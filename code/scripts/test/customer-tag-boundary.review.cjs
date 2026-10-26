'use strict';
// Independent boundary review checks; started RED, not registered by this task.
// Current controller/service + real Midway validation; repositories are in memory.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../services/customer-service');
const req = createRequire(path.join(root, 'package.json'));
const ts = req('typescript');
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(path.join(root,'src') + path.sep)) throw new Error('Unexpected TypeScript module');
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true
  } }).outputText, filename);
};
const { TagService } = require(path.join(root,'src/service/tag.service.ts'));
const { TagController } = require(path.join(root,'src/controller/tag.controller.ts'));
const { ValidationPipe, ValidateService, getSchema } = req('@midwayjs/validate');
function fixture(headers = { 'x-corp-id':'2', 'x-user-id':'7' }) {
  const rows = [{ id:21, corpId:2, tagName:'owned-tag', parentId:0 }, { id:11, corpId:1, tagName:'foreign-protected', parentId:0 }];
  const saves = [], reads = []; let nextId = 100;
  const repo = {
    findOne: async ({where}) => { reads.push(where); const row = rows.find(row => Object.entries(where).every(([key,value]) => String(row[key]) === String(value))); return row ? {...row} : null; },
    create: input => ({...input}),
    save: async input => {
      const save = row => { const value = {...row, id:row.id ?? nextId++}; saves.push(value); const index = rows.findIndex(row=>row.id===value.id); if(index<0) rows.push(value); else rows[index]=value; return value; };
      return Array.isArray(input) ? input.map(save) : save(input);
    },
    find: async ({where}) => rows.filter(row=>row.corpId===where.corpId).map(row=>({...row}))
  };
  repo.manager = { transaction: async work => work({ getRepository: () => repo, query: async () => [] }) };
  const service = Object.assign(new TagService(), { tagRepository:repo, ctx:{get:name=>headers[name]||'',headers} });
  return { rows, saves, reads, service, controller:Object.assign(new TagController(),{tagService:service}) };
}
function actualUpdateBody(controller, body) {
  const design = Reflect.getMetadata('design:paramtypes', TagController.prototype,'update')[1];
  const pipe = new ValidationPipe();
  const validation = new ValidateService();
  validation.validateConfig = { errorStatus: 400, validationOptions: {} };
  validation.i18nConfig = { defaultLocale: 'en_US' };
  validation.i18nService = { getAvailableLocale: value => value };
  pipe.validateService = validation;
  return pipe.transform(body,{metaType:{isBaseType:design===Object,originDesign:design},target:controller,methodName:'update'});
}
async function allowReject(action) { try { await action(); } catch(error) { assert([400,404].includes(error.status),error.message); } }
test('update cannot change own lookup into a foreign primary key save', async()=>{
  const t=fixture();
  await allowReject(()=>t.controller.update(21,actualUpdateBody(t.controller,{id:11,corpId:1,tagName:'foreign overwrite'})));
  assert.deepEqual(t.rows.find(row=>row.id===11),{id:11,corpId:1,tagName:'foreign-protected',parentId:0});
  assert(t.saves.every(row=>row.id===21&&row.corpId===2));
});
test('batch body cannot upsert a foreign primary key without any own-tag lookup',async()=>{
  const t=fixture();await allowReject(()=>t.controller.batchCreate([{id:11,tagName:'batch foreign overwrite',parentId:0}]));
  assert.deepEqual(t.rows.find(row=>row.id===11),{id:11,corpId:1,tagName:'foreign-protected',parentId:0});
});
test('frontend legacy corpId1 body must not move a corp2 tag to corp1',async()=>{
  const t=fixture();await allowReject(()=>t.controller.update(21,actualUpdateBody(t.controller,{tagName:'ordinary UI edit',corpId:1})));
  assert.equal(t.rows.find(row=>row.id===21).corpId,2);
});
for(const operation of ['create','update','batchCreate']) {
  test(`${operation} rejects foreign parent before any write`,async()=>{
    const t=fixture(), dto={tagName:'foreign-parent-child',parentId:11};
    const action=operation==='create'?()=>t.service.create(dto):operation==='update'?()=>t.service.update(21,dto):()=>t.service.batchCreate([dto]);
    await assert.rejects(action,error=>[400,404].includes(error.status));assert.equal(t.saves.length,0);
  });
}
test('same-enterprise parent control remains usable and appears in tree',async()=>{
  const t=fixture();const child=await t.service.create({tagName:'valid-child',parentId:21});
  const tree=await t.service.getTagTree();assert.equal(tree[0].children[0].id,child.id);assert.equal(child.corpId,2);
});
// Printing metadata makes the validation bypass evidence inspectable without HTTP.
const bodyType = Reflect.getMetadata('design:paramtypes',TagController.prototype,'update')[1];
console.log(JSON.stringify({updateBodyType:bodyType.name,hasSchema:!!getSchema(bodyType),scope:'no HTTP, database or provider calls'}));

for (const method of ['getById','update','delete']) {
  for (const raw of ['21junk','21.5','9007199254740993','01']) {
    test(method+' rejects raw path '+raw+' with400 before repository reads',async()=>{
      const t=fixture();const type=Reflect.getMetadata('design:paramtypes',TagController.prototype,method)[0];
      const id=req('@midwayjs/core').transformRequestObjectByType(raw,type);
      await assert.rejects(()=>t.controller[method](id,{tagName:'name'}),e=>e.status===400);assert.equal(t.reads.length,0);
    });
  }
}
for (const headers of [{},{'x-corp-id':'2'},{'x-user-id':'7'},{'x-corp-id':'2junk','x-user-id':'7'},{'x-corp-id':'9007199254740993','x-user-id':'7'},{'x-corp-id':'0','x-user-id':'7'}]) {
  test('create rejects incomplete or malformed identity '+JSON.stringify(headers),async()=>{
    const t=fixture(headers);await assert.rejects(()=>t.service.create({tagName:'identity-probe',parentId:0}),e=>e.status===401);assert.equal(t.saves.length,0);
  });
}
test('direct create cannot upsert immutable foreign primary key',async()=>{
  const t=fixture();await allowReject(()=>t.service.create({id:11,corpId:1,tagName:'create foreign overwrite',parentId:0}));
  assert.deepEqual(t.rows.find(row=>row.id===11),{id:11,corpId:1,tagName:'foreign-protected',parentId:0});
});
test('self-parent rejects without mutation',async()=>{const t=fixture();await assert.rejects(()=>t.service.update(21,{parentId:21}),e=>[400,404].includes(e.status));assert.equal(t.saves.length,0);});
test('descendant parent cycle rejects without mutation',async()=>{const t=fixture();t.rows.push({id:22,corpId:2,tagName:'child',parentId:21});await assert.rejects(()=>t.service.update(21,{parentId:22}),e=>[400,404].includes(e.status));assert.equal(t.saves.length,0);});
for (const dtos of [[],Array.from({length:101},(_,i)=>({tagName:'batch-'+i,parentId:0}))]) {
  test('batch size '+dtos.length+' rejects with400 without writes',async()=>{const t=fixture();await assert.rejects(()=>t.service.batchCreate(dtos),e=>e.status===400);assert.equal(t.saves.length,0);});
}
