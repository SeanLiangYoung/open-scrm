# 员工选择与客户分配边界交叉复查

本轮只读复查当前工作树，未发现达到重要级别且本轮能明确复现的新缺陷。没有修改业务源码，没有构建、真实HTTP、浏览器启动或数据库操作。

## 范围与源码证据

- [StaffController](../../code/services/auth-service/src/controller/staff.controller.ts)：list先验证企业/操作者身份；查询的所有OR分支都包含corpId及status=1；分页使用规范正安全整数并限制pageSize100及安全偏移；keyword为最多50字符的字符串，LIKE特殊字符转义且通过TypeORM绑定；返回只包含id字符串、username、realName，不包含密码和全局用户资料。
- [CustomerService](../../code/services/customer-service/src/service/customer.service.ts)：create使用当前企业；update先按id+corpId读取客户。显式负责人需为正安全整数，参数化查询共享user表的id+corp_id+status=1；不存在、停用及其他企业员工在保存前被拒绝。update的null清空仅在客户归属查验之后跳过员工查询；create仍不接受null；遗漏负责人保留已有分配。
- [useTenantStaff](../../code/apps/operation-platform/src/composables/useTenantStaff.ts)：编号保存为精确字符串，提交数值前拒绝非规范编号和安全整数上限外编号；search的成功、失败和finally三个分支均只更新最新请求。查询失败清除结果并显示错误，但保留已选员工缓存。
- [TenantStaffSelect](../../code/apps/operation-platform/src/components/TenantStaffSelect.vue)：已选员工与当前搜索结果合并，未在当前页的已选编号保留并显示占位标签；不可安全转换的编号禁选；单选清空显式发出空数组，多选保留字符串数组。
- [CustomerList保存逻辑](../../code/apps/operation-platform/src/views/customer/CustomerList.vue)：原负责人未变时省略字段，修改时验证数值，已有负责人被清空时发送null；创建空选择省略字段。手机号和备注只有在原非空且主动清空时发送null。编辑来源只读，创建来源发送channel；没有恢复假企业/假员工或不支持的email/source写字段。

## 本轮独立执行证据

1. auth-service：`vitest run src/controller/staff.controller.spec.ts`，20通过。覆盖身份、企业过滤、停用过滤、允许返回字段、查询参数与分页边界。
2. customer-service：`vitest run src/service/customer-assignment.service.spec.ts src/service/customer-update-contract.spec.ts`，26通过（23分配、3可空字段契约）。覆盖同企业启用员工分配、停用/其他企业/缺失员工拒绝、数值/原始类型拒绝、创建省略、更新省略、null清空和不存在客户无写入。
3. 当前composable源码内存转译，真实Vue ref，受控API Promise独立探针：4组通过。实际检查安全编号上限/不规范编号；较旧成功不能覆盖较新搜索；较旧失败不能污染较新成功；当前失败清空结果并显示错误但保留已有缓存。没有网络调用，输出为 `passed:4, failed:0`。

现有13个staff浏览器契约用例也逐项对照源码，但本轮没有重新执行，不能将其历史通过计作本轮浏览器验证。涉及创建/替换/清空负责人、保留不在当前结果的原负责人、失败反馈、编号精度和搜索乱序的断言与当前保存路径一致。

## 结论边界

员工搜索结果是选择提示，员工可在搜索后停用；提交时服务重新查询启用状态，因此不依赖浏览器缓存作授权依据。保留旧负责人且字段未提交时不重新分配，是已有明确契约，不能把“未主动更改时保留已停用旧负责人”误报为新分配绕过。

本轮仓库测试使用替身，不证明并发数据库事务中的原子性；员工启用检查与客户保存不是本轮验证的串行化事务，不将结果表述为“员工状态在并发修改下仍绝对不变”。本轮没有用替身仓库模拟数据库锁来制造数据库保证，也没有据此声称并发缺陷已经实际触发。

StaffController和CustomerService依赖内部可信身份头；通过网关时身份头由已验证claim重建。内部服务对外暴露的部署信任边界不属于本轮新增接口自行解决的范围，本轮未对直连内部服务作外部安全通过声明。真实PG持久化与实际网关/页面的历史证据需查各自报告，不能与本轮46个单测及4组内存探针混为一次全链路复验。
