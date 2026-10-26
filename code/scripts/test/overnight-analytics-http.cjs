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
  if (process.env.ANALYTICS_HTTP_CHILD !== '1' || process.env.DB_DATABASE !== 'analytics_http' ||
    process.env.DB_USERNAME !== 'analytics_verify' || process.env.DB_HOST !== '127.0.0.1' ||
    !['auth-service', 'analytics-service', 'gateway-service'].includes(process.argv[3]) ||
    !Number.isSafeInteger(Number(process.argv[4])) || Number(process.argv[4]) < 1 || Number(process.argv[4]) > 65535) {
    throw new Error('Internal service launcher requires the disposable analytics harness profile');
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
  const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-analytics-http-'));
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
    const id = command('docker', ['run', '--rm', '--detach', '--name', `open-scrm-analytics-${suffix}-${runId}`,
      '--label', 'open-scrm.verification=analytics-http', '--publish', `127.0.0.1::${internalPort}`, ...extra, image]);
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
    const pg = container('postgres:16-alpine', 'pg', 5432, ['--env', 'POSTGRES_DB=analytics_http', '--env', 'POSTGRES_USER=analytics_verify', '--env', 'POSTGRES_PASSWORD=disposable_analytics_only']);
    const redis = container('redis:7-alpine', 'redis', 6379, []);
    await waitUntil(() => spawnSync('docker', ['exec', pg.id, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', 'analytics_verify', '-d', 'analytics_http']).status === 0, 'disposable PostgreSQL');
    await waitUntil(() => spawnSync('docker', ['exec', redis.id, 'redis-cli', 'ping']).status === 0, 'disposable Redis');
    const psql = sql => command('docker', ['exec', '-i', pg.id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'analytics_verify', '-d', 'analytics_http'], { input: sql });
    psql(fs.readFileSync(path.join(root, 'scripts/init-db.pg.sql'), 'utf8'));
    psql("ALTER DATABASE analytics_http SET timezone TO 'UTC'");
    psql(`
      INSERT INTO "user"(id,corp_id,username,password,status,is_admin) SELECT 91001,1101,'analytics_a',password,1,0 FROM "user" WHERE corp_id=1 AND username='admin';
      INSERT INTO "user"(id,corp_id,username,password,status,is_admin) SELECT 91002,1102,'analytics_b',password,1,0 FROM "user" WHERE corp_id=1 AND username='admin';
      INSERT INTO "user"(id,corp_id,username,password,status,is_admin) SELECT 91003,1101,'analytics_disabled',password,0,0 FROM "user" WHERE corp_id=1 AND username='admin';
      INSERT INTO "user"(id,corp_id,username,password,status,is_admin) SELECT 91004,1102,'analytics_b_colleague',password,1,0 FROM "user" WHERE corp_id=1 AND username='admin';
      INSERT INTO customer(id,corp_id,external_userid,name,status,create_time) VALUES
        (81001,1101,'a-old','A old',1,'2026-10-20 12:00:00'),(81002,1101,'a-new','A new',1,'2026-10-21 09:00:00'),
        (81003,1101,'a-deleted','A deleted',0,'2026-10-21 10:00:00'),(82001,1102,'b-only','B only',1,'2026-10-21 08:00:00');
      INSERT INTO channel_code(id,corp_id,code_name,channel) VALUES(71001,1101,'A','fixture'),(72001,1102,'B','fixture');
      INSERT INTO channel_scan_touch(corp_id,channel_code_id,create_time) VALUES
        (1101,71001,'2026-10-20 23:59:59.999+00'),(1101,71001,'2026-10-21 00:00:00+00'),
        (1101,71001,'2026-10-21 12:00:00+00'),(1101,71001,'2026-10-22 00:00:00+00'),(1102,72001,'2026-10-21 12:00:00+00');
      INSERT INTO message_log(corp_id,message_type,target_type,target_id,content,send_status,extra,create_time) VALUES
        (1101,5,1,81001,'start boundary',1,'{"utm_campaign":"own"}','2026-10-21 00:00:00'),
        (1101,5,1,81001,'duplicate own',1,'{"region_pack_id":"fixture"}','2026-10-21 12:00:00'),
        (1101,5,1,81002,'no hint',1,'{}','2026-10-21 13:00:00'),
        (1101,5,1,82001,'foreign reference',1,'{"utm_source":"foreign"}','2026-10-21 14:00:00'),
        (1101,5,1,89999,'orphan reference',1,'{"link_id":"orphan"}','2026-10-21 15:00:00'),
        (1101,5,1,81002,'failed hint',2,'{"utm_campaign":"failed"}','2026-10-21 16:00:00'),
        (1101,5,2,91001,'employee hint',1,'{"utm_medium":"employee"}','2026-10-21 17:00:00'),
        (1101,5,1,81001,'before window',1,'{"utm_campaign":"before"}','2026-10-20 23:59:59.999'),
        (1101,5,1,81002,'next midnight',1,'{"utm_campaign":"after"}','2026-10-22 00:00:00'),
        (1102,5,1,82001,'B only',1,'{"utm_campaign":"b"}','2026-10-21 11:00:00');
      INSERT INTO sop_template(id,corp_id,template_name,template_type,trigger_type,status) VALUES(61001,1101,'analytics fixture',1,4,1);
      INSERT INTO sop_execution(corp_id,template_id,target_type,customer_id,current_step,total_steps,status,complete_time,create_time) VALUES
        (1101,61001,1,81001,1,1,1,'2026-10-21 18:00:00','2026-10-21 17:00:00'),(1101,61001,1,81002,0,1,3,NULL,'2026-10-21 17:30:00');
      -- Imported historical daily snapshot, intentionally distinct from current inventory.
      INSERT INTO daily_stat(corp_id,stat_date,new_customer_count,lost_customer_count,active_customer_count,total_customer_count,active_staff_count,total_staff_count,message_send_count,message_success_count,message_fail_count,sop_execute_count,sop_success_count,update_time)
        VALUES(1101,'2026-10-20',1,1,1,2,1,2,1,1,0,2,1,'2026-10-20 23:00:00');
    `);
    const ports = { auth: await freePort(), analytics: await freePort(), gateway: await freePort() };
    const baseEnv = { ...process.env, NODE_ENV: 'production', ANALYTICS_HTTP_CHILD: '1', TZ: 'UTC', DB_HOST: '127.0.0.1', DB_PORT: String(pg.port),
      DB_USERNAME: 'analytics_verify', DB_USER: 'analytics_verify', DB_PASSWORD: 'disposable_analytics_only', DB_DATABASE: 'analytics_http',
      REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redis.port), REDIS_PASSWORD: '',
      JWT_SECRET: `disposable-analytics-jwt-${runId}`, APP_KEYS: `disposable-analytics-keys-${runId}`,
      AUTH_SERVICE_URL: `http://127.0.0.1:${ports.auth}`, ANALYTICS_SERVICE_URL: `http://127.0.0.1:${ports.analytics}`,
      HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '', http_proxy: '', https_proxy: '', all_proxy: '', NO_PROXY: '127.0.0.1,localhost',
    };
    for (const [name, port] of [['auth-service', ports.auth], ['analytics-service', ports.analytics], ['gateway-service', ports.gateway]]) {
      const dir = serviceRoot(name);
      console.log(`Build/start ${name} on free loopback port ${port}`);
      fs.rmSync(path.join(dir, 'dist'), { recursive: true, force: true });
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
    const e2eDir = path.join(root, 'e2e');
    const playwrightOutput = command(path.join(e2eDir, 'node_modules/.bin/playwright'), ['test', '--config', 'analytics-runtime.config.ts', '--reporter=line', '--output', path.join(artifactDir, 'playwright')], {
      cwd: e2eDir, env: { ...baseEnv, ANALYTICS_E2E_DISPOSABLE: '1', GATEWAY_URL: `http://127.0.0.1:${ports.gateway}` },
    });
    fs.writeFileSync(path.join(artifactDir, 'playwright-output.txt'), playwrightOutput + '\n');
    if (!/11 passed/.test(playwrightOutput) || /\d+ skipped/.test(playwrightOutput)) throw new Error(`Expected eleven executed passing tests: ${playwrightOutput}`);
    psql(`DO $$ BEGIN
      IF (SELECT COUNT(*) FROM daily_stat WHERE corp_id IN(1101,1102) AND stat_date BETWEEN '2026-10-20' AND '2026-10-21') <> 3
        THEN RAISE EXCEPTION 'Expected 3 fixture snapshots'; END IF;
      IF NOT EXISTS(SELECT 1 FROM daily_stat WHERE corp_id=1101 AND stat_date='2026-10-21' AND total_customer_count=3 AND active_customer_count=2 AND lost_customer_count=1 AND new_customer_count=2 AND message_send_count=7 AND message_success_count=6 AND message_fail_count=1 AND sop_execute_count=2 AND sop_success_count=1)
        THEN RAISE EXCEPTION 'A events/inventory mismatch'; END IF;
      IF NOT EXISTS(SELECT 1 FROM daily_stat WHERE corp_id=1102 AND stat_date='2026-10-21' AND total_customer_count=1 AND message_send_count=1)
        THEN RAISE EXCEPTION 'B tenant aggregate mismatch'; END IF;
      IF NOT EXISTS(SELECT 1 FROM daily_stat WHERE corp_id=1101 AND stat_date='2026-10-20' AND total_customer_count=2 AND new_customer_count=1)
        THEN RAISE EXCEPTION 'Historical snapshot changed'; END IF;
      IF EXISTS(SELECT 1 FROM daily_stat WHERE corp_id IN(1101,1102) AND stat_date='2026-10-23')
        THEN RAISE EXCEPTION 'Missing overview created snapshot'; END IF;
      IF (SELECT COUNT(*) FROM message_log WHERE corp_id IN(1101,1102)) <> 10
        THEN RAISE EXCEPTION 'Analytics mutated raw message fixtures'; END IF;
    END $$;`);
    console.log('PASS: analytics runtime Playwright 11 passed (actual authenticated gateway HTTP)');
    const evidence = psql("SELECT corp_id,stat_date,new_customer_count,total_customer_count,active_customer_count,lost_customer_count,message_send_count,message_success_count,message_fail_count,sop_execute_count,sop_success_count FROM daily_stat WHERE corp_id IN(1101,1102) ORDER BY corp_id,stat_date; SELECT corp_id,create_time::date AS day,send_status,COUNT(*) FROM message_log WHERE corp_id IN(1101,1102) GROUP BY corp_id,create_time::date,send_status ORDER BY corp_id,day,send_status;");
    console.log(evidence);
    fs.writeFileSync(path.join(artifactDir, 'database-evidence.txt'), evidence + '\n');
    testPassed = true;
  } catch (error) {
    outcome.error = error.message;
    for (const name of ['auth-service', 'analytics-service', 'gateway-service']) {
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
