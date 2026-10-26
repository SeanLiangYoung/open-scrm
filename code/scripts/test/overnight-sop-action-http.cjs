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
  const allowedServices = ['auth-service', 'customer-service', 'message-service', 'operation-service', 'gateway-service'];
  if (process.env.SOP_ACTION_CHILD_DISPOSABLE !== '1' ||
    process.env.DB_HOST !== '127.0.0.1' || process.env.REDIS_HOST !== '127.0.0.1' ||
    process.env.DB_USERNAME !== 'sop_action_http_verify' || process.env.DB_USER !== 'sop_action_http_verify' ||
    process.env.DB_DATABASE !== 'sop_action_http' || process.env.DB_PASSWORD !== 'disposable_sop_action_http_only' ||
    !validPort(process.env.DB_PORT) || Number(process.env.DB_PORT) === 5432 ||
    !validPort(process.env.REDIS_PORT) || Number(process.env.REDIS_PORT) === 6379 ||
    !validPort(process.argv[4]) || !allowedServices.includes(process.argv[3])) {
    throw new Error('Refusing service startup without owned disposable SOP action HTTP profile');
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
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-sop-action-http-'));
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
    const id = command('docker', ['create', '--rm', '--name', `open-scrm-sop-action-http-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=sop-action-http', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
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
    const pg = container('postgres:16-alpine', 'pg', 5432, ['--env', 'POSTGRES_DB=sop_action_http', '--env', 'POSTGRES_USER=sop_action_http_verify', '--env', 'POSTGRES_PASSWORD=disposable_sop_action_http_only']);
    const redis = container('redis:7-alpine', 'redis', 6379, []);
    await waitUntil(() => spawnSync('docker', ['exec', pg.id, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', 'sop_action_http_verify', '-d', 'sop_action_http']).status === 0, 'disposable PostgreSQL');
    await waitUntil(() => spawnSync('docker', ['exec', redis.id, 'redis-cli', 'ping']).status === 0, 'disposable Redis');
    const psql = sql => command('docker', ['exec', '-i', pg.id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'sop_action_http_verify', '-d', 'sop_action_http'], { input: sql });
    psql(fs.readFileSync(path.join(root, 'scripts/init-db.pg.sql'), 'utf8'));
    psql(`INSERT INTO "user" (id,corp_id,username,password,real_name,is_admin,status)
      SELECT f.id,1,f.username,a.password,f.username,0,1 FROM
      (VALUES (14102,'sop_action_actor'),(14103,'sop_action_peer')) AS f(id,username)
      CROSS JOIN "user" a WHERE a.corp_id=1 AND a.username='admin';
      INSERT INTO customer (id,corp_id,external_userid,name,follow_user_id) VALUES (94101,1,'sop-action-fixture','SOP isolated customer',14102);
      INSERT INTO customer_tag (id,corp_id,tag_name,tag_type) VALUES (94111,1,'SOP own tag',1),(94112,2,'SOP foreign tag',1);
      INSERT INTO message_template (id,corp_id,template_name,template_type,message_type,content,status) VALUES
      (94201,1,'owned disabled metadata',1,1,'Never replace request content',0),(94202,2,'foreign metadata',1,5,'Foreign content',1);
      INSERT INTO sop_template (id,corp_id,template_name,template_type,trigger_type,status,create_user_id)
      SELECT id,1,'sop-action-'||id,CASE WHEN id=94127 THEN 2 ELSE 1 END,4,1,14102 FROM generate_series(94121,94130) AS id;
      INSERT INTO sop_step (template_id,step_order,step_name,step_type,delay_time,delay_unit,action_content) VALUES
      (94121,1,'invalid assignment',4,0,'minute','{"followUserId":true}'),
      (94122,1,'invalid notification',5,0,'minute','{"userIds":["1e0"],"content":"invalid notification"}'),
      (94123,1,'mixed foreign tag',2,0,'minute','{"tagIds":[94111,94112]}'),
      (94124,1,'negative delay',4,-3,'minute','{"followUserId":1}'),
      (94125,1,'valid assignment',4,0,'minute','{"staffId":"14103","metadata":{"keep":true}}'),
      (94126,1,'valid notification',5,0,'minute','{"userIds":["14103",14103],"text":"valid SOP notice","title":"sop-valid-notification"}'),
      (94127,1,'group customer-only',2,0,'minute','{"tagIds":[94111]}'),
      (94128,1,'explicit Mock',1,0,'minute','{"messageType":5,"templateId":94201,"content":"SOP action Mock only","extra":{"fixture":"message","keep":true}}'),
      (94129,1,'legacy material Mock',3,0,'minute',to_jsonb('{"messageType":5,"templateId":94201,"assetUrl":"https://example.invalid/metadata-only","content":"SOP material Mock only","extra":{"fixture":"material","keep":true}}'::text)),
      (94130,1,'foreign metadata Mock',1,0,'minute','{"messageType":5,"templateId":94202,"content":"Foreign metadata must fail"}');`);
    const ports = { auth: await freePort(), customer: await freePort(), message: await freePort(), operation: await freePort(), gateway: await freePort() };
    // Isolate every unused gateway dependency from project-local services. No successful
    // response is synthesized: unrelated dashboard requests receive explicit HTTP503.
    unavailableDependencies = http.createServer((req, res) => {
      unavailableRequests.push({ method: req.method, path: req.url });
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 503, message: 'Unrelated dependency excluded from isolated SOP action HTTP verification' }));
    });
    await new Promise((resolve, reject) => { unavailableDependencies.once('error', reject); unavailableDependencies.listen(0, '127.0.0.1', resolve); });
    ports.unavailable = unavailableDependencies.address().port;
    const unusedEnv = Object.fromEntries(['ANALYTICS', 'ACQUISITION', 'ASSET', 'INTEGRATION', 'FINANCE', 'CONTENT_GENERATION'].map(name => [`${name}_SERVICE_URL`, `http://127.0.0.1:${ports.unavailable}`]));
    const baseEnv = { ...process.env, ...unusedEnv, SOP_ACTION_CHILD_DISPOSABLE: '1', TZ: 'UTC', NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: String(pg.port),
      DB_USERNAME: 'sop_action_http_verify', DB_USER: 'sop_action_http_verify', DB_PASSWORD: 'disposable_sop_action_http_only', DB_DATABASE: 'sop_action_http',
      REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redis.port), REDIS_PASSWORD: '',
      JWT_SECRET: `disposable-sop-action-http-jwt-${runId}`, APP_KEYS: `disposable-sop-action-http-keys-${runId}`,
      AUTH_SERVICE_URL: `http://127.0.0.1:${ports.auth}`, OPERATION_SERVICE_URL: `http://127.0.0.1:${ports.operation}`, CUSTOMER_SERVICE_URL: `http://127.0.0.1:${ports.customer}`, MESSAGE_SERVICE_URL: `http://127.0.0.1:${ports.message}`,
      HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '', http_proxy: '', https_proxy: '', all_proxy: '', NO_PROXY: '127.0.0.1,localhost',
    };
    for (const [name, port] of [['auth-service', ports.auth], ['customer-service', ports.customer], ['message-service', ports.message], ['operation-service', ports.operation], ['gateway-service', ports.gateway]]) {
      const dir = serviceRoot(name);
      console.log(`Build/start ${name} on free loopback port ${port}`);
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
    const playwrightOutput = await asyncCommand(path.join(e2eDir, 'node_modules/.bin/playwright'), ['test', ...(process.argv.includes('--int32-red') ? ['--grep', 'INT32'] : []), '--config', 'sop-action-runtime.config.ts', '--reporter=line', '--output', path.join(artifactDir, 'playwright')], {
      cwd: e2eDir, env: { ...baseEnv, SOP_ACTION_HTTP_DISPOSABLE: '1', SOP_ACTION_HTTP_BASE_URL: `http://127.0.0.1:${ports.gateway}` },
    });
    fs.writeFileSync(path.join(artifactDir, 'playwright-output.txt'), playwrightOutput + '\n');
    if (!/\b13 passed\b/.test(playwrightOutput) || /\d+ skipped/.test(playwrightOutput)) throw new Error(`Expected thirteen actual SOP action boundary cases: ${playwrightOutput}`);
    psql(`DO $$ BEGIN
      IF (SELECT COUNT(*) FROM sop_template WHERE id BETWEEN 94121 AND 94130) <> 10 THEN RAISE EXCEPTION 'Template fixture changed'; END IF;
      IF (SELECT COUNT(*) FROM sop_execution) <> 11 THEN RAISE EXCEPTION 'Expected exactly eleven executions'; END IF;
      IF (SELECT COUNT(*) FROM sop_execution WHERE template_id IN (94121,94122,94123,94124,94127,94130) AND status=3 AND current_step=0) <> 6 THEN RAISE EXCEPTION 'Invalid steps must fail without progress'; END IF;
      IF (SELECT COUNT(*) FROM sop_execution WHERE template_id IN (94125,94126,94128,94129) AND status=1 AND current_step=1) <> 4 THEN RAISE EXCEPTION 'Valid steps must finish'; END IF;
      IF (SELECT follow_user_id FROM customer WHERE id=94101) <> 14103 THEN RAISE EXCEPTION 'Valid assignment not persisted'; END IF;
      IF (SELECT COUNT(*) FROM customer_tag_relation WHERE customer_id=94101) <> 1 OR NOT EXISTS(SELECT 1 FROM customer_tag_relation WHERE customer_id=94101 AND tag_id=94111) THEN RAISE EXCEPTION 'Only legitimate own-tag relation permitted'; END IF;
      IF (SELECT COUNT(*) FROM sop_template WHERE template_name='sop-action-valid-tag' AND corp_id=1 AND create_user_id=14102 AND description IS NULL) <> 1 OR (SELECT COUNT(*) FROM sop_execution e JOIN sop_template t ON t.id=e.template_id WHERE t.template_name='sop-action-valid-tag' AND e.status=1 AND e.current_step=1) <> 1 THEN RAISE EXCEPTION 'HTTP atomic create/tag execution mismatch'; END IF;
      IF (SELECT COUNT(*) FROM notification) <> 1 OR NOT EXISTS(SELECT 1 FROM notification WHERE corp_id=1 AND user_id=14103 AND title='sop-valid-notification') THEN RAISE EXCEPTION 'Only one deduplicated valid notification permitted'; END IF;
      IF (SELECT COUNT(*) FROM message_log) <> 2 OR (SELECT COUNT(*) FROM message_log WHERE corp_id=1 AND target_id=94101 AND message_type=5 AND send_status=1 AND template_id=94201) <> 2 THEN RAISE EXCEPTION 'Exactly two owned-ref explicit Mock logs permitted'; END IF;
      IF NOT EXISTS(SELECT 1 FROM message_log WHERE content='SOP action Mock only' AND extra->>'fixture'='message' AND extra->>'keep'='true') OR NOT EXISTS(SELECT 1 FROM message_log WHERE content='SOP material Mock only' AND extra->>'fixture'='material' AND extra->>'keep'='true') THEN RAISE EXCEPTION 'Reference must preserve explicit content and extra metadata'; END IF;
      IF NOT EXISTS(SELECT 1 FROM sop_step WHERE template_id=94125 AND action_content->'metadata'->>'keep'='true' AND action_content->>'staffId'='14103') THEN RAISE EXCEPTION 'Saved action metadata/alias lost'; END IF;
      IF NOT EXISTS(SELECT 1 FROM sop_step WHERE template_id=94129 AND jsonb_typeof(action_content)='string') THEN RAISE EXCEPTION 'Legacy JSON-string action overwritten'; END IF;
      IF (SELECT status FROM message_template WHERE id=94201) <> 0 OR (SELECT message_type FROM message_template WHERE id=94201) <> 1 THEN RAISE EXCEPTION 'Reference metadata must not rewrite disabled/channel template'; END IF;

    END $$;`);
    const evidence=psql('SELECT version(); SELECT template_id,target_type,customer_id,group_id,status,current_step,error_message FROM sop_execution ORDER BY template_id; SELECT id,corp_id,follow_user_id FROM customer WHERE id=94101; SELECT corp_id,user_id,title FROM notification; SELECT corp_id,template_id,message_type,target_id,content,extra,send_status FROM message_log; SELECT * FROM customer_tag_relation WHERE customer_id=94101;');
    fs.writeFileSync(path.join(artifactDir,'database-evidence.txt'),evidence+'\n');
    outcome.httpCases=13; outcome.unavailableDependencies=unavailableRequests;
    console.log('PASS SOP action realHTTP13 and exact SQL: six failed steps no progress, five valid actions, two Mock-only logs.');
    testPassed = true;
  } catch (error) {
    outcome.error = error.message;
    outcome.unavailableDependencies = unavailableRequests;
    for (const name of ['auth-service', 'customer-service', 'message-service', 'operation-service', 'gateway-service']) {
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
