'use strict';
// No Docker daemon, Bootstrap, database, or HTTP calls: subprocess Docker is a fixture executable.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const target = path.join(__dirname, 'overnight-message-logs-ui.cjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'message-logs-selfcheck-'));
const events = path.join(temp, 'docker-events.jsonl');
fs.writeFileSync(path.join(temp, 'docker'), `#!${process.execPath}\nconst fs=require('node:fs');const args=process.argv.slice(2);fs.appendFileSync(process.env.FAULT_EVENTS,JSON.stringify(args)+'\\n');if(args[0]==='create'){console.log('owned-fault-container');process.exit(0)}if(args[0]==='run'||args[0]==='start'){console.error('injected Docker start failure');process.exit(42)}if(args[0]==='image'||args[0]==='rm'||args[0]==='ps')process.exit(0);process.exit(43);\n`, { mode: 0o755 });
let failures = 0;
try {
  let bootstrapLoaded = false;
  try {
    vm.runInNewContext(fs.readFileSync(target, 'utf8'), {
      require: name => name === 'node:module' ? { createRequire() { bootstrapLoaded = true; throw new Error('BOOTSTRAP_MUST_NOT_LOAD'); } } : require(name),
      __dirname, __filename: target, console, process: { argv: ['node', target, '--service', 'auth-service', '49123'], env: {}, exit() {} },
    });
  } catch (error) {
    assert.match(error.message, /Refusing.*disposable/, 'direct child must reject disposable profile before loading Bootstrap');
  }
  assert.equal(bootstrapLoaded, false);
  console.log('PASS direct --service refuses absent disposable profile before Bootstrap/connect');
} catch (error) { failures++; console.error(error.message); }
try {
  const child = spawnSync(process.execPath, [target], { env: { ...process.env, PATH: `${temp}:${process.env.PATH}`, FAULT_EVENTS: events }, encoding: 'utf8', timeout: 15000 });
  assert.notEqual(child.status, 0, 'Docker start fault must fail overall');
  assert.match(child.stderr, /injected Docker start failure/);
  const calls = fs.readFileSync(events, 'utf8').trim().split('\n').map(JSON.parse);
  assert(calls.some(a => a[0] === 'create'), 'must create and register before start');
  assert(calls.some(a => a[0] === 'start'), 'must exercise injected start failure');
  assert(calls.some(a => a[0] === 'rm' && a.includes('owned-fault-container')), 'created container must be cleaned after failed start');
  assert(calls.some(a => a[0] === 'ps'), 'must verify absence');
  const artifact = /Artifacts: (.+)/.exec(child.stdout)[1];
  const result = JSON.parse(fs.readFileSync(path.join(artifact, 'result.json'), 'utf8'));
  assert.equal(result.passed, false); assert.equal(result.testsPassed, false); assert.equal(result.cleanup.passed, true);
  console.log(`PASS injected Docker start failure exit${child.status}, registered container removed, result passed=false; ${artifact}`);
} catch (error) { failures++; console.error(error.message); }
finally { fs.rmSync(temp, { recursive: true, force: true }); }
process.exitCode = failures ? 1 : 0;
