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
  if (process.env.CUSTOMER_INPUT_HTTP_CHILD !== '1' || process.env.DB_HOST !== '127.0.0.1' ||
    process.env.DB_DATABASE !== 'consent_http' || process.env.DB_USERNAME !== 'consent_verify' ||
    process.env.DB_PASSWORD !== 'disposable_consent_only' || Number(process.env.DB_PORT) === 5432 ||
    !Number.isSafeInteger(Number(process.env.DB_PORT)) || Number(process.env.DB_PORT) <= 0 ||
    process.env.REDIS_HOST !== '127.0.0.1' || !Number.isSafeInteger(Number(process.env.REDIS_PORT)) ||
    Number(process.env.REDIS_PORT) <= 0 || Number(process.env.REDIS_PORT) === 6379 ||
    !['auth-service','customer-service','gateway-service'].includes(process.argv[3])) {
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
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-customer-input-http-'));
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
    const id = command('docker', ['create', '--name', `open-scrm-customer-input-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=customer-input-http', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
    ownedContainers.push(id);
    command('docker', ['start', ...(process.env.CUSTOMER_INPUT_FAULT_START === '1' ? ['--open-scrm-forced-invalid-start-option'] : []), id]);
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
    psql(`INSERT INTO "user"(id,corp_id,username,password,status)
      SELECT 9002,2,'consent_other',password,1 FROM "user" WHERE corp_id=1 AND username='admin';
      INSERT INTO "user"(id,corp_id,username,password,status)
      SELECT 9106,1,'customer-input-owner',password,1 FROM "user" WHERE corp_id=1 AND username='admin';
      INSERT INTO customer(id,corp_id,external_userid,name,status,follow_user_id) VALUES
      (100,1,'input-preserve','original input row',1,9106),(200,2,'input-foreign','foreign input row',1,NULL),
      (9007199254740991,1,'input-bigint-max','safe MAX input row',1,NULL);
      INSERT INTO customer_tag(id,corp_id,tag_name) VALUES (8101,1,'input own tag'),(8102,2,'input foreign tag');`);
    const ports = { auth: await freePort(), customer: await freePort(), gateway: await freePort() };
    const baseEnv = { ...process.env, CUSTOMER_INPUT_HTTP_CHILD: '1', NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: String(pg.port),
      DB_USERNAME: 'consent_verify', DB_USER: 'consent_verify', DB_PASSWORD: 'disposable_consent_only', DB_DATABASE: 'consent_http',
      REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redis.port), REDIS_PASSWORD: '',
      JWT_SECRET: `disposable-consent-jwt-${runId}`, APP_KEYS: `disposable-consent-keys-${runId}`,
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
    const assert=require('node:assert/strict');const checks=[];
    async function request(path,token,body,method=body===undefined?'GET':'POST',headers={}){const r=await fetch(`http://127.0.0.1:${ports.gateway}${path}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`} :{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(5000)});return {status:r.status,body:await r.json()};}
    const login=async(username,corpId)=>{const r=await request('/api/v1/auth/login',undefined,{username,password:'Admin@123',corpId});assert.equal(r.status,200);return r.body.accessToken};const a=await login('admin',1),b=await login('consent_other',2);checks.push('two real tenant logins');
    const customer=(externalUserid,patch={})=>({externalUserid,name:externalUserid,...patch});
    const total=()=>psql('SELECT COUNT(*) FROM customer;');const baseline=total();
    for(const [index,tagIds] of [[0,[999999]],[1,[8102]],[2,[8101,8102]]]){const r=await request('/api/v1/customers',a,customer(`input-invalid-tag-${index}`,{tagIds}));assert.equal(r.status,400,JSON.stringify(r));assert.equal(total(),baseline)}
    const bForeign=await request('/api/v1/customers',b,customer('input-b-foreign-tag',{tagIds:[8101]}),'POST',{'x-corp-id':'1','x-user-id':'1'});assert.equal(bForeign.status,400);assert.equal(total(),baseline);checks.push('missing foreign and mixed numeric tags400 with no customers created');
    for(const [index,tagIds] of [[0,['8101']],[1,[0]],[2,[2147483648]],[3,[[8101]]]]){const r=await request('/api/v1/customers',a,customer(`input-format-tag-${index}`,{tagIds}));assert.equal(r.status,422,JSON.stringify(r));assert.equal(total(),baseline)}checks.push('tag JSON formats remain strict422 without rows');
    const valid=await request('/api/v1/customers',a,customer('input-valid-a',{tagIds:[8101,8101],followUserId:9106}));assert.equal(valid.status,200,JSON.stringify(valid));const createdId=String(valid.body.data.id);assert.deepEqual(valid.body.data.tags.map(t=>t.id),[8101]);
    psql(`DO $$ BEGIN IF (SELECT COUNT(*) FROM customer WHERE external_userid='input-valid-a' AND corp_id=1 AND follow_user_id=9106)<>1 OR (SELECT COUNT(*) FROM customer_tag_relation r JOIN customer c ON c.id=r.customer_id WHERE c.external_userid='input-valid-a' AND r.tag_id=8101)<>1 THEN RAISE EXCEPTION 'valid dedupe not one row and relation'; END IF; END $$;`);checks.push('valid duplicate tags create exactly one customer one relation');
    psql(`CREATE FUNCTION customer_input_relation_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF EXISTS(SELECT 1 FROM customer WHERE id=NEW.customer_id AND external_userid='input-trigger-fail') THEN RAISE EXCEPTION 'injected join failure after customer row observed'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER customer_input_relation_fault BEFORE INSERT ON customer_tag_relation FOR EACH ROW EXECUTE FUNCTION customer_input_relation_fault();`);
    const rollback=await request('/api/v1/customers',a,customer('input-trigger-fail',{tagIds:[8101]}));assert.equal(rollback.status,500);assert.equal(rollback.body.code,'P0001');
    psql(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM customer WHERE external_userid='input-trigger-fail') OR (SELECT COUNT(*) FROM customer_tag_relation)<>1 THEN RAISE EXCEPTION 'customer insert not rolled back'; END IF; END $$; DROP TRIGGER customer_input_relation_fault ON customer_tag_relation; DROP FUNCTION customer_input_relation_fault();`);checks.push('actual join trigger after observing inserted customer rejects and whole customer rolls back');
    const invalidOwners=['1','1e0','0x1',' 1','01',true,false,[],[1],0,-1,1.5,Number.MAX_SAFE_INTEGER+1];
    for(const [index,followUserId] of invalidOwners.entries()){
      const c=await request('/api/v1/customers',a,customer(`input-invalid-owner-${index}`,{followUserId}));assert.equal(c.status,422,JSON.stringify(c));
      const u=await request('/api/v1/customers/100',a,{followUserId},'PUT');assert.equal(u.status,422,JSON.stringify(u));
    }
    psql(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM customer WHERE external_userid LIKE 'input-invalid-owner-%') OR NOT EXISTS(SELECT 1 FROM customer WHERE id=100 AND follow_user_id=9106 AND name='original input row') THEN RAISE EXCEPTION 'owner coercion wrote employee1'; END IF; END $$;`);checks.push('26 noncanonical owner create update422 do not assign employee1');
    assert.equal((await request('/api/v1/customers/100',a,{followUserId:null},'PUT')).status,200);psql(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM customer WHERE id=100 AND follow_user_id IS NULL AND name='original input row') THEN RAISE EXCEPTION 'explicit null owner clear failed'; END IF; END $$;`);checks.push('explicit null update clears owner legitimately');
    const beforePaths=psql("SELECT row_to_json(c) FROM customer c WHERE id IN (100,200,9007199254740991) ORDER BY id;");
    for(const id of ['100junk','100.5','100e0','0100','%20100','0','-1','9007199254740993'])for(const method of ['GET','PUT','DELETE']){const r=await request(`/api/v1/customers/${id}`,a,method==='PUT'?{name:'must not overwrite'}:undefined,method);assert.equal(r.status,400,`${method} ${id}: ${JSON.stringify(r)}`)}
    assert.equal(psql("SELECT row_to_json(c) FROM customer c WHERE id IN (100,200,9007199254740991) ORDER BY id;"),beforePaths);checks.push('24 malformed CRUD paths400 preserve exact original fixture rows');
    const max=await request(`/api/v1/customers/${Number.MAX_SAFE_INTEGER}`,a);assert.equal(max.status,200,JSON.stringify(max));assert.equal(String(max.body.data.id),String(Number.MAX_SAFE_INTEGER));assert.equal(max.body.data.name,'safe MAX input row');checks.push('bigint MAX_SAFE actual own customer detail200 exact');
    const ownB=await request('/api/v1/customers/200',b,undefined,'GET',{'x-corp-id':'1','x-user-id':'1'});assert.equal(ownB.status,200);assert.equal(ownB.body.data.name,'foreign input row');checks.push('B reads own fixture despite forged A headers');
    psql(`DO $$ BEGIN
      IF (SELECT COUNT(*) FROM customer WHERE external_userid LIKE 'input-%')<>4 THEN RAISE EXCEPTION 'expected three seed and one created customer'; END IF;
      IF (SELECT COUNT(*) FROM customer_tag_relation)<>1 OR NOT EXISTS(SELECT 1 FROM customer_tag_relation WHERE customer_id=${createdId} AND tag_id=8101) THEN RAISE EXCEPTION 'expected exact one own relation'; END IF;
      IF NOT EXISTS(SELECT 1 FROM customer_tag WHERE id=8102 AND corp_id=2 AND tag_name='input foreign tag') THEN RAISE EXCEPTION 'foreign tag changed'; END IF;
      IF (SELECT COUNT(*) FROM message_log)<>0 THEN RAISE EXCEPTION 'customer input must not send messages'; END IF;
    END $$;`);checks.push('SQL exact four dedicated customers one relation and zero messages');
    const evidence=psql("SELECT id,corp_id,external_userid,name,status,follow_user_id FROM customer WHERE external_userid LIKE 'input-%' ORDER BY id; SELECT * FROM customer_tag_relation;");fs.writeFileSync(path.join(artifactDir,'database-evidence.txt'),evidence+'\n');Object.assign(outcome,{checks,checkCount:checks.length,expectedDedicatedCustomers:4,expectedCreatedCustomers:1,expectedRelations:1,expectedMessageRows:0});console.log(JSON.stringify({checks,evidence}));
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
