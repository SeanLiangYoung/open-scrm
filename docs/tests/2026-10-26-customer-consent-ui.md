# 客户详情营销授权证据登记

状态：仅准备测试，业务实现待当前主回归释放。未声明新增功能通过。

设计依据[next business slices第3项](../plans/2026-10-26-next-business-slices.md)：客户详情独立授权证据组件，客户编号由详情传入、严格正安全整数转换；policyVersion/channel/locale默认全部空，由运营人员登记已有授权事实。请求只有既有API白名单字段，不发送企业与操作者。授权与撤回成功仅显示本次接口返回，不缓存授权状态，不伪造历史；失败保留证据草稿及上次操作结果。撤回显示准确revokedCount，包含0。

新增独立Mock配置customer-consent.config.ts使用3114严格端口，新spec10例覆盖：grant严格体、revoke严格体和正数、空政策、缺证据字段、无效locale、超安全ID、失败保留、零撤回、刷新无伪状态、撤回失败保留。本轮首先运行当前无授权区块的界面，预期观察缺入口失败后才实现。

另准备独立真实UI脚本overnight-customer-consent-ui.cjs和runtime配置/spec4例：A界面登记→实际Mock5营销可通行；A界面撤回→后续403；重复界面撤回0；B界面登记自己客户证据，伪造A头对A客户授权/撤回均404。只用新PG16/Redis、真实auth/customer/message/gateway和实际Vite。test-e2e-policy现有测试RegionPack关闭静默且限额3，稳定控制一次Mock发送；不修改时钟或伪造授权通过。最终SQL预期专用客户恰2条授权证据：A已撤回、B仍有效；消息表恰1条A类型5成功。清理检查包含进程退出和容器不存在，失败不得写通过。

脚本目前只完成语法检查，真实运行需要主执行者串行排期。Mock浏览器不代表真实授权或营销合规，真实Mock消息不代表外部平台送达。

## 界面实现与Mock验证

源码释放后新增CustomerMarketingConsent.vue，CustomerDetail只增加导入及按客户ID隔离的组件插入，既有标签/跟进逻辑不变。证据字段全为空默认，渠道限定现有五值；编号提交前严格校验十进制正安全整数，locale用Intl校验。忙时阻止重复操作；响应只展示本次返回，失败保留草稿及上次结果，刷新无本地授权状态缓存。

实际红绿：原页面10例全部因缺入口失败；实现后先发现Element Select的placeholder测试选择器不命中，改成实际表单项内的选择器，最终10例全部通过（11.1秒，0跳过）。operation-platform全vue-tsc --noEmit exit0；新组件与CustomerDetail两文件eslint exit0。未启动前端dist构建，真实UI四例仍等待串行窗口。

## 真实界面验收完成

实际Node20.20.0运行脚本：新PG16/Redis、auth/customer/message/gateway构建启动及Vite代理，真实Chromium四场景全部通过（8.9秒，0跳过），exit0。A登记ui-consent-a后显式Mock5营销通过，撤回显示1且后续营销403，刷新后没有伪持久状态并重复撤回显示0；B界面登记自己客户后携真实B令牌和伪造A身份头，对A客户grant与revoke均404。

SQL最终专用客户恰2条证据，A9001企业1/web/zh-CN已撤回，B9002企业2/web/zh-CN仍有效；不存在foreign-forbidden证据。消息表恰1条企业1、客户9001、类型5、状态1记录。测试只证明模拟发送闸门，不代表真实外部送达或法律合规。

证据目录：`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-customer-consent-ui-DjiECM`，playwright-output.txt记录4 passed；result.json记录browserCases4、testsPassed/cleanup.passed/passed均true。PG61234、Redis61264、auth61291、customer61292、message61293、gateway61294、Vite61295。自有进程5937/5953/6005/6033/6035/6037全部退出，两个自有容器确认移除，未使用现有用户数据库。

直接子服务启动缺少专用disposable配置时，预启动guard实际exit1拒绝，Bootstrap未执行。正向截图请求到达时本次环境已清理，未为截图重复运行；已在runtime首例末尾加入animations disabled截图，供下一次独立复验保存在该次playwright产物目录，当前截图增强尚未单独执行。

## 容器启动失败的清理自检

根执行者审查指出原docker run成功返回之后才登记容器，Docker已创建但启动失败时可能漏清理。脚本已改为docker create返回ID→立即登记ownedContainers→docker start，端口映射在启动后读取。子服务disposable profile guard保持。

新增 `code/scripts/test/check-customer-consent-cleanup.cjs`，实际设置故障开关令docker start携带非法参数并返回非零；本次harness整体exit1，testsPassed/passed false，cleanup.passed true、errors空、childPids空，唯一已创建容器93a7bc0ef312a2815782a245e0a32e386a5acd4b3730965a1dcb3cff25ff9fa4经第二次docker查询确认不存在。证据目录 `.../open-scrm-customer-consent-ui-8xHr8J`。直接--service无disposable标记仍在Bootstrap前exit1拒绝。自检脚本整体exit0表示成功观察到预期失败与清理，不把业务harness故障称为功能通过。没有正常构建、没有真实HTTP或用户数据库操作。
