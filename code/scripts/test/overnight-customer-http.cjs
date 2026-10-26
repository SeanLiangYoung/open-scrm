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
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-customer-http-'));
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
    const id = command('docker', ['run', '--rm', '--detach', '--name', `open-scrm-customer-http-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=customer-http', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
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
    const pg = container('postgres:16-alpine', 'pg', 5432, ['--env', 'POSTGRES_DB=customer_http', '--env', 'POSTGRES_USER=customer_http_verify', '--env', 'POSTGRES_PASSWORD=disposable_customer_http_only']);
    const redis = container('redis:7-alpine', 'redis', 6379, []);
    await waitUntil(() => spawnSync('docker', ['exec', pg.id, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', 'customer_http_verify', '-d', 'customer_http']).status === 0, 'disposable PostgreSQL');
    await waitUntil(() => spawnSync('docker', ['exec', redis.id, 'redis-cli', 'ping']).status === 0, 'disposable Redis');
    const psql = sql => command('docker', ['exec', '-i', pg.id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'customer_http_verify', '-d', 'customer_http'], { input: sql });
    psql(fs.readFileSync(path.join(root, 'scripts/init-db.pg.sql'), 'utf8'));
    psql(`INSERT INTO customer (id, corp_id, external_userid, name) VALUES
      (9101, 1, 'customer-http-a', 'Disposable company A'),
      (9102, 902, 'customer-http-b', 'Disposable company B');
      INSERT INTO "user" (id, corp_id, username, password, real_name, is_admin, status)
      SELECT 9102, 902, 'overnight_tenant_b', password, 'Disposable tenant B login', 1, 1 FROM "user" WHERE username='admin';
      INSERT INTO customer_follow_up (corp_id, customer_id, user_id, follow_type, content)
      VALUES (902, 9101, 9102, 1, 'Intentionally inconsistent legacy isolation fixture');`);
    const ports = { auth: await freePort(), customer: await freePort(), gateway: await freePort() };
    const baseEnv = { ...process.env, TZ: 'UTC', NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: String(pg.port),
      DB_USERNAME: 'customer_http_verify', DB_USER: 'customer_http_verify', DB_PASSWORD: 'disposable_customer_http_only', DB_DATABASE: 'customer_http',
      REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redis.port), REDIS_PASSWORD: '',
      JWT_SECRET: `disposable-customer-http-jwt-${runId}`, APP_KEYS: `disposable-customer-http-keys-${runId}`,
      AUTH_SERVICE_URL: `http://127.0.0.1:${ports.auth}`, CUSTOMER_SERVICE_URL: `http://127.0.0.1:${ports.customer}`,
      HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '', http_proxy: '', https_proxy: '', all_proxy: '', NO_PROXY: '127.0.0.1,localhost',
    };
    for (const [name, port] of [['auth-service', ports.auth], ['customer-service', ports.customer], ['gateway-service', ports.gateway]]) {
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
    const e2eDir = path.join(root, 'e2e');
    const playwrightOutput = command(path.join(e2eDir, 'node_modules/.bin/playwright'), ['test', '--config', 'playwright.customer-followup-http.config.ts', '--reporter=line', '--output', path.join(artifactDir, 'playwright')], {
      cwd: e2eDir, env: { ...baseEnv, CUSTOMER_HTTP_DISPOSABLE: '1', GATEWAY_URL: `http://127.0.0.1:${ports.gateway}` },
    });
    fs.writeFileSync(path.join(artifactDir, 'playwright-output.txt'), playwrightOutput + '\n');
    if (!/1 passed/.test(playwrightOutput) || /\d+ skipped/.test(playwrightOutput)) throw new Error(`Expected one executed passing test: ${playwrightOutput}`);
    psql(`DO $$ BEGIN
      IF current_setting('server_version_num')::int / 10000 <> 16 THEN RAISE EXCEPTION 'Expected PostgreSQL16'; END IF;
      IF (SELECT COUNT(*) FROM customer_follow_up) <> 4 THEN RAISE EXCEPTION 'Expected 4 follow-ups'; END IF;
      IF (SELECT COUNT(*) FROM customer_follow_up WHERE corp_id=1 AND customer_id=9101 AND user_id=(SELECT id FROM "user" WHERE username='admin')) <> 2
        THEN RAISE EXCEPTION 'Expected 2 company-A rows with authenticated operator'; END IF;
      IF (SELECT COUNT(*) FROM customer_follow_up WHERE corp_id=902 AND customer_id=9102 AND user_id=9102) <> 1
        THEN RAISE EXCEPTION 'Expected 1 company-B own record'; END IF;
    END $$;`);
    console.log('PASS: follow-up gateway HTTP Playwright 1 passed, 8 named steps, two real tenant logins');
    const evidence = psql("SELECT version(); SELECT corp_id,customer_id,user_id,follow_type,next_follow_time FROM customer_follow_up ORDER BY id;");
    console.log(evidence);
    fs.writeFileSync(path.join(artifactDir, 'database-evidence.txt'), evidence + '\n');
    testPassed = true;
  } catch (error) {
    outcome.error = error.message;
    for (const name of ['auth-service', 'customer-service', 'gateway-service']) {
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
