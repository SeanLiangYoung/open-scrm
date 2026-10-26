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
  if (env.TAG_INTEGRITY_UI_DISPOSABLE !== '1' || !['auth-service', 'customer-service', 'gateway-service'].includes(service) ||
      env.DB_HOST !== '127.0.0.1' || env.REDIS_HOST !== '127.0.0.1' ||
      env.DB_USERNAME !== 'tag_integrity_http_verify' || env.DB_USER !== 'tag_integrity_http_verify' ||
      env.DB_DATABASE !== 'tag_integrity_http' || env.DB_PASSWORD !== 'disposable_tag_integrity_http_only' ||
      !validPort(env.DB_PORT) || !validPort(env.REDIS_PORT) || !validPort(rawPort) || env.DB_PORT === env.REDIS_PORT) reject();
  let allowed;
  try { allowed = JSON.parse(env.TAG_INTEGRITY_ALLOWED_PORTS); } catch { reject(); }
  if (!Array.isArray(allowed) || allowed.length < 5 || !allowed.every(port => Number.isInteger(port) && validPort(String(port))) ||
      new Set(allowed).size !== allowed.length || ![env.DB_PORT, env.REDIS_PORT, rawPort].every(port => allowed.includes(Number(port))) ||
      [env.DB_PORT, env.REDIS_PORT].includes(rawPort)) reject();
  if (!env.TAG_INTEGRITY_GUARD_LOG || !path.isAbsolute(env.TAG_INTEGRITY_GUARD_LOG) ||
      path.basename(env.TAG_INTEGRITY_GUARD_LOG) !== 'blocked-outbound.jsonl' ||
      !path.basename(path.dirname(env.TAG_INTEGRITY_GUARD_LOG)).startsWith('open-scrm-tag-integrity-http-') ||
      !fs.existsSync(env.TAG_INTEGRITY_GUARD_LOG)) reject();
  return Number(rawPort);
}

if (require.main === module) { try {
if (process.argv[2] === '--service') {
  assertServiceProfile(process.env, process.argv[3], process.argv[4]);
  const allowedPorts = new Set(JSON.parse(process.env.TAG_INTEGRITY_ALLOWED_PORTS));
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    let options = args[0]; if (Array.isArray(options)) options = options[0];
    const host = options && typeof options === 'object' ? options.host || 'localhost' : args[1];
    const port = options && typeof options === 'object' ? options.port : options;
    if (!['127.0.0.1', '::1'].includes(host) || !allowedPorts.has(Number(port))) {
      fs.appendFileSync(process.env.TAG_INTEGRITY_GUARD_LOG, JSON.stringify({ host, port }) + '\n');
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
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-tag-integrity-http-'));
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
    const id = command('docker', ['create', '--rm', '--name', `open-scrm-tag-integrity-http-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=tag-integrity-http', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
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
    const pg = container('postgres:16-alpine', 'pg', 5432, ['--env', 'POSTGRES_DB=tag_integrity_http', '--env', 'POSTGRES_USER=tag_integrity_http_verify', '--env', 'POSTGRES_PASSWORD=disposable_tag_integrity_http_only']);
    const redis = container('redis:7-alpine', 'redis', 6379, []);
    await waitUntil(() => spawnSync('docker', ['exec', pg.id, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', 'tag_integrity_http_verify', '-d', 'tag_integrity_http']).status === 0, 'disposable PostgreSQL');
    await waitUntil(() => spawnSync('docker', ['exec', redis.id, 'redis-cli', 'ping']).status === 0, 'disposable Redis');
    const psql = sql => command('docker', ['exec', '-i', pg.id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'tag_integrity_http_verify', '-d', 'tag_integrity_http'], { input: sql });
    psql(fs.readFileSync(path.join(root, 'scripts/init-db.pg.sql'), 'utf8'));
    psql(`INSERT INTO "user"(id,corp_id,username,password,real_name,is_admin,status)
      SELECT 74002,2,'tag_peer',password,'标签同事',0,1 FROM "user" WHERE corp_id=1 AND username='admin';
      INSERT INTO customer_tag(id,corp_id,tag_name,tag_type,tag_color,parent_id,sort,is_auto,status) VALUES
      (100011,1,'tag-http-foreign-protected',1,'#112233',0,0,0,1),
      (100022,2,'tag-http-parent',1,'#112233',0,0,0,1),
      (100021,2,'tag-http-own',3,'#123456',100022,8,1,1);
      INSERT INTO customer(id,corp_id,external_userid,name) VALUES
      (100201,2,'tag-http-owned','tag-http-owned'),(100101,1,'tag-http-foreign','tag-http-foreign');`);
    const ports = { auth: await freePort(), customer: await freePort(), gateway: await freePort(), vite: await freePort() };
    // Isolate every unused gateway dependency from project-local services. No successful
    // response is synthesized: unrelated dashboard requests receive explicit HTTP503.
    unavailableDependencies = http.createServer((req, res) => {
      unavailableRequests.push({ method: req.method, path: req.url });
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 503, message: 'Unrelated dependency excluded from isolated notification UI verification' }));
    });
    await new Promise((resolve, reject) => { unavailableDependencies.once('error', reject); unavailableDependencies.listen(0, '127.0.0.1', resolve); });
    ports.unavailable = unavailableDependencies.address().port;
    const unusedEnv = Object.fromEntries(['OPERATION', 'ANALYTICS', 'ACQUISITION', 'ASSET', 'INTEGRATION', 'MESSAGE', 'FINANCE', 'CONTENT_GENERATION'].map(name => [`${name}_SERVICE_URL`, `http://127.0.0.1:${ports.unavailable}`]));
    const guardLog = path.join(artifactDir, 'blocked-outbound.jsonl'); fs.writeFileSync(guardLog, '');
    const baseEnv = { ...process.env, ...unusedEnv, TAG_INTEGRITY_UI_DISPOSABLE: '1', TAG_INTEGRITY_GUARD_LOG: guardLog, TAG_INTEGRITY_ALLOWED_PORTS: JSON.stringify([pg.port, redis.port, ...Object.values(ports)]), TZ: 'UTC', NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: String(pg.port),
      DB_USERNAME: 'tag_integrity_http_verify', DB_USER: 'tag_integrity_http_verify', DB_PASSWORD: 'disposable_tag_integrity_http_only', DB_DATABASE: 'tag_integrity_http',
      REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redis.port), REDIS_PASSWORD: '',
      JWT_SECRET: `disposable-tag-integrity-http-jwt-${runId}`, APP_KEYS: `disposable-tag-integrity-http-keys-${runId}`,
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
    const playwrightOutput = await asyncCommand(path.join(e2eDir, 'node_modules/.bin/playwright'), ['test', '--config', 'playwright.tag-integrity-http.config.ts', '--reporter=line', '--output', path.join(artifactDir, 'playwright')], {
      cwd: e2eDir, env: { ...baseEnv, TAG_INTEGRITY_UI_DISPOSABLE: '1', TAG_INTEGRITY_UI_BASE_URL: `http://127.0.0.1:${ports.vite}` },
    });
    fs.writeFileSync(path.join(artifactDir, 'playwright-output.txt'), playwrightOutput + '\n');
    if (!/\b5 passed\b/.test(playwrightOutput) || /\d+ skipped/.test(playwrightOutput)) throw new Error(`Expected five executed passing browser tests: ${playwrightOutput}`);
    psql(`DO $$ BEGIN
      IF current_setting('server_version_num')::int / 10000 <> 16 THEN RAISE EXCEPTION 'Expected PostgreSQL16'; END IF;
      IF (SELECT COUNT(*) FROM customer_tag WHERE id=100011 AND corp_id=1 AND tag_name='tag-http-foreign-protected') <> 1 THEN RAISE EXCEPTION 'Foreign primary key and enterprise must remain unchanged'; END IF;
      IF (SELECT COUNT(*) FROM customer_tag WHERE id=100021 AND corp_id=2 AND tag_name='tag-http-ui-edited' AND tag_type=3 AND parent_id=100022 AND sort=8 AND is_auto=1 AND tag_color='#123456') <> 1 THEN RAISE EXCEPTION 'Real UI edit must preserve omitted metadata'; END IF;
      IF (SELECT COUNT(*) FROM customer_tag WHERE tag_name='tag-http-ui-created' AND corp_id=2 AND parent_id=0 AND tag_type=1) <> 1 THEN RAISE EXCEPTION 'Expected supported real UI create in company2'; END IF;
      IF (SELECT COUNT(*) FROM customer_tag WHERE corp_id=2) <> 3 THEN RAISE EXCEPTION 'Rejected writes/valid child deletion must leave exactly three company2 tags'; END IF;
      IF (SELECT COUNT(*) FROM customer_tag_relation WHERE customer_id=100201 AND tag_id=100021) <> 1 THEN RAISE EXCEPTION 'Valid duplicate attachment is idempotent'; END IF;
      IF (SELECT COUNT(*) FROM customer_tag_relation WHERE customer_id=100101) <> 0 THEN RAISE EXCEPTION 'Foreign customer relationships unchanged'; END IF;
      IF (SELECT COUNT(*) FROM message_log) <> 0 THEN RAISE EXCEPTION 'No message sending in tag verification'; END IF;
    END $$;`);
    assert.equal(fs.readFileSync(guardLog,'utf8'),'','No outbound connection outside owned resources');
    outcome.unavailableDependencies=unavailableRequests;
    const evidence=psql("SELECT version(); SELECT id,corp_id,tag_name,tag_type,parent_id,sort,is_auto FROM customer_tag WHERE id IN(100011,100021,100022) OR tag_name LIKE 'tag-http-%' ORDER BY id; SELECT customer_id,tag_id FROM customer_tag_relation WHERE customer_id IN(100201,100101) ORDER BY customer_id,tag_id; SELECT COUNT(*) AS message_count FROM message_log;");
    console.log('PASS: five real tag UI/API scenarios and PG16 immutable/metadata/relationship assertions');console.log(evidence);fs.writeFileSync(path.join(artifactDir,'database-evidence.txt'),evidence+'\n');
    testPassed = true;
  } catch (error) {
    outcome.error = error.message;
    outcome.unavailableDependencies = unavailableRequests;
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
