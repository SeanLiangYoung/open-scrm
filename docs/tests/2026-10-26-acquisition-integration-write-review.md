# 获客 / 集成写入边界独立审查（2026-10-26）

本次为生产源码冻结期间的只读审查。依据 [仓库索引](../README.md)、[获客事实](../services/acquisition-service/README.md)、[集成事实](../services/integration-service/README.md) 与当前工作树核对；未修改生产源码、注册测试或统一验证清单，未构建、启动服务、连接数据库、Redis 或外部平台。

## 已确认的重要问题

### P2：扫码去重先提交，数据库失败后的合法重试被吞掉

位置：[ChannelCodeService 第72行](../../code/services/acquisition-service/src/service/channel-code.service.ts#L72) 至第82行。`recordScanEvent` 先以24小时 TTL 写 Redis，再保存 `scanCount`。首次保存失败时没有撤销/恢复机制。相同事件再次请求命中键，返回成功且 `replayed=true`，尽管该事件从未成功计数。

实际控制器与实际服务探针使用 corp2、user7、活码1：第一次保存注入一次数据库异常；第二次同 `externalEventId=event-A` 返回 `{success:true,data:{scanCount:0,replayed:true}}`，持久状态仍0，Redis键仍在。这违反接口“相同事件仅生效一次”的可靠重试语义，不能通过再重试恢复。当前鉴权用户可通过网关 `POST /api/v1/acquisition/channel-codes/1/ingest-scan` 触发；不需要伪造企业身份。建议后续将事件去重与计数成功放进可靠提交协议；仅把 Redis 改成 NX 并不能修复先占位后失败吞事件。

### P2：并发不同扫码事件成功响应但少计数

位置：[ChannelCodeService 第68行](../../code/services/acquisition-service/src/service/channel-code.service.ts#L68)、第81–82行。服务读取实体、在进程内加1、再全实体 save，没有原子 increment 或行锁。两个不同事件都读取旧值0，各保存1；两个请求均返回成功，最终仅1。

探针以两个独立 `findOne` 实体快照模拟真实 repository 的对象隔离，使用 `Promise.all` 同时调用实际控制器，事件分别为 event-A/event-B。观察到2次 save、2个去重键，最终 `scanCount=1`。该复现说明源码允许此交错；未宣称已执行 PostgreSQL 并发实验。修复后应补真实数据库并发检查，并保留企业条件。

### P2：畸形扫码路径被截断后写入另一规范编号

位置：[AcquisitionApiController 第78行](../../code/services/acquisition-service/src/controller/acquisition-api.controller.ts#L78)。`parseInt(id,10)` 接受 `1junk`，实际服务收到1并更新活码1。请求的路径不是合法编号却执行写入而不是400；同类 `1.5` 也会被截断。控制器第48、67行读路径同样使用 parseInt。

探针实际调用 `ingestScan('1junk', {})`，服务的企业条件仍为2，最终 corp2 活码1计数由0变1。这是错误目标写入/输入边界问题，**没有跨企业读写证据**。建议路径先做规范正十进制、安全整数与实际数据库列范围校验，非法输入在调用 service 前400。

## 实际检查的入口与排除理由

- `PlatformAccountController` 创建、列表、OAuth写入：创建绑定具体 `CreatePlatformAccountDto`，OAuth绑定具体 `ConnectPlatformAccountDto`；未发现 Partial 泛型擦除。创建服务 `{corpId,...dto}` 虽有 spread，但真实 DTO schema 拒绝 `id/corpId` 未知字段，探针已验证拒绝，不能把直接调用 service 的任意对象当成已鉴权 HTTP 注入。OAuth先以 `{corpId,id}` 取实体，随后仅赋 token、刷新 token、过期时间、状态。
- `ContentController` 创建、列表、详情、发布、批量发布、发布状态：创建显式列白名单；批量 DTO 是实际类，元素是正整数，逐项执行并逐项返回失败，不存在承诺全事务却部分成功的证据。发布取内容及账号均带 corpId，且校验平台匹配。创建草稿本身未检查 accountId 归属，可保存悬空/外企引用，但实际发布器前会拒绝该账号；探针验证0次内容写入、0次 publish。未将该不完整草稿认定为本次重要跨企业漏洞。未验证实际平台发布行为。
- `ChannelCodeController` 与 `AcquisitionApiController` 创建：具体 DTO、服务逐列赋值，无法注入主键/corpId；`staffIds/autoTagIds` 当前为配置数据，未发现此服务据此操作共享 user/customer_tag 表的路径，未仅凭缺少 lookup 推定跨企业数据写入。扫码写入的3个确认问题见上。
- `WeworkController` 配置创建/更新/同步/联系方式入口：更新有真正 `UpdateWeworkConfigDto`，服务显式允许 corpSecret、agentId、callbackToken、encodingAesKey、status，不复制任意请求字段；创建同样白名单。旧控制器路径为 `/api/wework`，当前网关只代理 `/api/v1/integration/*`，没有旧路径代理/改写，不能称为当前已鉴权网关可利用的配置覆盖。未调用直接服务端口、同步或提供商 API。
- `IntegrationApiController` 网关入口：检查 health、签名回调 GET/POST、测试扫码转发。回调不直接接受实体更新对象，验证签名/解密后应答，当前没有业务事件写入；测试转发绑定 `AcquisitionChannelScanTestDto`，转发原 Bearer，受测试路由开关控制。未发现新的主键/corp原样覆盖。health 的探测键不是业务企业记录。
- 集成配置“最新启用项 + 部署提供 SCRM 企业映射”是 [既有交付边界](../services/integration-service/README.md#回调协议兼容与交付边界2026-10-25)，并非本次新增漏洞。旧直接内部端口的访问控制不在“当前网关已鉴权路径”证明范围内。

## 可复现证据与限制

执行：`node /tmp/acquisition-integration-write-review.cjs`，退出0；5组 characterization 断言成立（3组确认缺陷、2组防误报）。输出保存在 `/tmp/acquisition-integration-write-review-results.jsonl`。此退出0表示成功重现当前缺陷，不表示功能通过修复验收。真实源码由 TypeScript 内存转译加载；真实 Midway decorator/DTO schema 保留；repo、Redis 为独立内存 stub，HTTP post 设置为立即抛错以禁止网络。没有测试业务 DB 或外部环境。

下列脚本为本次证据的完整副本，可保存至临时目录执行。未注册为测试，也未修改服务依赖。

```js
const fs=require('node:fs'),{createRequire}=require('node:module');
const root='/Users/seanliang/projects/open-scrm/code/services/acquisition-service',req=createRequire(root+'/package.json'),ts=req('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>{if(!f.startsWith(root+'/src/'))throw Error('Unexpected TS');m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText,f)};
const {ChannelCodeService}=require(root+'/src/service/channel-code.service.ts'),{AcquisitionApiController}=require(root+'/src/controller/acquisition-api.controller.ts');
function fixture(){const row={id:1,corpId:2,scanCount:0},keys=new Map(),calls=[];let fail=false;const svc=Object.assign(new ChannelCodeService(),{codeRepository:{findOne:async({where})=>where.id===1&&where.corpId===2?{...row}:null,save:async x=>{calls.push(['save',x.id]);if(fail){fail=false;throw Error('simulated DB failure')}Object.assign(row,x);return x}},redisService:{get:async k=>keys.get(k),set:async(k,v)=>keys.set(k,v)},httpService:{post:()=>{throw Error('NETWORK FORBIDDEN')}}});const ctrl=Object.assign(new AcquisitionApiController(),{channelCodeService:svc,ctx:{get:k=>({'x-corp-id':'2','x-user-id':'7'})[k]||'',state:{}}});return{svc,ctrl,row,keys,calls,failNext:()=>fail=true}}
(async()=>{let t=fixture();await t.ctrl.ingestScan('1junk',{});assert.equal(t.row.scanCount,1);console.log(JSON.stringify({case:'malformed authenticated write aliases ID1',path:'1junk',row:t.row}));
t=fixture();t.failNext();await assert.rejects(t.ctrl.ingestScan('1',{externalEventId:'event-A'}));const retry=await t.ctrl.ingestScan('1',{externalEventId:'event-A'});assert.equal(retry.data.replayed,true);assert.equal(t.row.scanCount,0);console.log(JSON.stringify({case:'failed first save permanently dedupes valid retry for24h',retry,row:t.row,keys:[...t.keys.keys()]}));
t=fixture();await Promise.all([t.ctrl.ingestScan('1',{externalEventId:'event-A'}),t.ctrl.ingestScan('1',{externalEventId:'event-B'})]);assert.equal(t.calls.length,2);assert.equal(t.row.scanCount,1);console.log(JSON.stringify({case:'two distinct concurrent successful events lose one increment',saveCalls:t.calls.length,row:t.row,dedupeKeys:t.keys.size}));
const {getSchema}=req('@midwayjs/validate'),{CreatePlatformAccountDto}=require(root+'/src/dto/platform-account.dto.ts');assert.ok(getSchema(CreatePlatformAccountDto).validate({platform:'wechat',corpId:1,id:99}).error);console.log(JSON.stringify({case:'platform account injection rejected by concrete DTO schema',passed:true}));
const {ContentPublishService}=require(root+'/src/service/content-publish.service.ts');let writes=0,publishes=0;const publisher=Object.assign(new ContentPublishService(),{contentRepository:{findOne:async({where})=>where.corpId===2?{id:9,corpId:2,accountId:11,platform:'wechat',status:0}:null,save:async()=>{writes++}},platformAccountRepository:{findOne:async({where})=>where.corpId===1?{id:11,corpId:1,platform:'wechat'}:null},publisherRegistry:new Map([['wechat',{publish:async()=>{publishes++;throw Error('NETWORK FORBIDDEN')}}]])});await assert.rejects(publisher.publishContent(2,9),/Platform account not found/);assert.equal(writes,0);assert.equal(publishes,0);console.log(JSON.stringify({case:'foreign account draft cannot reach publishing or mutate account',writes,publishes}));
})().catch(e=>{console.error(e);process.exitCode=1});
```


## 后续修复状态

以上为修复前只读审查的历史证据，嵌入探针保留原样，不能再作为当前服务的通过脚本。后续M25已修复这三项获客问题，实际单元红绿与PG并发/故障验收另见[扫码可靠性验收](2026-10-26-channel-scan-reliability.md)。集成部署边界仍按原排除理由，不在该修复范围。
