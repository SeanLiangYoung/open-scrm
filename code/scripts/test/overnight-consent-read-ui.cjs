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
  const allowed = ['auth-service', 'customer-service', 'message-service', 'gateway-service'];
  const port = Number(process.argv[4]);
  if (process.env.CONSENT_READ_UI_CHILD_DISPOSABLE !== '1' ||
    process.env.DB_DATABASE !== 'customer_ui' || process.env.DB_USERNAME !== 'customer_ui_verify' ||
    process.env.DB_PASSWORD !== 'disposable_customer_ui_only' || process.env.DB_HOST !== '127.0.0.1' ||
    process.env.REDIS_HOST !== '127.0.0.1' || !Number.isSafeInteger(Number(process.env.DB_PORT)) ||
    Number(process.env.DB_PORT) <= 0 || Number(process.env.DB_PORT) === 5432 ||
    !Number.isSafeInteger(Number(process.env.REDIS_PORT)) || Number(process.env.REDIS_PORT) <= 0 || Number(process.env.REDIS_PORT) === 6379 ||
    !allowed.includes(process.argv[3]) || !Number.isSafeInteger(port) || port <= 0) {
    throw new Error('Refusing service startup without owned disposable consent UI profile');
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
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-consent-read-ui-'));
  const ownedContainers = [];
  const children = [];
  const logs = [];
  let unavailableDependencies;
  let faultProxy;
  let failConsentRead = false;
  const readFaults = [];
  const faultKey = `consent-read-fixture-${runId}`;
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
      if (faultProxy) { faultProxy.closeAllConnections(); await new Promise(resolve => faultProxy.close(resolve)); if (faultProxy.listening) errors.push('Fault proxy remains open'); }
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
    const id = command('docker', ['create', '--name', `open-scrm-consent-read-ui-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=customer-ui', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
    ownedContainers.push(id);
    command('docker', ['start', ...(process.env.CONSENT_READ_UI_FAULT_START === '1' ? ['--open-scrm-forced-invalid-start-option'] : []), id]);
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
    const pg = container('postgres:16-alpine', 'pg', 5432, ['--env', 'POSTGRES_DB=customer_ui', '--env', 'POSTGRES_USER=customer_ui_verify', '--env', 'POSTGRES_PASSWORD=disposable_customer_ui_only']);
    const redis = container('redis:7-alpine', 'redis', 6379, []);
    await waitUntil(() => spawnSync('docker', ['exec', pg.id, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', 'customer_ui_verify', '-d', 'customer_ui']).status === 0, 'disposable PostgreSQL');
    await waitUntil(() => spawnSync('docker', ['exec', redis.id, 'redis-cli', 'ping']).status === 0, 'disposable Redis');
    const psql = sql => command('docker', ['exec', '-i', pg.id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'customer_ui_verify', '-d', 'customer_ui'], { input: sql });
    psql(fs.readFileSync(path.join(root, 'scripts/init-db.pg.sql'), 'utf8'));
    psql(`INSERT INTO customer (id,corp_id,external_userid,name) VALUES
      (9001,1,'consent-ui-a','Disposable consent UI A'),(9002,2,'consent-ui-b','Disposable consent UI B'),(9003,1,'consent-ui-fault','Disposable read fault'),(9004,1,'consent-ui-history','Disposable history');
      INSERT INTO "user" (id,corp_id,username,password,real_name,is_admin,status)
      SELECT 9002,2,'consent_other',password,'Consent UI company B',0,1 FROM "user" WHERE corp_id=1 AND username='admin';`);
    psql(`INSERT INTO consent_record(id,corp_id,subject_type,subject_id,purpose,created_at,revoked_at)
      SELECT 10000+n,1,'customer',9004,'marketing',TIMESTAMPTZ '2026-10-20T00:00:00Z',CASE WHEN n%2=0 THEN TIMESTAMPTZ '2026-10-21T00:00:00Z' ELSE NULL END FROM generate_series(1,21) n;
      INSERT INTO consent_record(id,corp_id,subject_type,subject_id,purpose,created_at) VALUES (9007199254740993,1,'customer',9004,'marketing','2026-10-20T00:00:00Z');`);
    const ports = { auth: await freePort(), customer: await freePort(), message: await freePort(), gateway: await freePort(), vite: await freePort() };
    // Isolate every unused gateway dependency from project-local services. No successful
    // response is synthesized: unrelated dashboard requests receive explicit HTTP503.
    unavailableDependencies = http.createServer((req, res) => {
      unavailableRequests.push({ method: req.method, path: req.url });
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 503, message: 'Unrelated dependency excluded from isolated customer UI verification' }));
    });
    await new Promise((resolve, reject) => { unavailableDependencies.once('error', reject); unavailableDependencies.listen(0, '127.0.0.1', resolve); });
    ports.unavailable = unavailableDependencies.address().port;
    const unusedEnv = Object.fromEntries(['OPERATION', 'ANALYTICS', 'ACQUISITION', 'ASSET', 'INTEGRATION', 'FINANCE', 'CONTENT_GENERATION'].map(name => [`${name}_SERVICE_URL`, `http://127.0.0.1:${ports.unavailable}`]));
    const baseEnv = { ...process.env, ...unusedEnv, CONSENT_READ_UI_CHILD_DISPOSABLE: '1', TZ: 'UTC', NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: String(pg.port),
      DB_USERNAME: 'customer_ui_verify', DB_USER: 'customer_ui_verify', DB_PASSWORD: 'disposable_customer_ui_only', DB_DATABASE: 'customer_ui',
      REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redis.port), REDIS_PASSWORD: '',
      JWT_SECRET: `disposable-customer-ui-jwt-${runId}`, APP_KEYS: `disposable-customer-ui-keys-${runId}`,
      AUTH_SERVICE_URL: `http://127.0.0.1:${ports.auth}`, CUSTOMER_SERVICE_URL: `http://127.0.0.1:${ports.customer}`, MESSAGE_SERVICE_URL: `http://127.0.0.1:${ports.message}`,
      HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '', http_proxy: '', https_proxy: '', all_proxy: '', NO_PROXY: '127.0.0.1,localhost',
    };
    for (const [name, port] of [['auth-service', ports.auth], ['customer-service', ports.customer], ['message-service', ports.message], ['gateway-service', ports.gateway]]) {
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
    faultProxy = http.createServer((req,res) => {
      if (req.url === '/__fixture__/read-failure') {
        if (req.method !== 'POST' || req.headers['x-fixture-key'] !== faultKey) { res.writeHead(403);res.end();return; }
        let body='';req.on('data',part=>{body+=part});req.on('end',()=>{try{failConsentRead=JSON.parse(body).enabled===true;res.writeHead(204);res.end()}catch{res.writeHead(400);res.end()}});return;
      }
      if (failConsentRead && req.method==='GET' && new URL(req.url,'http://fixture').pathname==='/api/v1/messages/consents/customer/9003') {
        readFaults.push({method:req.method,path:req.url,status:503});res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({message:'隔离验证读取故障'}));return;
      }
      const upstream=http.request({host:'127.0.0.1',port:ports.gateway,path:req.url,method:req.method,headers:req.headers},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res)});
      upstream.on('error',error=>{res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({message:error.message}))});req.pipe(upstream);
    });
    await new Promise((resolve,reject)=>{faultProxy.once('error',reject);faultProxy.listen(0,'127.0.0.1',resolve)});
    ports.faultProxy=faultProxy.address().port;
    const frontendDir = path.join(root, 'apps/operation-platform');
    const viteLog = fs.openSync(path.join(artifactDir, 'vite.log'), 'w');
    logs.push(viteLog);
    const vite = spawn(process.execPath, [path.join(frontendDir, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(ports.vite), '--strictPort'], {
      cwd: frontendDir, env: { ...baseEnv, NODE_ENV: 'development', VITE_GATEWAY_URL: `http://127.0.0.1:${ports.faultProxy}` }, stdio: ['ignore', viteLog, viteLog],
    });
    children.push(vite);
    await waitUntil(async () => {
      if (vite.exitCode !== null) throw new Error(`Vite exited ${vite.exitCode}: ${fs.readFileSync(path.join(artifactDir, 'vite.log'), 'utf8')}`);
      return (await fetch(`http://127.0.0.1:${ports.vite}/login`, { signal: AbortSignal.timeout(1000) })).ok;
    }, 'isolated Vite HTTP');
    const e2eDir = path.join(root, 'e2e');
    const playwrightOutput = await asyncCommand(path.join(e2eDir, 'node_modules/.bin/playwright'), ['test', '--config', 'consent-read-ui.config.ts', '--reporter=line', '--output', path.join(artifactDir, 'playwright')], {
      cwd: e2eDir, env: { ...baseEnv, CONSENT_READ_UI_DISPOSABLE: '1', CONSENT_READ_UI_FAULT_URL: `http://127.0.0.1:${ports.faultProxy}`, CONSENT_READ_UI_FAULT_KEY: faultKey, CONSENT_READ_UI_BASE_URL: `http://127.0.0.1:${ports.vite}` },
    });
    fs.writeFileSync(path.join(artifactDir, 'playwright-output.txt'), playwrightOutput + '\n');
    if (!/\b5 passed\b/.test(playwrightOutput) || /\d+ skipped/.test(playwrightOutput)) throw new Error(`Expected five executed passing browser tests: ${playwrightOutput}`);
    psql(`DO $$ BEGIN
      IF (SELECT COUNT(*) FROM consent_record WHERE subject_id IN (9001,9002,9003,9004))<>25 THEN RAISE EXCEPTION 'expected exactly25 evidence rows'; END IF;
      IF NOT EXISTS(SELECT 1 FROM consent_record WHERE corp_id=1 AND subject_id=9001 AND policy_version='read-ui-a' AND revoked_at IS NOT NULL) THEN RAISE EXCEPTION 'A UI revoke missing'; END IF;
      IF NOT EXISTS(SELECT 1 FROM consent_record WHERE corp_id=2 AND subject_id=9002 AND policy_version='read-ui-b' AND revoked_at IS NULL) THEN RAISE EXCEPTION 'B evidence wrong'; END IF;
      IF NOT EXISTS(SELECT 1 FROM consent_record WHERE corp_id=1 AND subject_id=9003 AND policy_version='read-ui-fault' AND revoked_at IS NULL) THEN RAISE EXCEPTION 'successful write during read fault lost'; END IF;
      IF (SELECT COUNT(*) FROM consent_record WHERE subject_id=9004 AND revoked_at IS NULL)<>12 OR (SELECT COUNT(*) FROM consent_record WHERE subject_id=9004 AND revoked_at IS NOT NULL)<>10 THEN RAISE EXCEPTION 'legacy fixture changed'; END IF;
      IF (SELECT COUNT(*) FROM message_log)<>0 THEN RAISE EXCEPTION 'UI read model must not send messages'; END IF;
    END $$;`);
    assert.equal(readFaults.length,1,'Exactly one deliberate read503 after actual successful grant');
    Object.assign(outcome,{browserCases:5,readFaults,expectedEvidenceRows:25,expectedMessageRows:0});
    const evidence=psql("SELECT corp_id,subject_id,COUNT(*) AS total,COUNT(*) FILTER(WHERE revoked_at IS NULL) AS active,COUNT(*) FILTER(WHERE revoked_at IS NOT NULL) AS revoked FROM consent_record WHERE subject_id IN (9001,9002,9003,9004) GROUP BY corp_id,subject_id ORDER BY subject_id; SELECT COUNT(*) FROM message_log;");
    fs.writeFileSync(path.join(artifactDir,'database-evidence.txt'),evidence+'\n');console.log('PASS actual consent read UI5, exact25 evidence and zero messages, deliberate read503 injection');
    testPassed = true;
  } catch (error) {
    outcome.error = error.message;
    outcome.unavailableDependencies = unavailableRequests;
    for (const name of ['auth-service', 'customer-service', 'message-service', 'gateway-service']) {
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
