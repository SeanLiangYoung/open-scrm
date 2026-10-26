# 素材网关路由接入

用户授权继续处理剩余问题；以已提交的素材边界修复为前置。当前网关`/api/v1/assets/*`保留原路径，而服务仅`/api/asset`与`/api/asset-category`，无法正确到达控制器。

采用显式可选`upstreamPrefix`映射：素材`/api/v1/assets/*`→`/api/asset/*`；分类`/api/v1/assets/categories/*`优先→`/api/asset-category/*`；保留原服务路径经网关的受保护兼容入口。所有匹配须为完整前缀段，`assets-evil`不命中，query/body/原始编号字符串不被转换。其余路由不重写。另一方案为在素材服务复制全部控制器路径，会产生重复定义；只增加原始路径别名则未解决已配置v1契约，因此使用显式映射。

先写路由、身份及代理红测，再实现。运行完整gateway单元、类型/lint/构建；新增隔离实际auth/asset/gateway+PG/Redis HTTP测试，覆盖无Bearer401、企业身份覆盖伪造头、分类树路由、非法编号400、外企分类拒绝、合法更新和usage并发/故障回滚。OSS仅使用fixture配置以允许启动并设置全外呼拦截，不发起上传删除请求；不把HTTP控制器覆盖称作真实OSS验收。

同步路由事实表、服务说明和独立报告；按功能提交推送，保留此前50阶段历史，不声称新快照全50已运行。

实际HTTP第12组发现有效JWT下未知路径404被AuthMiddleware包裹next的catch误改401。新增404/500原异常透传单元先红后修，只把next移出Token验证catch，不削弱身份校验。保留第一轮HTTP失败记录，再完整复验。

最终：网关54单元、素材99单元、专属PG13、真实素材HTTP12、全库8门禁和既有HTTP22阶段全部通过。568冻结文件无变化。CI定义actionlint红绿另见CI报告；独立审查复跑网关54项通过，无需修复项。
