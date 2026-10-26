# 已观测日趋势最小切片（2026-10-26，只读调查与待授权设计）

状态：**仅调查与设计，未实现，未运行新增测试/服务/构建**。当前根任务 all32 回归期间源代码冻结。本计划不授权自动开始 analytics 或 Dashboard 实现，也不占用另行规划的营销授权读模型任务。

## 当前事实与缺口

核对[运营Dashboard](../../code/apps/operation-platform/src/views/Dashboard.vue)、[AnalyticsController](../../code/services/analytics-service/src/controller/analytics.controller.ts)、[DailyStatService](../../code/services/analytics-service/src/service/daily-stat.service.ts)、[聚合SQL](../../code/services/analytics-service/src/service/daily-aggregation.service.ts)、[服务事实](../services/analytics-service/README.md)和[既有实际HTTP11项](../tests/2026-10-26-analytics-http.md)。既有11项是历史执行证据，本轮没有重跑。

运营看板当前**没有硬编码示例数值趋势图**：两张饼图来自 GET customers?pageSize=100，已经标明最近最多100位客户样本；它们不是全企业分布，也不是每日趋势。四张顶栏卡来自实际客户/SOP/标签API；SOP概览表实际读取模板，名字“执行概览”比真实内容宽。日表区是当日单个overview，明确正常状态库存与采集时间；没有历史折线。管理端Dashboard也没有示例趋势图，但“正常运行”是静态标签、“活跃客户”仍沿用当前状态值，不能当健康探针或行为活跃指标。本切片仅运营端，不顺手改管理端。

服务README中的2025响应数字是**说明示例**，不能搬到页面当实际序列；文档中的旧lost/active字段必须按前置口径解释。新计划无需“替换已经存在的假折线”，而是新增有证据边界的每日序列。

已有API足够读到日行：GET /daily?startDate&endDate 返回已有日表行、准确别名与updateTime；/trend?days 返回稀疏平行数组，MM-DD缺年份、未补缺日、days无严格验证，库存legacy别名易误用；/summary只能汇总，空段的兼容0不能证明逐日观测。**不缺数据库日表读取能力，缺严格有界、完整日历、缺口语义一致的读模型及UI。** 可以用 /daily + 前端补日实现，但会把校验/缺口语义分散在客户端；推荐新增独立只读投影，不更改旧接口响应以避免兼容回归。

当前Dashboard加载会先POST aggregate-daily再GET overview，这不是只读看板：登录访问会写当日日表。新趋势不能循环聚合历史日期以填空，不应借读取制造“已观测历史”；建议同一切片移除Dashboard隐式POST，聚合仍由已有计划任务/明确运维动作负责。若需保留用户手动刷新，只GET，不隐式补采样。

## 先定义指标，避免错误解释

- 新增客户：create_time落在statDate的当前客户记录数量；可跨不同日相加，但不是广告净增、首次购买或独立事件流水（物理删除/导入/回填可改变结果）。
- 消息日志创建数：message_log.create_time落日的行数，包含待处理/失败/Mock，**不是实际发送尝试次数**。成功/失败是聚合时该批日志的当前状态，成功不是第三方送达，重试不创建新行时不增加创建数。首版名称采用“消息日志创建数”，不画“真实送达率”。
- SOP创建数：sop_execution.create_time落日的执行记录数量；当前成功SQL按该批记录complete_time非空，不能叫“当日完成数”。首版可只展示创建数，不增加成功率避免扩大解释。
- 客户总数/正常状态/已删除库存与启用员工是**聚合时库存**。同一日表的statDate是统计标签，snapshotObservedAt才是采集时间；补聚合历史日期会读取今天库存，绝不是过去收盘状态。库存不跨日求和、不差分推断新增/流失、不前向填充，不与事件轴混成一条。
- 日表存在但updateTime为空仍是存在的旧行；无时间标记“采集时间未记录”，不能反转成没有行。日表无行表示未观测，所有指标null；存在行的数字0为观测零。
- 日表没有可信采集来源/完整性字段，无法区分SQL种子、导入和自然聚合；接口只承诺“已存日表行”，不能保证生产自然采样。若要求来源证明，需要独立schema/采集审计切片，本轮不做。

聚合目前按数据库create_time::date，dayjs默认服务本地日；历史HTTP夹具显式UTC，不能据此宣布全部部署UTC。新投影只读取date标签，不再分桶原事件；返回dateBasis='stored_daily_stat_date'及eventDayTimezone=null（未知），页面提示“按既存统计日，事件边界时区未记录”。不得猜一个UTC/Asia/Shanghai字段冒充已知。默认近7日由明确完整日期请求给出；不改变部署时区或旧聚合SQL。

## 推荐最小只读协议（待授权）

新增 GET `/api/v1/analytics/observed-daily?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`，单独DTO，不触碰旧trend/daily响应。两端日期必填、严格实际日历日、闭区间、start<=end、最多31天、禁止未知query（corpId/status等）；非法400。公司身份只取JWT经网关上下文，不信客户端身份头/query。匿名401；普通本企业员工可读，保持既有analytics权限范围。

仅一次本企业参数化日表查询，无INSERT/UPDATE、无aggregate调用、无外部服务。返回success:true/data下包括startDate/endDate/dateBasis/eventDayTimezone及points完整日历数组，按YYYY-MM-DD升序，每日一个对象：

```json
{
  "date": "2026-10-20",
  "observed": false,
  "snapshotObservedAt": null,
  "events": {"newCustomerRecords": null, "messageLogRecords": null, "sopExecutionRecords": null},
  "inventory": {"totalCustomers": null, "normalCustomers": null, "deletedCustomers": null}
}
```

有行时observed=true、所有上述值按列返回数字（包括0），snapshotObservedAt为实际updateTime或null。旧行无时间仍observed=true。仅返回白名单数值与时间，不传corpId、内部ID、原始customer/message内容；不加入收入、用户隐私字段或未采集指标。缺日不合成数据库行。不返回summary“区间总计”以免缺口时误称全量。

事件累计只是所选日期行的横向展示，首版不额外显示“区间共计”；库存另图并提示实际采集时刻。若实现者选择复用/daily而非新增协议，仍须满足相同完整日历/null/严格窗口/只读验收，并先与根任务确认兼容方案，不能静默改旧trend语义。

## 最小运营界面

新增“日表记录趋势”区，近7/14/30日受控选择；事件图显示新增客户记录、消息日志创建、SOP执行创建，库存另图显示总数/正常/已删除采集快照。缺测用null断线，connectNulls=false；真实0落在零轴。提示缺失天数，全部缺测显示“所选区间无已存日表”，错误显示读取失败，不能伪空态。每点tooltip完整日期、是否存在行、实际采集时间和口径；库存明确不是历史收盘快照。数值列表可访问且作为浏览器断言来源，避免只凭canvas截图证明精确数据。

保持现有客户样本饼图及实时卡独立，不把100位样本描述全量。读取失败保留最后成功数据但明确过期/失败；选择日期乱序响应不能覆盖新窗口。现有overview改为纯读后，无行按snapshotAvailable=false提示，兼容零不展示成实测零。继续明确日志状态含Mock/历史占位，不代表第三方送达。

## 量化验收（均待执行）

1. 后端至少12项红→绿：日历补齐/升序跨月年、缺测null、实测全0、旧行空时间仍observed、两个库存不累加、严格日期/不存在日期/倒序/超31日/未知query、两企业隔离。具体case数可拆更多但不可省类。
2. Mock浏览器至少8项：缺日断线与可读表null、实测0、全缺、读取失败、采集时间标签、两种指标口径、快速换窗乱序、加载时不发aggregate或其他写请求。保留既有Dashboard断言，不把新假响应当服务证据。
3. 独立真实PG16+auth/gateway/analytics至少6项：双企业读隔离（含伪造头）、跨年3日一缺一零一非零、旧行无时间、非法窗口、匿名401、SQL读前后daily_stat与源OLTP行数/关键值完全一致。真实浏览器至少2项：实际登录显示缺测/零/采集说明、切换范围无POST写；所有fixture为合成日表，明确不代表自然历史。截图animations disabled并保留数据文本附件。
4. 相关unit/type/lint/build通过；真实服务构建与PG窗口由根任务串行安排，专用profile/先create登记容器/cleanup失败非零沿用已修harness要求。不得触碰现有用户DB。
5. 文档同步Dashboard/analytics事实与最终证据；本计划中的验收数是目标，不能加入已通过统计。

## 不做与实施边界

不做收入/成交归因、渠道ROI、第三方送达/阅读、客户状态事件回建、行为活跃、历史库存复原、自动回填、cron改造、数据迁移、财务写入或外部账号。不给授权读模型新增字段或抢改其组件。实施分成analytics独立只读投影、Dashboard消费与Mock、隔离真实验收三个所有权明确的任务；当前仅交调查设计，等待用户/根任务下一明确授权再动源码。
