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
  if (process.env.NOTIFICATION_IDENTIFIERS_HTTP_CHILD !== '1' || process.env.DB_HOST !== '127.0.0.1' ||
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
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-notification-identifiers-http-'));
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
    const id = command('docker', ['create', '--name', `open-scrm-notification-identifiers-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=notification-identifiers-http', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
    ownedContainers.push(id);
    command('docker', ['start', ...(process.env.NOTIFICATION_IDENTIFIERS_FAULT_START === '1' ? ['--open-scrm-forced-invalid-start-option'] : []), id]);
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
    const baseEnv = { ...process.env, NOTIFICATION_IDENTIFIERS_HTTP_CHILD: '1', NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: String(pg.port),
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
    async function request(path,token,body,method='POST',headers={}){const r=await fetch(`http://127.0.0.1:${ports.gateway}${path}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`} :{}),...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});return {status:r.status,body:await r.json()};}
    const login=async(username,corpId)=>{const r=await request('/api/v1/auth/login',undefined,{username,password:'Admin@123',corpId});assert.equal(r.status,200);return r.body.accessToken};const a=await login('admin',1),b=await login('consent_other',2);checks.push('two real tenant logins');
    psql(`INSERT INTO "user"(id,corp_id,username,password,status) SELECT 9007199254740991,1,'notification-safe-max',password,1 FROM "user" WHERE corp_id=1 AND username='admin';
      INSERT INTO notification(id,corp_id,user_id,notification_type,title,content,is_read) VALUES
      (9101,1,1,1,'own unread','own fixture',0),(9102,2,9002,1,'foreign unread','foreign fixture',0),(9007199254740991,1,1,1,'safe max unread','bigint fixture',0);`);
    const body=userIds=>({userIds,notificationType:1,title:'strict notification fixture',content:'no external send'});
    const invalid=['1','1e0','0x1',' 1','01',true,false,[true],['1e0'],[1,'1e0'],[[]],[[1]],[],Array(101).fill(1),[0],[-1],[1.5],[Number.MAX_SAFE_INTEGER+1],0,-1,1.5,Number.MAX_SAFE_INTEGER+1,null];
    for(const ids of invalid){const create=await request('/api/notification',a,body(ids));assert.equal(create.status,422,JSON.stringify({ids,create}));const read=await request('/api/notification/read',a,{notificationIds:ids},'PUT');assert.equal(read.status,422,JSON.stringify({ids,read}));}
    psql(`DO $$ BEGIN IF (SELECT COUNT(*) FROM notification)<>3 OR EXISTS(SELECT 1 FROM notification WHERE is_read<>0) THEN RAISE EXCEPTION 'invalid identifiers caused writes'; END IF; END $$;`);checks.push('46 invalid create/read shapes422 with exact unchanged seed rows');
    const max=await request('/api/notification',a,body(Number.MAX_SAFE_INTEGER));assert.equal(max.status,200);assert.equal(max.body.data.count,1);checks.push('safe bigint MAX numeric scalar recipient accepted beyond int32');
    const array=await request('/api/notification',a,body([1,1,Number.MAX_SAFE_INTEGER]));assert.equal(array.status,200);assert.equal(array.body.data.count,2);checks.push('numeric recipient array deduplicates own exact bigint IDs');
    const hundred=await request('/api/notification',a,body(Array(100).fill(1)));assert.equal(hundred.status,200);assert.equal(hundred.body.data.count,1);checks.push('one hundred numeric recipients permitted and deduplicated');
    const scalar=await request('/api/notification',a,body(1));assert.equal(scalar.status,200);assert.equal(scalar.body.data.count,1);checks.push('ordinary numeric scalar recipient preserved');
    const maxRead=await request('/api/notification/read',a,{notificationIds:Number.MAX_SAFE_INTEGER},'PUT');assert.equal(maxRead.status,200);assert.equal(maxRead.body.data.count,1);checks.push('safe bigint MAX numeric notification scalar read accepted');
    const mixed=await request('/api/notification/read',a,{notificationIds:[9101,9101,9102]},'PUT',{'x-corp-id':'2','x-user-id':'9002'});assert.equal(mixed.status,200);assert.equal(mixed.body.data.count,1);
    psql(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM notification WHERE id=9102 AND corp_id=2 AND is_read=0) THEN RAISE EXCEPTION 'foreign notification was marked'; END IF; END $$;`);checks.push('mixed numeric mark-read array keeps tenant filtering despite spoofed headers');
    const repeat=await request('/api/notification/read',a,{notificationIds:Array(100).fill(9101)},'PUT');assert.equal(repeat.status,200);assert.equal(repeat.body.data.count,0);checks.push('hundred numeric mark-read array allowed successful row not recounted');
    const bRead=await request('/api/notification/read',b,{notificationIds:9102},'PUT',{'x-corp-id':'1','x-user-id':'1'});assert.equal(bRead.status,200);assert.equal(bRead.body.data.count,1);checks.push('B numeric scalar reads own notification');
    const foreign=await request('/api/notification',a,body([1,9002]));assert.equal(foreign.status,400);checks.push('valid numeric foreign recipients still fail service400 without partial writes');
    psql(`DO $$ BEGIN
      IF (SELECT COUNT(*) FROM notification)<>8 THEN RAISE EXCEPTION 'expected exactly8 notifications'; END IF;
      IF (SELECT COUNT(*) FROM notification WHERE user_id=9007199254740991 AND corp_id=1)<>2 THEN RAISE EXCEPTION 'safe MAX recipient mapping mismatch'; END IF;
      IF (SELECT COUNT(*) FROM notification WHERE id IN (9101,9102,9007199254740991) AND is_read=1)<>3 THEN RAISE EXCEPTION 'read rows mismatch'; END IF;
      IF (SELECT COUNT(*) FROM message_log)<>0 THEN RAISE EXCEPTION 'no provider messages allowed'; END IF;
    END $$;`);checks.push('raw SQL exact eight notifications three read seeds and zero message logs');
    const evidence=psql('SELECT corp_id,user_id,COUNT(*) AS total,COUNT(*) FILTER(WHERE is_read=1) AS read FROM notification GROUP BY corp_id,user_id ORDER BY corp_id,user_id; SELECT id,corp_id,user_id,is_read FROM notification WHERE id IN (9101,9102,9007199254740991) ORDER BY id;');fs.writeFileSync(path.join(artifactDir,'database-evidence.txt'),evidence+'\n');Object.assign(outcome,{checks,checkCount:checks.length,expectedNotificationRows:8,invalidRequests:46});console.log(JSON.stringify({checks,evidence}));
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
