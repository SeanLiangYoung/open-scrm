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
  if (process.env.CONSENT_READ_HTTP_CHILD !== '1' || process.env.DB_HOST !== '127.0.0.1' ||
    process.env.DB_DATABASE !== 'consent_http' || process.env.DB_USERNAME !== 'consent_verify' ||
    process.env.DB_PASSWORD !== 'disposable_consent_only' || Number(process.env.DB_PORT) === 5432 ||
    !Number.isSafeInteger(Number(process.env.DB_PORT)) || Number(process.env.DB_PORT) <= 0 ||
    process.env.REDIS_HOST !== '127.0.0.1' || !Number.isSafeInteger(Number(process.env.REDIS_PORT)) ||
    Number(process.env.REDIS_PORT) <= 0 || Number(process.env.REDIS_PORT) === 6379 ||
    !['auth-service','message-service','gateway-service'].includes(process.argv[3])) {
    throw Error('Refusing non-disposable consent read service profile');
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
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-consent-read-http-http-'));
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
    const id = command('docker', ['create', '--name', `open-scrm-consent-read-http-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=consent-read-http', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
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
    const baseEnv = { ...process.env, CONSENT_READ_HTTP_CHILD: '1', NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: String(pg.port),
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
    async function request(route, token, body, headers = {}) {
      const response = await fetch(`http://127.0.0.1:${ports.gateway}${route}`, { method: body === undefined ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(5000) });
      return { status: response.status, body: await response.json() };
    }
    const login = async (username,corpId) => {const r=await request('/api/v1/auth/login',undefined,{username,password:'Admin@123',corpId});assert.equal(r.status,200);assert.ok(r.body.accessToken);return r.body.accessToken};
    const a=await login('admin',1),b=await login('consent_other',2);checks.push('two real tenant logins');
    const url=id=>`/api/v1/messages/consents/customer/${id}`;
    const get=(id,token=a,query='')=>request(url(id)+query,token,undefined,{'x-corp-id':token===a?'2':'1','x-user-id':'9002'});
    assert.equal((await request(url(9001))).status,401);checks.push('anonymous read401');
    const zero=await get(9001);assert.equal(zero.status,200);assert.deepEqual({...zero.body.data,observedAt:'time'}, {customerId:'9001',purpose:'marketing',observedAt:'time',hasActiveMarketingConsent:false,activeCount:0,revokedCount:0,total:0,page:1,pageSize:20,list:[]});assert(Number.isFinite(Date.parse(zero.body.data.observedAt)));checks.push('own zero evidence real snapshot with forged foreign headers ignored');
    for(const policyVersion of ['read-http-a1','read-http-a2']){const r=await request('/api/v1/messages/consents/grant',a,{customerId:9001,purpose:'marketing',policyVersion,channel:'web',locale:'zh-CN'});assert.equal(r.status,200)}
    psql(`INSERT INTO consent_record(id,corp_id,subject_type,subject_id,purpose,policy_version,created_at,revoked_at)
      VALUES(9007199254740993,1,'customer',9001,'marketing',NULL,now()-interval '1 day',now()-interval '1 hour');`);
    const mixed=await get(9001);assert.equal(mixed.status,200);assert.deepEqual([mixed.body.data.activeCount,mixed.body.data.revokedCount,mixed.body.data.total],[2,1,3]);assert.equal(mixed.body.data.hasActiveMarketingConsent,true);
    assert.deepEqual(Object.keys(mixed.body.data.list[0]).sort(),['id','purpose','policyVersion','channel','locale','createdAt','revokedAt'].sort());assert(mixed.body.data.list.every(row=>typeof row.id==='string'));checks.push('two active plus revoked legacy exact counts and whitelist');
    const page1=await get(9001,a,'?page=1&pageSize=1'),page2=await get(9001,a,'?page=2&pageSize=1'),page3=await get(9001,a,'?page=3&pageSize=1'),past=await get(9001,a,'?page=99&pageSize=1');
    for(const r of [page1,page2,page3,past]){assert.equal(r.status,200);assert.equal(r.body.data.total,3);assert.equal(r.body.data.activeCount,2)}
    assert.notEqual(page1.body.data.list[0].id,page2.body.data.list[0].id);assert.equal(page3.body.data.list[0].id,'9007199254740993');assert.equal(page3.body.data.list[0].policyVersion,null);assert.deepEqual(past.body.data.list,[]);checks.push('stable paged whitelist retains bigint null and global totals');
    assert.equal((await get(9001,b)).status,404);assert.equal((await get(9002,a)).status,404);assert.equal((await get(99999,a)).status,404);checks.push('foreign and missing identical404 despite forged headers');
    assert.equal((await request('/api/v1/messages/consents/grant',b,{customerId:9002,purpose:'marketing',policyVersion:'read-http-b',channel:'email',locale:'de-DE'})).status,200);
    const ownB=await get(9002,b);assert.equal(ownB.status,200);assert.equal(ownB.body.data.total,1);assert.equal(ownB.body.data.list[0].policyVersion,'read-http-b');checks.push('B reads only its own evidence');
    for(const id of ['0','-1','1.5','1e2','01','9007199254740993','7tail','%207'])assert.equal((await get(id)).status,400,`invalid ID ${id}`);checks.push('eight invalid path formats400');
    for(const query of ['?page=','?page=01','?page=1e2','?page=100001','?pageSize=101','?pageSize=0','?corpId=2','?userId=2','?purpose=marketing','?page=1&page=2','?pageSize=1&pageSize=2'])assert.equal((await get(9001,a,query)).status,400,query);checks.push('eleven invalid or duplicate query forms400');
    const send={messageType:5,targetType:1,targetIds:[9001],content:'read API disposable Mock',consentPurpose:'marketing',regionPackId:'test-e2e-policy'};
    const sent=await request('/api/v1/messages/send',a,send);assert.equal(sent.status,200);assert.equal(sent.body.data.success,1);checks.push('read grant evidence still permits explicit Mock marketing');
    const revoked=await request('/api/v1/messages/consents/revoke',a,{customerId:9001,purpose:'marketing'});assert.equal(revoked.status,200);assert.equal(revoked.body.data.revokedCount,2);
    const after=await get(9001);assert.deepEqual([after.body.data.activeCount,after.body.data.revokedCount,after.body.data.total],[0,3,3]);assert.equal(after.body.data.hasActiveMarketingConsent,false);assert(after.body.data.list.every(row=>row.revokedAt!==null));checks.push('revoke all reflects zero active three revoked without losing history');
    assert.equal((await request('/api/v1/messages/consents/revoke',a,{customerId:9001,purpose:'marketing'})).body.data.revokedCount,0);assert.equal((await get(9001)).body.data.total,3);checks.push('repeat revoke zero with stable totals');
    assert.equal((await request('/api/v1/messages/send',a,send)).status,403);checks.push('after revoke marketing403 without extra message');
    psql(`DO $$ BEGIN
      IF (SELECT COUNT(*) FROM consent_record WHERE subject_id IN (9001,9002))<>4 THEN RAISE EXCEPTION 'expected four dedicated evidence rows'; END IF;
      IF (SELECT COUNT(*) FROM consent_record WHERE subject_id=9001 AND corp_id=1 AND revoked_at IS NOT NULL)<>3 THEN RAISE EXCEPTION 'A history mismatch'; END IF;
      IF NOT EXISTS(SELECT 1 FROM consent_record WHERE subject_id=9002 AND corp_id=2 AND revoked_at IS NULL AND policy_version='read-http-b') THEN RAISE EXCEPTION 'B changed'; END IF;
      IF (SELECT COUNT(*) FROM message_log)<>1 OR NOT EXISTS(SELECT 1 FROM message_log WHERE corp_id=1 AND target_id=9001 AND message_type=5 AND send_status=1) THEN RAISE EXCEPTION 'message mismatch'; END IF;
    END $$;`);checks.push('raw SQL exact four evidence rows and one Mock log');
    const evidence=psql("SELECT id,corp_id,subject_id,policy_version,revoked_at IS NOT NULL AS revoked FROM consent_record WHERE subject_id IN (9001,9002) ORDER BY id; SELECT corp_id,message_type,target_id,send_status FROM message_log;");
    fs.writeFileSync(path.join(artifactDir,'database-evidence.txt'),evidence+'\n');Object.assign(outcome,{checks,checkCount:checks.length,expectedEvidenceRows:4,expectedMessageRows:1});console.log(JSON.stringify({checks,evidence}));
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
