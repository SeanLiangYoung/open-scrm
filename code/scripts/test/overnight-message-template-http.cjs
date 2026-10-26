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
  if (process.env.MESSAGE_TEMPLATE_HTTP_CHILD !== '1' || process.env.DB_HOST !== '127.0.0.1' ||
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
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-message-template-http-'));
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
    const id = command('docker', ['create', '--name', `open-scrm-message-template-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=message-template-http', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
    ownedContainers.push(id);
    command('docker', ['start', ...(process.env.MESSAGE_TEMPLATE_FAULT_START === '1' ? ['--open-scrm-forced-invalid-start-option'] : []), id]);
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
    const baseEnv = { ...process.env, MESSAGE_TEMPLATE_HTTP_CHILD: '1', NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: String(pg.port),
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
    const assert=require('node:assert/strict');const checks=[];
    async function request(path,token,body,method=body===undefined?'GET':'POST',headers={}){
      const r=await fetch(`http://127.0.0.1:${ports.gateway}${path}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`} :{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(5000)});return{status:r.status,body:await r.json()};
    }
    const login=async(username,corpId)=>{const r=await request('/api/v1/auth/login',undefined,{username,password:'Admin@123',corpId});assert.equal(r.status,200);return r.body.accessToken};
    const a=await login('admin',1),b=await login('consent_other',2);checks.push('two real tenant logins');
    psql(`INSERT INTO message_template(id,corp_id,template_name,template_type,message_type,content,status) VALUES
      (9201,1,'own disabled reference',1,1,'must not replace explicit content',0),(9202,2,'foreign template',1,5,'foreign private content',1),(9203,1,'own editable template',1,5,'original own content',1);
      INSERT INTO message_log(id,corp_id,message_type,target_type,target_id,content,send_status,retry_count,idempotency_key) VALUES
      (9101,1,5,2,1,'prior Mock result',1,0,'existing-key'),(9102,2,5,2,9002,'foreign prior Mock',1,0,NULL);`);
    assert.equal((await request('/api/message/template/9203',a)).body.data.templateName,'own editable template');assert.equal((await request('/api/message/template/9202',b)).body.data.templateName,'foreign template');checks.push('valid own template details tenant scoped');
    const boundaryProbes=[];
    for(const id of [2147483648,Number.MAX_SAFE_INTEGER]){
      boundaryProbes.push({kind:'detail',id,...await request(`/api/message/template/${id}`,a)});
      boundaryProbes.push({kind:'single-ref',id,...await request('/api/message/send',a,{messageType:5,targetType:2,targetIds:[1],content:'int boundary probe',templateId:id})});
      boundaryProbes.push({kind:'batch-ref',id,...await request('/api/message/send/batch',a,{messageType:5,targetType:2,targetIds:[1],content:'int boundary probe',templateId:id})});
    }
    const maxLog=await request(`/api/message/log/${Number.MAX_SAFE_INTEGER}`,a);
    Object.assign(outcome,{integerBoundaryProbes:boundaryProbes,maxSafeLogProbe:maxLog});
    console.log(JSON.stringify({integerBoundaryProbes:boundaryProbes,maxSafeLogProbe:maxLog}));
    assert.equal(maxLog.status,200);assert.equal(maxLog.body.data,null);
    const intMax=await request('/api/message/template/2147483647',a);assert.equal(intMax.status,200);assert.equal(intMax.body.data,null);
    const intMaxRef=await request('/api/message/send',a,{messageType:5,targetType:2,targetIds:[1],content:'intmax format accepted',templateId:2147483647});assert.equal(intMaxRef.status,404);

    for(const probe of boundaryProbes)assert.equal(probe.status,400,`int4 boundary ${JSON.stringify(probe)}`);
    checks.push('int4 template out-of-range safely rejected while bigint log safe max readable');

    for(const suffix of ['tail','.9','e0']){
      for(const method of ['GET','PUT','DELETE']){const r=await request(`/api/message/template/9203${suffix}`,a,method==='PUT'?{templateName:'must not update'}:undefined,method);assert.equal(r.status,400,`${method} ${suffix}: ${JSON.stringify(r)}`)}
    }
    psql(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM message_template WHERE id=9203 AND corp_id=1 AND template_name='own editable template') OR (SELECT COUNT(*) FROM message_template WHERE id IN (9201,9202,9203))<>3 THEN RAISE EXCEPTION 'malformed path changed template'; END IF; END $$;`);checks.push('nine malformed template paths400 with SQL row unchanged');
    for(const path of ['/api/message/log/9101tail','/api/message/log/9007199254740993','/api/v1/messages/logs/9101.5','/api/v1/messages/logs/9007199254740993'])assert.equal((await request(path,a)).status,400,path);
    assert.equal(String((await request('/api/message/log/9101',a)).body.data.id),'9101');assert.equal((await request('/api/message/log/9102',a)).body.data,null);checks.push('legacy and v1 log malformed unsafe400 without foreign read');
    const input={messageType:5,targetType:2,targetIds:[1],content:'explicit own content'};
    for(const path of ['/api/message/send','/api/message/send/batch'])for(const templateId of [9202,999999]){const r=await request(path,a,{...input,templateId});assert.equal(r.status,404,JSON.stringify(r))}checks.push('single and batch foreign missing reference404');
    for(const path of ['/api/message/send','/api/message/send/batch','/api/v1/messages/send'])for(const templateId of ['9201',0,-1,1.5,null,Number.MAX_SAFE_INTEGER+1])assert.equal((await request(path,a,{...input,templateId})).status,400,`${path} ref ${templateId}`);checks.push('eighteen strict JSON template reference400');
    assert.equal((await request('/api/message/send',a,{...input,content:null})).status,422);checks.push('unrelated invalid content retains legacy422');
    const policyKeys=()=>command('docker',['exec',redis.id,'redis-cli','--raw','--scan','--pattern','msg:policy:*']);const beforePolicy=policyKeys();
    const early=await request('/api/v1/messages/send',a,{...input,targetType:1,targetIds:[9001],consentPurpose:'marketing',regionPackId:'test-e2e-policy',templateId:9202,idempotencyKey:'existing-key'});
    assert.equal(early.status,404);assert.equal(policyKeys(),beforePolicy);psql(`DO $$ BEGIN IF (SELECT COUNT(*) FROM message_log)<>2 THEN RAISE EXCEPTION 'negative reference wrote logs'; END IF; END $$;`);checks.push('v1 rejects foreign reference before missing consent quota and existing key replay');
    const single=await request('/api/message/send',a,{...input,templateId:9201});assert.equal(single.status,200);assert.equal(single.body.data.success,1);
    const batch=await request('/api/message/send/batch',a,{...input,targetIds:[1,2],templateId:9201});assert.equal(batch.status,200);assert.equal(batch.body.data.success,2);checks.push('own disabled other-channel template reference keeps explicit Mock single batch content');
    const ownB=await request('/api/message/send',b,{...input,targetIds:[9002],templateId:9202},'POST',{'x-corp-id':'1','x-user-id':'1'});assert.equal(ownB.status,200);assert.equal(ownB.body.data.success,1);checks.push('B can reference own template despite spoofed A identity headers');
    const plain=await request('/api/message/send',a,input);assert.equal(plain.status,200);assert.equal(plain.body.data.success,1);checks.push('no optional template remains supported');
    assert.equal((await request('/api/message/template/9203',a,{templateName:'correct update'},'PUT')).status,200);assert.equal((await request('/api/message/template/9203',a)).body.data.templateName,'correct update');assert.equal((await request('/api/message/template/9203',a,undefined,'DELETE')).status,200);checks.push('valid own update delete still work');
    psql(`DO $$ BEGIN
      IF (SELECT COUNT(*) FROM message_template WHERE id IN (9201,9202,9203))<>2 OR EXISTS(SELECT 1 FROM message_template WHERE id=9203) THEN RAISE EXCEPTION 'template CRUD mismatch'; END IF;
      IF NOT EXISTS(SELECT 1 FROM message_template WHERE id=9202 AND corp_id=2 AND content='foreign private content') THEN RAISE EXCEPTION 'foreign template changed'; END IF;
      IF (SELECT COUNT(*) FROM message_log)<>7 THEN RAISE EXCEPTION 'expected exactly7 logs'; END IF;
      IF (SELECT COUNT(*) FROM message_log WHERE corp_id=1 AND template_id=9201 AND message_type=5 AND send_status=1 AND content='explicit own content')<>3 THEN RAISE EXCEPTION 'own metadata refs mismatch'; END IF;
      IF (SELECT COUNT(*) FROM message_log WHERE corp_id=2 AND template_id=9202 AND message_type=5 AND send_status=1 AND content='explicit own content')<>1 THEN RAISE EXCEPTION 'B metadata ref mismatch'; END IF;
      IF EXISTS(SELECT 1 FROM message_log WHERE corp_id=1 AND template_id=9202) THEN RAISE EXCEPTION 'foreign reference persisted'; END IF;
    END $$;`);checks.push('exact SQL two dedicated templates seven logs and zero cross tenant references');
    const evidence=psql("SELECT id,corp_id,template_name,status,message_type FROM message_template WHERE id IN (9201,9202,9203) ORDER BY id; SELECT corp_id,template_id,message_type,send_status,content FROM message_log ORDER BY id;");fs.writeFileSync(path.join(artifactDir,'database-evidence.txt'),evidence+'\n');Object.assign(outcome,{checks,checkCount:checks.length,expectedDedicatedTemplates:2,expectedMessageRows:7});console.log(JSON.stringify({checks,evidence}));
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
