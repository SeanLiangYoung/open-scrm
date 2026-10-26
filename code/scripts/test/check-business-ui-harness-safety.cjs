'use strict';
// Real Docker creation, intentionally failed start, and independently verified cleanup.
// No service or database is started by this check.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'scrm-ui-harness-safety-'));
const dockerLookup = spawnSync('which', ['docker'], { encoding: 'utf8' });
assert.equal(dockerLookup.status, 0, 'Docker CLI is required; this check never installs it');
const docker = dockerLookup.stdout.trim();
const bin = path.join(directory, 'bin');
fs.mkdirSync(bin);
fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env node
const fs = require('node:fs');
const cp = require('node:child_process');
const args = process.argv.slice(2);
const injected = args[0] === 'start' ? [...args, '--intentionally-invalid-scrm-verification-option'] : args;
const result = cp.spawnSync(${JSON.stringify(docker)}, injected, { encoding: 'utf8' });
if (args[0] === 'create' && result.status === 0) fs.appendFileSync(process.env.SAFETY_CREATED_LOG, result.stdout.trim() + '\\n');
process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
process.exit(result.status === null ? 1 : result.status);
`, { mode: 0o700 });

let passed = 0;
const results = [];
try {
  for (const name of ['notification', 'message-logs', 'customer-consent', 'notification-history', 'consent-read', 'observed-dashboard', 'customer']) {
    const harness = path.join(__dirname, `overnight-${name}-ui.cjs`);
    const env = { ...process.env, NOTIFICATION_UI_DISPOSABLE: '', MESSAGE_LOGS_CHILD_DISPOSABLE: '', CUSTOMER_CONSENT_CHILD_DISPOSABLE: '',
      NOTIFICATION_HISTORY_UI_DISPOSABLE: '', CONSENT_READ_UI_CHILD_DISPOSABLE: '', OBSERVED_DASHBOARD_CHILD_DISPOSABLE: '', CUSTOMER_UI_CHILD_DISPOSABLE: '' };
    const guard = spawnSync(process.execPath, [harness, '--service', name === 'observed-dashboard' ? 'analytics-service' : 'message-service', '7008'], { env, encoding: 'utf8', timeout: 10000 });
    fs.writeFileSync(path.join(directory, `${name}-guard.log`), `${guard.stdout || ''}${guard.stderr || ''}`);
    assert.equal(guard.status, 1, `${name}: unowned startup must fail before Bootstrap`);
    assert.match(guard.stderr, /Refusing/);
    assert.doesNotMatch(guard.stdout, /Artifacts:/, `${name}: guard must not enter the main resource flow`);
    const createdLog = path.join(directory, `${name}-created.txt`);
    const result = spawnSync(process.execPath, [harness], {
      env: { ...env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, SAFETY_CREATED_LOG: createdLog },
      encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024,
    });
    fs.writeFileSync(path.join(directory, `${name}-failure.log`), `${result.stdout || ''}${result.stderr || ''}`);
    assert.equal(result.status, 1, `${name}: start failure must fail the entire harness`);
    const artifactDir = result.stdout.match(/Artifacts: (.+)/)?.[1];
    assert.ok(artifactDir, `${name}: failure must preserve an artifact path`);
    const outcome = JSON.parse(fs.readFileSync(path.join(artifactDir, 'result.json'), 'utf8'));
    assert.equal(outcome.passed, false);
    assert.equal(outcome.testsPassed, false);
    assert.equal(outcome.cleanup.passed, true);
    assert.deepEqual(outcome.cleanup.errors, []);
    assert.deepEqual(outcome.cleanup.childPids, [], `${name}: no service may start before database startup succeeds`);
    const ids = fs.readFileSync(createdLog, 'utf8').trim().split('\n');
    assert.equal(ids.length, 1, `${name}: failure happens after creating exactly one owned container`);
    assert.deepEqual(outcome.cleanup.containerIds, ids, `${name}: every created container must be owned before start`);
    for (const id of ids) {
      const absent = spawnSync(docker, ['ps', '-a', '--no-trunc', '--filter', `id=${id}`, '--format', '{{.ID}}'], { encoding: 'utf8' });
      assert.equal(absent.status, 0, `${name}: real daemon must answer the absence check`);
      assert.equal(absent.stdout.trim(), '', `${name}: no owned container may remain`);
    }
    results.push({ name, artifactDir, guardExit: guard.status, injectedExit: result.status, createdIds: ids, cleanupPassed: true });
    passed++;
  }
  fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify({ passed, failed: 0, results }, null, 2));
  console.log(JSON.stringify({ scope: 'Seven unowned-start guards and seven real Docker create/start-failure cleanup checks', passed, failed: 0, directory }));
} catch (error) {
  // Even a regression in the tested harness must not strand this check's resources.
  for (const file of fs.readdirSync(directory).filter(name => name.endsWith('-created.txt'))) {
    for (const id of fs.readFileSync(path.join(directory, file), 'utf8').trim().split('\n')) {
      if (/^[a-f0-9]{64}$/.test(id)) spawnSync(docker, ['rm', '-f', id], { encoding: 'utf8' });
    }
  }
  fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify({ passed, failed: 1, error: String(error), results }, null, 2));
  console.error(error);
  console.error(`Evidence: ${directory}`);
  process.exitCode = 1;
}
