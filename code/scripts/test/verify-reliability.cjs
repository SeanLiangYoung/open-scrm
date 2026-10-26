#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const codeRoot = path.resolve(__dirname, '../..');
const groups = ['static', 'browser', 'database', 'http'];
function parseArgs(args) {
  const options = { group: 'all' };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--help') { options.help = true; continue; }
    if (!['--group', '--report-dir'].includes(flag) || seen.has(flag)) throw new Error(`Unknown or duplicate flag: ${flag}`);
    seen.add(flag);
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    options[flag === '--group' ? 'group' : 'reportDir'] = value;
  }
  if (![...groups, 'all'].includes(options.group)) throw new Error(`Unknown group: ${options.group}`);
  return options;
}
function registry(pnpm) {
  const stage = (group, id, command, args, cwd = codeRoot, needs = []) => ({ group, id, command, args, cwd, needs });
  return [
    stage('static', 'workspace', pnpm, ['test'], codeRoot, ['pnpm', 'bash']),
    stage('static', 'login-store-races', process.execPath, ['e2e/check-login-store-races.cjs']),
    stage('static', 'auth-response-races', process.execPath, ['e2e/check-auth-response-races.cjs']),
    stage('static', 'runner-selfcheck', process.execPath, ['scripts/test/verify-reliability.selfcheck.cjs']),
    ...['operation-contracts', 'mass-task-contracts', 'customer-form-contracts', 'staff-selection-contracts', 'tenant-login-admin', 'tenant-login-operation', 'sop-message-capabilities', 'notification-staff', 'message-logs', 'customer-consent', 'notification-history', 'customer-consent-history', 'observed-dashboard', 'tag-integrity'].map(name => stage('browser', name, pnpm, ['exec', 'playwright', 'test', '--config', `${name}.config.ts`], path.join(codeRoot, 'e2e'), ['pnpm', 'playwright', 'chromium'])),
    ...['customer', 'sop', 'analytics', 'customer-assignment', 'notification', 'service-schema-audit'].map(name => stage('database', name, 'bash', [`scripts/test/overnight-${name}${name === 'service-schema-audit' ? '' : '-postgres'}.sh`], codeRoot, ['bash', 'docker'])),
    stage('database', 'consent-read-postgres', process.execPath, ['scripts/test/overnight-consent-read-postgres.cjs'], codeRoot, ['docker']),
    ...['tag-integrity-postgres', 'tag-name-concurrency', 'sop-create-postgres'].map(name => stage('database', name, process.execPath, [`scripts/test/overnight-${name}.cjs`], codeRoot, ['docker'])),
    ...['customer-http', 'consent-http', 'operation-http', 'staff-http', 'message-retry-http', 'message-capability-http', 'analytics-http', 'customer-ui', 'tenant-login', 'notification-ui', 'message-logs-ui', 'customer-consent-ui', 'notification-history-ui', 'consent-read-http', 'consent-read-ui', 'observed-dashboard-ui', 'tag-integrity-http', 'message-template-http', 'sop-action-http', 'notification-identifiers-http', 'customer-input-http'].map(name => stage('http', name, process.execPath, [`scripts/test/overnight-${name}.cjs`], codeRoot, ['docker', ...(['message-retry-http', 'message-capability-http', 'consent-read-http', 'message-template-http', 'notification-identifiers-http', 'customer-input-http'].includes(name) ? [] : ['playwright']), ...(['customer-ui', 'tenant-login', 'notification-ui', 'message-logs-ui', 'customer-consent-ui', 'notification-history-ui', 'consent-read-ui', 'observed-dashboard-ui', 'tag-integrity-http'].includes(name) ? ['chromium'] : [])])),
    stage('http', 'runtime-boot-oss-fixture', process.execPath, ['scripts/test/overnight-runtime-boot.cjs', '--oss-fixture'], codeRoot, ['docker'])
  ];
}
function execute(stage, logPath, env, cancellation = {}) {
  return new Promise(resolve => {
    const fd = fs.openSync(logPath, 'a');
    let child;
    try { child = spawn(stage.command, stage.args, { cwd: stage.cwd, env, stdio: ['ignore', fd, fd], detached: process.platform !== 'win32', shell: process.platform === 'win32' && /\.cmd$/i.test(stage.command) }); }
    catch (error) { fs.closeSync(fd); resolve({ exitCode: 1, error: error.message }); return; }
    const forward = signal => {
      cancellation.signal = signal;
      try { if (process.platform === 'win32') child.kill(signal); else process.kill(-child.pid, signal); } catch {}
    };
    const interrupt = () => forward('SIGINT');
    const terminate = () => forward('SIGTERM');
    process.once('SIGINT', interrupt); process.once('SIGTERM', terminate);
    const unlisten = () => { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate); };
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true; unlisten(); fs.closeSync(fd); resolve(result);
    };
    child.once('error', error => finish({ exitCode: 1, error: error.message }));
    child.once('close', (exitCode, signal) => finish({ exitCode, signal }));
  });
}
async function runStages(stages, { reportDir, env = process.env, executor = execute, prerequisite = () => null, now = Date.now, cancellation = {} }) {
  fs.mkdirSync(reportDir, { recursive: true });
  const manifest = { startedAt: new Date(now()).toISOString(), stages: [], passed: [], failed: [], skipped: [], exitCode: 0 };
  const save = () => fs.writeFileSync(path.join(reportDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  save();
  for (const [index, stage] of stages.entries()) {
    const started = now();
    const record = { id: stage.id, group: stage.group, command: stage.command, args: stage.args, cwd: stage.cwd,
      log: path.join(reportDir, `${String(index + 1).padStart(2, '0')}-${stage.group}-${stage.id}.log`), startedAt: new Date(started).toISOString() };
    fs.writeFileSync(record.log, `${stage.command} ${stage.args.join(' ')}\n`);
    let reason;
    try { reason = cancellation.signal ? `Interrupted by ${cancellation.signal}; stage not started` : await prerequisite(stage); } catch (error) { reason = error.message; }
    if (reason) {
      Object.assign(record, { status: 'skipped', reason, exitCode: null });
      fs.appendFileSync(record.log, `SKIPPED: ${reason}\n`);
    } else {
      let result;
      try { result = await executor(stage, record.log, env, cancellation); } catch (error) { result = { exitCode: 1, error: error.message }; }
      if (cancellation.signal && !result.signal) result.signal = cancellation.signal;
      Object.assign(record, result, { status: result.exitCode === 0 && !result.signal && !result.error ? 'passed' : 'failed' });
      if (record.error) fs.appendFileSync(record.log, `ERROR: ${record.error}\n`);
    }
    record.durationMs = now() - started;
    manifest.stages.push(record);
    manifest[record.status].push(record.id);
    // Preserve the first actual failure code; a skipped prerequisite alone fails with 1.
    if (record.status === 'failed' && !manifest.failed.slice(0, -1).length) manifest.exitCode = Number.isInteger(record.exitCode) && record.exitCode > 0 ? record.exitCode : record.signal === 'SIGINT' ? 130 : record.signal === 'SIGTERM' ? 143 : 1;
    if (record.status === 'skipped' && manifest.exitCode === 0) manifest.exitCode = 1;
    console.log(`${record.status.toUpperCase()} ${stage.group}/${stage.id} (${record.durationMs}ms): ${record.log}`);
    save();
  }
  manifest.finishedAt = new Date(now()).toISOString(); save(); return manifest;
}
function resolveExecutable(value, env) {
  if (/\.cjs$/i.test(value) && fs.existsSync(path.resolve(value))) return path.resolve(value);
  if (path.isAbsolute(value) || value.includes('/') || value.includes('\\')) return path.resolve(value);
  const extensions = process.platform === 'win32' ? ['', ...(env.PATHEXT || '.EXE;.CMD;.BAT').split(';')] : [''];
  for (const dir of (env.PATH || '').split(path.delimiter)) {
    for (const extension of extensions) {
      const candidate = path.resolve(dir || '.', value + extension);
      try { fs.accessSync(candidate, process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK); if (fs.statSync(candidate).isFile()) return candidate; } catch {}
    }
  }
  return null;
}
function preparePrerequisites(reportDir, env, probeCommand, chromiumAvailable, needed = new Set(['pnpm','bash','docker','playwright','chromium'])) {
  const errors = {};
  if (Number(process.versions.node.split('.')[0]) < 20) errors.node = 'Node20+ required';
  const selectedPnpm = env.PNPM_EXEC || 'pnpm';
  let pnpm = selectedPnpm;
  const probe = probeCommand || ((command, args) => spawnSync(command, args, { env, encoding: 'utf8', shell: process.platform === 'win32' && /\.cmd$/i.test(command) }));
  if (needed.has('pnpm')) {
    const resolved = env.PNPM_EXEC ? resolveExecutable(selectedPnpm, env) : null;
    const versionTarget = resolved || selectedPnpm;
    const pnpmArgs = /\.cjs$/i.test(versionTarget) ? [versionTarget, '--version'] : ['--version'];
    const version = probe(/\.cjs$/i.test(versionTarget) ? process.execPath : versionTarget, pnpmArgs);
    if (version.status !== 0 || !/^8\./.test((version.stdout || '').trim())) errors.pnpm = 'pnpm 8 required on PATH, or set PNPM_EXEC to a pnpm 8 executable/.cjs file';
    if (!errors.pnpm && env.PNPM_EXEC) {
      const target = resolveExecutable(selectedPnpm, env);
      if (!target) errors.pnpm = `Cannot resolve PNPM_EXEC on PATH: ${selectedPnpm}`;
      else {
        const bin = path.join(reportDir, 'bin'); fs.mkdirSync(bin, { recursive: true });
        const launcher = path.join(bin, 'pnpm');
        const command = /\.cjs$/i.test(target) ? process.execPath : target;
        const prefix = /\.cjs$/i.test(target) ? [target] : [];
        fs.writeFileSync(launcher, `#!${process.execPath}\nconst r=require('node:child_process').spawnSync(${JSON.stringify(command)},[...${JSON.stringify(prefix)},...process.argv.slice(2)],{stdio:'inherit',shell:${process.platform === 'win32' && /\.cmd$/i.test(command)}});if(r.error)console.error(r.error.message);process.exit(r.status===null?1:r.status);\n`, { mode: 0o755 });
        if (process.platform === 'win32') fs.writeFileSync(launcher + '.cmd', `@"${process.execPath}" "${launcher}" %*\r\n`);
        pnpm = process.platform === 'win32' ? launcher + '.cmd' : launcher;
        env.PATH = bin + path.delimiter + (env.PATH || '');
      }
    }
  }
  for (const [key, command, args] of [['bash', 'bash', ['--version']], ['docker', 'docker', ['info']]]) {
    if (!needed.has(key)) continue;
    const result = probe(command, args); if (result.status !== 0) errors[key] = `${key} unavailable${key === 'docker' ? ' or daemon not running' : ''}`;
  }
  if (needed.has('playwright') || needed.has('chromium')) {
    let playwright;
    try {
      const { createRequire } = require('node:module');
      playwright = createRequire(path.join(codeRoot, 'e2e/package.json'))('@playwright/test');
    } catch { errors.playwright = 'Installed Playwright package required; runner never installs dependencies'; }
    if (needed.has('chromium')) {
      try {
        if (!(chromiumAvailable ? chromiumAvailable() : playwright && fs.existsSync(playwright.chromium.executablePath()))) throw new Error('Chromium missing');
      } catch { errors.chromium = 'Installed Chromium required for browser stages; runner never downloads browsers'; }
    }
  }
  return { pnpm, prerequisite: stage => ['node', ...(stage.needs || [])].map(key => errors[key]).filter(Boolean).join('; ') || null };
}

async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) { console.log('Usage: node verify-reliability.cjs [--group static|browser|database|http|all] [--report-dir PATH]\nRequires Node20+, pnpm8, existing dependencies; database/http also Docker, database/static Bash. PNPM_EXEC may override pnpm. No installs or downloads.'); return 0; }
  const reportDir = options.reportDir ? path.resolve(options.reportDir) : fs.mkdtempSync(path.join(os.tmpdir(), 'open-scrm-verification-'));
  fs.mkdirSync(reportDir, { recursive: true });
  if (fs.existsSync(path.join(reportDir, 'manifest.json'))) throw new Error('Report directory already contains manifest.json; choose a fresh directory');
  const env = { ...process.env, TEST_REPORT_DIR: path.join(reportDir, 'workspace-details') };
  const selected = registry('pnpm').filter(stage => options.group === 'all' || stage.group === options.group);
  const needed = new Set(selected.flatMap(stage => stage.needs || []));
  const { pnpm, prerequisite } = preparePrerequisites(reportDir, env, undefined, undefined, needed);
  const stages = registry(pnpm).filter(stage => options.group === 'all' || stage.group === options.group);
  const cancellation = {};
  const interrupt = () => { cancellation.signal = 'SIGINT'; };
  const terminate = () => { cancellation.signal = 'SIGTERM'; };
  process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
  let result;
  try { result = await runStages(stages, { reportDir, env, prerequisite, cancellation }); }
  finally { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate); }
  console.log(JSON.stringify({ reportDir, passed: result.passed.length, failed: result.failed.length, skipped: result.skipped.length, exitCode: result.exitCode }));
  return result.exitCode;
}
module.exports = { parseArgs, registry, runStages, execute, preparePrerequisites };
if (require.main === module) main().then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 2; });
