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
  const validPort = value => Number.isSafeInteger(Number(value)) && Number(value) > 1024 && Number(value) <= 65535;
  const allowedServices = ['auth-service', 'message-service', 'gateway-service'];
  if (process.env.MESSAGE_LOGS_CHILD_DISPOSABLE !== '1' ||
    process.env.DB_HOST !== '127.0.0.1' || process.env.REDIS_HOST !== '127.0.0.1' ||
    process.env.DB_USERNAME !== 'message_logs_ui_verify' || process.env.DB_USER !== 'message_logs_ui_verify' ||
    process.env.DB_DATABASE !== 'message_logs_ui' || process.env.DB_PASSWORD !== 'disposable_message_logs_ui_only' ||
    !validPort(process.env.DB_PORT) || Number(process.env.DB_PORT) === 5432 ||
    !validPort(process.env.REDIS_PORT) || Number(process.env.REDIS_PORT) === 6379 ||
    !validPort(process.argv[4]) || !allowedServices.includes(process.argv[3])) {
    throw new Error('Refusing service startup without owned disposable message logs UI profile');
  }
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
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-message-logs-ui-'));
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
      child.once('exit', code => code === 0 ? resolve(output) : reject(new Error(`Browser runner failed (${code}):\n${output}`)));
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
    const id = command('docker', ['create', '--rm', '--name', `open-scrm-message-logs-ui-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=message-logs-ui', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
    ownedContainers.push(id);
    command('docker', ['start', id]);
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
    const pg = container('postgres:16-alpine', 'pg', 5432, ['--env', 'POSTGRES_DB=message_logs_ui', '--env', 'POSTGRES_USER=message_logs_ui_verify', '--env', 'POSTGRES_PASSWORD=disposable_message_logs_ui_only']);
    const redis = container('redis:7-alpine', 'redis', 6379, []);
    await waitUntil(() => spawnSync('docker', ['exec', pg.id, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', 'message_logs_ui_verify', '-d', 'message_logs_ui']).status === 0, 'disposable PostgreSQL');
    await waitUntil(() => spawnSync('docker', ['exec', redis.id, 'redis-cli', 'ping']).status === 0, 'disposable Redis');
    const psql = sql => command('docker', ['exec', '-i', pg.id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'message_logs_ui_verify', '-d', 'message_logs_ui'], { input: sql });
    psql(fs.readFileSync(path.join(root, 'scripts/init-db.pg.sql'), 'utf8'));
    psql(`INSERT INTO "user" (id,corp_id,username,password,real_name,is_admin,status)
      SELECT f.id,f.corp_id,f.username,a.password,f.username,0,1 FROM
      (VALUES (12101,1201,'logoperatora'),(12102,1202,'logoperatorb')) AS f(id,corp_id,username)
      CROSS JOIN "user" a WHERE a.corp_id=1 AND a.username='admin';
      INSERT INTO message_log (id,corp_id,message_type,target_type,target_id,content,send_status,fail_reason,retry_count,send_time) VALUES
      (62001,1201,5,1,9301,'日志A失败模拟',2,'原模拟失败原因',0,NULL),
      (62002,1201,5,1,9301,'日志A成功模拟',1,NULL,1,'2026-10-25 01:00:00'),
      (62003,1201,5,1,9301,'日志A待处理',0,NULL,0,NULL),
      (62004,1201,3,1,9301,'日志A未接通短信',2,'原短信失败原因',0,NULL),
      (62005,1201,5,1,9301,'跨企保护的A模拟',2,'原跨企保护原因',0,NULL),
      (62006,1202,5,1,9302,'日志B失败模拟',2,'B失败原因',0,NULL);`);
    const ports = { auth: await freePort(), message: await freePort(), gateway: await freePort(), vite: await freePort() };
    // Isolate every unused gateway dependency from project-local services. No successful
    // response is synthesized: unrelated dashboard requests receive explicit HTTP503.
    unavailableDependencies = http.createServer((req, res) => {
      unavailableRequests.push({ method: req.method, path: req.url });
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 503, message: 'Unrelated dependency excluded from isolated message logs UI verification' }));
    });
    await new Promise((resolve, reject) => { unavailableDependencies.once('error', reject); unavailableDependencies.listen(0, '127.0.0.1', resolve); });
    ports.unavailable = unavailableDependencies.address().port;
    const unusedEnv = Object.fromEntries(['OPERATION', 'ANALYTICS', 'ACQUISITION', 'ASSET', 'INTEGRATION', 'CUSTOMER', 'FINANCE', 'CONTENT_GENERATION'].map(name => [`${name}_SERVICE_URL`, `http://127.0.0.1:${ports.unavailable}`]));
    const baseEnv = { ...process.env, ...unusedEnv, MESSAGE_LOGS_CHILD_DISPOSABLE: '1', TZ: 'UTC', NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: String(pg.port),
      DB_USERNAME: 'message_logs_ui_verify', DB_USER: 'message_logs_ui_verify', DB_PASSWORD: 'disposable_message_logs_ui_only', DB_DATABASE: 'message_logs_ui',
      REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redis.port), REDIS_PASSWORD: '',
      JWT_SECRET: `disposable-message-logs-ui-jwt-${runId}`, APP_KEYS: `disposable-message-logs-ui-keys-${runId}`,
      AUTH_SERVICE_URL: `http://127.0.0.1:${ports.auth}`, MESSAGE_SERVICE_URL: `http://127.0.0.1:${ports.message}`,
      HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '', http_proxy: '', https_proxy: '', all_proxy: '', NO_PROXY: '127.0.0.1,localhost',
    };
    for (const [name, port] of [['auth-service', ports.auth], ['message-service', ports.message], ['gateway-service', ports.gateway]]) {
      const dir = serviceRoot(name);
      console.log(`Build/start ${name} on free loopback port ${port}`);
      command(path.join(dir, 'node_modules/.bin/mw'), ['build'], { cwd: dir, env: baseEnv });
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
    const frontendDir = path.join(root, 'apps/operation-platform');
    const viteLog = fs.openSync(path.join(artifactDir, 'vite.log'), 'w');
    logs.push(viteLog);
    const vite = spawn(process.execPath, [path.join(frontendDir, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(ports.vite), '--strictPort'], {
      cwd: frontendDir, env: { ...baseEnv, NODE_ENV: 'development', VITE_GATEWAY_URL: `http://127.0.0.1:${ports.gateway}` }, stdio: ['ignore', viteLog, viteLog],
    });
    children.push(vite);
    await waitUntil(async () => {
      if (vite.exitCode !== null) throw new Error(`Vite exited ${vite.exitCode}: ${fs.readFileSync(path.join(artifactDir, 'vite.log'), 'utf8')}`);
      return (await fetch(`http://127.0.0.1:${ports.vite}/login`, { signal: AbortSignal.timeout(1000) })).ok;
    }, 'isolated Vite HTTP');
    const e2eDir = path.join(root, 'e2e');
    const playwrightOutput = await asyncCommand(path.join(e2eDir, 'node_modules/.bin/playwright'), ['test', '--config', 'playwright.message-logs-ui.config.ts', '--reporter=line', '--output', path.join(artifactDir, 'playwright')], {
      cwd: e2eDir, env: { ...baseEnv, MESSAGE_LOGS_UI_DISPOSABLE: '1', MESSAGE_LOGS_UI_BASE_URL: `http://127.0.0.1:${ports.vite}` },
    });
    fs.writeFileSync(path.join(artifactDir, 'playwright-output.txt'), playwrightOutput + '\n');
    if (!/\b4 passed\b/.test(playwrightOutput) || /\d+ skipped/.test(playwrightOutput)) throw new Error(`Expected four passing browser tests: ${playwrightOutput}`);
    psql(`DO $$ BEGIN
      IF (SELECT COUNT(*) FROM message_log) <> 6 THEN RAISE EXCEPTION 'Unexpected new message rows'; END IF;
      IF (SELECT COUNT(*) FROM message_log WHERE id=62001 AND corp_id=1201 AND message_type=5 AND send_status=1 AND retry_count=1 AND send_time IS NOT NULL AND content='日志A失败模拟') <> 1 THEN RAISE EXCEPTION 'Mock retry mismatch'; END IF;
      IF (SELECT COUNT(*) FROM message_log WHERE id=62002 AND send_status=1 AND retry_count=1 AND send_time='2026-10-25 01:00:00') <> 1 THEN RAISE EXCEPTION 'Successful row changed'; END IF;
      IF (SELECT COUNT(*) FROM message_log WHERE id=62003 AND send_status=0 AND retry_count=0) <> 1 THEN RAISE EXCEPTION 'Pending row changed'; END IF;
      IF (SELECT COUNT(*) FROM message_log WHERE id=62004 AND corp_id=1201 AND message_type=3 AND send_status=2 AND retry_count=1 AND fail_reason LIKE '%尚未接通%' AND content='日志A未接通短信') <> 1 THEN RAISE EXCEPTION 'Unsupported retry mismatch'; END IF;
      IF (SELECT COUNT(*) FROM message_log WHERE id IN (62005,62006) AND send_status=2 AND retry_count=0) <> 2 THEN RAISE EXCEPTION 'Tenant rows changed'; END IF;
    END $$;`);
    outcome.unavailableDependencies = unavailableRequests;
    const evidence = psql('SELECT version(); SELECT id,corp_id,message_type,content,send_status,retry_count,fail_reason,send_time FROM message_log ORDER BY id;');
    fs.writeFileSync(path.join(artifactDir, 'database-evidence.txt'), evidence + '\n');
    console.log('PASS: real Chromium message logs UI 4 passed with PostgreSQL ownership/retry assertions; only Mock succeeded.');
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
