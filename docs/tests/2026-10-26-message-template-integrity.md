# 模板引用与编号边界修复准备

状态：ALL40源码冻结期间，仅新增[计划](../plans/2026-10-26-message-template-integrity.md)和独立测试，尚未实现或验证修复。

新增message-path-integrity.spec.ts与message-template-reference.spec.ts，当前80例实际执行67失败/13通过。路径45例：五入口分别八种畸形编号均失败（现有实现未拒绝），五种合法路径通过。引用35例：实际单发/批量与v1控制器及真实DTO边界共27失败/8通过；已覆盖合法、不带引用、原有部分DTO拒绝行为，不将这些现有通过例称先红。

引用行为验收遵循批准范围：templateId仅正安全JSON数字及本企业存在；本企业停用或与请求channel不同的模板仍可作引用元数据，explicit content不渲染/改写。独立sendByTemplate启用规则不变。v1非法引用必须在consent/Redis与幂等查询前拒绝。

本次tsc --noEmit exit0，新增红测试类型正确；这是类型检查通过，不是业务修复通过。没有业务源码、dist、旧spec、CI/runner或真实HTTP变动。后续实现须等待主执行者明确解冻；新红spec会被Vitest自动发现，完整单元暂时有预期失败，应和既有ALL40证据区分。

## 解冻后实现与单元结果

主执行者明确解冻后实现：五路径统一严格解析，模板/日志详情服务直接调用也验证正安全数；sender单发/批量/v1 preflight均先验证optional模板引用归属。仅同企业存在，不增加启用/渠道匹配条件，不渲染explicit content。既有模板渲染发送的启用规则保持，其他consent/read/notification逻辑未改。

原80例现全部通过。新增局部route middleware九例验证：仅templateId原始JSON错误变为400，其他DTO仍留给原@Validate错误处理；避免把整个发送DTO的422全改400。最新完整message21文件286项单元全部通过，tsc --noEmit exit0。未构建/真实HTTP；新overnight-message-template-http.cjs已语法检查，等待串行窗口，预期实际双企至少13组及精确SQL。

## 实际网关双企业13组通过

主执行者确认资源引用不存在/外企统一404，非法格式400，其他既有DTO422；计划已记执行裁定。Node20.20.0独占auth/message/gateway实际构建及新PG16/Redis运行13组，首次全部通过、exit0。

实际覆盖：两个真实企业登录，正常自有模板读；九种畸形路径GET/PUT/DELETE全部400且SQL模板不变；legacy/v1日志畸形与超安全ID400且不读取外企日志；单发/批量foreign/missing404；三个发送入口共十八个非法JSON模板引用400；无关content null仍422（证实局部middleware执行顺序和兼容性）。v1营销foreign引用叠加existing-key仍404，不被缺授权403或旧幂等重放遮蔽，Redis策略键无增量。自有停用/不同渠道模板仅作元数据引用仍允许明确Mock5单发/批量，正文不被模板替换；B带伪造A头仍只能正常关联B自己模板；无模板继续允许；正常自有更新/删除仍有效。

最终SQL专用模板恰2条：A9201仍停用/渠道1，B9202原内容保持；A9203仅在合法更新/删除后移除。日志恰7行：2原有种子、A9201引用3条、B9202引用1条、A无引用1条；全部类型5模拟，内容仍explicit own content，无A引用B9202。拒绝路径/引用没有新增行。模拟成功不代表外部送达。

证据 `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-message-template-http-9CZvyI/result.json`：checkCount13、expectedDedicatedTemplates2、expectedMessageRows7，testsPassed/cleanup.passed/passed均true，exit0。PG49761、Redis49766、auth49785、message49786、gateway49787；自有服务进程与两个容器确认清理。

新check-message-template-cleanup.cjs亦实际通过：注入docker start非法参数，业务harness exit1/0子服务，唯一已创建容器af0ebadc242a02e8804678cd7029fb2385ba2d271fef757c8033553f3b13ba59已确认不存在，cleanup true；无专用profile直接--service仍在Bootstrap前exit1。证据`.../open-scrm-message-template-http-LsvVAI`。自检exit0指成功捕获预期失败，不是把故障业务运行算通过。

## 实际32位模板编号边界补证与修复

主执行者提出int4边界后，先在原安全整数实现上运行fresh实例，证据`.../open-scrm-message-template-http-uKcJoS`：2147483648与9007199254740991各自模板detail、single-ref、batch-ref共6请求全部500/code22003；日志MAX_SAFE详情仍200/null。harness原预期安全拒绝，实际exit1，最终cleanup true。此为实际数据库溢出证明，不是仅根据Entity推测。

随后分离模板int4与日志bigint规则：模板路径/服务/DTO/引用中间件只允许1..2147483647，超范围400；日志详情仍支持正安全整数至MAX_SAFE。新增18边界例先16失败/2日志MAX_SAFE通过，修复后全绿；最新完整message21文件304测试及tsc通过。

fresh最终扩展14组全部通过、exit0，证据 `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-message-template-http-GXQdUg/result.json`。六超int4请求全部400；合法2147483647详情查询200/null、该范围内缺失引用404；日志9007199254740991仍200/null。原13组同时通过，最终仍2专用模板/7Mock日志/0crossref，testsPassed/cleanup.passed/passed true，所有自有服务与容器确认清理。PG52769、Redis52776、auth52795、message52796、gateway52797。先前13组是历史执行，最终14组为扩展证据，不相加统计。
