# 标签不可变字段、企业与父级关系完整性

依据[标签完整性计划](../plans/2026-10-26-tag-integrity.md)。本报告分开记录修复前真实PG因果、修复后单元/Mock、独立PG及实际网关页面证据，不修改ALL40历史结果。

## 修复前实际数据库因果

ALL40源码冻结期间新增独立 `overnight-tag-integrity-postgres.cjs`，当前TS内存编译并实际加载Tag controller/service、CustomerService和TypeORM，使用新建PG16.13；不Bootstrap、不构建、不连接已有用户库。7项保护检查得到 **6失败、1正常控制通过**，退出1，清理通过。

保留原始工件 `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-tag-integrity-pg-O55NqX/result.json`，每项都有SQL before/after：

- 企业2更新自己标签100021，注入id100011/corp1后，外企标签100011名称实际变成integrity-attacker-update，原自有标签21仍在。
- 正常旧UI的corpId1使100021从企业2实际迁到企业1。
- batch注入100011使该外企原行变成企业2、名称integrity-attacker-batch。
- 外企父标签100011被写进企业2新子标签；混合有效/外企父级batch两项实际都写入。
- 客户100201加[本企100021,外企100011]没有整批拒绝，实际留下本企标签的部分关系。
- 有效同企标签重复添加保持1条关系，正常控制通过。

这是实际PG保存结果，不再只是早期内存仓库推断。此前[只读审查](2026-10-26-customer-tag-boundary-review.md)的“尚未PG验证”是该阶段历史限制，此处提供后续独立证据，不回写原快照。

## 当前修复契约

create/update/batch均用真实运行时schema及服务字段白名单，仅tagName/tagType/tagColor/parentId/sort/isAuto可编辑，id/corpId/实体内部字段拒绝。UpdateTagDto为独立class，无Create默认值，省略字段保留已有元数据；nullable tagColor可显式null清空，TagEntity类型与既有nullable列一致。企业/操作者必须为完整规范正安全整数身份，不再开发默认1回退。

标签ID与parentId对应PostgreSQL INTEGER，支持ID1–2147483647，parentId0表示根；不能仅以JS MAX_SAFE_INTEGER放行数据库int4越界。路径参数保持字符串直到严格解析，避免Midway Number转换先丢掉前导零等原始形式。客户路径与企业/操作者采用正安全整数上限9007199254740991；不声称支持全部PostgreSQL bigint数域。

父级必须存在且同企业，遍历父链拒绝自指/循环并持有事务共享锁；更新实际节点加写锁，父节点删除有子节点时拒绝。batch1–100项，先验证所有条目、父级和名称，再在一事务中save；失败不部分保存。更新省略parent也验证当前父链，不将旧异常引用继续当作有效新写入。

CustomerService.addTags验证全体数值标签ID、客户归属及全部标签同企业，持有客户写锁/标签共享锁，事务合并去重；缺失/外企混合拒绝而非部分成功。相应客户加标签body和添加/删除关系路径严格校验。此修复限于关联入口，不把其他旧客户CRUD或既有内部信任部署边界描述为全面加固。

TagManage不发送id/corpId或硬编码tagType，编辑只提交实际修改的姓名/颜色，保留type/parent/sort/isAuto；不再显示不能保存的groupName输入，真实父级只读显示。空白名称、不安全int4编号阻止写入；失败保留草稿，pending锁住关闭/重开，旧列表响应不覆盖新刷新。

## 当前自动验证

- 独立实际TS/Midway转换Node审查从30项29失败/1通过变为 **30通过**。真实Update元数据现在为UpdateTagDto且有schema；真实路径转换还捕获并修正两个read/delete入口遗留Number metadata的前导零漏洞，不能只用直接方法字符串调用掩盖。
- 新增服务/controller/DTO Vitest66项（标签51、客户关系15），完整customer服务 **147通过**，tsc --noEmit通过。Vitest/esbuild不生成完整design:paramtypes，参数元数据在上述真实TypeScript/Node与实际HTTP层单独核对，不给Vitest伪造metadata来让测试通过。
- 标签界面8项先 **7失败、1通过**，实现后 **8通过，9.3秒**；企业2严格body、元数据省略、真实父级、失败草稿、不安全ID、空白、pending锁及旧列表保护均覆盖。页面/spec ESLint和运营vue-tsc --noEmit通过；前端dist由主任务统一构建。
- 同一实际PG7项先全部转绿，工件5n429e；随后新增数据库CHECK触发实际save失败，验证整个batch回滚，最新 **8/8通过**，工件 `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-tag-integrity-pg-EEcPfv`。外企行始终原值，原客户关系正常幂等，临时容器清理通过。

## 实际网关与页面验收

独立 `overnight-tag-integrity-http.cjs` 使用实际auth/customer/gateway、Vite和Chromium，预建双企业用户/标签/客户，只操作该新PG16/Redis。专用profile+完整DB身份+拥有loopback端口在Bootstrap前校验；新profile自检8项通过，create→记录拥有ID→start，进程/容器清理错误必须传播失败。没有第三方调用或真实消息发送。

5场景为实际企业2页面创建/修改；immutable create/update/batch及伪造身份头；外企/缺失/自指/循环父级及混合批量；严格int4与客户路径；客户标签全批拒绝、重复幂等、移除/重添。实际运行结果在脚本结束和SQL/清理确认后追加，不把准备或PG方法调用当作已完成HTTP。

## 实际5场景最终结果

首次运行 `node code/scripts/test/overnight-tag-integrity-http.cjs` 退出0，**5通过、0跳过，7.3秒**。该次实际创建/更新DTO、batch原始数组、网关身份覆盖、int4及客户路径边界均经过真实HTTP，不以直接调用方法替代。

PG16.13最终SQL：外企100011仍corp1、tag-http-foreign-protected；本企100021仍corp2，名称tag-http-ui-edited，tagType3、parent100022、sort8、isAuto1均保留；真实UI新标签ID9属于corp2，type1/parent0/sort0/isAuto0。企业2标签总数恰好3，拒绝的批量/父级写入没有残留；有效临时子标签删除后不计入。客户100201只存在tag100021的一条关系，重复添加未重复，外企客户100101关系数0；message_log=0。

工件：`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-tag-integrity-http-3Dlh4z`。result.json的testsPassed、cleanup.passed、passed均true，errors为空；5个拥有的子进程及2个拥有容器均确认退出/消失，出站拒绝日志为空。数据库与Playwright输出保留；共享构建/HTTP窗口已明确释放。

正向截图已人工查看，fullPage且animations disabled：`playwright/tag-integrity-http-actual--db320-identity-or-metadata-resets/real-company2-tag-metadata.png`。展示企业2真实账号、创建/改名后的标签、兴趣类型与自动标记保留。没有为截图单独再运行。

额外既有Mock回归：operation-contracts及editor-boundaries **25通过**、customer-form **4通过**、staff-selection **13通过**；原跟进54项已包含customer全量147中。上述均与实际5场景分开统计，不相加宣称全为真实业务API。

## 保留边界

本轮不迁移用户现有数据库或自动修复历史脏父级/跨企业关系；所有破坏性红证据都发生在已销毁的专用PG。未新增数据库标签名唯一索引，因此本次事务保证批量完整性及父级关系稳定，不宣称跨请求标签名称唯一性已被数据库约束。CustomerService.create的整个客户创建事务、其他旧CRUD身份或存量关系审计不属于本次关联入口修复。没有真实渠道、消息送达或生产部署验证。
