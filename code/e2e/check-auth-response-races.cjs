#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
function setup(app) {
  const root=path.resolve(__dirname,'../apps',`${app}-platform`),req=createRequire(path.join(root,'package.json')),ts=req('typescript'),pinia=req('pinia');
  const storage=new Map([['token','old-A'],['user',JSON.stringify({id:'1',corpId:'1'})]]);
  const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
  const window={location:{href:'/customers'}};
  function load(file,api) {
    const module={exports:{}};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{module,exports:module.exports,localStorage,window,require:n=>n==='@/utils/api'?api:req(n)});
    return module.exports;
  }
  const api=load('src/utils/api.ts').default,requests=[];
  api.defaults.adapter=config=>new Promise((resolve,reject)=>requests.push({config,resolve,reject}));
  pinia.setActivePinia(pinia.createPinia());
  return {api,store:load('src/stores/auth.ts',api).useAuthStore(),storage,window,requests};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function reject401(request) {request.reject({config:request.config,response:{status:401}});}
async function login(t,token='new-B') {
  const pending=t.store.login('same','pw',2);await tick();const request=t.requests.at(-1);
  request.resolve({status:200,statusText:'OK',headers:{},config:request.config,data:{success:true,data:{accessToken:token,refreshToken:'refresh-B',user:{id:'2',corpId:'2'}}}});await pending;
}
async function main(){let passed=0,failed=0;for(const app of ['admin','operation']){
 const check=async(name,run)=>{try{await run();passed++;console.log(`PASS ${app}: ${name}`);}catch(error){failed++;console.error(`FAIL ${app}: ${name}: ${error.message}`);}};
 await check('old tenant protected401 cannot clear a later successful login',async()=>{
  const t=setup(app),old=t.api.get('/api/v1/customers').catch(()=>{});await tick();assert.equal(t.requests[0].config.headers.Authorization,'Bearer old-A');await login(t);reject401(t.requests[0]);await old;assert.equal(t.storage.get('token'),'new-B');assert.equal(t.window.location.href,'/customers');
 });
 await check('logout/relogin with identical access token still ignores previous-session401',async()=>{
  const t=setup(app),old=t.api.get('/api/v1/customers').catch(()=>{});await tick();t.store.logout();await login(t,'old-A');reject401(t.requests[0]);await old;assert.equal(t.storage.get('token'),'old-A');assert.equal(t.window.location.href,'/customers');
 });
 await check('stale successful login response does not invalidate requests from the winning session',async()=>{
  const t=setup(app),older=t.store.login('same','old',1);await tick();await login(t);
  const current=t.api.get('/api/v1/customers').catch(()=>{});await tick();
  const request=t.requests[0];request.resolve({status:200,statusText:'OK',headers:{},config:request.config,data:{success:true,data:{accessToken:'stale-A',refreshToken:'refresh-A',user:{id:'1',corpId:'1'}}}});
  assert.equal(await older,false);reject401(t.requests[2]);await current;
  assert.equal(t.storage.has('token'),false);assert.equal(t.window.location.href,'/login');
 });
 await check('current-session protected401 still clears token and redirects',async()=>{
  const t=setup(app),pending=t.api.get('/api/v1/customers').catch(()=>{});await tick();reject401(t.requests[0]);await pending;assert.equal(t.storage.has('token'),false);assert.equal(t.window.location.href,'/login');
 });
 await check('anonymous401 still redirects when current session remains anonymous',async()=>{
  const t=setup(app);t.store.logout();const pending=t.api.get('/api/v1/customers').catch(()=>{});await tick();reject401(t.requests[0]);await pending;assert.equal(t.window.location.href,'/login');assert.equal(t.storage.has('token'),false);
 });
 await check('anonymous old401 cannot clear a later login',async()=>{
  const t=setup(app);t.store.logout();const pending=t.api.get('/api/v1/customers').catch(()=>{});await tick();await login(t);reject401(t.requests[0]);await pending;assert.equal(t.storage.get('token'),'new-B');assert.equal(t.window.location.href,'/customers');
 });
 await check('login401 is surfaced without redirect or deleting current token',async()=>{
  const t=setup(app);const pending=t.store.login('same','bad',2).catch(error=>error);await tick();reject401(t.requests[0]);await pending;assert.equal(t.storage.get('token'),'old-A');assert.equal(t.window.location.href,'/customers');
 });
 await check('failed login does not suppress current-session protected401',async()=>{
  const t=setup(app),old=t.api.get('/api/v1/customers').catch(()=>{});await tick();const attempt=t.store.login('same','bad',2).catch(()=>{});await tick();reject401(t.requests[1]);await attempt;reject401(t.requests[0]);await old;assert.equal(t.storage.has('token'),false);assert.equal(t.window.location.href,'/login');
 });
 }console.log(JSON.stringify({scope:'current TS + real Axios/Pinia/Vue; controlled adapters, no network',passed,failed}));if(failed)process.exitCode=1;}
main().catch(error=>{console.error(error);process.exitCode=1;});
