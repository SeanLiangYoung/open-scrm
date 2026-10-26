'use strict';
// Five-service readiness only. No accounts, provider calls or existing databases.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');
const tls = require('node:tls');
const dns = require('node:dns');
const dgram = require('node:dgram');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const names = ['acquisition', 'integration', 'analytics', 'asset', 'content-generation'].map(name => `${name}-service`);

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
  return {
    async selfCheck() {
      const blocked = error => error.code === 'BOOT_OUTBOUND_BLOCKED';
      for (const host of ['example.invalid', '169.254.169.254', '127.0.0.1']) {
        const socket = new net.Socket();
        assert.throws(() => socket.connect({ host, port: host === '127.0.0.1' ? 1 : 443 }), blocked);
        socket.destroy();
      }
      assert.throws(() => tls.connect({ host: 'example.invalid', port: 443 }), blocked);
      assert.throws(() => http.get('http://example.invalid/'), blocked);
      assert.throws(() => https.get('https://example.invalid/'), blocked);
      assert.throws(() => dns.lookup('example.invalid', () => {}), blocked);
      await assert.rejects(() => dns.promises.resolve4('example.invalid'), blocked);
      assert.throws(() => dns.lookupService('192.0.2.1', 443, () => {}), blocked);
      assert.throws(() => new dns.Resolver().resolve4('example.invalid', () => {}), blocked);
      assert.throws(() => cp.spawnSync(process.execPath, ['-e', 'process.exit(0)']), blocked);
      assert.throws(() => new (require('node:worker_threads').Worker)('process.exit(0)', { eval: true }), blocked);
      await assert.rejects(() => fetch('https://example.invalid/'), blocked);
      const sdkHttp = createRequire(path.join(root, 'services/integration-service/package.json'))('axios');
      await assert.rejects(() => sdkHttp.get('https://example.invalid/', { proxy: false }), error => error.code === 'BOOT_OUTBOUND_BLOCKED');
      await new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: '127.0.0.1', port: policy.pgPort }, () => { socket.end(); resolve(); });
        socket.once('error', reject);
      });
      const response = await fetch(policy.resourceUrl + '/guard-self-check');
      assert.equal(response.status, 503);
      write({ decision: 'self-check-passed', negativeCases: 14, postgresTcpAllowed: true, ownedHttpAllowed: true });
      phase = 'runtime';
    }
  };
}

if (process.argv[2] === '--service') {
  (async () => {
    const guard = installOutboundGuard();
    await guard.selfCheck();
    const dir = path.join(root, 'services', process.argv[3]);
    const output = process.env.BOOT_OUTPUT_DIR;
    const { Bootstrap } = createRequire(path.join(dir, 'package.json'))('@midwayjs/bootstrap');
    await Bootstrap.configure({ appDir: dir, baseDir: path.join(dir, 'dist'), globalConfig: {
      koa: { port: Number(process.argv[4]), hostname: '127.0.0.1' },
      upload: { tmpdir: path.join(output, 'upload-temp') },
      midwayLogger: { default: { dir: path.join(output, 'logs') } },
      ...(process.env.BOOT_OSS_FIXTURE === '1' ? { oss: { client: { cname: true } } } : {}),
    } }).run();
  })().catch(error => { console.error(error); process.exit(1); });
} else main().catch(error => { console.error(error); process.exitCode = 1; });

async function main() {
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-runtime-boot-'));
  const ossFixture = process.argv.includes('--oss-fixture');
  const outcome = { artifactDir, profile: ossFixture ? 'inert-oss-fixture' : 'unconfigured-oss', services: [] };
  const containers = [];
  const children = [];
  const logFiles = [];
  const resources = [];
  let resourceServer;
  let cleanupPromise;
  let testsPassed = false;
  const command = (executable, args, options = {}) => {
    const result = cp.spawnSync(executable, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options });
    if (result.status !== 0) throw new Error(`${executable} ${args.join(' ')} failed\n${result.stdout || ''}\n${result.stderr || ''}`);
    return result.stdout.trim();
  };
  const cleanup = () => cleanupPromise ||= (async () => {
    const errors = [];
    const exited = child => child.exitCode !== null || child.signalCode !== null;
    for (const child of children) if (!exited(child)) child.kill('SIGTERM');
    for (let i = 0; i < 20 && children.some(child => !exited(child)); i++) await pause(100);
    for (const child of children) if (!exited(child)) child.kill('SIGKILL');
    for (let i = 0; i < 30 && children.some(child => !exited(child)); i++) await pause(100);
    for (const child of children) if (!exited(child)) errors.push(`Process ${child.pid} remains`);
    if (resourceServer) { resourceServer.closeAllConnections(); await new Promise(resolve => resourceServer.close(resolve)); }
    for (const id of [...containers].reverse()) {
      const removal = cp.spawnSync('docker', ['rm', '-f', id], { encoding: 'utf8' });
      if (removal.status !== 0) errors.push(`Container removal ${id}: ${removal.stderr}`);
      const absence = cp.spawnSync('docker', ['ps', '-a', '--no-trunc', '--filter', `id=${id}`, '--format', '{{.ID}}'], { encoding: 'utf8' });
      if (absence.status !== 0 || absence.stdout.trim()) errors.push(`Cannot verify absent container ${id}`);
    }
    for (const fd of logFiles) try { fs.closeSync(fd); } catch (error) { errors.push(error.message); }
    return { passed: errors.length === 0, errors, childPids: children.map(child => child.pid), containerIds: containers };
  })();
  const save = (cleaned, extra = {}) => fs.writeFileSync(path.join(artifactDir, 'result.json'), JSON.stringify({ ...outcome, ...extra, testsPassed, cleanup: cleaned, passed: testsPassed && cleaned.passed && !extra.signal }, null, 2));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { const cleaned = await cleanup(); save(cleaned, { signal }); process.exit(signal === 'SIGINT' ? 130 : 143); });
  const freePort = () => new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
  const createContainer = (image, internalPort, extra) => {
    command('docker', ['image', 'inspect', image]);
    const id = command('docker', ['run', '--rm', '--detach', '--label', 'open-scrm.verification=runtime-boot', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
    containers.push(id);
    const binding = JSON.parse(command('docker', ['inspect', id]))[0].NetworkSettings.Ports[`${internalPort}/tcp`][0];
    return { id, port: Number(binding.HostPort) };
  };
  console.log(`Artifacts: ${artifactDir}`);
  try {
    const pg = createContainer('postgres:16-alpine', 5432, ['--env', 'POSTGRES_DB=runtime_boot', '--env', 'POSTGRES_USER=runtime_verify', '--env', 'POSTGRES_PASSWORD=disposable_runtime_only']);
    const redis = createContainer('redis:7-alpine', 6379, []);
    for (const [description, check] of [
      ['PostgreSQL TCP', () => cp.spawnSync('docker', ['exec', pg.id, 'pg_isready', '-h', '127.0.0.1', '-U', 'runtime_verify', '-d', 'runtime_boot']).status === 0],
      ['Redis', () => cp.spawnSync('docker', ['exec', redis.id, 'redis-cli', 'ping']).status === 0],
    ]) {
      let ready = false;
      for (let i = 0; i < 60; i++) { if (check()) { ready = true; break; } await pause(500); }
      assert(ready, `${description} did not become ready`);
    }
    const psql = sql => command('docker', ['exec', '-i', pg.id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'runtime_verify', '-d', 'runtime_boot'], { input: sql });
    psql(fs.readFileSync(path.join(root, 'scripts/init-db.pg.sql'), 'utf8'));
    assert.equal(psql("SELECT current_setting('server_version_num')::int / 10000;" ).split('\n').some(line => line.trim() === '16'), true);
    const ports = Object.fromEntries(await Promise.all(names.map(async name => [name, await freePort()])));
    resourceServer = http.createServer((req, res) => { resources.push({ path: req.url }); res.writeHead(503, { 'content-type': 'application/json' }); res.end('{"message":"Provider unavailable in isolated boot verification"}'); });
    await new Promise((resolve, reject) => { resourceServer.once('error', reject); resourceServer.listen(0, '127.0.0.1', resolve); });
    const resourcePort = resourceServer.address().port;
    const resourceUrl = `http://127.0.0.1:${resourcePort}`;
    const serviceUrls = Object.fromEntries(['AUTH', 'CUSTOMER', 'GATEWAY', 'ACQUISITION', 'INTEGRATION', 'ANALYTICS', 'ASSET', 'CONTENT_GENERATION', 'OPERATION', 'MESSAGE', 'FINANCE'].map(name => [`${name}_SERVICE_URL`, resourceUrl]));
    const env = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'en_US.UTF-8', TZ: 'UTC', NODE_ENV: 'production', NODE_OPTIONS: '',
      ...serviceUrls, APP_KEYS: `disposable-runtime-${process.pid}-${Date.now()}`,
      DB_HOST: '127.0.0.1', DB_PORT: String(pg.port), DB_USERNAME: 'runtime_verify', DB_USER: 'runtime_verify', DB_PASSWORD: 'disposable_runtime_only', DB_DATABASE: 'runtime_boot',
      REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redis.port), REDIS_PASSWORD: '', REDIS_DB: '0',
      LLM_API_BASE: resourceUrl, LLM_API_KEY: '', LLM_MODEL: 'unavailable-boot-only', LLM_WIKI_BASE_URL: resourceUrl, LLM_WIKI_API_TOKEN: '', LLM_WIKI_PROJECT_ID: 'boot-only',
      CONTENT_GENERATION_SYNC: 'true', CONTENT_GENERATION_MOCK_LLM: 'true', XHS_PUBLISH_MODE: 'mock', PLATFORM_PUBLISH_MODE: 'mock',
      OSS_ACCESS_KEY_ID: ossFixture ? 'disposable-not-a-real-access-key' : '', OSS_ACCESS_KEY_SECRET: ossFixture ? 'disposable-not-a-real-secret' : '',
      OSS_ENDPOINT: ossFixture ? resourceUrl : '', OSS_BUCKET: ossFixture ? 'disposable-boot-only' : '', OSS_PREFIX: 'boot-only', CDN_DOMAIN: '',
      HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '', http_proxy: '', https_proxy: '', all_proxy: '', NO_PROXY: '127.0.0.1,localhost',
      BOOT_NETWORK_POLICY: JSON.stringify({ ports: [pg.port, redis.port, resourcePort, ...Object.values(ports)], httpPorts: [resourcePort, ...Object.values(ports)], pgPort: pg.port, resourceUrl }),
    };
    for (const name of names) {
      const state = { name, port: ports[name], build: 'pending', metadata: null, health: null, readyRoute: null, startup: 'pending' };
      outcome.services.push(state);
      const dir = path.join(root, 'services', name);
      const output = path.join(artifactDir, name); fs.mkdirSync(path.join(output, 'tmp'), { recursive: true });
      const serviceEnv = { ...env, TMPDIR: path.join(output, 'tmp'), MIDWAY_LOGGER_WRITEABLE_DIR: output, BOOT_OUTPUT_DIR: output, BOOT_GUARD_LOG: path.join(output, 'network.jsonl'), BOOT_OSS_FIXTURE: ossFixture ? '1' : '0' };
      try {
        console.log(`Clean build/start ${name} ${ports[name]}`);
        assert.equal(command('git', ['ls-files', '--', path.join(dir, 'dist')], { cwd: root }), '', 'Clean build cannot delete tracked files');
        command('git', ['check-ignore', path.join(dir, 'dist')], { cwd: root });
        command(path.join(dir, 'node_modules/.bin/mw'), ['build', '--clean'], { cwd: dir, env: serviceEnv }); state.build = 'passed';
        const requireService = createRequire(path.join(dir, 'package.json'));
        const { DataSource } = requireService('typeorm');
        const entityDir = path.join(dir, 'dist/entity');
        const entities = fs.readdirSync(entityDir).filter(file => file.endsWith('.entity.js')).flatMap(file => Object.values(require(path.join(entityDir, file))).filter(value => typeof value === 'function'));
        const db = new DataSource({ type: 'postgres', host: '127.0.0.1', port: pg.port, username: 'runtime_verify', password: 'disposable_runtime_only', database: 'runtime_boot', entities, synchronize: false });
        try { await db.initialize(); for (const entity of db.entityMetadatas) await db.getRepository(entity.target).find({ take: 1 }); state.metadata = { entities: db.entityMetadatas.length, columns: db.entityMetadatas.reduce((sum, item) => sum + item.columns.length, 0), tables: db.entityMetadatas.map(item => item.tableName) }; }
        finally { if (db.isInitialized) await db.destroy(); }
        const fd = fs.openSync(path.join(output, 'service.log'), 'w'); logFiles.push(fd);
        const child = cp.spawn(process.execPath, [__filename, '--service', name, String(ports[name])], { cwd: dir, env: serviceEnv, stdio: ['ignore', fd, fd] }); children.push(child);
        for (let i = 0; i < 60; i++) {
          if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Service exited ${child.exitCode || child.signalCode}: ${fs.readFileSync(path.join(output, 'service.log'), 'utf8').slice(-4000)}`);
          try {
            const response = await fetch(`http://127.0.0.1:${ports[name]}/health`, { signal: AbortSignal.timeout(1000) });
            if (response.ok) { state.health = { status: response.status, body: await response.json() }; break; }
          } catch { /* Await an actual listener, never synthesize readiness. */ }
          await pause(500);
        }
        assert(state.health, 'HTTP health timed out');
        assert.equal(state.health.body.database, 'connected'); assert.equal(state.health.body.service, name);
        const ready = await fetch(`http://127.0.0.1:${ports[name]}/health/ready`, { signal: AbortSignal.timeout(1000) });
        state.readyRoute = { status: ready.status, implemented: name !== 'content-generation-service' };
        assert.equal(ready.status, name === 'content-generation-service' ? 404 : 200);
        state.startup = 'passed';
      } catch (error) { state.startup = 'failed'; state.error = error.message; console.error(`${name}: ${error.message}`); }
    }
    for (const state of outcome.services) {
      const log = path.join(artifactDir, state.name, 'network.jsonl');
      const entries = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
      state.guard = { selfCheckPassed: entries.some(entry => entry.decision === 'self-check-passed'), blockedSelfChecks: entries.filter(entry => entry.phase === 'self-check' && entry.decision === 'deny').length,
        runtimeBlocked: entries.filter(entry => entry.phase === 'runtime' && entry.decision === 'deny') };
    }
    outcome.resources = resources;
    outcome.metadataTotals = outcome.services.reduce((sum, state) => ({ entities: sum.entities + (state.metadata?.entities || 0), columns: sum.columns + (state.metadata?.columns || 0) }), { entities: 0, columns: 0 });
    testsPassed = outcome.services.length === 5 && outcome.services.every(state => state.startup === 'passed' && state.guard.selfCheckPassed && state.guard.runtimeBlocked.length === 0);
    console.log(JSON.stringify({ profile: outcome.profile, metadataTotals: outcome.metadataTotals, services: outcome.services.map(state => ({ name: state.name, startup: state.startup, healthStatus: state.health?.status, readyStatus: state.readyRoute?.status, guard: state.guard })) }, null, 2));
    assert(testsPassed, 'Five-service boot verification incomplete; see individual service states');
  } catch (error) { outcome.error = error.message; throw error; }
  finally { const cleaned = await cleanup(); save(cleaned); assert(cleaned.passed, `Cleanup failed: ${cleaned.errors.join('; ')}`); console.log('Verified owned processes stopped and disposable containers absent.'); }
}
