'use strict';
// Disposable HTTP integration harness. No connection to an existing project database.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const serviceRoot = name => path.join(root, 'services', name);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

if (process.argv[2] === '--service') {
  const dir = serviceRoot(process.argv[3]);
  const { Bootstrap } = createRequire(path.join(dir, 'package.json'))('@midwayjs/bootstrap');
  Bootstrap.configure({ appDir: dir, baseDir: path.join(dir, 'dist'), globalConfig: {
    koa: { port: Number(process.argv[4]), hostname: '127.0.0.1' },
  } }).run().catch(error => { console.error(error); process.exit(1); });
} else {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}

async function main() {
  const runId = `${process.pid}-${Date.now()}`;
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-operation-http-'));
  const ownedContainers = [];
  const children = [];
  const logs = [];
  let messageGuard;
  const forwarded = [];
  const denied = [];
  const injected = [];
  let cleanupPromise;
  let testPassed = false;
  const outcome = { artifactDir };
  function command(executable, args, options = {}) {
    const result = spawnSync(executable, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options });
    if (result.status !== 0) throw new Error(`${executable} ${args.join(' ')} failed\n${result.stdout || ''}\n${result.stderr || ''}`);
    return result.stdout.trim();
  }
  function asyncCommand(executable, args, options) {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
      children.push(child);
      let output = '';
      child.stdout.on('data', data => { output += data; });
      child.stderr.on('data', data => { output += data; });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve(output) : reject(new Error(`Test runner failed (${code}):\n${output}`)));
    });
  }
  function cleanup() {
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      const errors = [];
      const exited = child => child.exitCode !== null || child.signalCode !== null;
      for (const child of children) if (!exited(child)) child.kill('SIGTERM');
      for (let i = 0; i < 20 && children.some(child => !exited(child)); i++) await pause(100);
      for (const child of children) if (!exited(child)) child.kill('SIGKILL');
      for (let i = 0; i < 30 && children.some(child => !exited(child)); i++) await pause(100);
      for (const child of children) if (!exited(child)) errors.push(`Owned service process ${child.pid} did not exit`);
      for (const id of [...ownedContainers].reverse()) {
        const removed = spawnSync('docker', ['rm', '-f', id], { encoding: 'utf8' });
        if (removed.status !== 0) errors.push(`Container removal failed: ${id}: ${removed.stderr || removed.error || removed.status}`);
        const inspected = spawnSync('docker', ['ps', '-a', '--no-trunc', '--filter', `id=${id}`, '--format', '{{.ID}}'], { encoding: 'utf8' });
        if (inspected.status !== 0) errors.push(`Cannot verify container absence: ${id}: ${inspected.stderr || inspected.error || inspected.status}`);
        else if (inspected.stdout.trim()) errors.push(`Owned container still exists: ${id}`);
      }
      if (messageGuard) {
        messageGuard.closeAllConnections();
        await new Promise(resolve => messageGuard.close(resolve));
        if (messageGuard.listening) errors.push('Message guard remains listening');
      }
      for (const fd of logs) {
        try { fs.closeSync(fd); } catch (error) { errors.push(`Log close failed: ${error.message}`); }
      }
      return { passed: errors.length === 0, errors, childPids: children.map(child => child.pid), containerIds: ownedContainers };
    })();
    return cleanupPromise;
  }
  function saveOutcome(cleanupResult, extra = {}) {
    fs.writeFileSync(path.join(artifactDir, 'result.json'), JSON.stringify({ ...outcome, ...extra,
      testsPassed: testPassed, cleanup: cleanupResult, passed: testPassed && cleanupResult.passed && !extra.signal,
    }, null, 2));
  }
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
    const cleanupResult = await cleanup();
    saveOutcome(cleanupResult, { signal });
    process.exit(signal === 'SIGINT' ? 130 : 143);
  });
  async function freePort() {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
    });
  }
  function container(image, suffix, internalPort, extra) {
    command('docker', ['image', 'inspect', image]);
    const id = command('docker', ['run', '--rm', '--detach', '--name', `open-scrm-operation-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=operation-http', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
    ownedContainers.push(id);
    const bindings = JSON.parse(command('docker', ['inspect', id]))[0].NetworkSettings.Ports[`${internalPort}/tcp`];
    return { id, port: Number(bindings[0].HostPort) };
  }
  async function waitUntil(check, description) {
    let last;
    for (let i = 0; i < 60; i++) {
      try { if (await check()) return; } catch (error) { last = error; }
      await pause(500);
    }
    throw new Error(`Timeout waiting for ${description}: ${last || ''}`);
  }
  console.log(`Artifacts: ${artifactDir}`);
  try {
    const pg = container('postgres:16-alpine', 'pg', 5432, ['--env', 'POSTGRES_DB=operation_http', '--env', 'POSTGRES_USER=operation_verify', '--env', 'POSTGRES_PASSWORD=disposable_operation_only']);
    const redis = container('redis:7-alpine', 'redis', 6379, []);
    await waitUntil(() => spawnSync('docker', ['exec', pg.id, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', 'operation_verify', '-d', 'operation_http']).status === 0, 'disposable PostgreSQL');
    await waitUntil(() => spawnSync('docker', ['exec', redis.id, 'redis-cli', 'ping']).status === 0, 'disposable Redis');
    const psql = sql => command('docker', ['exec', '-i', pg.id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'operation_verify', '-d', 'operation_http'], { input: sql });
    psql(fs.readFileSync(path.join(root, 'scripts/init-db.pg.sql'), 'utf8'));
    psql(`
      INSERT INTO customer (id, corp_id, external_userid, name) VALUES
        (9001, 1, 'operation-http-only', 'Disposable lifecycle fixture'),
        (9002, 2, 'operation-http-company-b', 'Disposable company B fixture'),
        (9003, 1, 'operation-http-company-a', 'Disposable company A isolation fixture');
      INSERT INTO "user" (id, corp_id, username, password, real_name, is_admin, status)
        SELECT 9002, 2, 'operation_other', password, 'Disposable company B user', 0, 1
        FROM "user" WHERE corp_id=1 AND username='admin';
    `);
    const ports = { auth: await freePort(), message: await freePort(), operation: await freePort(), gateway: await freePort() };
    // Independent hard guard: no omitted/default/non-Mock message can reach the real sender.
    messageGuard = http.createServer(async (req, res) => {
      try {
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (raw.length > 65536) throw new Error('Oversize body'); }
        const body = JSON.parse(raw);
        const targetId = Number(body.targetIds);
        const validTarget = ['number','string'].includes(typeof body.targetIds) && /^[1-9]\d*$/.test(String(body.targetIds)) && Number.isSafeInteger(targetId);
        if (req.method !== 'POST' || !['/api/v1/messages/send', '/api/message/send'].includes(req.url) ||
          body.messageType !== 5 || !validTarget || !((body.targetType === 1 && [9001,9003].includes(targetId)) || (body.targetType === 3 && targetId === 9004)) || req.headers['x-corp-id'] !== '1') {
          denied.push({ path: req.url, body });
          res.writeHead(403, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Only dedicated fixture Mock sends allowed' }));
          return;
        }
        if (body.content === 'HTTP SOP MOCK reported failure') {
          injected.push({ path: req.url, body });
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: { total: 1, success: 0, failed: 1, details: [{ targetId, success: false, error: 'Injected Mock downstream failure' }] } }));
          return;
        }
        const headers = { 'content-type': 'application/json', 'x-corp-id': req.headers['x-corp-id'], 'x-user-id': req.headers['x-user-id'] };
        if (req.headers['idempotency-key']) headers['idempotency-key'] = req.headers['idempotency-key'];
        forwarded.push({ path: req.url, body, headers });
        const response = await fetch(`http://127.0.0.1:${ports.message}${req.url}`, {
          method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
        });
        res.writeHead(response.status, { 'content-type': 'application/json' });
        res.end(await response.text());
      } catch (error) {
        denied.push({ path: req.url, error: error.message });
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: error.message }));
      }
    });
    await new Promise((resolve, reject) => { messageGuard.once('error', reject); messageGuard.listen(0, '127.0.0.1', resolve); });
    ports.messageGuard = messageGuard.address().port;
    const baseEnv = { ...process.env, NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: String(pg.port),
      DB_USERNAME: 'operation_verify', DB_USER: 'operation_verify', DB_PASSWORD: 'disposable_operation_only', DB_DATABASE: 'operation_http',
      REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redis.port), REDIS_PASSWORD: '',
      JWT_SECRET: `disposable-operation-jwt-${runId}`, APP_KEYS: `disposable-operation-keys-${runId}`,
      AUTH_SERVICE_URL: `http://127.0.0.1:${ports.auth}`, MESSAGE_SERVICE_URL: `http://127.0.0.1:${ports.message}`,
      OPERATION_SERVICE_URL: `http://127.0.0.1:${ports.operation}`,
      HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '', http_proxy: '', https_proxy: '', all_proxy: '', NO_PROXY: '127.0.0.1,localhost',
    };
    for (const [name, port] of [['auth-service', ports.auth], ['message-service', ports.message], ['operation-service', ports.operation], ['gateway-service', ports.gateway]]) {
      const dir = serviceRoot(name);
      console.log(`Build/start ${name} on free loopback port ${port}`);
      command(path.join(dir, 'node_modules/.bin/mw'), ['build', '--clean'], { cwd: dir, env: baseEnv });
      if (name === 'operation-service') {
        const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
          const file = path.join(folder, entry.name);
          return entry.isDirectory() ? walk(file) : [file];
        });
        assert.deepEqual(walk(path.join(dir, 'dist')).filter(file => /\.spec\.js$/.test(file)), [], 'Production dist must not contain executable tests');
        const operationRequire = createRequire(path.join(dir, 'package.json'));
        const { DataSource } = operationRequire('typeorm');
        const entities = ['mass-task', 'sop-execution', 'sop-step', 'sop-template'].flatMap(file => Object.values(require(path.join(dir, 'dist/entity', `${file}.entity.js`))).filter(value => typeof value === 'function'));
        const metadataDb = new DataSource({ type: 'postgres', host: '127.0.0.1', port: pg.port,
          username: 'operation_verify', password: 'disposable_operation_only', database: 'operation_http', entities, synchronize: false });
        try {
          await metadataDb.initialize();
          assert.equal(metadataDb.entityMetadatas.length, 4);
          const [version] = await metadataDb.query("SELECT current_setting('server_version_num')::int AS version");
          assert.equal(Math.floor(version.version / 10000), 16);
          outcome.postgresMetadata = metadataDb.entityMetadatas.map(entity => ({ table: entity.tableName, columns: entity.columns.map(column => ({ name: column.databaseName, type: column.type })) }));
          console.log('Verified: all 4 operation entities initialize on PostgreSQL16; production dist excludes specs');
        } finally { if (metadataDb.isInitialized) await metadataDb.destroy(); }
      }

      const fd = fs.openSync(path.join(artifactDir, `${name}.log`), 'w');
      logs.push(fd);
      const child = spawn(process.execPath, [__filename, '--service', name, String(port)], { cwd: dir, env: { ...baseEnv, ...(name === 'operation-service' ? { MESSAGE_SERVICE_URL: `http://127.0.0.1:${ports.messageGuard}` } : {}) }, stdio: ['ignore', fd, fd] });
      children.push(child);
      await waitUntil(async () => {
        if (child.exitCode !== null) throw new Error(`${name} exited ${child.exitCode}: ${fs.readFileSync(path.join(artifactDir, `${name}.log`), 'utf8').slice(-5000)}`);
        const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) });
        return response.ok;
      }, `${name} HTTP health`);
    }
    Object.assign(outcome, { ports, pgPort: pg.port, redisPort: redis.port });
    console.log(JSON.stringify({ stage: 'isolated-services-ready', pgPort: pg.port, redisPort: redis.port, ports }));
    const e2eDir = path.join(root, 'e2e');
    const playwrightOutput = await asyncCommand(path.join(e2eDir, 'node_modules/.bin/playwright'), ['test', '--config', 'playwright.operation-http.config.ts', '--reporter=line', '--output', path.join(artifactDir, 'playwright')], {
      cwd: e2eDir, env: { ...baseEnv, OPERATION_HTTP_DISPOSABLE: '1', GATEWAY_URL: `http://127.0.0.1:${ports.gateway}` },
    });
    fs.writeFileSync(path.join(artifactDir, 'playwright-output.txt'), playwrightOutput + '\n');
    if (!/5 passed/.test(playwrightOutput) || /\d+ skipped/.test(playwrightOutput)) throw new Error(`Expected five executed passing tests: ${playwrightOutput}`);
    assert.equal(injected.length, 1, 'Expected exactly one controlled HTTP200 failed-count response');
    assert.equal(denied.length, 0, `Unsafe/unexpected send attempts: ${JSON.stringify(denied)}`);
    assert.equal(forwarded.length, 5, 'Expected two mass task + one customer SOP + two group SOP Mock dispatches');
    assert.equal(forwarded.filter(item => item.body.targetType === 3 && Number(item.body.targetIds) === 9004).length, 2);
    assert.equal(forwarded.filter(item => item.path === '/api/v1/messages/send').length, 2);
    assert.equal(forwarded.filter(item => item.path === '/api/message/send').length, 3);
    outcome.mockDispatches = forwarded;
    outcome.injectedResponses = injected;
    psql(`DO $$ BEGIN
      IF current_setting('server_version_num')::int / 10000 <> 16 THEN RAISE EXCEPTION 'Expected PostgreSQL16'; END IF;
      IF (SELECT COUNT(*) FROM mass_task WHERE task_name='overnight-operation-mock' AND status=2 AND success_count=2 AND fail_count=0 AND message_type=5) <> 1
        THEN RAISE EXCEPTION 'Expected successful Mock mass task'; END IF;
      IF (SELECT COUNT(*) FROM sop_execution WHERE template_name='overnight-immediate-mock' AND status=1 AND current_step=1) <> 1
        THEN RAISE EXCEPTION 'Expected completed immediate SOP'; END IF;
      IF (SELECT COUNT(*) FROM sop_execution WHERE template_name='overnight-control-mock' AND status=3 AND current_step=0) <> 1
        THEN RAISE EXCEPTION 'Expected cancelled delayed SOP without progress'; END IF;
      IF (SELECT COUNT(*) FROM sop_execution WHERE template_name='overnight-group-mock' AND target_type=2 AND group_id=9004 AND status=1 AND current_step=2) <> 1 THEN RAISE EXCEPTION 'Expected completed group SOP'; END IF;
      IF (SELECT COUNT(*) FROM message_log WHERE target_id=9004 AND target_type=3 AND corp_id=1 AND message_type=5 AND send_status=1) <> 2 THEN RAISE EXCEPTION 'Expected exactly two Mock group logs with message targetType3'; END IF;
      IF (SELECT COUNT(*) FROM sop_execution WHERE template_name='overnight-failed-mock' AND status=3 AND current_step=0 AND execution_log->0->>'status'='failed') <> 1 THEN RAISE EXCEPTION 'Expected downstream failure recorded without progress'; END IF;
      IF (SELECT COUNT(*) FROM message_log) <> 5 THEN RAISE EXCEPTION 'Expected exactly five total message logs'; END IF;
      IF (SELECT COUNT(*) FROM message_log WHERE target_id IN (9001,9003)) <> 3
        THEN RAISE EXCEPTION 'Expected exactly three message logs'; END IF;
      IF (SELECT COUNT(*) FROM message_log WHERE target_id IN (9001,9003) AND corp_id=1 AND message_type=5 AND send_status=1) <> 3
        THEN RAISE EXCEPTION 'Expected exactly three correctly owned successful Mock logs'; END IF;
    END $$;`);
    const evidence = psql("SELECT version(); SELECT task_name,status,success_count,fail_count,message_type FROM mass_task WHERE task_name='overnight-operation-mock'; SELECT template_name,status,current_step FROM sop_execution ORDER BY id; SELECT corp_id,message_type,target_type,send_status,target_id FROM message_log WHERE target_id IN (9001,9003,9004) ORDER BY id;");
    console.log('PASS: operation HTTP Playwright 5 passed, exact PG16 database assertions, 5 Mock-only dispatches and one controlled failure');
    console.log(evidence);
    fs.writeFileSync(path.join(artifactDir, 'database-evidence.txt'), evidence + '\n');
    testPassed = true;
  } catch (error) {
    outcome.error = error.message;
    outcome.mockDispatches = forwarded;
    outcome.injectedResponses = injected;
    outcome.deniedDispatches = denied;
    for (const name of ['auth-service', 'message-service', 'operation-service', 'gateway-service']) {
      const file = path.join(artifactDir, `${name}.log`);
      if (fs.existsSync(file)) console.error(`${name} log tail:\n${fs.readFileSync(file, 'utf8').slice(-5000)}`);
    }
    throw error;
  } finally {
    const cleanupResult = await cleanup();
    saveOutcome(cleanupResult);
    if (!cleanupResult.passed) throw new Error(`Cleanup verification failed: ${cleanupResult.errors.join('; ')}`);
    console.log('Verified: owned service processes exited and disposable containers are absent.');
  }
}
