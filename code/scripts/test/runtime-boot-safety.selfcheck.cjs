'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { assertSafeBuildDirectory } = require('./runtime-boot-safety.cjs');
function command(executable, args, options={}) {
  const result=spawnSync(executable,args,{encoding:'utf8',...options});
  if(result.status!==0)throw new Error(`${executable} ${args.join(' ')} failed: ${result.stderr||result.error||result.status}`);
  return result.stdout.trim();
}
function fixture(ignore,run) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'scrm-build-safety-'));
  try {command('git',['init','--quiet',root]);fs.writeFileSync(path.join(root,'.gitignore'),ignore);run(root,path.join(root,'dist'));}
  finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('fresh checkout permits an ignored dist directory before it exists',()=>fixture('dist/\n',(root,dist)=>{
  assert.equal(fs.existsSync(dist),false);assert.doesNotThrow(()=>assertSafeBuildDirectory(root,dist,command));assert.equal(fs.existsSync(dist),false);
}));
test('existing ignored dist remains permitted',()=>fixture('dist/\n',(root,dist)=>{
  fs.mkdirSync(dist);fs.writeFileSync(path.join(dist,'generated.js'),'generated');assert.doesNotThrow(()=>assertSafeBuildDirectory(root,dist,command));
}));
test('unignored directory remains rejected',()=>fixture('',(root,dist)=>{
  assert.throws(()=>assertSafeBuildDirectory(root,dist,command),/check-ignore/);
}));
test('tracked files remain protected even inside ignored dist',()=>fixture('dist/\n',(root,dist)=>{
  fs.mkdirSync(dist);fs.writeFileSync(path.join(dist,'keep.txt'),'user work');command('git',['add','--force','--','dist/keep.txt'],{cwd:root});
  assert.throws(()=>assertSafeBuildDirectory(root,dist,command),/cannot delete tracked files/);assert.equal(fs.readFileSync(path.join(dist,'keep.txt'),'utf8'),'user work');
}));
