#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseArgs, registry, runStages, execute, preparePrerequisites } = require('./verify-reliability.cjs');
const { forbiddenMessagingDependency } = require('./customer-ui-request-policy.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scrm-runner-selfcheck-'));
let passed = 0;
const check = async (name, run) => { await run(); passed++; console.log(`CHECK ${name}`); };
const fake = id => ({ id, group: 'static', command: process.execPath, args: [], cwd: root });
async function main() {
  await check('CLI rejects unknown, duplicate, missing and invalid group flags', () => {
    for (const args of [['--bad'], ['--group'], ['--group','wat'], ['--group','static','--group','http'], ['--report-dir']]) assert.throws(() => parseArgs(args));
    assert.equal(parseArgs(['--group','database']).group, 'database');
  });
  await check('customer UI permits only the specific read-only consent dependency', () => {
    for (const [method, pathname, expected] of [
      ['GET', '/api/v1/messages/consents/customer/10?page=1&pageSize=20', false],
      ['POST', '/api/v1/messages/consents/customer/10', true],
      ['POST', '/api/v1/messages/send', true],
      ['GET', '/api/v1/messages/logs/10', true],
      ['POST', '/api/message/send', true],
      ['POST', '/api/notification', true],
      ['POST', '/api/v1/messages/consents/grant', true],
      ['GET', '/api/v1/messages/consents/customer/10/extra', true],
      ['GET', '/api/v1/analytics/overview', false],
    ]) assert.equal(forbiddenMessagingDependency({ method, path: pathname }), expected);
  });
  await check('registry has only reviewed existing 50 stages', () => {
    const stages = registry('pnpm');
    assert.deepEqual(['static','browser','database','http'].map(group => stages.filter(s => s.group === group).length), [4,14,10,22]);
    assert.equal(stages.length, 50);
    assert.deepEqual(stages.find(s => s.id === 'message-retry-http').args, ['scripts/test/overnight-message-retry-http.cjs']);
    assert.deepEqual(stages.find(s => s.id === 'message-retry-http').needs, ['docker']);
    assert.deepEqual(stages.find(s => s.id === 'message-capability-http').needs, ['docker']);
    assert.deepEqual(stages.find(s => s.id === 'auth-response-races').args, ['e2e/check-auth-response-races.cjs']);
    assert.deepEqual(stages.find(s => s.id === 'runtime-boot-oss-fixture').args, ['scripts/test/overnight-runtime-boot.cjs', '--oss-fixture']);
    assert.deepEqual(stages.find(s => s.id === 'runtime-boot-oss-fixture').needs, ['docker']);
    assert(stages.some(s => s.id === 'analytics-http' && s.group === 'http'));
    for (const stage of stages.filter(s => s.group === 'database' || s.group === 'http')) assert(fs.existsSync(path.resolve(stage.cwd, stage.args[0])));
  });
  await check('serial results separate pass/fail/skip, preserve first child exit and continue', async () => {
    const calls = [];
    const reportDir = path.join(root, 'mixed');
    const result = await runStages(['skip','bad','ok','laterbad'].map(fake), { reportDir,
      prerequisite: s => s.id === 'skip' ? 'missing fake dependency' : null,
      executor: async s => { calls.push(s.id); return { exitCode: s.id === 'bad' ? 7 : s.id === 'laterbad' ? 9 : 0 }; } });
    assert.deepEqual(calls, ['bad','ok','laterbad']); assert.equal(result.exitCode,7);
    assert.deepEqual(result.passed,['ok']); assert.deepEqual(result.failed,['bad','laterbad']); assert.deepEqual(result.skipped,['skip']);
    const saved = JSON.parse(fs.readFileSync(path.join(reportDir,'manifest.json')));
    assert.equal(saved.exitCode,7); assert(saved.finishedAt);
    for (const record of saved.stages) { assert(fs.existsSync(record.log)); assert(record.durationMs >= 0); }
  });
  await check('a missing prerequisite never reports success', async () => {
    const result = await runStages([fake('skip')], { reportDir:path.join(root,'skip'), prerequisite:()=> 'absent', executor:()=>assert.fail('must not spawn') });
    assert.equal(result.exitCode,1); assert.equal(result.failed.length,0); assert.equal(result.skipped.length,1);
  });
  await check('actual fake child output and original exit propagate without shell/tee', async () => {
    const stage = { ...fake('child'), args:['-e', "console.log('visible-output');process.exit(23)"] };
    const result = await runStages([stage], { reportDir:path.join(root,'child'), executor:execute });
    assert.equal(result.exitCode,23); assert.match(fs.readFileSync(result.stages[0].log,'utf8'),/visible-output/);
  });
  await check('spawn failure becomes failed with retained error', async () => {
    const result = await runStages([{...fake('missing'),command:path.join(root,'does-not-exist')}], {reportDir:path.join(root,'spawn')});
    assert.equal(result.exitCode,1); assert.equal(result.failed.length,1); assert.match(result.stages[0].error,/ENOENT/);
  });
  await check('interruption is failed and remaining stages are explicitly skipped', async () => {
    const cancellation = {};
    const result = await runStages([fake('interrupt'),fake('unstarted')], {reportDir:path.join(root,'interrupt'), cancellation,
      executor:async()=> { cancellation.signal='SIGTERM'; return {exitCode:null,signal:'SIGTERM'}; } });
    assert.equal(result.exitCode,143); assert.deepEqual(result.failed,['interrupt']); assert.deepEqual(result.skipped,['unstarted']);
  });
  await check('real fake-child interruption waits for cleanup and skips later work', async () => {
    const ready = path.join(root,'signal-ready');
    const cleaned = path.join(root,'signal-cleaned');
    const script = `const fs=require('node:fs');process.on('SIGTERM',()=>{setTimeout(()=>{fs.writeFileSync(${JSON.stringify(cleaned)},'done');process.exit(143)},30)});fs.writeFileSync(${JSON.stringify(ready)},'ready');setInterval(()=>{},1000);`;
    const cancellation = {};
    const result = await runStages([{...fake('signal'),args:['-e',script]},fake('after-signal')], {reportDir:path.join(root,'real-signal'), cancellation,
      executor:async(stage,log,env,state)=> {
        const childResult = execute(stage,log,env,state);
        for (let n=0; !fs.existsSync(ready) && n<200; n++) await new Promise(resolve=>setTimeout(resolve,10));
        process.emit('SIGTERM');
        return childResult;
      } });
    assert(fs.existsSync(cleaned)); assert.equal(result.exitCode,143); assert.deepEqual(result.skipped,['after-signal']);
  });
  await check('PNPM_EXEC launcher preserves literal paths and propagates to nested pnpm', async () => {
    const dir = path.join(root, 'literal-$()-`path`'); fs.mkdirSync(dir);
    const target = path.join(dir,'fake-pnpm.cjs'); fs.writeFileSync(target, `console.log('8.9.0')`);
    const env = {...process.env, PNPM_EXEC:target};
    const prepared = preparePrerequisites(path.join(root,'launcher'),env,()=>({status:0,stdout:'8.9.0'}),()=>true);
    assert.equal(prepared.prerequisite({needs:['pnpm']}),null);
    const launched = spawnSync(process.execPath,['-e',`const r=require('node:child_process').spawnSync('pnpm',['--version'],{encoding:'utf8'});process.stdout.write(r.stdout||'');process.exit(r.status===null?1:r.status)`],{env,encoding:'utf8'});
    assert.equal(launched.status,0); assert.equal(launched.stdout.trim(),'8.9.0');
    const absent = preparePrerequisites(path.join(root,'absent'),{...env,PNPM_EXEC:'missing'},()=>({status:1}),()=>false);
    assert.match(absent.prerequisite({needs:['pnpm']}),/pnpm 8 required/);
  });
  await check('bare PNPM_EXEC resolves PATH before constructing launcher', async () => {
    const dir = path.join(root,'bare-bin'); fs.mkdirSync(dir);
    const target = path.join(dir,'pnpm');
    fs.writeFileSync(target, `#!${process.execPath}\nconsole.log('8.9.0')\n`, {mode:0o755});
    const env = {...process.env, PATH:dir+path.delimiter+process.env.PATH, PNPM_EXEC:'pnpm'};
    const prepared = preparePrerequisites(path.join(root,'bare-report'),env,undefined,()=>true,new Set(['pnpm']));
    assert.equal(prepared.prerequisite({needs:['pnpm']}),null);
    const launched = spawnSync(prepared.pnpm,['--version'],{env,encoding:'utf8'});
    assert.equal(launched.status,0,launched.stderr); assert.equal(launched.stdout.trim(),'8.9.0');
  });
  await check('missing Chromium skips browser stages but allows API-only HTTP stages', async () => {
    const env = {...process.env}; delete env.PNPM_EXEC;
    const calls = [];
    const prepared = preparePrerequisites(path.join(root,'mixed-browser'),env,(command)=>{calls.push(command);return {status:0,stdout:'8.9.0'};},()=>false,new Set(['docker','playwright','chromium']));
    const stages = registry('pnpm').filter(s => s.group === 'http');
    const result = await runStages(stages,{reportDir:path.join(root,'mixed-browser-results'),prerequisite:prepared.prerequisite,executor:async()=>({exitCode:0})});
    assert.equal(result.passed.length,13); assert.equal(result.skipped.length,9); assert.equal(result.failed.length,0); assert.equal(result.exitCode,1);
    assert.deepEqual(calls,['docker']);
  });
  await check('static dependency probing never invokes Docker', () => {
    const calls = [];
    const env = {...process.env}; delete env.PNPM_EXEC;
    preparePrerequisites(path.join(root,'static-probes'),env,(command)=>{calls.push(command);return {status:0,stdout:'8.9.0'};},()=>assert.fail('no browser probe expected'),new Set(['pnpm','bash']));
    assert.deepEqual(calls,['pnpm','bash']);
  });
  await check('unknown CLI flag exits 2 without starting project commands', () => {
    const result = spawnSync(process.execPath,[path.join(__dirname,'verify-reliability.cjs'),'--unknown'],{encoding:'utf8'});
    assert.equal(result.status,2); assert.match(result.stderr,/Unknown/);
  });
  console.log(JSON.stringify({scope:'runner selfcheck only; fake child commands, no project suites/DB/services',passed,failed:0,reportDir:root}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
