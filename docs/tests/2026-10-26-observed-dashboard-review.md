# Observed Daily接口与仪表盘独立复核

只读复核当前controller/service/util及Dashboard趋势区块，对照[观测趋势计划](../plans/2026-10-26-observed-dashboard-trends.md)。没有修改业务源码、现有spec或通知文件，没有构建、真实HTTP/数据库调用。

## Important：新控制器的内部身份边界仍回退默认企业

定位：[observed-daily.controller.ts第14行](../../code/services/analytics-service/src/controller/observed-daily.controller.ts)调用通用getTenantContext；该[共享helper](../../code/packages/server-common/src/util/tenant-context.ts)第19行parseInt，第39行无身份时返回企业1/用户1。新端点因此不具备staff/consent/SOP新入口已有的完整、规范、安全身份失败关闭行为。

使用**实际控制器、实际当前util及当前构建的真实共享helper**内存执行，仅注入service记录调用（无DB）：

- 无x-corp-id/x-user-id，也无ctx.state.user：read仍调用service.read(1,query)。
- x-corp-id=25junk，x-user-id=7：read调用service.read(25,query)。
- x-corp-id=9007199254740993，x-user-id=7：read调用service.read(9007199254740992,query)，发生舍入。

上述是实际入口调用行为，不是只对parseInt做语言演示。最初期望非法身份401的探针真实失败；随后保留实际三个dispatch输出以避免将失败包装为通过。对应service会把该企业值绑定到SQL的$1，因此缺失身份没有在新controller阻断。

**边界说明：** 正常gateway验证JWT并重建可信头，匿名在gateway被拒绝，危险JWT编号也在gateway被拒绝。本轮没有证明通过正常网关跨企业访问，也没有运行直接HTTP读取数据。问题是新服务入口在缺少/损坏可信身份时回退或截断，与计划的匿名401/明确企业身份及近期新入口失败关闭标准不一致；内部端口仍须受网关隔离。修复应限于这个新controller的完整规范正安全整数身份解析，不建议借本次修改共享helper并影响所有旧服务契约。

## 其他范围未确认重要缺陷

- util严格真实YYYY-MM-DD日期、闭区间1–31日，拒绝不存在日、倒序、32日、数组与未知query（含corpId）。UTC仅用于日历标签算术，返回明确stored_daily_stat_date及未知eventDayTimezone=null，不冒充历史事件桶时区。
- service只执行一次参数化SELECT，corp_id=$1且日期上下界绑定，未导入或调用聚合服务。Dashboard只读GET，overview现有路径也只读日表，没有访问页面隐式aggregate写入。
- 投影有行保留0，无行各项null；旧行采集时间null仍observed=true。库存逐行返回，没有求和/前值填补；每日日期补齐独立于数据库新增行。
- Dashboard趋势文案明确库存是采集快照而非历史日末，消息日志含Mock/历史结果并非第三方送达；图线connectNulls=false，表格null显示未观测，0显示0。读取失败保留旧数据并明确提示可能过期。
- trendRead同时保护成功、错误、finally。旧7日响应或旧错误不能覆盖后发14/30日结果；最新失败保留上次数据并展示错误。没有在缺失点补零或沿用库存。

## 本轮执行证据

1. analytics-service运行 `vitest run src/util/observed-daily.util.spec.ts src/service/observed-daily.service.spec.ts`，**17通过**（util15/service2）。JWT、真实SQL执行与真实HTTP不在这17项范围。
2. `node /tmp/observed-dashboard-review-probe.cjs`，当前Dashboard趋势代码内存转译、真实Vue响应式、可控GET Promise，**4组通过**：旧成功、旧错误、当前失败保留、图表0/null及库存不延续。没有DOM、ECharts实际绘制或服务网络调用。
3. `node /tmp/observed-controller-review-probe.cjs`，**2组日期/企业传参检查通过**；另记录上述3个错误身份实际dispatch。31日合法传企业25；32日、不存在日、注入corpId均400且不调用service。错误身份不算安全检查通过。

临时探针没有加入CI，也未重跑作者浏览器/实际UI套件。既有作者证据与本轮只读探针应分开；修复身份后仍需相应严格controller回归和实际网关验证，不能用现有17项util/service通过替代入口身份验证。

## 身份修复后独立复核

主任务已将新controller改为局部严格requestCorpId，不再调用开发回退helper。重新内存执行当前实际controller：缺失身份、25junk、超安全编号、缺user头均401且不调用service；完整state身份可读取其企业3；显式空header不能借用有效state。这些错误身份先前真实dispatch企业1/25/舍入值的缺口已消除。

复验 `node /tmp/observed-controller-fixed-review-probe.cjs`，共5组通过（原日期合法/非法2组，错误身份阻断1组，state允许1组，显式空头禁止fallback1组）。没有修改业务源码或运行HTTP；原Finding保留为修复前历史证据，不再标为当前未解决问题。
