# 客户创建输入与标签原子性独立HTTP验证

2026-10-26。仅新增独立harness及清理自检，不修改Customer生产源码/根测试。Node20.20.0，新PG16/Redis、实际auth/customer/gateway。首次11组全部通过、exit0。

## 已执行场景

两个企业真实登录。A合法数字但不存在、外企或有效/外企混合tagIds创建返回400；B伪造A头使用A标签也400，四次均无新客户。标签JSON格式错误（字符串、0、超int4、嵌套数组）按当前严格DTO返回422，未改错误契约或写记录；不把“引用不存在400”和“字段格式422”混淆。

A带有效员工9106与重复自有标签8101创建成功，SQL立即确认仅一个新客户和一条标签关系。随后在专用customer_tag_relation挂BEFORE INSERT触发器：只有在同事务内已能读到external_userid=input-trigger-fail的新customer时才RAISE EXCEPTION。实际创建请求500/codeP0001；最终SQL客户不存在、关系仍仅前一个有效关系，证明customer插入后join失败仍整体回滚。触发器随后移除，只存在于一次性数据库。

十三类非规范followUserId对create/update共26请求全部422，未把'1e0'/'0x1'/空白/前导零/布尔/数组/非正/小数/unsafe误赋员工1；原id100在此阶段仍员工9106、原名不变。显式null更新200并合法清空owner。其后快照原3条fixture行，GET/PUT/DELETE各八类畸形路径共24请求400，快照逐字相同，id100没有被截断路径误改或软删。实际MAX_SAFE客户行9007199254740991详情200、精确字符串ID，未错误缩成int4。B带伪造A头仍读取自己id200。

## SQL与执行证据

最终专用customer恰4条：原100/200/MAX_SAFE三条加新id9 input-valid-a一条；owner9106只在新客户，原100经显式null合法清空。customer_tag_relation恰一条(customer9,tag8101)，foreign标签8102原样，message_log0行。没有调用任何消息提供方。

证据 `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-customer-input-http-iNYZiw/result.json`，checkCount11、expectedDedicatedCustomers4、expectedCreatedCustomers1、expectedRelations1、expectedMessageRows0，testsPassed/cleanup.passed/passed true，exit0。PG63434、Redis63441、auth63454、customer63455、gateway63456；自有服务进程和两个容器确认清理。

`check-customer-input-cleanup.cjs`另实际注入docker start非法参数，业务harness exit1、0子服务、唯一已create容器bcbba3d167e6309b88f449c82bee417f84b90d20a67d9de0e8636a75f3ee88a2确认不存在、cleanup true；无专用profile直接服务启动guardexit1。证据`.../open-scrm-customer-input-http-PeLDiy`。create后立即登记再start，不存在start失败漏登记窗口。

这份证据只证明此次客户输入/标签事务/路径边界。原客户服务单元由作者/主执行者验证，本报告不重复计算；未审计所有客户CRUD并发及历史数据修复。API11组不等同11个独立产品功能。
