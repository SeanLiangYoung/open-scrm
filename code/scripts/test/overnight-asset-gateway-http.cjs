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

const http=require('node:http'),https=require('node:https'),tls=require('node:tls'),dns=require('node:dns'),dgram=require('node:dgram'),cp=require('node:child_process'),assert=require('node:assert/strict');
function installOutboundGuard() {
  const policy = JSON.parse(process.env.BOOT_NETWORK_POLICY);
  const ports = new Set(policy.ports);
  const httpPorts = new Set(policy.httpPorts);
  let phase = 'self-check';
  const write = entry => fs.appendFileSync(process.env.BOOT_GUARD_LOG, JSON.stringify({ phase, ...entry }) + '\n');
  const block = (kind, host, port) => {
    write({ decision: 'deny', kind, host: String(host), port: Number(port) || null });
    const error = new Error(`Blocked verification outbound ${kind}: ${host}:${port || ''}`);
    error.code = 'BOOT_OUTBOUND_BLOCKED';
    throw error;
  };
  const check = (kind, host, port, allowed = ports) => {
    if (!['127.0.0.1', '::1', '[::1]'].includes(host) || !allowed.has(Number(port))) block(kind, host, port);
    write({ decision: 'allow', kind, host, port: Number(port) });
  };
  const originalConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    let options = args[0];
    if (Array.isArray(options)) options = options[0];
    if (options && typeof options === 'object') {
      if (options.path) block('unix-socket', options.path);
      check('tcp', options.host || 'localhost', options.port);
    } else if (typeof options === 'number') check('tcp', typeof args[1] === 'string' ? args[1] : 'localhost', options);
    else block('tcp', options);
    return originalConnect.apply(this, args);
  };
  const originalTls = tls.connect;
  tls.connect = function (...args) {
    const options = args[0];
    if (options && typeof options === 'object') check('tls', options.host || 'localhost', options.port || 443);
    else check('tls', typeof args[1] === 'string' ? args[1] : 'localhost', options);
    return originalTls.apply(this, args);
  };
  const checkHttp = (kind, input, secure = false) => {
    if (typeof input === 'string' || input instanceof URL) {
      const url = new URL(input);
      check(kind, url.hostname, url.port || (url.protocol === 'https:' ? 443 : 80), httpPorts);
    } else if (input && typeof input === 'object') {
      if (input.socketPath) block(kind, input.socketPath);
      check(kind, input.hostname || input.host || 'localhost', input.port || (secure ? 443 : 80), httpPorts);
    } else block(kind, 'unknown');
  };
  for (const [module, secure] of [[http, false], [https, true]]) for (const method of ['request', 'get']) {
    const original = module[method];
    module[method] = function (...args) { checkHttp(`${secure ? 'https' : 'http'}.${method}`, args[0], secure); return original.apply(this, args); };
  }
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    try { checkHttp('fetch', typeof input === 'object' && input.url ? input.url : input); }
    catch (error) { return Promise.reject(error); }
    return originalFetch(input, init);
  };
  const lookup = dns.lookup;
  dns.lookup = function (hostname, ...args) {
    if (!['127.0.0.1', '::1'].includes(hostname)) block('dns.lookup', hostname);
    return lookup.call(this, hostname, ...args);
  };
  const promiseLookup = dns.promises.lookup;
  dns.promises.lookup = async function (hostname, ...args) {
    if (!['127.0.0.1', '::1'].includes(hostname)) block('dns.promises.lookup', hostname);
    return promiseLookup.call(this, hostname, ...args);
  };
  const resolutionMethods = new Set(['lookupService', ...Object.keys(dns), ...Object.keys(dns.promises), ...Object.getOwnPropertyNames(dns.Resolver.prototype)].filter(name => name.startsWith('resolve') || name === 'reverse' || name === 'lookupService'));
  for (const method of resolutionMethods) {
    if (dns[method]) dns[method] = hostname => block(`dns.${method}`, hostname);
    if (dns.promises[method]) dns.promises[method] = async hostname => block(`dns.promises.${method}`, hostname);
    if (dns.Resolver.prototype[method]) dns.Resolver.prototype[method] = hostname => block(`dns.Resolver.${method}`, hostname);
    if (dns.promises.Resolver.prototype[method]) dns.promises.Resolver.prototype[method] = async hostname => block(`dns.promises.Resolver.${method}`, hostname);
  }
  for (const method of ['send', 'connect']) dgram.Socket.prototype[method] = () => block(`udp.${method}`, 'disabled');
  for (const method of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) cp[method] = executable => block(`subprocess.${method}`, executable);
  require('node:worker_threads').Worker = class { constructor() { block('worker-thread', 'disabled'); } };
  assert.throws(() => http.get('http://example.invalid/'), error => error.code === 'BOOT_OUTBOUND_BLOCKED');
  write({decision:'self-check-passed'});phase='runtime';
}

if (process.argv[2] === '--service') {
  if (process.env.ASSET_GATEWAY_HTTP_CHILD !== '1' || process.env.DB_HOST !== '127.0.0.1' ||
    process.env.DB_DATABASE !== 'asset_gateway_http' || process.env.DB_USERNAME !== 'asset_gateway_verify' ||
    process.env.DB_PASSWORD !== 'disposable_asset_gateway_only' || Number(process.env.DB_PORT) === 5432 ||
    !Number.isSafeInteger(Number(process.env.DB_PORT)) || Number(process.env.DB_PORT) <= 0 ||
    process.env.REDIS_HOST !== '127.0.0.1' || !Number.isSafeInteger(Number(process.env.REDIS_PORT)) ||
    Number(process.env.REDIS_PORT) <= 0 || Number(process.env.REDIS_PORT) === 6379 ||
    !['auth-service','asset-service','gateway-service'].includes(process.argv[3])) {
    throw Error('Refusing non-disposable asset gateway service profile');
  }
  installOutboundGuard();
  const dir = serviceRoot(process.argv[3]);
  const { Bootstrap } = createRequire(path.join(dir, 'package.json'))('@midwayjs/bootstrap');
  Bootstrap.configure({ appDir: dir, baseDir: path.join(dir, 'dist'), globalConfig: {
    koa: { port: Number(process.argv[4]), hostname: '127.0.0.1' },
    oss: {client:{cname:true}},
    upload:{tmpdir:path.join(process.env.ASSET_GATEWAY_OUTPUT,'uploads')},
    midwayLogger:{default:{dir:path.join(process.env.ASSET_GATEWAY_OUTPUT,'logs')}},
  } }).run().catch(error => { console.error(error); process.exit(1); });
} else {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}

async function main() {
  const runId = `${process.pid}-${Date.now()}`;
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-asset-gateway-http-'));
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
    const id = command('docker', ['create', '--name', `open-scrm-asset-gateway-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=asset-gateway-http', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
    ownedContainers.push(id);
    command('docker', ['start', ...(process.env.ASSET_GATEWAY_FAULT_START === '1' ? ['--open-scrm-forced-invalid-start-option'] : []), id]);
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
    const pg = container('postgres:16-alpine', 'pg', 5432, ['--env', 'POSTGRES_DB=asset_gateway_http', '--env', 'POSTGRES_USER=asset_gateway_verify', '--env', 'POSTGRES_PASSWORD=disposable_asset_gateway_only']);
    const redis = container('redis:7-alpine', 'redis', 6379, []);
    await waitUntil(() => spawnSync('docker', ['exec', pg.id, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', 'asset_gateway_verify', '-d', 'asset_gateway_http']).status === 0, 'disposable PostgreSQL');
    await waitUntil(() => spawnSync('docker', ['exec', redis.id, 'redis-cli', 'ping']).status === 0, 'disposable Redis');
    const psql = sql => command('docker', ['exec', '-i', pg.id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'asset_gateway_verify', '-d', 'asset_gateway_http'], { input: sql });
    psql(fs.readFileSync(path.join(root, 'scripts/init-db.pg.sql'), 'utf8'));
    psql(`INSERT INTO "user"(id,corp_id,username,password,status) SELECT 9002,2,'asset_other',password,1 FROM "user" WHERE corp_id=1 AND username='admin';
      INSERT INTO asset_category(id,corp_id,parent_id,name) VALUES(31,1,0,'own root'),(32,1,31,'own child'),(33,2,0,'foreign root');
      INSERT INTO asset(id,corp_id,category_id,name,type,file_url) VALUES(71,1,31,'own',1,'https://invalid.local/own'),(72,2,33,'foreign',1,'https://invalid.local/foreign'),(9007199254740991,1,31,'safeMAX',1,'https://invalid.local/max');`);
    const ports = { auth: await freePort(), asset: await freePort(), gateway: await freePort() };
    const baseEnv = { ...process.env, ASSET_GATEWAY_HTTP_CHILD: '1', NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: String(pg.port),
      DB_USERNAME: 'asset_gateway_verify', DB_USER: 'asset_gateway_verify', DB_PASSWORD: 'disposable_asset_gateway_only', DB_DATABASE: 'asset_gateway_http',
      REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redis.port), REDIS_PASSWORD: '',
      JWT_SECRET: `disposable-consent-jwt-${runId}`, APP_KEYS: `disposable-consent-keys-${runId}`,
      AUTH_SERVICE_URL: `http://127.0.0.1:${ports.auth}`, ASSET_SERVICE_URL: `http://127.0.0.1:${ports.asset}`,
      ASSET_GATEWAY_OUTPUT:artifactDir, BOOT_GUARD_LOG:path.join(artifactDir,'network.jsonl'),
      BOOT_NETWORK_POLICY:JSON.stringify({ports:[pg.port,redis.port,...Object.values(ports)],httpPorts:Object.values(ports)}),
      OSS_ACCESS_KEY_ID:'disposable-not-real',OSS_ACCESS_KEY_SECRET:'disposable-not-real',OSS_BUCKET:'disposable-only',OSS_ENDPOINT:'http://127.0.0.1:1',
      HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '', http_proxy: '', https_proxy: '', all_proxy: '', NO_PROXY: '127.0.0.1,localhost',
    };
    for (const [name, port] of [['auth-service', ports.auth], ['asset-service', ports.asset], ['gateway-service', ports.gateway]]) {
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
    async function request(path,token,body,method=body===undefined?'GET':'POST',headers={}){const r=await fetch(`http://127.0.0.1:${ports.gateway}${path}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`} :{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(5000)});const text=await r.text();let responseBody;try{responseBody=JSON.parse(text);}catch{responseBody=text;}return {status:r.status,body:responseBody};}
    const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
    const login=async(username,corpId)=>{const r=await request('/api/v1/auth/login',undefined,{username,password:'Admin@123',corpId});assert.equal(r.status,200);return r.body.accessToken;};
    const a=await login('admin',1),b=await login('asset_other',2);
    await check('asset and category entry points require access JWT',async()=>{for(const p of ['/api/v1/assets/71','/api/v1/assets/categories/tree','/api/asset/71','/api/asset-category/tree'])assert.equal((await request(p)).status,401);});
    await check('v1 and legacy detail routes use path IDs, not forged query IDs',async()=>{for(const p of ['/api/v1/assets/71?id=72','/api/asset/71?id=72']){const r=await request(p,a);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.data.name,'own');}});
    await check('safe MAX BIGINT detail remains exact through gateway',async()=>{const r=await request('/api/v1/assets/9007199254740991',a);assert.equal(r.status,200);assert.equal(r.body.data.id,'9007199254740991');});
    await check('category routes take precedence and preserve tenant filtering',async()=>{for(const p of ['/api/v1/assets/categories/tree','/api/asset-category/tree']){const r=await request(p,a);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.data.length,1);assert.equal(r.body.data[0].id,31);assert.equal(r.body.data[0].children[0].id,32);}});
    await check('gateway replaces forged tenant headers',async()=>{const r=await request('/api/v1/assets/72',a,undefined,'GET',{'x-corp-id':'2','x-user-id':'9002'});assert.equal(r.status,200);assert.equal(r.body.data,null);const own=await request('/api/v1/assets/72',b,undefined,'GET',{'x-corp-id':'1'});assert.equal(own.body.data.name,'foreign');});
    await check('malformed paths400 preserve local row, category overflow400',async()=>{for(const id of ['71junk','071','71e0','0x47','0','9007199254740992']){const r=await request('/api/v1/assets/'+id,a,{name:'bad'},'PUT');assert.equal(r.status,400,JSON.stringify(r));}assert.equal((await request('/api/v1/assets/categories/2147483648',a,undefined,'DELETE')).status,400);assert.equal((await request('/api/v1/assets/71',a)).body.data.name,'own');});
    await check('foreign categories400 and malformed JSON references422 without writes',async()=>{const foreign=await request('/api/v1/assets/71',a,{categoryId:33},'PUT');assert.equal(foreign.status,400,JSON.stringify(foreign));const malformed=await request('/api/v1/assets/71',a,{categoryId:'31'},'PUT');assert.equal(malformed.status,422,JSON.stringify(malformed));assert.equal((await request('/api/v1/assets/71',a)).body.data.categoryId,31);});
    await check('legitimate category filtering update and creation work',async()=>{const list=await request('/api/v1/assets/list?categoryId=31',a);assert.equal(list.status,200,JSON.stringify(list));assert.equal(list.body.data.total,2);assert.equal((await request('/api/v1/assets/71',a,{name:'updated',categoryId:32},'PUT')).status,200);const cat=await request('/api/v1/assets/categories',a,{name:'new root',parentId:0});assert.equal(cat.status,200,JSON.stringify(cat));assert.equal(cat.body.data.parentId,0);});
    await check('foreign parent and cyclic hierarchy rejected via actual DTO/controller',async()=>{assert.equal((await request('/api/v1/assets/categories',a,{name:'bad',parentId:33})).status,400);assert.equal((await request('/api/v1/assets/categories/31',a,{parentId:32},'PUT')).status,400);});
    await check('foreign usage404 leaves zero usage, concurrent ten usage requests count exactly ten',async()=>{assert.equal((await request('/api/v1/assets/usage',a,{assetId:72,useType:'message'})).status,404);const responses=await Promise.all(Array.from({length:10},()=>request('/api/v1/assets/usage',a,{assetId:71,useType:'message'})));for(const r of responses)assert.equal(r.status,200,JSON.stringify(r));psql(`DO $$ BEGIN IF (SELECT use_count FROM asset WHERE id=71)<>10 OR (SELECT COUNT(*) FROM asset_usage)<>10 THEN RAISE EXCEPTION 'usage count mismatch';END IF; END $$;`);});
    await check('actual counter failure500 rolls back usage insertion',async()=>{psql('ALTER TABLE asset ADD CONSTRAINT http_counter_failure CHECK(use_count<=10);');const r=await request('/api/v1/assets/usage',a,{assetId:71,useType:'message'});assert.equal(r.status,500,JSON.stringify(r));psql(`DO $$ BEGIN IF (SELECT use_count FROM asset WHERE id=71)<>10 OR (SELECT COUNT(*) FROM asset_usage)<>10 THEN RAISE EXCEPTION 'rollback mismatch';END IF; END $$;ALTER TABLE asset DROP CONSTRAINT http_counter_failure;`);});
    await check('referenced category deletion400 and unrelated prefix404',async()=>{assert.equal((await request('/api/v1/assets/categories/32',a,undefined,'DELETE')).status,400);assert.equal((await request('/api/v1/assets-evil/71',a)).status,404);});
    const network=fs.readFileSync(path.join(artifactDir,'network.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
    assert.equal(network.filter(e=>e.phase==='runtime'&&e.decision==='deny').length,0);
    const evidence=psql('SELECT id,corp_id,category_id,name,use_count FROM asset ORDER BY id; SELECT corp_id,asset_id,count(*) FROM asset_usage GROUP BY corp_id,asset_id;');
    fs.writeFileSync(path.join(artifactDir,'database-evidence.txt'),evidence+'\n');Object.assign(outcome,{checks,checkCount:checks.length,runtimeExternalAttempts:0,ossCalls:0,expectedUsageRows:10});
    testPassed = true;
  } catch (error) {
    outcome.error = error.message;
    for (const name of ['auth-service', 'asset-service', 'gateway-service']) {
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
