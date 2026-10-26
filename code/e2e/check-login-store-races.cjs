#!/usr/bin/env node
'use strict';
// Executable behavioral checks: current TS source + real Pinia/Vue, mock API only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
function loadStore(app) {
  const root = path.resolve(__dirname, '../apps', `${app}-platform`);
  const appRequire = createRequire(path.join(root, 'package.json'));
  const ts = appRequire('typescript');
  const pinia = appRequire('pinia');
  // The actual store imports the same real Vue used by its Pinia dependency.
  const storage = new Map();
  const localStorage = { getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  const requests = [];
  const api = { post: (url, body) => new Promise((resolve, reject) => requests.push({ url, body, resolve, reject })) };
  const module = { exports: {} };
  const filename = path.join(root, 'src/stores/auth.ts');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, localStorage,
    require: name => name === '@/utils/api' ? api : appRequire(name) }, { filename });
  pinia.setActivePinia(pinia.createPinia());
  return { store: module.exports.useAuthStore(), storage, requests };
}
const payload = (corpId, suffix) => ({ data: { accessToken: `access-${suffix}`, refreshToken: `refresh-${suffix}`,
  user: { id: '7', corpId: String(corpId), username: 'same', isAdmin: 0 } } });
async function main() {
  const checks = [];
  for (const app of ['admin', 'operation']) {
    const check = async (name, run) => {
      try { await run(); checks.push({ app, name, passed: true }); }
      catch (error) { checks.push({ app, name, passed: false, error: error.message }); }
    };
    await check('newest successful login wins against an older delayed success', async () => {
      const t = loadStore(app);
      const older = t.store.login('same', 'one', 1).catch(error => error);
      const newer = t.store.login('same', 'two', 2);
      t.requests[1].resolve(payload(2, 'new'));
      assert.equal(await newer, undefined, 'latest success retains Promise<void> contract');
      t.requests[0].resolve(payload(1, 'old'));
      assert.equal(await older, false);
      assert.equal(t.store.token, 'access-new');
      assert.equal(t.store.user.corpId, '2');
      assert.equal(t.storage.get('token'), 'access-new');
      if (app === 'admin') assert.equal(t.storage.get('refreshToken'), 'refresh-new');
    });
    await check('logout invalidates an in-flight login and cannot be undone by late success', async () => {
      const t = loadStore(app);
      const pending = t.store.login('same', 'good', 1).catch(error => error);
      t.store.logout();
      t.requests[0].resolve(payload(1, 'late'));
      assert.equal(await pending, false);
      assert.equal(t.store.token, '');
      assert.equal(t.store.user, null);
      assert.equal(t.store.isAuthenticated, false);
      assert.equal(t.storage.get('token'), undefined);
      assert.equal(t.storage.get('user'), undefined);
      assert.equal(t.storage.get('refreshToken'), undefined);
    });
    await check('a newer failed attempt prevents an older response from restoring another enterprise', async () => {
      const t = loadStore(app);
      const older = t.store.login('same', 'one', 1).catch(error => error);
      const newer = t.store.login('same', 'bad', 2);
      t.requests[1].reject(new Error('newest credentials rejected'));
      await assert.rejects(newer, /newest credentials rejected/);
      t.requests[0].resolve(payload(1, 'old'));
      assert.equal(await older, false);
      assert.equal(t.store.token, '');
      assert.equal(t.storage.get('token'), undefined);
    });
    await check('stale failures are marked ignored after a newer successful login', async () => {
      const t = loadStore(app);
      const older = t.store.login('same', 'bad', 1).catch(error => error);
      const newer = t.store.login('same', 'good', 2);
      t.requests[1].resolve(payload(2, 'new'));
      await newer;
      t.requests[0].reject(new Error('old credentials rejected'));
      const ignored = await older;
      assert.equal(ignored, false);
      assert.equal(t.store.token, 'access-new');
      assert.equal(t.store.user.corpId, '2');
    });
    await check('legacy two-argument latest login persists a normal success and returns void', async () => {
      const t = loadStore(app);
      const pending = t.store.login('unique', 'good');
      assert.deepEqual(JSON.parse(JSON.stringify(t.requests[0].body)), { username: 'unique', password: 'good' });
      t.requests[0].resolve(payload(2, 'unique'));
      assert.equal(await pending, undefined);
      assert.equal(t.store.token, 'access-unique');
    });
  }
  const failed = checks.filter(check => !check.passed);
  console.log(JSON.stringify({ scope: 'real Pinia/Vue and current in-memory TS stores; no browser introspection or network', passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));
  if (failed.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
