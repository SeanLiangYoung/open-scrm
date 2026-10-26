# 客户授权读模型后端验证

2026-10-26。执行已批准[设计契约](../plans/2026-10-26-consent-read-model.md)的后端部分；独占新读controller/service/DTO，不修改原grant/revoke写实现，前端由主执行者拥有。

## 当前完成证据

新增ConsentReadController GET `/api/v1/messages/consents/customer/:customerId`，完整可信企业/操作者缺失401；customerId与分页严格规范十进制安全整数，未知/重复/空query400；同企业客户不存在或外企客户404。响应白名单、count安全转换、精确字符串证据ID、DB observedAt及全量active/revoked/total契约保持设计。默认page1/pageSize20，page最大100000、pageSize最大100。

新39项单测先运行缺实现失败；加入仅抛未实现的类后可观察32失败/7通过，随后实现39通过。完整message服务18文件197测试通过，tsc --noEmit exit0。测试的7个非法直接参数例在占位期仅断言拒绝，不能把它们称为先红；其余32例实际先红后绿。未以这些单元测试代替真实事务隔离。

## 实际PG16与MVCC屏障

运行 `PATH=/Users/seanliang/.nvm/versions/node/v20.20.0/bin:$PATH node code/scripts/test/overnight-consent-read-postgres.cjs`，无dist构建；直接内存转译当前service/entity，实际TypeORM连接脚本刚创建的PG16。容器create后立即登记，再start；未复用用户数据库。

六组全部通过：PG16+实际metadata；大bigint排序/字段白名单/null/分页总量；空客户/外企404；并发grant屏障；并发revoke屏障；数据库READ ONLY实际拒绝写及零消息。实际设置读取为repeatable read/on。第一页count2/1/3与排序按数据库bigint降序，9007199254740993精确返回字符串；查询ORDER BY使用consent_record.id，避免id::text输出别名参与词典排序。

屏障在真实customer查询完成、MVCC快照建立后暂停读事务，另一实际连接运行现有grant或revoke并等待提交完成，再释放读事务。grant时当前响应仍total3/active2/revoked1/list3，下一读total4/active3/revoked1/list4；revoke时当前响应仍4/3/1/list4，下一读4/0/4/list4。写方在读暂停期间实际完成，未被读锁阻塞。不是用固定sleep推断并发行为。

实际证据 `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-consent-read-pg-D3pX1d/result.json`：checkCount6、testsPassed/cleanup.passed/passed true，exit0。PG51298，自有容器c01e73d6a099f45cc45e2e4782a183521e805e8b7c19bbebb7d0e72eb3d5c58b已确认不存在。database-evidence.json记录专用证据最终状态，消息表0行。

## 下一步真实HTTP

新overnight-consent-read-http.cjs已准备并语法检查通过，含双企业真实登录、匿名401、空证据、混合证据计数/白名单、分页及精确大ID、跨企404和伪造头、非法路径/query含重复数组、grant/revoke后快照与Mock营销闸门以及最终SQL。尚未构建或运行，等待串行窗口；不把准备状态称通过。前端与实际UI证据由主执行者单独验收。

## 原生真实网关HTTP完成

Node20下独占构建auth/message/gateway后运行overnight-consent-read-http.cjs，14组全部通过、exit0。两企业真实登录；匿名401；A空证据、两个有效加一条旧撤回的全量计数/白名单；分页/精确9007199254740993/null/超页；双方跨企与不存在404，伪造头不改变JWT企业；八类非法路径400、十一类非法或重复query400（实际HTTP确认重复page/pageSize不会被框架先取单值）。B只读自己证据；A两条grant仍允许显式Mock营销，撤回2条后快照active0/revoked3，重复撤回0且历史保持，后续营销403无新增日志。

最终SQL专用客户恰4条证据：A9001的read-http-a1/a2与大ID历史证据全部已撤回，B9002的read-http-b仍有效；消息表恰1条A显式类型5成功记录。读接口没有授权或消息副作用，写入仅来自测试显式grant/revoke/Mock发送。未连接任何真实提供方。

证据目录 `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-consent-read-http-http-5gFejW`，result.json含checkCount14、expectedEvidenceRows4、expectedMessageRows1，testsPassed/cleanup.passed/passed均true。PG53164、Redis53167、auth53182、message53183、gateway53184；自有服务与两个容器全部确认清理。直接--service无专用profile实测exit1拒绝，在Bootstrap前停止。

前节“下一步真实HTTP”保留准备历史，此节为最终完成证据；实际前端读取/显示仍由主执行者独立实现和验收。
