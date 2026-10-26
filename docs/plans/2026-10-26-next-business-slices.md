# 下一阶段运营业务小闭环待选清单

状态：**02:12主执行者已选择三项并行准备测试，业务实现等待当前26阶段回归释放源码后开始；尚无新增通过声明**。依据当前工作树、[开发计划](../开发计划.md)、[迭代/E2E事实](../../code/docs/迭代计划-E2E.md)、[消息服务当前契约](../services/message-service/README.md)。旧计划里“消息中心完成”指已有模板/通知页面，不等于消息日志、重试或营销同意已经有运营UI；旧迭代正文仍有历史渠道2 Mock描述，实施时以当前明确Mock5的发送契约为准。

以下按价值、范围和当晚独立验收成本排序。本轮推进全部三项，不新增第三方提供方或生产部署。

## 执行分工与门禁

customer任务独占NotificationCenter及新增notification-staff独立测试/config(3112)和真实UI脚本；SOP任务独占新MessageLogs页面、运营router/MainLayout及独立message-logs测试/config(3113)和真实UI脚本；consent任务独占CustomerDetail的授权区块或独立组件、customer-consent测试/config(3114)和真实UI脚本。每项先运行失败界面测试，再实现，分别至少8/10/9项界面场景和3/4/4项真实链路场景。真实脚本使用独立资源并核验SQL、清理，不得写当前运行用户数据库。

主执行者维护计划、统一runner、CI、总证据与独立复验。当前26阶段全组回归期间只准备新测试/独立脚本，不改业务源码或共享配置；根明确释放后开始实现。真实服务clean构建和HTTP由根串行排期，不并发覆盖dist。每项完成后交叉审查，新增未验证脚本不直接注册CI。08:00停止扩展并交付。

## 1. 通知中心选择真实本企业员工，发送后由接收方读到并标记已读

**证据与价值。** [NotificationCenter.vue](../../code/apps/operation-platform/src/views/message/NotificationCenter.vue) 第80行只有“管理员(ID:1)”选项，第105/177行把接收人初始化为1。普通企业员工无法选择实际同事；企业内无启用员工1时，当前后端会正确拒绝。这是现有通知产品入口的实际阻塞，并非缺少发送后端。[NotificationService.createNotification](../../code/services/message-service/src/service/notification.service.ts) 已在事务中验证全部接收人同企业且启用并加共享锁，批量写入；列表、未读数、单条/全部已读已经按当前用户+企业过滤。[staff目录](../../code/services/auth-service/src/controller/staff.controller.ts) 与 [TenantStaffSelect](../../code/apps/operation-platform/src/components/TenantStaffSelect.vue) 可直接复用，无需访问全局用户管理。

**范围。** 通知发送表单替换硬编码接收人为既有员工多选器，默认不选择假员工；可提供显式“我自己”选项并去重。提交严格安全数值数组，空选择和空白标题阻止请求，失败保留草稿。保持现有通知列表、未读数与已读操作；本轮不扩展邮件/企微通知、全局通知广播、调度或用户管理。分页是现有列表独立缺口，不与本小闭环强绑。

**量化验收目标（待执行）。** 至少8个浏览器契约场景：正确员工请求、空接收人无写、超安全ID无写、多人去重、搜索失败保留、后端停用拒绝保留草稿、发送成功清理草稿、已读后刷新未读数。独立真实链路至少3个场景：企业A用户发给A同事→同事登录可见并读；企业B不可读取/修改A通知；启用目录结果在提交前停用则整批无新增。实际SQL核对预期接收人数与通知行数，而非仅toast。

**风险/优先级。** 优先级1，风险低：后端和选择器已具备，主要是表单契约与独立两个账号的验收。已有通知删除路径parseInt不是本项新增能力，不把它混入发送闭环或默认为安全通过；验收以发送/读取/已读为主。

## 2. 消息日志列表与明确Mock5失败重试结果可见

**证据与价值。** 当前[运营路由](../../code/apps/operation-platform/src/router/index.ts) 和 [侧栏](../../code/apps/operation-platform/src/layout/MainLayout.vue) 有消息模板、通知，没有消息日志页；全src检索没有 `/api/message/logs` 或 `/api/message/retry` 的页面调用。[MessageController](../../code/services/message-service/src/controller/message.controller.ts) 已提供GET `/api/message/logs`、POST `/api/message/retry`；[查询/重试DTO](../../code/services/message-service/src/dto/message-log.dto.ts) 和 [日志服务](../../code/services/message-service/src/service/message-log.service.ts) 已支持筛选与分页，重试的租户与安全编号已有独立真实验证。运营人员当前只能从接口或数据库追踪失败，不能从页面区分失败、处理中、Mock成功。

**范围。** 新增运营日志列表及入口，展示类型、接收目标、内容、状态、失败原因、重试次数和时间；支持状态/渠道筛选与分页。只对失败且messageType5的行提供重试按钮，单条提交 `logIds:[安全数值]`；其他渠道展示尚未接通而不提供真实发送承诺。重试后按实际 `success/failed/details` 结果提示并刷新，不能仅因HTTP200显示全成功。详情用列表已有字段的行展开，避免为此新增接口或依赖尚未严格校验的详情路径。不得提供任意原始目标发送器、自动重试循环或真实渠道联调。

**量化验收目标（待执行）。** 至少10个浏览器契约场景：读取、空态、分页、状态筛选、查询失败、失败Mock允许重试、处理中/成功不可重试、未接通渠道不可重试、超安全编号不写、HTTP200失败详情不误报成功。独立真实链路至少4个场景：本企业失败Mock重试成功；跨企业ID不可变；成功日志重复重试不再发送；未接通渠道保持失败且无新增成功日志。SQL明确核对重试次数、状态及无额外日志行。新页面不能使用全局用户接口。

**风险/优先级。** 优先级2，风险中：现有接口是组合结果，必须区分HTTP成功与业务结果；页面不可把Mock成功描述为第三方送达。查询DTO分页上限当前不等同严格目录分页，UI固定受控pageSize，未评估接口全量输入安全前不声称已全面加固。渠道能力矩阵若已由另一任务更新，应读取现有契约，不再另造一份枚举事实源。

## 3. 客户详情记录营销授权证据与撤回操作

**证据与价值。** [CustomerDetail.vue](../../code/apps/operation-platform/src/views/customer/CustomerDetail.vue) 当前已有标签及跟进闭环，但无consent相关组件或请求；运营页面全src也没有consents调用。[ConsentApiController](../../code/services/message-service/src/controller/consent-api.controller.ts) 已实现POST `/api/v1/messages/consents/grant` 和 `/revoke`，严格body白名单及安全customerId；[ConsentRecordService](../../code/services/message-service/src/service/consent-record.service.ts) 在本企业客户行锁内授予或撤回全部有效营销授权。授权前后出站闸门已有真实HTTP证据，缺少的是运营录入与撤回入口。

**范围。** 客户详情新增“记录营销授权”和“撤回营销授权”操作面板。授予表单明确填写policyVersion、证据渠道（web/line_oa/whatsapp/email/other）与locale，purpose固定marketing、客户ID来自当前详情；不发送企业/操作者字段。撤回只发customerId+purpose，显示后端返回revokedCount；授予成功显示本次返回记录，失败保留输入。页面描述为已有授权证据的登记，不用一个默认勾选框捏造客户同意。

**关键边界。** 当前只有写API，**没有营销授权状态/历史查询API**。因此这个最小版本只显示“本次操作结果”，刷新后不能凭本地缓存或客户标签宣称“当前已同意/已撤回”，也不能展示伪造完整历史。若产品要求持久状态和历史，应另开一个明确的读接口切片；本待选项不暗示后端已经具备该接口。群发营销模式或完整CMP落地页不属于范围。

**量化验收目标（待执行）。** 至少9个浏览器契约场景：严格grant体、严格revoke体、空policyVersion无写、无效locale失败保留、超安全customerId无写、接口失败保留草稿、撤回计数0与正数正确提示、刷新不伪造授权状态、无全局/自填企业请求。独立真实链路至少4个场景：企业A客户授予→Mock5营销可通行；撤回→后续营销403；重复撤回计数0；企业B对A客户授予/撤回404且原记录不变。策略时间/频控使用隔离夹具稳定控制，避免把额度拒绝误当同意结果。

**风险/优先级。** 优先级3，风险中：虽写API已就绪，缺少读模型限制了完整产品观感；操作措辞和证据字段需严格对应实际含义，不能将内部登记当客户自动授权，也不能将Mock验证当真实营销送达。可在当晚完成动作闭环，完整授权管理不应靠增加虚假状态赶进度。

## 共同行为与验收纪律

三项都沿用当前网关身份、精确字符串ID与提交前安全整数转换、错误反馈保留输入，以及已验证的真实Axios会话401处理。模拟浏览器只证明界面契约；真实闭环须使用新独立PG16/Redis和实际登录，明确SQL结果并确认清理。服务clean构建和真实HTTP必须由主任务协调串行。只读梳理没有执行上述目标中的任何新增测试，既有计划中S7/S8的历史最小切片与远程CI待验证状态不因本清单改变。

Ruling（02:17）：直接调用未接通渠道的失败重试时，既有契约会更新失败原因和retryCount；本切片验收要求无新增成功、状态仍失败、归属与内容保持，而非整行逐字段不变。UI仍不给未接通渠道重试按钮，不调整后端已有失败记录语义。
