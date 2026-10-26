# 管理员全局用户写入校验最小修复

根任务已授权实现[只读审查](../tests/2026-10-26-admin-write-boundary-review.md)确认的三项，auth-service独占；不改共享gateway、不改变管理员全局跨企业用户/角色契约。

1. 新ResetPasswordDto使用既有create同等min8字符串要求，未知字段拒绝；service在hash/写之前同样验证。不给登录设新长度门槛，不额外启动未启用的强密码政策。
2. 所有用户路径先验证原始canonical正安全十进制string，保留BIGINT对应safeMAX，不缩至INT32；direct service也拒非法数值ID。
3. AssignRolesDto显式roleIds JSON正整数INT32数组；[]表示明确清空，缺字段/畸形拒绝。服务去重并验证全部存在后才替换，缺任一不得部分保存；不新增跨企业角色限制。

先新增红测再改生产；仅运行auth单元测试/tsc，不build/真实HTTP/既有DB。新增边界、正常reset、合法角色/清空、普通用户gateway已有admin防护的范围分开记录，用户路径不声称未经实际HTTP的中间件结果。根任务随后统一复验。保留共享脏工作，不提交。

执行完成：controller/service/helper已修，新增87项红75fail/12pass→全绿，auth全157项与tsc通过；独立当前源码TypeORM/PG16共9检查覆盖完整集合、回滚与真实锁等待，cleanup通过。生产已冻结，不build/HTTP。角色替换使用用户行FOR UPDATE+所选角色FOR SHARE同事务，明确不新设跨企业角色政策；提交后的任意直接SQL删除及缺共享FK不在本次承诺。证据见[最终报告](../tests/2026-10-26-admin-write-validation.md)。

格式收尾：首次根workspace lint的auth37条prettier错误已限定修复本轮3生产源+2新增spec；全auth lint最终exit0、0errors/27warnings，格式后157unit/tsc再次通过。源与tests已重新冻结，后续只同步报告，root重启force+全50。
