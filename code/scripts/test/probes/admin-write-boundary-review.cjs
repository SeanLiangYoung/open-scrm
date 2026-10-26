'use strict';
// Actual current controller/service/schema methods; inert repository/JWT adapters. No HTTP/DB/build.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');const{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../../..'),authRequire=createRequire(path.join(root,'services/auth-service/package.json'));
const ts=authRequire('typescript');const noop=()=>()=>{};
const core={...authRequire('@midwayjs/core'),Provide:()=>target=>target,Middleware:()=>target=>target,Controller:()=>target=>target,Inject:noop,Config:noop,Get:noop,Post:noop,Put:noop,Del:noop,Body:noop,Param:noop,Query:noop};
function load(relative,append=''){const file=path.join(root,relative),module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:false}}).outputText+append,{module,exports:module.exports,console,require:id=>{
 if(id==='@midwayjs/core')return core;if(id==='@midwayjs/typeorm')return{InjectEntityModel:noop};
 if(id==='@midwayjs/validate')return authRequire(id);if(id==='bcrypt')return authRequire(id);
 if(id==='./password-strength.util')return load('services/auth-service/src/util/password-strength.util.ts');
 return new Proxy({},{get:()=>class FixtureType{}});
}},{filename:file});return module.exports;}
(async()=>{
 const{UserController,ProbeCreateUserDto,ProbeUpdateUserDto}=load('services/auth-service/src/controller/user.controller.ts','\nexports.ProbeCreateUserDto=CreateUserDto;exports.ProbeUpdateUserDto=UpdateUserDto;');
 const{getSchema}=authRequire('@midwayjs/validate');const evidence=[];
 for(const forbidden of [{id:99},{corpId:99},{isAdmin:1},{password:'forged'},{roles:[1]}])assert(getSchema(ProbeUpdateUserDto).validate({realName:'valid',...forbidden}).error);
 assert(getSchema(ProbeCreateUserDto).validate({username:'user',password:'12345678',corpId:1,id:99}).error);
 evidence.push({case:'actual DTO rejects immutable/admin/password/roles update fields and forged create id',outcome:'rejected before normal service boundary'});
 const{UserService}=load('services/auth-service/src/service/user.service.ts');const{PasswordUtil}=load('services/auth-service/src/util/password.util.ts');const util=new PasswordUtil();util.saltRounds=4;
 const rows=new Map([[2,{id:2,corpId:2,username:'fixture',isAdmin:0,password:'previous',roles:[{id:1,roleCode:'old'}]}]]),writes=[];const userService=new UserService();Object.assign(userService,{passwordUtil:util,userRepo:{findOne:async({where})=>rows.get(where.id),update:async(id,data)=>{writes.push({id,fields:Object.keys(data)});Object.assign(rows.get(id),data);},delete:async id=>{rows.delete(id);},save:async user=>{rows.set(user.id,user);return user;}},roleRepo:{findByIds:async ids=>ids.filter(id=>id===3).map(id=>({id,roleCode:'role3'}))}});
 const controller=new UserController();controller.userService=userService;
 await controller.updateUser('2e0',{realName:'invalid path selected user2'});assert.equal(rows.get(2).realName,'invalid path selected user2');
 evidence.push({case:'scientific path2e0 reaches and mutates user2',writes:[...writes]});
 await controller.resetPassword(2,'');assert(await util.verifyPassword('',rows.get(2).password));
 const{AuthService}=load('services/auth-service/src/service/auth.service.ts');const authService=new AuthService();await assert.rejects(()=>authService.login('fixture',''),e=>e.status===400);
 evidence.push({case:'reset accepts/hashes empty password yet login rejects empty password',resetPersisted:true,loginStatus:400});
 await controller.resetPassword(2,'x');assert(await util.verifyPassword('x',rows.get(2).password));evidence.push({case:'reset accepts one-character password despite create min8',persisted:true});
 await controller.assignRoles(2,[3,999]);assert.deepEqual(rows.get(2).roles.map(r=>r.id),[3]);evidence.push({case:'unknown requested role999 silently dropped while replacing old roles',requested:[3,999],persistedRoleIds:rows.get(2).roles.map(r=>r.id)});
 const{AuthMiddleware}=load('services/gateway-service/src/middleware/auth.middleware.ts');
 for(const route of ['/api/v1/users/','/api/v1/users/2','/api/v1/users/2/reset-password','/api/v1/users/2/roles'])for(const admin of [false,'1',1,true]){const mid=new AuthMiddleware();mid.jwtService={verify:async()=>({userId:7,corpId:2,isAdmin:admin,type:'access'})};const ctx={path:route,get:header=>header==='authorization'?'Bearer fixture':header==='x-is-admin'?'1':'',state:{}};let called=0;await mid.resolve()(ctx,async()=>{called++;});assert.equal(called,admin===1||admin===true?1:0);if(!called)assert.equal(ctx.status,403);}
 evidence.push({case:'gateway admin guard examined on all global-user write subpaths',ordinaryAndString1:403,numeric1AndTrue:'authorized',globalScope:'not treated as tenant bypass'});
 console.log(JSON.stringify({scope:'current source methods and actual DTO schema; memory adapters; real bcrypt round4',externalHttpOrDatabase:false,evidence},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
