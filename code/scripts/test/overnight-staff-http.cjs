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
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-staff-http-'));
  const ownedContainers = [];
  const children = [];
  const logs = [];
  let unavailableDependencies;
  const unavailableRequests = [];
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
      child.once('error', reject);
      child.once('exit', code => code === 0 ? resolve(output) : reject(new Error(`HTTP runner failed (${code}):\n${output}`)));
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
      if (unavailableDependencies) {
        unavailableDependencies.closeAllConnections();
        await new Promise(resolve => unavailableDependencies.close(resolve));
        if (unavailableDependencies.listening) errors.push('Dependency isolation listener remains open');
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
    const id = command('docker', ['run', '--rm', '--detach', '--name', `open-scrm-staff-http-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=staff-http', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
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
    const pg = container('postgres:16-alpine', 'pg', 5432, ['--env', 'POSTGRES_DB=staff_http', '--env', 'POSTGRES_USER=staff_http_verify', '--env', 'POSTGRES_PASSWORD=disposable_staff_http_only']);
    const redis = container('redis:7-alpine', 'redis', 6379, []);
    await waitUntil(() => spawnSync('docker', ['exec', pg.id, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', 'staff_http_verify', '-d', 'staff_http']).status === 0, 'disposable PostgreSQL');
    await waitUntil(() => spawnSync('docker', ['exec', redis.id, 'redis-cli', 'ping']).status === 0, 'disposable Redis');
    const psql = sql => command('docker', ['exec', '-i', pg.id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'staff_http_verify', '-d', 'staff_http'], { input: sql });
    psql(fs.readFileSync(path.join(root, 'scripts/init-db.pg.sql'), 'utf8'));
    psql(`INSERT INTO "user" (id,corp_id,username,password,real_name,mobile,email,is_admin,status)
      SELECT f.id,f.corp_id,f.username,a.password,f.real_name,'13800009999','private@example.invalid',0,f.status
      FROM (VALUES
        (9201,901,'staffoperatora','甲运营',1),
        (9203,901,'shared','甲同名员工',1),
        (9204,901,'percent%mark','甲百分',1),
        (9209,901,'under_mark','甲下划线',1),
        (9210,901,'slash' || chr(92) || 'mark','甲反斜线',1),
        (9007199254740993,901,'largemember',NULL,1),
        (9211,901,'plainalpha','MixedCASE Label',1),
        (9205,901,'disableda','甲停用',0),
        (9202,902,'staffoperatorb','乙运营',1),
        (9206,902,'shared','乙同名员工',1),
        (9207,902,'percent%mark','乙百分',1),
        (9208,902,'disabledb','乙停用',0)
      ) AS f(id,corp_id,username,real_name,status)
      CROSS JOIN "user" a WHERE a.corp_id=1 AND a.username='admin';`);
    const ports = { auth: await freePort(), message: await freePort(), gateway: await freePort() };
    // Isolate every unused gateway dependency from project-local services. No successful
    // response is synthesized: unrelated dashboard requests receive explicit HTTP503.
    unavailableDependencies = http.createServer((req, res) => {
      unavailableRequests.push({ method: req.method, path: req.url });
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 503, message: 'Unrelated dependency excluded from isolated customer UI verification' }));
    });
    await new Promise((resolve, reject) => { unavailableDependencies.once('error', reject); unavailableDependencies.listen(0, '127.0.0.1', resolve); });
    ports.unavailable = unavailableDependencies.address().port;
    const unusedEnv = Object.fromEntries(['OPERATION', 'ANALYTICS', 'ACQUISITION', 'ASSET', 'INTEGRATION', 'CUSTOMER', 'FINANCE', 'CONTENT_GENERATION'].map(name => [`${name}_SERVICE_URL`, `http://127.0.0.1:${ports.unavailable}`]));
    const baseEnv = { ...process.env, ...unusedEnv, TZ: 'UTC', NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: String(pg.port),
      DB_USERNAME: 'staff_http_verify', DB_USER: 'staff_http_verify', DB_PASSWORD: 'disposable_staff_http_only', DB_DATABASE: 'staff_http',
      REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redis.port), REDIS_PASSWORD: '',
      JWT_SECRET: `disposable-staff-http-jwt-${runId}`, APP_KEYS: `disposable-staff-http-keys-${runId}`,
      AUTH_SERVICE_URL: `http://127.0.0.1:${ports.auth}`, MESSAGE_SERVICE_URL: `http://127.0.0.1:${ports.message}`,
      HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '', http_proxy: '', https_proxy: '', all_proxy: '', NO_PROXY: '127.0.0.1,localhost',
    };
    for (const [name, port] of [['auth-service', ports.auth], ['message-service', ports.message], ['gateway-service', ports.gateway]]) {
      const dir = serviceRoot(name);
      console.log(`Build/start ${name} on free loopback port ${port}`);
      assert.equal(command('git', ['ls-files', '--', path.join(dir, 'dist')], { cwd: root }), '', 'Clean build must not remove tracked files');
      command('git', ['check-ignore', path.join(dir, 'dist')], { cwd: root });
      command(path.join(dir, 'node_modules/.bin/mw'), ['build', '--clean'], { cwd: dir, env: baseEnv });
      const fd = fs.openSync(path.join(artifactDir, `${name}.log`), 'w');
      logs.push(fd);
      const child = spawn(process.execPath, [__filename, '--service', name, String(port)], { cwd: dir, env: baseEnv, stdio: ['ignore', fd, fd] });
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
    const playwrightOutput = await asyncCommand(path.join(e2eDir, 'node_modules/.bin/playwright'), ['test', '--config', 'playwright.staff-http.config.ts', '--reporter=line', '--output', path.join(artifactDir, 'playwright')], {
      cwd: e2eDir, env: { ...baseEnv, STAFF_HTTP_DISPOSABLE: '1', GATEWAY_URL: `http://127.0.0.1:${ports.gateway}` },
    });
    fs.writeFileSync(path.join(artifactDir, 'playwright-output.txt'), playwrightOutput + '\n');
    if (!/\b4 passed\b/.test(playwrightOutput) || /\d+ skipped/.test(playwrightOutput)) throw new Error(`Expected four executed passing HTTP tests: ${playwrightOutput}`);
    psql(`DO $$ BEGIN
      IF current_setting('server_version_num')::int / 10000 <> 16 THEN RAISE EXCEPTION 'Expected PostgreSQL16'; END IF;
      IF (SELECT COUNT(*) FROM "user" WHERE corp_id=901 AND status=1) <> 7 OR (SELECT COUNT(*) FROM "user" WHERE corp_id=902 AND status=1) <> 3
        THEN RAISE EXCEPTION 'Expected unchanged active employee fixture counts'; END IF;
      IF (SELECT COUNT(*) FROM notification) <> 3 THEN RAISE EXCEPTION 'Expected exactly three deduplicated valid notifications'; END IF;
      IF (SELECT COUNT(*) FROM notification WHERE title='staff-http-invalid') <> 0 THEN RAISE EXCEPTION 'Rejected notifications must not leave partial writes'; END IF;
      IF (SELECT COUNT(*) FROM notification WHERE corp_id=901 AND user_id IN (9201,9203) AND title='staff-http-valid') <> 2
        THEN RAISE EXCEPTION 'Expected exactly two company A notifications'; END IF;
      IF (SELECT COUNT(*) FROM notification WHERE corp_id=902 AND user_id=9202 AND title='staff-http-valid') <> 1
        THEN RAISE EXCEPTION 'Expected exactly one company B notification'; END IF;
      IF (SELECT COUNT(*) FROM message_log) <> 0 THEN RAISE EXCEPTION 'No outbound message is allowed'; END IF;
    END $$;`);
    assert.equal(unavailableRequests.length, 0, 'Staff/notification workflow must not call excluded services');
    outcome.unavailableDependencies = unavailableRequests;
    console.log('PASS: staff gateway HTTP 4 passed, two ordinary company logins, exact public fields and recipient transaction checks');
    const evidence = psql("SELECT version(); SELECT id,corp_id,username,real_name,status FROM \"user\" WHERE corp_id IN(901,902) ORDER BY corp_id,username,id; SELECT corp_id,user_id,title FROM notification ORDER BY corp_id,user_id; SELECT COUNT(*) AS message_count FROM message_log;");
    console.log(evidence);
    fs.writeFileSync(path.join(artifactDir, 'database-evidence.txt'), evidence + '\n');
    testPassed = true;
  } catch (error) {
    outcome.error = error.message;
    outcome.unavailableDependencies = unavailableRequests;
    for (const name of ['auth-service', 'message-service', 'gateway-service']) {
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
