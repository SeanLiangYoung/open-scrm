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
  if (process.env.UPLOAD_STORAGE_HTTP_CHILD !== '1' || process.env.DB_HOST !== '127.0.0.1' ||
    process.env.DB_DATABASE !== 'upload_storage_http' || process.env.DB_USERNAME !== 'upload_storage_verify' ||
    process.env.DB_PASSWORD !== 'disposable_upload_storage_only' || Number(process.env.DB_PORT) === 5432 ||
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
    oss: {client:{cname:true,retryMax:0}},
    asset:{maxSize:{image:256,video:100*1024*1024,file:50*1024*1024}},
    upload:{tmpdir:path.join(process.env.UPLOAD_STORAGE_OUTPUT,'uploads')},
    midwayLogger:{default:{dir:path.join(process.env.UPLOAD_STORAGE_OUTPUT,'logs')}},
  } }).run().catch(error => { console.error(error); process.exit(1); });
} else {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}

async function main() {
  const runId = `${process.pid}-${Date.now()}`;
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-upload-storage-http-'));
  const ownedContainers = [];
  const children = [];
  const logs = [];
  let cleanupPromise;
  let storageServer;
  const objects=new Map(),ledger=[];
  const storageMode={putFail:false,deleteFail:false};
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
      if(storageServer)await new Promise(resolve=>storageServer.close(resolve));
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
    const id = command('docker', ['create', '--name', `open-scrm-upload-storage-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=upload-storage-http', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
    ownedContainers.push(id);
    command('docker', ['start', ...(process.env.UPLOAD_STORAGE_FAULT_START === '1' ? ['--open-scrm-forced-invalid-start-option'] : []), id]);
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
    const pg = container('postgres:16-alpine', 'pg', 5432, ['--env', 'POSTGRES_DB=upload_storage_http', '--env', 'POSTGRES_USER=upload_storage_verify', '--env', 'POSTGRES_PASSWORD=disposable_upload_storage_only']);
    const redis = container('redis:7-alpine', 'redis', 6379, []);
    await waitUntil(() => spawnSync('docker', ['exec', pg.id, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', 'upload_storage_verify', '-d', 'upload_storage_http']).status === 0, 'disposable PostgreSQL');
    await waitUntil(() => spawnSync('docker', ['exec', redis.id, 'redis-cli', 'ping']).status === 0, 'disposable Redis');
    const psql = sql => command('docker', ['exec', '-i', pg.id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'upload_storage_verify', '-d', 'upload_storage_http'], { input: sql });
    psql(fs.readFileSync(path.join(root, 'scripts/init-db.pg.sql'), 'utf8'));
    psql(`INSERT INTO "user"(id,corp_id,username,password,status) SELECT 9002,2,'asset_other',password,1 FROM "user" WHERE corp_id=1 AND username='admin';
      INSERT INTO asset_category(id,corp_id,parent_id,name) VALUES(31,1,0,'own root'),(32,1,31,'own child'),(33,2,0,'foreign root');
      INSERT INTO asset(id,corp_id,category_id,name,type,file_url) VALUES(71,1,31,'own',1,'https://invalid.local/own'),(72,2,33,'foreign',1,'https://invalid.local/foreign'),(9007199254740991,1,31,'safeMAX',1,'https://invalid.local/max');`);
    const ports = { auth: await freePort(), asset: await freePort(), gateway: await freePort() };
    storageServer=http.createServer(async(req,res)=>{
      const chunks=[];for await(const chunk of req)chunks.push(chunk);const bytes=Buffer.concat(chunks),key=new URL(req.url,'http://fixture').pathname;
      const digest=require('node:crypto').createHash('sha256').update(bytes).digest('hex');
      ledger.push({method:req.method,key,length:bytes.length,digest});
      if(req.method==='PUT'){
        objects.set(key,bytes);
        if(storageMode.putFail){res.writeHead(500,{'content-type':'application/xml'});res.end('<Error><Code>InternalError</Code><Message>controlled PUT failure after store</Message><RequestId>fixture</RequestId></Error>');return;}
        res.writeHead(200,{'etag':'"fixture-etag"','x-oss-request-id':'fixture'});res.end();return;
      }
      if(req.method==='DELETE'){
        if(storageMode.deleteFail){res.writeHead(500,{'content-type':'application/xml'});res.end('<Error><Code>InternalError</Code><Message>controlled DELETE failure</Message><RequestId>fixture</RequestId></Error>');return;}
        objects.delete(key);res.writeHead(204,{'x-oss-request-id':'fixture'});res.end();return;
      }
      res.writeHead(404);res.end();
    });
    await new Promise(resolve=>storageServer.listen(0,'127.0.0.1',resolve));
    const storagePort=storageServer.address().port;
    const baseEnv = { ...process.env, UPLOAD_STORAGE_HTTP_CHILD: '1', NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: String(pg.port),
      DB_USERNAME: 'upload_storage_verify', DB_USER: 'upload_storage_verify', DB_PASSWORD: 'disposable_upload_storage_only', DB_DATABASE: 'upload_storage_http',
      REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redis.port), REDIS_PASSWORD: '',
      JWT_SECRET: `disposable-consent-jwt-${runId}`, APP_KEYS: `disposable-consent-keys-${runId}`,
      AUTH_SERVICE_URL: `http://127.0.0.1:${ports.auth}`, ASSET_SERVICE_URL: `http://127.0.0.1:${ports.asset}`,
      TMPDIR:artifactDir,UPLOAD_STORAGE_OUTPUT:artifactDir, BOOT_GUARD_LOG:path.join(artifactDir,'network.jsonl'),
      BOOT_NETWORK_POLICY:JSON.stringify({ports:[pg.port,redis.port,storagePort,...Object.values(ports)],httpPorts:[storagePort,...Object.values(ports)]}),
      OSS_ACCESS_KEY_ID:'disposable-not-real',OSS_ACCESS_KEY_SECRET:'disposable-not-real',OSS_BUCKET:'disposable-only',OSS_ENDPOINT:`http://127.0.0.1:${storagePort}`,
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
    const a=await login('admin',1);
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jPfsAAAAASUVORK5CYII=','base64');
    async function upload(fields={},options={}){
      const form=new FormData();form.append('type','1');for(const [k,v] of Object.entries(fields)){if(k==='type')form.set(k,v);else form.append(k,v);}
      for(let i=0;i<(options.files??1);i++)form.append('file',new Blob([options.bytes||png],{type:'image/png'}),'proof.png');
      const response=await fetch(`http://127.0.0.1:${ports.gateway}${options.path||'/api/v1/assets/upload'}`,{method:'POST',headers:{...(options.noToken?{}:{authorization:`Bearer ${a}`}),...(options.headers||{})},body:form,signal:AbortSignal.timeout(15000)});
      const text=await response.text();let body;try{body=JSON.parse(text);}catch{body=text;}return{status:response.status,body};
    }
    const countRows=()=>Number(psql('SELECT count(*) FROM asset;').split('\n')[2].trim());
    const initialRows=countRows();let successKey;
    await check('binary multipart upload via v1 preserves bytes metadata and verified tenant',async()=>{
      const r=await upload({name:'upload-proof',categoryId:'31',tags:'["one"]'},{headers:{'x-corp-id':'2','x-user-id':'9002'}});
      assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.success,true,JSON.stringify(r));assert.equal(String(r.body.data.corpId),'1');assert.equal(String(r.body.data.fileSize),String(png.length));
      assert.deepEqual(r.body.data.tags,['one']);assert.equal(r.body.data.categoryId,31);
      const put=ledger.find(e=>e.method==='PUT');assert(put);assert.deepEqual(objects.get(put.key),png);successKey=put.key;assert.equal(countRows(),initialRows+1);
      assert.equal(r.body.data.fileUrl,`http://127.0.0.1:${storagePort}`+put.key);
    });
    await check('legacy multipart route also stores a unique exact object',async()=>{const r=await upload({name:'legacy-proof'},{path:'/api/asset/upload'});assert.equal(r.status,200);assert.equal(r.body.success,true,JSON.stringify(r));assert.equal(objects.size,2);const keys=[...objects.keys()];assert.equal(new Set(keys).size,2);assert.equal(countRows(),initialRows+2);});
    await check('unauthenticated multipart401 never contacts storage',async()=>{const n=ledger.length;assert.equal((await upload({}, {noToken:true})).status,401);assert.equal(ledger.length,n);});
    await check('strict metadata and multi-file400 reject before OSS',async()=>{for(const fields of [{type:'1e0'},{tags:'{}'},{tags:'bad json'},{corpId:'2'}]){const n=ledger.length;const r=await upload(fields);assert.equal(r.status,400,JSON.stringify(r));assert.equal(ledger.length,n);}const n=ledger.length;assert.equal((await upload({}, {files:2})).status,400);assert.equal(ledger.length,n);});
    await check('foreign category400 and per-type file size413 reject before OSS',async()=>{const n=ledger.length;assert.equal((await upload({categoryId:'33'})).status,400);const r=await upload({}, {bytes:Buffer.alloc(257)});assert.equal(r.status,413,JSON.stringify(r));assert.equal(ledger.length,n);});
    await check('database insert failure compensates exactly its uploaded UUID object',async()=>{
      psql("ALTER TABLE asset ADD CONSTRAINT upload_storage_fault CHECK(name <> 'db-reject');");const before=ledger.length;
      const r=await upload({name:'db-reject'});assert.equal(r.status,200);assert.equal(r.body.success,false,JSON.stringify(r));const events=ledger.slice(before);assert.deepEqual(events.map(e=>e.method),['PUT','DELETE']);assert.equal(events[0].key,events[1].key);assert(!objects.has(events[0].key));assert(objects.has(successKey));assert.equal(countRows(),initialRows+2);psql('ALTER TABLE asset DROP CONSTRAINT upload_storage_fault;');
    });
    await check('ambiguous OSS failure after local store deletes only its own key',async()=>{storageMode.putFail=true;const before=ledger.length;try{const r=await upload({name:'oss-reject'});assert.equal(r.body.success,false,JSON.stringify(r));}finally{storageMode.putFail=false;}const events=ledger.slice(before);assert.deepEqual(events.map(e=>e.method),['PUT','DELETE']);assert.equal(events[0].key,events[1].key);assert(!objects.has(events[0].key));assert.equal(countRows(),initialRows+2);});
    await check('compensation failure retains explicit reconciliation evidence without hiding primary failure',async()=>{psql("ALTER TABLE asset ADD CONSTRAINT upload_storage_fault CHECK(name <> 'db-reject');");storageMode.deleteFail=true;const before=ledger.length;try{const r=await upload({name:'db-reject'});assert.equal(r.body.success,false,JSON.stringify(r));assert.match(r.body.message,/upload_storage_fault/);}finally{storageMode.deleteFail=false;psql('ALTER TABLE asset DROP CONSTRAINT upload_storage_fault;');}const events=ledger.slice(before);assert.deepEqual(events.map(e=>e.method),['PUT','DELETE']);assert(objects.has(events[0].key));assert.equal(countRows(),initialRows+2);const log=fs.readFileSync(path.join(artifactDir,'asset-service.log'),'utf8');assert.match(log,/asset-upload-reconciliation-required/);assert.match(log,/compensation-failed/);outcome.expectedUnreconciledFixtureKey=events[0].key;});
    await check('chunked actual multipart wire cap413 rejects before upstream side effects',async()=>{
      const before=ledger.length;
      const response=await new Promise((resolve,reject)=>{
        const req=http.request({hostname:'127.0.0.1',port:ports.gateway,path:'/api/v1/assets/upload',method:'POST',headers:{authorization:`Bearer ${a}`,'content-type':'multipart/form-data; boundary=oversize-proof'}},res=>{const pieces=[];res.on('data',c=>pieces.push(c));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(pieces).toString()}));});req.on('error',reject);
        (async()=>{const chunk=Buffer.alloc(1024*1024,0x61);for(let i=0;i<102;i++){if(!req.write(chunk))await require('node:events').once(req,'drain');}req.end();})().catch(reject);
      });assert.equal(response.status,413,JSON.stringify(response));assert.equal(ledger.length,before);assert.equal(countRows(),initialRows+2);
    });
    await check('all success/failure upload temp files and gateway spools are reclaimed',async()=>{
      const tmp=fs.readdirSync(artifactDir).filter(name=>name.startsWith('scrm-gateway-upload-'));assert.deepEqual(tmp,[]);
      const uploads=path.join(artifactDir,'uploads');if(fs.existsSync(uploads))assert.deepEqual(fs.readdirSync(uploads),[]);
      assert.equal(objects.size,3);assert.equal(countRows(),initialRows+2);
    });
    const network=fs.readFileSync(path.join(artifactDir,'network.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));assert.equal(network.filter(e=>e.phase==='runtime'&&e.decision==='deny').length,0);
    fs.writeFileSync(path.join(artifactDir,'storage-ledger.json'),JSON.stringify({events:ledger,retainedKeys:[...objects.keys()],expectedUnreconciledFixtureKey:outcome.expectedUnreconciledFixtureKey},null,2));
    fs.writeFileSync(path.join(artifactDir,'database-evidence.txt'),psql('SELECT id,corp_id,category_id,name,file_url,file_size,tags FROM asset ORDER BY id;')+'\n');
    Object.assign(outcome,{checks,checkCount:checks.length,initialRows,expectedRows:initialRows+2,localObjectsRetained:3,runtimeExternalAttempts:0,storagePort});
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
