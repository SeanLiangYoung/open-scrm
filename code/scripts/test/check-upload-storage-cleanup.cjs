'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const harness = path.join(__dirname, 'overnight-upload-storage-http.cjs');
const result = spawnSync(process.execPath, [harness], {
  env: { ...process.env, UPLOAD_STORAGE_FAULT_START: '1' }, encoding: 'utf8', timeout: 30000,
});
assert.notEqual(result.status, 0, 'Injected docker start failure must fail the overall run');
const directory = result.stdout.match(/Artifacts: (.+)/)?.[1];
assert.ok(directory, `Expected artifact path: ${result.stdout}\n${result.stderr}`);
const outcome = JSON.parse(fs.readFileSync(path.join(directory, 'result.json'), 'utf8'));
assert.equal(outcome.passed, false); assert.equal(outcome.testsPassed, false);
assert.equal(outcome.cleanup.passed, true); assert.deepEqual(outcome.cleanup.errors, []);
assert.equal(outcome.cleanup.containerIds.length, 1, 'Created container must be registered before start');
for (const id of outcome.cleanup.containerIds) {
  const inspected = spawnSync('docker', ['ps', '-a', '--no-trunc', '--filter', `id=${id}`, '--format', '{{.ID}}'], { encoding: 'utf8' });
  assert.equal(inspected.status, 0); assert.equal(inspected.stdout.trim(), '', 'Created container must be absent after cleanup');
}
assert.match(outcome.error, /docker start/);
const guard = spawnSync(process.execPath, [harness, '--service', 'asset-service', '7005'], {
  env: { ...process.env, UPLOAD_STORAGE_HTTP_CHILD: '' }, encoding: 'utf8', timeout: 10000,
});
assert.equal(guard.status, 1); assert.match(guard.stderr, /Refusing non-disposable/);
console.log(JSON.stringify({ passed: true, artifactDir: directory, injectedExit: result.status, createdContainers: outcome.cleanup.containerIds, cleanup: outcome.cleanup, guardExit: guard.status }));
