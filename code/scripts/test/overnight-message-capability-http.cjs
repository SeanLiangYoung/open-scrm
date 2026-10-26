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
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-message-capability-http-'));
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
    const id = command('docker', ['run', '--rm', '--detach', '--name', `open-scrm-message-capability-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=message-capability-http', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
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
    const send = messageType => ({ messageType, targetType: 2, targetIds: [1], content: 'capability fixture only' });
    for (const type of [1, 2, 3, 4]) {
      psql(`INSERT INTO message_log (id,corp_id,message_type,target_type,target_id,content,send_status,retry_count,idempotency_key)
        VALUES (${9200 + type},1,${type},2,1,'historical placeholder success',1,0,'legacy-channel-${type}'),
        (${9300 + type},1,${type},2,1,'failed unsupported channel',2,0,NULL);`);
    }
    psql(`INSERT INTO message_log (id,corp_id,message_type,target_type,target_id,content,send_status,retry_count)
      VALUES (9401,2,5,2,9002,'foreign failed Mock',2,0);`);
    const redisCommand = (...args) => command('docker', ['exec', redis.id, 'redis-cli', '--raw', ...args]);
    function policySnapshot() {
      const keys = redisCommand('--scan', '--pattern', 'msg:policy:*').split('\n').filter(Boolean).sort();
      return keys.map(key => [key, redisCommand('GET', key)]);
    }
    const baselinePolicy = policySnapshot();
    const baselineConsents = psql('SELECT COUNT(*) FROM consent_record;');
    for (const type of [1, 2, 3, 4]) {
      const result = await request('/api/v1/messages/send', { ...send(type), targetType: 1, targetIds: [9001],
        consentPurpose: 'marketing', regionPackId: 'th-bangkok' }, tokenA);
      assert.equal(result.status, 400, JSON.stringify(result));
      assert.match(JSON.stringify(result.body), /渠道|channel/i);
      checks.push(`channel${type} marketing rejects capability before missing consent403`);
    }
    assert.deepEqual(policySnapshot(), baselinePolicy);
    assert.equal(psql('SELECT COUNT(*) FROM consent_record;'), baselineConsents);
    psql(`INSERT INTO consent_record (corp_id,subject_type,subject_id,purpose,policy_version)
      VALUES (1,'customer',9001,'marketing','capability-precedence-fixture');`);
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const quotaKey = `msg:policy:1:th-bangkok:1:9001:${day}`;
    redisCommand('SET', quotaKey, '999');
    const saturatedPolicy = policySnapshot();
    for (const type of [1, 2, 3, 4]) {
      const result = await request('/api/v1/messages/send', { ...send(type), targetType: 1, targetIds: [9001],
        consentPurpose: 'marketing', regionPackId: 'th-bangkok' }, tokenA);
      assert.equal(result.status, 400, JSON.stringify(result));
      assert.match(JSON.stringify(result.body), /渠道|channel/i);
      checks.push(`channel${type} marketing rejects capability before quota or quiet429`);
    }
    assert.deepEqual(policySnapshot(), saturatedPolicy);
    psql(`DO $$ BEGIN
      IF (SELECT COUNT(*) FROM message_log)<>9 THEN RAISE EXCEPTION 'marketing rejection wrote message'; END IF;
      IF (SELECT COUNT(*) FROM consent_record WHERE subject_id=9001 AND corp_id=1 AND policy_version='capability-precedence-fixture' AND revoked_at IS NULL)<>1 THEN RAISE EXCEPTION 'consent fixture changed'; END IF;
    END $$;`);
    checks.push('eight unsupported marketing requests preserve exact DB rows and Redis policy key values');
    Object.assign(outcome, { policySnapshots: { baseline: baselinePolicy, saturated: saturatedPolicy, after: policySnapshot() } });
    const legacyMarketingPolicy = policySnapshot();
    const legacyMarketing = await request('/api/v1/messages/send', { ...send(5), targetType: 1, targetIds: [9001],
      consentPurpose: 'marketing', regionPackId: 'th-bangkok', idempotencyKey: 'legacy-channel-1' }, tokenA);
    assert.equal(legacyMarketing.status, 400, JSON.stringify(legacyMarketing));
    assert.match(JSON.stringify(legacyMarketing.body), /渠道|channel/i);
    assert.deepEqual(policySnapshot(), legacyMarketingPolicy);
    psql(`DO $$ BEGIN IF (SELECT COUNT(*) FROM message_log)<>9 OR
      NOT EXISTS(SELECT 1 FROM message_log WHERE id=9201 AND corp_id=1 AND message_type=1 AND send_status=1 AND retry_count=0 AND content='historical placeholder success')
      THEN RAISE EXCEPTION 'legacy marketing rejection changed logs'; END IF; END $$;`);
    checks.push('v1 Mock marketing historical channel1 key rejects400 before policy and preserves Redis plus old row');
    const templates = {};
    for (const type of [1, 2, 3, 4, 5]) {
      const result = await request('/api/message/template', { templateName: `capability-${type}`, templateType: 1,
        messageType: type, content: 'template fixture {{name}}' }, tokenA);
      assert.equal(result.status, 200, JSON.stringify(result)); templates[type] = result.body.data.id;
    }
    checks.push('create five typed templates including explicit Mock5');
    for (const type of [1, 2, 3, 4]) {
      for (const [label, route, body] of [
        ['initial', '/api/message/send', send(type)],
        ['batch', '/api/message/send/batch', { ...send(type), targetIds: [1, 2] }],
        ['template', '/api/message/send/template', { templateId: Number(templates[type]), targetType: 2, targetIds: [1], variables: { name: 'test' } }],
        ['historic-idempotent', '/api/message/send', { ...send(type), idempotencyKey: `legacy-channel-${type}` }],
      ]) {
        const result = await request(route, body, tokenA);
        assert.equal(result.status, 400, `${type}/${label}: ${JSON.stringify(result)}`);
        assert.match(JSON.stringify(result.body), /渠道|channel/i); checks.push(`channel${type} ${label} rejects400`);
      }
    }
    const disguised = await request('/api/message/send', { ...send(5), idempotencyKey: 'legacy-channel-1' }, tokenA);
    assert.equal(disguised.status, 400, JSON.stringify(disguised)); checks.push('Mock request cannot replay historical real-channel success');
    psql(`DO $$ BEGIN IF (SELECT COUNT(*) FROM message_log)<>9 THEN RAISE EXCEPTION 'rejected sends created logs'; END IF;
      IF (SELECT COUNT(*) FROM message_log WHERE id BETWEEN 9201 AND 9204 AND send_status=1 AND retry_count=0 AND send_time IS NULL AND content='historical placeholder success')<>4 THEN RAISE EXCEPTION 'historical rows changed'; END IF;
    END $$;`); checks.push('all rejected sends leave exact nine fixture rows and four historic rows unchanged');
    for (const type of [1, 2, 3, 4]) {
      const result = await request('/api/message/retry', { logIds: [9300 + type, 9401] }, tokenA, { 'x-corp-id': '2', 'x-user-id': '9002' });
      assert.equal(result.status, 200); assert.equal(result.body.data.total, 1);
      assert.equal(result.body.data.failed, 1); assert.equal(result.body.data.success, 0);
      assert.match(JSON.stringify(result.body.data.details), /渠道|channel/i); checks.push(`channel${type} retry remains failed with tenant isolation`);
    }
    psql(`DO $$ BEGIN
      IF (SELECT COUNT(*) FROM message_log WHERE id BETWEEN 9301 AND 9304 AND send_status=2 AND retry_count=1 AND send_time IS NULL AND fail_reason IS NOT NULL)<>4 THEN RAISE EXCEPTION 'unsupported retry became success'; END IF;
      IF NOT EXISTS(SELECT 1 FROM message_log WHERE id=9401 AND corp_id=2 AND send_status=2 AND retry_count=0 AND content='foreign failed Mock') THEN RAISE EXCEPTION 'foreign row changed'; END IF;
    END $$;`); checks.push('raw PG four failures preserved and foreign row untouched');
    const body5 = { ...send(5), idempotencyKey: 'explicit-mock' };
    const first = await request('/api/message/send', body5, tokenA);
    const replay = await request('/api/message/send', body5, tokenA);
    assert.equal(first.status, 200); assert.equal(replay.status, 200);
    assert.equal(first.body.data.success, 1); assert.equal(replay.body.data.success, 1);
    assert.equal(String(first.body.data.details[0].messageLogId), String(replay.body.data.messageLogId));
    assert.equal(replay.body.data.idempotentReplay, true); checks.push('Mock5 initial and same-log replay');
    const batch = await request('/api/message/send/batch', { ...send(5), targetIds: [1, 2] }, tokenA);
    assert.equal(batch.status, 200); assert.equal(batch.body.data.success, 2); checks.push('Mock5 batch two successes');
    const template = await request('/api/message/send/template', { templateId: Number(templates[5]), targetType: 2,
      targetIds: [1], variables: { name: 'test' } }, tokenA);
    assert.equal(template.status, 200); assert.equal(template.body.data.success, 1); checks.push('Mock5 template success');
    const secondTenant = await request('/api/message/send', { ...send(5), targetIds: [9002], idempotencyKey: 'explicit-mock' }, tokenB,
      { 'x-corp-id': '1', 'x-user-id': '1' });
    assert.equal(secondTenant.status, 200); assert.equal(secondTenant.body.data.success, 1); checks.push('same key independent tenant Mock5 success despite spoofed headers');
    psql(`DO $$ BEGIN
      IF (SELECT COUNT(*) FROM message_log)<>14 THEN RAISE EXCEPTION 'expected exact 14 rows'; END IF;
      IF (SELECT COUNT(*) FROM message_log WHERE message_type=5 AND send_status=1)<>5 THEN RAISE EXCEPTION 'expected five new Mock successes'; END IF;
      IF (SELECT COUNT(*) FROM message_log WHERE idempotency_key='explicit-mock')<>2 OR
        (SELECT COUNT(DISTINCT corp_id) FROM message_log WHERE idempotency_key='explicit-mock')<>2 THEN RAISE EXCEPTION 'tenant key isolation wrong'; END IF;
      IF (SELECT COUNT(*) FROM message_log WHERE message_type IN (1,2,3,4) AND send_status=1)<>4 THEN RAISE EXCEPTION 'new unsupported success'; END IF;
    END $$;`); checks.push('exact14 rows: four historical successes four failed unsupported one foreign failed five Mock successes');
    const evidence = psql('SELECT corp_id,message_type,send_status,COUNT(*) FROM message_log GROUP BY corp_id,message_type,send_status ORDER BY corp_id,message_type,send_status; SELECT id,corp_id,message_type,send_status,retry_count,fail_reason FROM message_log WHERE id BETWEEN 9301 AND 9401 ORDER BY id;');
    fs.writeFileSync(path.join(artifactDir, 'database-evidence.txt'), evidence + '\n');
    Object.assign(outcome, { checks, checkCount: checks.length, expectedMessageRows: 14 });
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
