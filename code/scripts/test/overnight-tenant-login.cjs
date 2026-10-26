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
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-tenant-login-'));
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
    const id = command('docker', ['run', '--rm', '--detach', '--name', `open-scrm-tenant-login-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=tenant-login', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
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
    const pg = container('postgres:16-alpine', 'pg', 5432, ['--env', 'POSTGRES_DB=tenant_login', '--env', 'POSTGRES_USER=tenant_login_verify', '--env', 'POSTGRES_PASSWORD=disposable_tenant_login_only']);
    const redis = container('redis:7-alpine', 'redis', 6379, []);
    await waitUntil(() => spawnSync('docker', ['exec', pg.id, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', 'tenant_login_verify', '-d', 'tenant_login']).status === 0, 'disposable PostgreSQL');
    await waitUntil(() => spawnSync('docker', ['exec', redis.id, 'redis-cli', 'ping']).status === 0, 'disposable Redis');
    const psql = sql => command('docker', ['exec', '-i', pg.id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'tenant_login_verify', '-d', 'tenant_login'], { input: sql });
    psql(fs.readFileSync(path.join(root, 'scripts/init-db.pg.sql'), 'utf8'));
    const authRequire = createRequire(path.join(serviceRoot('auth-service'), 'package.json'));
    const bcrypt = authRequire('bcrypt');
    const hashA = bcrypt.hashSync('TenantA@123', 10);
    const hashB = bcrypt.hashSync('TenantB@123', 10);
    psql(`INSERT INTO "user" (id,corp_id,username,password,real_name,is_admin,status) VALUES
      (11001,1001,'duplicate_operator','${hashA}','同名甲员工',0,1),
      (11002,1002,'duplicate_operator','${hashB}','同名乙员工',0,1),
      (11003,1001,'disabled_operator','${hashA}','停用员工',0,0),
      (11004,1001,'unique_operator','${hashA}','唯一员工',0,1);`);
    const ports = { auth: await freePort(), gateway: await freePort(), vite: await freePort() };
    // Isolate every unused gateway dependency from project-local services. No successful
    // response is synthesized: unrelated dashboard requests receive explicit HTTP503.
    unavailableDependencies = http.createServer((req, res) => {
      unavailableRequests.push({ method: req.method, path: req.url });
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 503, message: 'Unrelated dependency excluded from isolated customer UI verification' }));
    });
    await new Promise((resolve, reject) => { unavailableDependencies.once('error', reject); unavailableDependencies.listen(0, '127.0.0.1', resolve); });
    ports.unavailable = unavailableDependencies.address().port;
    const unusedEnv = Object.fromEntries(['OPERATION', 'ANALYTICS', 'ACQUISITION', 'ASSET', 'INTEGRATION', 'MESSAGE', 'CUSTOMER', 'FINANCE', 'CONTENT_GENERATION'].map(name => [`${name}_SERVICE_URL`, `http://127.0.0.1:${ports.unavailable}`]));
    const baseEnv = { ...process.env, ...unusedEnv, TZ: 'UTC', NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: String(pg.port),
      DB_USERNAME: 'tenant_login_verify', DB_USER: 'tenant_login_verify', DB_PASSWORD: 'disposable_tenant_login_only', DB_DATABASE: 'tenant_login',
      REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redis.port), REDIS_PASSWORD: '',
      JWT_SECRET: `disposable-tenant-login-jwt-${runId}`, APP_KEYS: `disposable-tenant-login-keys-${runId}`,
      AUTH_SERVICE_URL: `http://127.0.0.1:${ports.auth}`,
      HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '', http_proxy: '', https_proxy: '', all_proxy: '', NO_PROXY: '127.0.0.1,localhost',
    };
    const jwt = createRequire(authRequire.resolve('@midwayjs/jwt/package.json'))('jsonwebtoken');
    baseEnv.TENANT_LOGIN_EXPIRED_ACCESS = jwt.sign({ userId: '11001', corpId: '1001', username: 'duplicate_operator', isAdmin: 0 }, baseEnv.JWT_SECRET, { expiresIn: -1 });
    baseEnv.TENANT_LOGIN_EXPIRED_REFRESH = jwt.sign({ userId: '11001', type: 'refresh' }, baseEnv.JWT_SECRET, { expiresIn: -1 });
    baseEnv.TENANT_LOGIN_DISABLED_REFRESH = jwt.sign({ userId: '11003', type: 'refresh' }, baseEnv.JWT_SECRET, { expiresIn: '5m' });
    for (const [name, port] of [['auth-service', ports.auth], ['gateway-service', ports.gateway]]) {
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
    const playwrightOutput = await asyncCommand(path.join(e2eDir, 'node_modules/.bin/playwright'), ['test', '--config', 'playwright.tenant-login.config.ts', '--reporter=line', '--output', path.join(artifactDir, 'playwright')], {
      cwd: e2eDir, env: { ...baseEnv, TENANT_LOGIN_DISPOSABLE: '1', GATEWAY_URL: `http://127.0.0.1:${ports.gateway}`, TENANT_LOGIN_UI_URL: `http://127.0.0.1:${ports.vite}` },
    });
    fs.writeFileSync(path.join(artifactDir, 'playwright-output.txt'), playwrightOutput + '\n');
    if (!/\b5 passed\b/.test(playwrightOutput) || /\d+ skipped/.test(playwrightOutput)) throw new Error(`Expected five executed passing HTTP/browser tests: ${playwrightOutput}`);
    psql(`DO $$ BEGIN
      IF current_setting('server_version_num')::int / 10000 <> 16 THEN RAISE EXCEPTION 'Expected PostgreSQL16'; END IF;
      IF (SELECT COUNT(*) FROM "user" WHERE username='duplicate_operator' AND corp_id IN(1001,1002) AND status=1) <> 2
        THEN RAISE EXCEPTION 'Expected two active same-name accounts'; END IF;
      IF (SELECT COUNT(*) FROM "user" WHERE id IN(11001,11002,11004) AND last_login_time IS NOT NULL) <> 3
        THEN RAISE EXCEPTION 'Expected each successful fixture user logged in'; END IF;
      IF (SELECT COUNT(*) FROM "user" WHERE id=11003 AND status=0 AND last_login_time IS NULL) <> 1
        THEN RAISE EXCEPTION 'Disabled fixture must remain disabled without login side effects'; END IF;
      IF (SELECT COUNT(*) FROM message_log) <> 0 OR (SELECT COUNT(*) FROM notification) <> 0
        THEN RAISE EXCEPTION 'No messages or notifications allowed'; END IF;
    END $$;`);
    assert(!unavailableRequests.some(item => /\/api\/(message|notification)|\/messages\//.test(item.path)), 'Login workflow must never invoke messaging');
    outcome.unavailableDependencies = unavailableRequests;
    console.log('PASS: tenant login real HTTP4 + Chromium1, PostgreSQL16 scoped/refresh checks, zero messages');
    const evidence = psql("SELECT version(); SELECT id,corp_id,username,is_admin,status,last_login_time IS NOT NULL AS logged_in FROM \"user\" WHERE id IN(11001,11002,11003,11004) ORDER BY id; SELECT COUNT(*) AS message_count FROM message_log; SELECT COUNT(*) AS notification_count FROM notification;");
    console.log(evidence);
    fs.writeFileSync(path.join(artifactDir, 'database-evidence.txt'), evidence + '\n');
    testPassed = true;
  } catch (error) {
    outcome.error = error.message;
    outcome.unavailableDependencies = unavailableRequests;
    for (const name of ['auth-service', 'gateway-service']) {
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
