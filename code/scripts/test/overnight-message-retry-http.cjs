'use strict';
// Disposable HTTP integration harness. No connection to an existing project database.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
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
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-message-retry-http-'));
  const ownedContainers = [];
  const children = [];
  const logs = [];
  let cleanupPromise;
  let testPassed = false;
  const outcome = { artifactDir };
  function command(executable, args, options = {}) {
    const result = spawnSync(executable, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options });
    if (result.status !== 0) throw new Error(`${executable} ${args.join(' ')} failed\n${result.stdout || ''}\n${result.stderr || ''}`);
    return result.stdout.trim();
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
    const id = command('docker', ['run', '--rm', '--detach', '--name', `open-scrm-message-retry-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=message-retry-http', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
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
    const pg = container('postgres:16-alpine', 'pg', 5432, ['--env', 'POSTGRES_DB=consent_http', '--env', 'POSTGRES_USER=consent_verify', '--env', 'POSTGRES_PASSWORD=disposable_consent_only']);
    const redis = container('redis:7-alpine', 'redis', 6379, []);
    await waitUntil(() => spawnSync('docker', ['exec', pg.id, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', 'consent_verify', '-d', 'consent_http']).status === 0, 'disposable PostgreSQL');
    await waitUntil(() => spawnSync('docker', ['exec', redis.id, 'redis-cli', 'ping']).status === 0, 'disposable Redis');
    const psql = sql => command('docker', ['exec', '-i', pg.id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'consent_verify', '-d', 'consent_http'], { input: sql });
    psql(fs.readFileSync(path.join(root, 'scripts/init-db.pg.sql'), 'utf8'));
    psql(`
      INSERT INTO customer (id, corp_id, external_userid, name) VALUES
        (9001, 1, 'consent-http-only', 'Disposable lifecycle fixture'),
        (9002, 2, 'consent-http-company-b', 'Disposable company B fixture'),
        (9003, 1, 'consent-http-company-a', 'Disposable company A isolation fixture'),
        (9004, 1, 'idempotency-http-company-a', 'Disposable company A replay fixture'),
        (9005, 2, 'idempotency-http-company-b', 'Disposable company B replay fixture');
      INSERT INTO "user" (id, corp_id, username, password, real_name, is_admin, status)
        SELECT 9002, 2, 'consent_other', password, 'Disposable company B user', 0, 1
        FROM "user" WHERE corp_id=1 AND username='admin';
    `);
    const ports = { auth: await freePort(), message: await freePort(), gateway: await freePort() };
    const baseEnv = { ...process.env, NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: String(pg.port),
      DB_USERNAME: 'consent_verify', DB_USER: 'consent_verify', DB_PASSWORD: 'disposable_consent_only', DB_DATABASE: 'consent_http',
      REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redis.port), REDIS_PASSWORD: '',
      JWT_SECRET: `disposable-consent-jwt-${runId}`, APP_KEYS: `disposable-consent-keys-${runId}`,
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
    const assert = require('node:assert/strict');
    const checks = [];
    async function request(route, body, token, extra = {}) {
      const response = await fetch(`http://127.0.0.1:${ports.gateway}${route}`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra },
        body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
      });
      return { status: response.status, body: await response.json() };
    }
    const loginA = await request('/api/v1/auth/login', { username: 'admin', password: 'Admin@123', corpId: 1 });
    const loginB = await request('/api/v1/auth/login', { username: 'consent_other', password: 'Admin@123', corpId: 2 });
    assert.equal(loginA.status, 200); assert.equal(loginB.status, 200);
    const tokenA = loginA.body.accessToken, tokenB = loginB.body.accessToken;
    assert.ok(tokenA); assert.ok(tokenB); checks.push('two real tenant logins');
    psql(`INSERT INTO message_log (id,corp_id,message_type,target_type,target_id,content,send_status,retry_count)
      VALUES (9101,1,5,2,1,'own failed Mock',2,0),(9102,2,5,2,9002,'foreign failed Mock',2,0),
      (9103,1,5,2,1,'already successful Mock',1,0);`);
    const anonymous = await request('/api/message/retry', { logIds: [9101] });
    assert.equal(anonymous.status, 401); checks.push('anonymous401');
    const foreign = await request('/api/message/retry', { logIds: [9102] }, tokenA, { 'x-corp-id': '2', 'x-user-id': '9002' });
    assert.equal(foreign.status, 200); assert.deepEqual(foreign.body.data, { total: 0, success: 0, failed: 0, details: [] });
    checks.push('foreign-only hidden despite forged headers');
    const mixed = await request('/api/message/retry', { logIds: [9101, 9102, 9101, 9103, 9999] }, tokenA);
    assert.equal(mixed.status, 200); assert.equal(mixed.body.data.total, 1); assert.equal(mixed.body.data.success, 1);
    assert.equal(String(mixed.body.data.details[0].id), '9101'); checks.push('mixed dedup only own failed');
    psql(`DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM message_log WHERE id=9102 AND corp_id=2 AND send_status=2 AND retry_count=0 AND send_time IS NULL AND content='foreign failed Mock') THEN RAISE EXCEPTION 'foreign row changed'; END IF;
      IF NOT EXISTS(SELECT 1 FROM message_log WHERE id=9103 AND send_status=1 AND retry_count=0) THEN RAISE EXCEPTION 'successful row retried'; END IF;
      IF NOT EXISTS(SELECT 1 FROM message_log WHERE id=9101 AND send_status=1 AND retry_count=1 AND send_time IS NOT NULL) THEN RAISE EXCEPTION 'own retry missing'; END IF;
    END $$;`); checks.push('raw PG foreign and successful rows unchanged');
    for (const logIds of [[], ['9102'], [0], [1.2], Array(101).fill(9102)]) {
      assert.equal((await request('/api/message/retry', { logIds }, tokenB)).status, 400);
    }
    checks.push('five invalid DTO shapes400');
    const ownB = await request('/api/message/retry', { logIds: 9102 }, tokenB, { 'x-corp-id': '1', 'x-user-id': '1' });
    assert.equal(ownB.status, 200); assert.equal(ownB.body.data.success, 1); checks.push('tenantB own scalar retry succeeds');
    assert.equal((await request('/api/message/retry', { logIds: [9101, 9102, 9103] }, tokenA)).body.data.total, 0);
    checks.push('no repeat of successful messages');
    psql(`DO $$ BEGIN
      IF (SELECT COUNT(*) FROM message_log WHERE id IN (9101,9102,9103))<>3 THEN RAISE EXCEPTION 'row count changed'; END IF;
      IF NOT EXISTS(SELECT 1 FROM message_log WHERE id=9102 AND corp_id=2 AND send_status=1 AND retry_count=1 AND content='foreign failed Mock') THEN RAISE EXCEPTION 'B retry invalid'; END IF;
    END $$;`);
    const evidence = psql('SELECT id,corp_id,message_type,send_status,retry_count,send_time IS NOT NULL AS sent FROM message_log WHERE id IN (9101,9102,9103) ORDER BY id;');
    fs.writeFileSync(path.join(artifactDir, 'database-evidence.txt'), evidence + '\n');
    Object.assign(outcome, { checks, checkCount: checks.length });
    console.log(JSON.stringify({ checks, evidence }));
    testPassed = true;
  } catch (error) {
    outcome.error = error.message;
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
