# 标签完整性独立只读复核

2026-10-26。审查当前TagController、TagService、Create/UpdateTagDto、tag-integrity工具、TagManage及CustomerService.addTags。未改customer生产源码/既有测试，未构建/启动HTTP/数据库，不占SOP实际窗口。独立重跑现有标签两文件66项单测全部通过、exit0。

## 已确认的剩余一致性缺口：并发同名创建无数据库唯一保证

TagService.requireUniqueName仅按corpId/tagName查询后再save；新建根标签没有可作为序列化边界的父行锁。当前DDL customer_tag只有corp_id普通索引，Entity也没有(corpId,tagName)唯一约束。

实际TagService方法屏障探针：两次同企业create({tagName:'concurrent-name'})在名称存在查询处同时等待，第二次到达后共同释放，两个查询均返回未存在，然后实际方法各调用save，最终记录saved2、names为两个相同名称。这不是新建PG复验；仓库为可观察内存实现，用于证明当前方法没有把查询和插入串行化。结合当前无唯一约束的DDL，可以确认服务层没有并发名称唯一保证，不能把单次事务或批内去重称为同企业名字全局唯一。

影响是同企业标签名称重复与操作歧义，不是跨企业写入，也不是已验证批量事务部分写入。若名称唯一是requireUniqueName表达的产品契约，建议另行选择数据库唯一约束（先审查/处理既有重复，保留跨企同名允许）或明确事务锁策略；不要在本只读审查直接添加迁移。需真实PG两连接屏障验证成功一次/另一明确重复错误，覆盖create/batch/update，而非仅内存锁模拟。若产品允许同名，应移除假唯一承诺并设计明确区分，不能留依赖时序的行为。

## 注入、partial及元数据保护证据

实际tagInput探针创建派生CreateTagDto实例并附加id/corpId，返回400。服务选择固定CreateTagDto/UpdateTagDto schema，不采用输入构造器或未验证的子类schema；convert false/allowUnknown false以及二次显式白名单阻止主键、企业、status、children字段被写入。Create与Update是独立类，Update没有Create默认字段，现66项单测也涵盖这项历史回归。

实际TagService.update仅提供tagName时，返回行保持id7/corp1/parent0/tagType3/sort8/isAuto1/status0/color原值。没有借改名重置父级或自动标志。清空颜色显式null是允许更新，不与省略字段混淆。TagManage编辑只发送tagName和颜色，不硬码tagType/parentId/sort/isAuto；父级仅显示保留，不能从客户端把所有子类改为根标签。提交pending时表单/关闭/重开已有保护，列表读取有latestRead。

## 企业归属、父级和事务边界

服务tagTenant要求完整可信企业/操作者，不默认回退企业1；坏/空身份头不靠state补齐。tagId按INTEGER1..2147483647解析，客户ID与企业仍保留安全bigint范围。Controller路径与服务入口均校验，客户标签完整body只允许tagIds，数组1..100、数值、去重后范围验证。

TagService写事务只使用callback manager的仓库；update/delete先带corpId锁自己行，祖先链每次带corpId读取并持读锁，visited包含自己且检查每一祖先，因此现已覆盖外企父级、不存在父级、自引用及祖先循环。batch在任何save前验证全部输入/父级/重名，再在同一事务save集合；现单测覆盖混合非法零写、注入零写、保存失败回滚，真实PG原8组由作者提供，不在本报告重新计执行。

CustomerService.addTags在事务内先锁本企customer，再按id集合+corpId锁全部请求标签；数量不匹配整批400，不能只保留命中的有效子集。最后同manager重新加载关系并合并一次，现15项客户标签单测证实混合外企/不存在零保存、合法去重、外企客户404和畸形输入无仓库调用。本轮未把预先已损坏历史关系假设当新漏洞，也未扩大到removeTags并发覆盖或全域客户CRUD审计。

## 范围结论

本次未再确认id/corp注入、partial默认重置、外企父级或请求级批量原子性缺陷。唯一已复现剩余项为名称唯一性在并发下缺少保证；其PG运行证据仍待单独排期，不把此报告称全面并发审计。没有修改共享运营README或customer源码。
