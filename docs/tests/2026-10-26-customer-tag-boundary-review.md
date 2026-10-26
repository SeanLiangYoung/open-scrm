# 客户与标签关系企业边界独立复核

ALL40运行期间只读复核Customer/Tag controller/service、标签父子分组与客户添加/移除关系。没有修改生产源码、已注册spec、配置或统一入口，没有构建、HTTP/数据库调用。本次重要问题先报主执行者，冻结解除前不修业务源码。

## Critical：更新标签可替换主键/企业，批量创建可直接覆盖外企主键

位置：[TagController.update](../../code/services/customer-service/src/controller/tag.controller.ts) 第30行附近使用Partial<CreateTagDto>，实际运行时参数类型是Object；[TagService.update](../../code/services/customer-service/src/service/tag.service.ts) 第49–50行先按id+corpId查本企业，但第71行Object.assign(tag,dto)允许把查验后的id、corpId一起替换，再按新主键save。读取时有企业条件并不能保护后续被替换的写目标。

独立探针读取当前TS并内存编译，实际Reflect metadata为 `Object`、`getSchema(Object)`为空；真实Midway ValidationPipe对该base type返回原始JSON，未剥除id/corpId。实际控制器+实际服务（仓库仅内存）复现：企业2更新自己的标签21，body `{id:11,corpId:1,tagName:'foreign overwrite'}`，save实际收到 `{id:11,corpId:1,...}`，内存外企标签11被改名。这不是只模拟Object.assign表达式；请求经过当前控制器、真实参数schema行为和服务本企业查验后才改写目标。

批量路径更直接：[TagController.batchCreate](../../code/services/customer-service/src/controller/tag.controller.ts) 的body为CreateTagDto[]且无Validate；[TagService.batchCreate](../../code/services/customer-service/src/service/tag.service.ts) 第186–198行对每项直接展开，虽然最后覆盖corpId为当前企业，但没有移除id。`[{id:11,tagName:'batch foreign overwrite'}]` 无需先查任何本企业标签，就将外企主键11交给save并把其corpId改为调用者企业2。Midway实际Body数组转换保留数组对象，不会自动逐项运行CreateTagDto的规则。

**普通界面也触发企业迁移。** [TagManage.vue第115行](../../code/apps/operation-platform/src/views/customer/TagManage.vue) 创建/修改请求均硬编码corpId1。企业2正常编辑自己的标签21，当前update接受后保存为corpId1，该标签会从企业2列表消失并进入企业1。这条body形状已用实际controller/service探针复现。

**证据边界。** 本轮没有真实PG写入；已证明真实服务提交的save目标是外企主键且仓库替身按主键发生错误更新，符合TypeORM save以主键更新/插入的调用契约。需要冻结结束后在独立PG16补实际数据库/网关验证，不能把本轮内存探针称为实际数据库越权测试。正常网关重建身份头不会修复此问题，因为恶意字段在合法业务body内，服务从本企业上下文取得身份后自行改写了实体。

建议修复范围：各创建/更新/批量入口只接受明确可编辑字段，实体构造/赋值也用白名单以保护直接服务调用；用真实DTO校验更新和批量元素，拒绝或安全忽略不可变id/corpId等字段；同步移除TagManage假身份字段。不要只在网关删一个header或只保护update而遗漏batch。

## Important：外企父标签可以写入，合法创建的本企业子标签从树中消失

CreateTagDto明确支持非负parentId，但TagService.create、update和batchCreate均没有读取父标签验证同企业归属。探针使用本企业2父标签21、其他企业1父标签11：创建/更新/批量任一操作带parentId11都成功保存，没有拒绝。随后实际getTagTree只读取企业2节点，无法找到外企父节点，本企业新子节点既非root也无法挂父，最终不出现在树中。

这证明的是持久化调用的跨企业引用和本企业树丢节点，不是读取到了外企父标签内容。标签树查询本身仍按corpId过滤。需要验证parentId=0根节点例外，其他父节点存在且属于本企业，修改时还需避免自指/环使有效节点消失；本轮只把已复现的外企父引用列作Finding，未把环检测建议计为已验证缺陷。

本服务没有独立标签组entity/API，分组关系是customer_tag.parent_id；TagManage的groupName输入当前没有映射到提交字段，不应据此假设已有可用组管理后端。

## 客户标签关联的安全控制与未扩大结论

实际CustomerService.addTags先按customerId+corpId读取客户，再按tag ID集合+corpId找标签；本轮4组控制探针通过：混合本企/外企ID只挂本企；只给外企ID不建立关系；其他企业客户添加/移除均在保存前拒绝；正常数字路径标签移除成功。

最后一项使用真实Midway extractKoaLikeValue读取Number参数，因此没有把原始URL字符串直接塞入方法再误报“类型声明不会转换所以移除失败”。当前框架确实执行Number转换。客户详情relations读取没有额外tag corp过滤，本轮未构造实际数据库中已有跨企业脏关系，故不另行宣称正常关联读取已泄露外企数据。

addTags当前会静默过滤无权标签而非整批拒绝；本轮没有发现它实际挂入外企标签，也不把这种产品结果处理方式单独称为跨企业漏洞。后续修复标签身份迁移应同时确认现存关联不被新写入污染。

## 可重复红测与输出

新增独立审查文件 [customer-tag-boundary.review.cjs](../../code/scripts/test/customer-tag-boundary.review.cjs)，位于scripts/test而非服务src的Vitest发现目录，**未注册统一入口**，不会把ALL40正在运行的项目测试改成红色。

执行 `node --test code/scripts/test/customer-tag-boundary.review.cjs`：**7项，6失败、1通过，退出1**。失败为更新外企主键、批量外企主键、普通UI企业迁移、create/update/batch外企父引用；同企业父节点控制通过。日志 `/tmp/customer-tag-boundary-red.log`，包含Object/noSchema元数据和完整差异。当前保持红色等待主任务冻结结束后处理。

另执行 `/tmp/customer-tag-review-probe.cjs` 得到实际save行/树输出，以及 `/tmp/customer-tag-relation-controls.cjs` 4组通过。所有探针使用当前TS源码及真实Midway元数据/转换，仓库为替身，无用户数据库或外部发送。
