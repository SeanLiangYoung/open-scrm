# 客户营销授权只读模型与界面刷新

状态：设计/验收准备，尚未修改产品代码、未新增通过声明。主执行者all32回归期间保持生产源码冻结；设计经主执行者审阅并释放后再执行。范围仅现有客户授权证据的查询和展示，不扩展CMP、客户自行授权页面、第三方发送或法律合规承诺。

## 已有事实与缺口

当前ConsentApiController只有grant/revoke写接口。ConsentRecordService在同企业customer行锁内追加证据或撤回全部有效marketing记录；出站闸门只检查是否存在revokedAt空记录。重复grant保留多条证据，因此不能把某一条“最新记录”替代全部有效记录判断。consent_record有id、corp_id、subject_type/subject_id、purpose、policy_version、channel、locale、created_at、revoked_at及现有查询索引，无到期时间、独立操作者、证据URL或法律依据字段。

CustomerMarketingConsent目前有真实登记/撤回操作，但只有本次结果，刷新后不能宣称状态。现有十项Mock与四项真实UI测试明确这一限制。下一切片增加读模型后需同步更新这些预期与事实源，保留原安全编号、空默认证据、失败草稿和写接口边界。

## API与安全契约

增加 `GET /api/v1/messages/consents/customer/:customerId?page=1&pageSize=20`，沿用网关已认证身份和现有consents前缀转发，无需新路由白名单。只查固定subject_type customer和purpose marketing。

身份使用当前授权写控制器的完整可信企业/操作者校验，不调用有默认企业1回退的解析；缺失或非法身份401且不查询。企业/操作者必须可精确表示为正安全整数；头存在时要求整组身份有效，不回退state修补坏头。请求路径customerId须是规范十进制正整数字符串，转换后仍正安全整数；拒绝0、负数、小数、指数、空白、前导零、超安全编号及尾随字符，不用parseInt。

query仅接受page/pageSize，缺省分别1/20；传入时必须是标量规范十进制正整数字符串，page最大100000、pageSize最大100，拒绝空字符串、重复参数数组、数字样式变体和未知字段（尤其corpId/userId/purpose/status）。不隐式把空值当默认。所有输入错误400，在访问仓库前完成。HTTP边界获取原始重复query值，避免框架先取首项掩盖注入。

服务入口也验证corpId、customerId及数值分页（直接调用不接受数字字符串）；offset仅由有界安全整数计算。用同企业customer存在查询决定404；不存在与外企业客户响应完全相同，不先读取外企业授权计数。继承当前写接口的客户存在语义，不本轮擅自增加status过滤（现写入锁未过滤软删状态）。

## 响应与字段白名单

成功响应保持 `{success:true,data:{...}}`。data明确包含：

- customerId：规范十进制字符串；purpose固定marketing。
- observedAt：数据库生成的ISO8601 UTC观测时间，说明为这次读取快照时间，不是持续实时订阅。
- hasActiveMarketingConsent：activeCount大于0；activeCount、revokedCount、total均针对全部该客户marketing证据，与当前页无关，且activeCount+revokedCount=total。
- page、pageSize、list；总量只用同一个total，不另造不同语义的total。
- list每项仅id、purpose、policyVersion、channel、locale、createdAt、revokedAt；id保留规范十进制字符串，时间ISO UTC或null。策略/渠道/locale旧记录nullable时原样null，不能补造默认政策或授权来源。

不要直接序列化完整Entity。无corpId、subjectType/subjectId、内部仓库字段、用户信息或新发明的操作者身份。客户ID由外层承载。现有有效定义仅为revokedAt为空，不能展示“法定有效”“已验证真实同意”“可跨所有渠道营销”等扩大解释。零证据返回三个计数0、hasActive false、list空，不能把请求失败显示成零。

PostgreSQL bigint记录ID保持字符串；COUNT返回值必须转为安全非负整数后才能输出number，越界明确失败不能舍入。输入客户仍有当前写接口正安全整数限制，本轮不拓展大ID写能力。

## 一次请求内的读取一致性

采用TypeORM manager.transaction('REPEATABLE READ', callback)，在事务开始时设置READ ONLY。所有存在校验、统计、分页均用回调manager，禁止混用外部注入repository。首先执行参数化同企业customer存在查询，并在该查询取得数据库statement_timestamp作为observedAt；之后统计和分页共用同一MVCC快照。读取不申请FOR UPDATE，不阻塞现有客户行锁写链；并发grant/revoke可以提交，当前请求仍呈现首次读取时的完整快照。

统计过滤固定corp_id/customer/subject_id/marketing；页查询完全同条件，按created_at DESC,id DESC稳定排序，DB负责bigint比较。分页超出总量返回空list但保留真实全量计数。一个请求里不出现“新计数+旧列表”；observedAt表示读取开始的观测时间，不能许诺它之后的更新已包含。

不同分页请求各有新快照，期间新增证据可能移动offset，本轮不承诺跨多页不变快照或游标导出。UI必须显示每次实际observedAt；写入成功后跳回第一页重读。需要不可变历史导出时另做游标/快照token，不在本切片隐式实现。读取失败不会修改日志、授权、Redis或营销槽位。

## UI行为与竞态

组件初次加载请求第一页，独立显示历史/状态loading、error与带observedAt的“截至该次读取，未撤回证据N条”快照。未加载/失败时不显示“无授权”；刷新失败可保留旧快照，但必须标出加载失败及旧observedAt，不伪装最新。新接口是证据记录查询，仍不能称完整客户同意管理。

列表展示白名单证据字段及撤回时间，旧null显示未记录。保留“本次操作结果”并与读取快照区分。grant/revoke成功先呈现实际操作返回，再重置页1读取；刷新失败不能把已成功写入称为失败、不能抹掉操作结果或草稿，也不能从本次revokedCount自行推算持久状态。操作期间已有按钮防重复提交继续保留。

使用latestRead代际保护成功、失败、loading及快照时间；客户切换/组件卸载后的响应不可写入新客户状态。开始写入时使旧读请求失效，写成功后再读；避免一个写前在途读取在写后结果区域覆盖状态。失败写不清草稿；读刷新不触碰表单输入。unsafe customerId不读不写，显示明确编号限制。分页仅controlled page/pageSize，不发送自填企业或目的。

## 后端量化验收：至少18类

1. 完整网关身份调用成功，返回稳定白名单和分页参数。
2. 缺企业/缺操作者/损坏身份401，服务零调用；state有效身份兼容。
3. 非法路径矩阵（0/负/小数/指数/空白/前导零/超安全/尾随字符）400无数据库操作。
4. 默认1/20，以及合法受控分页；page/pageSize边界。
5. 空query、重复数组、非法格式、未知身份/目的字段400无查询。
6. 服务直接调用的非法身份/客户/分页被拒绝，offset不溢出。
7. 客户不存在404；外企客户同404，外企授权内容与数量不读取不返回。
8. 零证据返回空页、三个0、hasActive false。
9. 两条有效加一条撤回：active2/revoked1/total3，hasActive true。
10. 仅撤回证据：active0且hasActive false，不能依赖最新一行判断。
11. 全页/尾页/超出页数，total与计数均不受页大小影响。
12. 相同created_at按bigint id降序稳定，返回精确大ID字符串。
13. 其他subject_type/subject_id/purpose/corp的种子均排除。
14. 历史nullable字段保持null，未知额外实体字段不外泄。
15. observedAt来自同事务DB时间，ISO UTC可解析；计数安全转换无舍入。
16. 事务隔离明确REPEATABLE READ/READ ONLY，存在/统计/分页全部回调manager，异常传播且无写入。
17. 双连接真实PG在首次customer快照建立后并发grant提交，当前统计/列表仍旧一致，下一请求读到新值。
18. 同样并发revoke，当前响应旧快照一致、下一请求全量撤回；参数化查询且没有写锁/Redis调用。

单元测试覆盖输入/契约/manager所有权；17/18必须真实PG证明MVCC可观察结果，不能用固定mock声称隔离成立。先红再绿，重复已有grant/revoke/营销保护回归。

## UI量化验收：至少12类

1. 初次请求严格路径/页参数，无企业、目的查询或全局用户接口。
2. 读到active2/revoked1/total3显示统计及真实observedAt，列表只显示真实字段。
3. 零证据与加载/错误明确区分，无伪默认无授权。
4. 翻页保持计数全量、请求受控，nullable证据显示未记录。
5. grant成功保留操作结果并请求第一页；结果以刷新API为准。
6. revoke后按实际返回计数提示并刷新，重复撤回0同样刷新。
7. 写成功但读失败：保留操作成功与草稿，显示读取失败/旧时间，不能误报写失败。
8. 初次加载失败/重试恢复，不造历史或状态。
9. 旧读取延迟至新读取之后返回，新快照/计数/错误/loading均不被覆盖。
10. 写前读延迟至grant/revoke之后，不能覆盖写后快照。
11. 客户切换/卸载与超安全ID不读写新旧错误客户。
12. API400/404错误保留输入，刷新后不缓存猜测状态。

保留原10项证据登记测试。原“没有GET状态/历史”用例应更新为“只展示真实读取快照”，不删除安全ID/无默认同意等保护。

## 实际双企业验收：至少5个串行场景

1. A真实登录，客户无证据读零；通过UI登记两条不同政策，实际GET active2/total2、精确分页和observedAt；SQL核对2行且无消息。
2. A界面撤回实际2条，读active0/revoked2，重复撤回0后统计不变；Mock5营销403，无额外消息。
3. B真实登录拥有自己的有效证据，GET自身可读；B伪造A企业头GET A客户404，A/BSQL均原样且不回传A证据。
4. 同企业分页含历史撤回/nullable证据，大ID记录精确显示；查询未知字段/非法ID400、匿名401，SQL没有新增或变化。
5. 独立两PG连接按显式屏障控制grant/revoke与快照读取，断言同请求统计/列表一致、下次刷新可见新提交；不是仅等待固定延时。

全部新PG16/Redis、实际gateway/auth/message/customer/Vite，四服务clean构建严格串行领取窗口；不外呼、不写用户DB。新harness先create登记后start，启动失败故障自检、进程/容器清理为最终passed前提。至少4实际场景为最低门槛，此处第5项专门证明读一致性，不用单元替代。精确执行数、SQL行数、截图和清理证据在执行后报告，当前均为计划。

## 执行切分与明确未做

后端角色独占Consent控制器/服务及新读DTO、单元与PG一致性验证；前端角色独占既有独立授权组件与新读模型浏览器测试；主执行者统一路由/runner/CI/事实源、串行构建与独立复验。先审定本契约再分配，当前不创建新测试注册或修改既有通过证据。

不新增表/迁移，不回填历史证据，不新增用户管理/客户自动授权，不提供审计导出、撤回单条接口、第三方CMP或真实渠道送达证明。现有grant/revoke和营销闸门行为保持。

实施记录：all32通过后根已批准并执行。consent任务拥有后端/PG/nativeHTTP，根拥有独立组件/CustomerDetail/新UI测试。39新单元、PG6组、原生HTTP14组通过；根12初始红测转绿并扩展17项，原10保留并更新真实GET夹具后通过。组件移到详情全宽容纳证据分页，失败不造零/旧时间保留/写前读失效/跨客户隔离已验证。独立真实UI5通过，根40阶段当前复验中；旧“尚未实施”是设计时状态，不冒充最终证明。
