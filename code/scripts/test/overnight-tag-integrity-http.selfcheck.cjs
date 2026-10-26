#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { assertServiceProfile } = require('./overnight-tag-integrity-http.cjs');
const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-tag-integrity-http-selfcheck-'));
const log = path.join(artifactDir, 'blocked-outbound.jsonl'); fs.writeFileSync(log, '');
const profile = {
  TAG_INTEGRITY_UI_DISPOSABLE: '1', DB_HOST: '127.0.0.1', REDIS_HOST: '127.0.0.1',
  DB_USERNAME: 'tag_integrity_http_verify', DB_USER: 'tag_integrity_http_verify',
  DB_DATABASE: 'tag_integrity_http', DB_PASSWORD: 'disposable_tag_integrity_http_only',
  DB_PORT: '49151', REDIS_PORT: '49152',
  TAG_INTEGRITY_ALLOWED_PORTS: JSON.stringify([49151, 49152, 49153, 49154, 49155]), TAG_INTEGRITY_GUARD_LOG: log
};
let passed = 0;
function check(name, run) { run(); passed++; console.log(`PASS ${name}`); }
check('valid disposable profile allows only known service bootstrap identities', () => {
  for (const name of ['auth-service','customer-service','gateway-service']) assert.equal(assertServiceProfile(profile,name,'49153'),49153);
});
check('missing marker or wrong dedicated database credentials reject', () => {
  for (const [key,value] of [['TAG_INTEGRITY_UI_DISPOSABLE',''],['DB_USERNAME','postgres'],['DB_USER','postgres'],['DB_DATABASE','scrm_dev'],['DB_PASSWORD','user-secret']]) assert.throws(()=>assertServiceProfile({...profile,[key]:value},'auth-service','49153'),/disposable profile/);
});
check('non-loopback/default/ambiguous or shared infrastructure ports reject', () => {
  for (const patch of [{DB_HOST:'localhost'},{REDIS_HOST:'10.0.0.2'},{DB_PORT:'5432'},{REDIS_PORT:'6379'},{DB_PORT:'49151junk'},{REDIS_PORT:'49151'}]) assert.throws(()=>assertServiceProfile({...profile,...patch},'auth-service','49153'));
});
check('unknown service or service port outside owned allowlist rejects', () => {
  for (const [name,port] of [['operation-service','49153'],['auth-service','7001'],['auth-service','49151'],['auth-service','49153junk']]) assert.throws(()=>assertServiceProfile(profile,name,port));
});
check('invalid owned port manifest and absent guard artifact reject', () => {
  for (const patch of [{TAG_INTEGRITY_ALLOWED_PORTS:'not-json'},{TAG_INTEGRITY_ALLOWED_PORTS:'[49151,49152,49153,49153,49155]'},{TAG_INTEGRITY_GUARD_LOG:'/tmp/user-file'},{TAG_INTEGRITY_GUARD_LOG:path.join(artifactDir,'missing.jsonl')}]) assert.throws(()=>assertServiceProfile({...profile,...patch},'auth-service','49153'));
});
const attempts = path.join(artifactDir,'connection-attempts.jsonl');
const tripwire = path.join(artifactDir,'network-tripwire.cjs');
fs.writeFileSync(tripwire, `const fs=require('node:fs');const deny=()=>{fs.appendFileSync(${JSON.stringify(attempts)},'attempt\\n');throw new Error('SELFTEST_NETWORK_FORBIDDEN')};require('node:net').Socket.prototype.connect=deny;require('node:dns').lookup=deny;globalThis.fetch=deny;`);
for (const [name, patch, service] of [
  ['direct service without profile', { TAG_INTEGRITY_UI_DISPOSABLE:'', DB_DATABASE:'scrm_dev', DB_USERNAME:'postgres' }, 'auth-service'],
  ['marker with user database credentials', { ...profile, DB_USERNAME:'postgres' }, 'customer-service'],
  ['marker with non-allowlisted service', profile, 'operation-service']
]) {
  check(`${name} exits1 before any connection or service loading`, () => {
    const result = spawnSync(process.execPath, ['--require',tripwire,path.join(__dirname,'overnight-tag-integrity-http.cjs'),'--service',service,'49153'], {env:{...process.env,...patch},encoding:'utf8'});
    assert.equal(result.status,1,result.stderr); assert.match(result.stderr,/Refusing.*disposable profile/);
    assert(!fs.existsSync(attempts),'No DNS/TCP/fetch permitted before validation');
    assert(!result.stdout.includes('Artifacts:'),'Direct guard must not start parent harness');
  });
}
const result = { scope:'tag harness profile selfcheck; no services, Docker, builds, HTTP or DB', passed, failed:0, artifactDir };
fs.writeFileSync(path.join(artifactDir,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
