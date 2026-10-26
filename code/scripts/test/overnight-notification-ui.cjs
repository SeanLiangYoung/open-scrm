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

function assertServiceProfile(env, service, rawPort) {
  const validPort = value => typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number(value) >= 1024 && Number(value) <= 65535 && ![5432, 6379].includes(Number(value));
  const reject = () => { throw new Error('Refusing notification verification service without a valid disposable profile'); };
  if (env.NOTIFICATION_UI_DISPOSABLE !== '1' || !['auth-service', 'message-service', 'gateway-service'].includes(service) ||
      env.DB_HOST !== '127.0.0.1' || env.REDIS_HOST !== '127.0.0.1' ||
      env.DB_USERNAME !== 'notification_ui_verify' || env.DB_USER !== 'notification_ui_verify' ||
      env.DB_DATABASE !== 'notification_ui' || env.DB_PASSWORD !== 'disposable_notification_ui_only' ||
      !validPort(env.DB_PORT) || !validPort(env.REDIS_PORT) || !validPort(rawPort) || env.DB_PORT === env.REDIS_PORT) reject();
  let allowed;
  try { allowed = JSON.parse(env.NOTIFICATION_ALLOWED_PORTS); } catch { reject(); }
  if (!Array.isArray(allowed) || allowed.length < 5 || !allowed.every(port => Number.isInteger(port) && validPort(String(port))) ||
      new Set(allowed).size !== allowed.length || ![env.DB_PORT, env.REDIS_PORT, rawPort].every(port => allowed.includes(Number(port))) ||
      [env.DB_PORT, env.REDIS_PORT].includes(rawPort)) reject();
  if (!env.NOTIFICATION_GUARD_LOG || !path.isAbsolute(env.NOTIFICATION_GUARD_LOG) ||
      path.basename(env.NOTIFICATION_GUARD_LOG) !== 'blocked-outbound.jsonl' ||
      !path.basename(path.dirname(env.NOTIFICATION_GUARD_LOG)).startsWith('open-scrm-notification-ui-') ||
      !fs.existsSync(env.NOTIFICATION_GUARD_LOG)) reject();
  return Number(rawPort);
}

if (require.main === module) { try {
if (process.argv[2] === '--service') {
  assertServiceProfile(process.env, process.argv[3], process.argv[4]);
  const allowedPorts = new Set(JSON.parse(process.env.NOTIFICATION_ALLOWED_PORTS));
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    let options = args[0]; if (Array.isArray(options)) options = options[0];
    const host = options && typeof options === 'object' ? options.host || 'localhost' : args[1];
    const port = options && typeof options === 'object' ? options.port : options;
    if (!['127.0.0.1', '::1'].includes(host) || !allowedPorts.has(Number(port))) {
      fs.appendFileSync(process.env.NOTIFICATION_GUARD_LOG, JSON.stringify({ host, port }) + '\n');
      throw new Error('Notification verification outbound connection blocked');
    }
    return connect.apply(this, args);
  };
  const dir = serviceRoot(process.argv[3]);
  const { Bootstrap } = createRequire(path.join(dir, 'package.json'))('@midwayjs/bootstrap');
  Bootstrap.configure({ appDir: dir, baseDir: path.join(dir, 'dist'), globalConfig: {
    koa: { port: Number(process.argv[4]), hostname: '127.0.0.1' },
  } }).run().catch(error => { console.error(error); process.exit(1); });
} else {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
} catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { assertServiceProfile };

async function main() {
  const runId = `${process.pid}-${Date.now()}`;
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-notification-ui-'));
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
    const id = command('docker', ['create', '--rm', '--name', `open-scrm-notification-ui-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=notification-ui', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
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
    const pg = container('postgres:16-alpine', 'pg', 5432, ['--env', 'POSTGRES_DB=notification_ui', '--env', 'POSTGRES_USER=notification_ui_verify', '--env', 'POSTGRES_PASSWORD=disposable_notification_ui_only']);
    const redis = container('redis:7-alpine', 'redis', 6379, []);
    await waitUntil(() => spawnSync('docker', ['exec', pg.id, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', 'notification_ui_verify', '-d', 'notification_ui']).status === 0, 'disposable PostgreSQL');
    await waitUntil(() => spawnSync('docker', ['exec', redis.id, 'redis-cli', 'ping']).status === 0, 'disposable Redis');
    const psql = sql => command('docker', ['exec', '-i', pg.id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'notification_ui_verify', '-d', 'notification_ui'], { input: sql });
    psql(fs.readFileSync(path.join(root, 'scripts/init-db.pg.sql'), 'utf8'));
    psql(`INSERT INTO "user" (id,corp_id,username,password,real_name,is_admin,status)
      SELECT f.id,f.corp_id,f.username,a.password,f.real_name,0,f.status
      FROM (VALUES (9203,1,'notify_peer','通知同事',1),(9204,902,'notify_foreign','外企通知同事',1),(9205,1,'notify_disabled','停用通知同事',0)) AS f(id,corp_id,username,real_name,status)
      CROSS JOIN "user" a WHERE a.corp_id=1 AND a.username='admin';
      INSERT INTO notification (id,corp_id,user_id,notification_type,title,content,is_read,expire_time)
      VALUES (92001,1,9203,1,'notification-foreign-boundary-fixture','Dedicated ownership fixture',0,NOW()+INTERVAL '1 day');`);
    const ports = { auth: await freePort(), message: await freePort(), gateway: await freePort(), vite: await freePort() };
    // Isolate every unused gateway dependency from project-local services. No successful
    // response is synthesized: unrelated dashboard requests receive explicit HTTP503.
    unavailableDependencies = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/__fixture/disable-notification-peer' && req.headers['x-fixture-key'] === runId) {
        try {
          psql('UPDATE "user" SET status=0 WHERE id=9203 AND corp_id=1');
          res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ changed: 1 }));
        } catch (error) {
          res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ message: error.message }));
        }
        return;
      }
      unavailableRequests.push({ method: req.method, path: req.url });
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 503, message: 'Unrelated dependency excluded from isolated notification UI verification' }));
    });
    await new Promise((resolve, reject) => { unavailableDependencies.once('error', reject); unavailableDependencies.listen(0, '127.0.0.1', resolve); });
    ports.unavailable = unavailableDependencies.address().port;
    const unusedEnv = Object.fromEntries(['OPERATION', 'ANALYTICS', 'ACQUISITION', 'ASSET', 'INTEGRATION', 'CUSTOMER', 'FINANCE', 'CONTENT_GENERATION'].map(name => [`${name}_SERVICE_URL`, `http://127.0.0.1:${ports.unavailable}`]));
    const guardLog = path.join(artifactDir, 'blocked-outbound.jsonl'); fs.writeFileSync(guardLog, '');
    const baseEnv = { ...process.env, ...unusedEnv, NOTIFICATION_UI_DISPOSABLE: '1', NOTIFICATION_GUARD_LOG: guardLog, NOTIFICATION_ALLOWED_PORTS: JSON.stringify([pg.port, redis.port, ...Object.values(ports)]), TZ: 'UTC', NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: String(pg.port),
      DB_USERNAME: 'notification_ui_verify', DB_USER: 'notification_ui_verify', DB_PASSWORD: 'disposable_notification_ui_only', DB_DATABASE: 'notification_ui',
      REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redis.port), REDIS_PASSWORD: '',
      JWT_SECRET: `disposable-notification-ui-jwt-${runId}`, APP_KEYS: `disposable-notification-ui-keys-${runId}`,
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
    const playwrightOutput = await asyncCommand(path.join(e2eDir, 'node_modules/.bin/playwright'), ['test', '--config', 'playwright.notification-ui.config.ts', '--reporter=line', '--output', path.join(artifactDir, 'playwright')], {
      cwd: e2eDir, env: { ...baseEnv, NOTIFICATION_UI_DISPOSABLE: '1', NOTIFICATION_UI_BASE_URL: `http://127.0.0.1:${ports.vite}`, NOTIFICATION_FIXTURE_URL: `http://127.0.0.1:${ports.unavailable}`, NOTIFICATION_FIXTURE_KEY: runId },
    });
    fs.writeFileSync(path.join(artifactDir, 'playwright-output.txt'), playwrightOutput + '\n');
    if (!/\b3 passed\b/.test(playwrightOutput) || /\d+ skipped/.test(playwrightOutput)) throw new Error(`Expected three executed passing browser tests: ${playwrightOutput}`);
    psql(`DO $$ BEGIN
      IF current_setting('server_version_num')::int / 10000 <> 16 THEN RAISE EXCEPTION 'Expected PostgreSQL16'; END IF;
      IF (SELECT COUNT(*) FROM notification) <> 2 THEN RAISE EXCEPTION 'Expected seed plus exactly one UI-created notification'; END IF;
      IF (SELECT COUNT(*) FROM notification WHERE title='overnight-notification-peer' AND corp_id=1 AND user_id=9203 AND is_read=1 AND content='真实同事通知正文') <> 1 THEN RAISE EXCEPTION 'Expected peer receipt/read persisted'; END IF;
      IF (SELECT COUNT(*) FROM notification WHERE id=92001 AND corp_id=1 AND user_id=9203 AND is_read=0) <> 1 THEN RAISE EXCEPTION 'Foreign read attempt must preserve original notification'; END IF;
      IF (SELECT COUNT(*) FROM notification WHERE title='overnight-notification-disabled-draft') <> 0 THEN RAISE EXCEPTION 'Disabled recipient rejection must not insert'; END IF;
      IF (SELECT status FROM "user" WHERE id=9203) <> 0 THEN RAISE EXCEPTION 'Expected status change after directory selection'; END IF;
      IF (SELECT COUNT(*) FROM message_log) <> 0 THEN RAISE EXCEPTION 'No provider message log permitted'; END IF;
    END $$;`);
    assert(!unavailableRequests.some(item => /\/api\/message|\/messages\//.test(item.path)), 'Notification UI must never invoke provider messaging');
    assert.equal(fs.readFileSync(guardLog, 'utf8'), '', 'No outbound connection outside owned resources');
    outcome.unavailableDependencies = unavailableRequests;
    console.log('PASS: actual Chromium notification UI 3 passed, PostgreSQL16 recipient/read/isolation assertions, zero provider messages');
    const evidence = psql('SELECT version(); SELECT id,corp_id,user_id,title,content,is_read FROM notification ORDER BY id; SELECT id,corp_id,username,status FROM "user" WHERE id IN (9203,9204,9205) ORDER BY id; SELECT COUNT(*) AS message_count FROM message_log;');
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
