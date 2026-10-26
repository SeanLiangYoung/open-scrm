# 网关 multipart 上传转发

2026-10-26。范围仅网关 `POST /api/v1/assets/upload` 与兼容 `POST /api/asset/upload` 的 `multipart/form-data` 请求。

## 设计与事实核对

已核对本地 Midway Koa 的 `bodyparser.middleware.js` 调用 koa-bodyparser；当前 json/form/text 配置不消费 multipart，`ctx.request.body` 为 `{}` 而原始 `ctx.req` 尚可读取。直接把这个解析正文配上原 boundary 转发会丢失文件。

只对这两个实际上传路径读取原始请求。认证中间件在代理前运行；代理也要求 `ctx.state.user` 存在。身份头仍从验证后的 state 生成。先顺序读取 raw stream 到私有临时目录（文件权限0600），总正文限制101MiB，完成后才通过文件流转发，不缓存整个文件到内存。这个限制给素材100MiB最大文件留1MiB multipart封装空间；具体类型文件限制和字段验证仍归素材服务。

Content-Length 超限预拒绝，实际读取仍按字节计数，因此未知长度/chunked或小报长度不能绕过限制。超限413且不联系下游。读取失败走既有502；连接拒绝503；业务验证状态与正文原样返回。Axios `maxBodyLength` 为101MiB，禁用重定向且不重试，避免上传流意外重复提交。保留原Content-Type/boundary，重新设置实际Content-Length。

finally关闭上传流并移除临时目录，覆盖成功和下游错误路径。提前超限不销毁HTTP socket，读取器允许提前退出后由Koa发送413。

## 权衡与边界

先落盘再转发增加一次本地磁盘写入和上传延迟，换取真实大小验证在下游副作用之前完成。每个并发请求最多占101MiB临时磁盘；当前没有增加全局并发配额，进程被强杀也不保证finally清理。非上传路由、非multipart正文与GET继续现有解析正文代理行为。不启用网关multipart解析器，不修改业务存储实现。

## 验证

测试与实际运行结果见 [测试报告](../tests/2026-10-26-multipart-proxy.md)。实际HTTP、认证和素材存储联合验证由主任务单独记录，单元结果不冒充端到端验证。

## 清理失败与中断请求补充

临时目录删除属于尽力维护动作。删除失败时记录 `Gateway upload spool cleanup failed`，包含目录与错误，保留下游已返回的状态/正文，不抛出新的网关错误或重试已提交上传；维护人员可据目录处理遗留文件。

原始请求读取抛出ECONNRESET/aborted时尚未联系下游，走既有502并清理临时目录；客户端连接已断时502不能保证送达。HTTP流正常结束但multipart封装缺少结束boundary仍交由下游multipart解析器验证，网关不实现第二份multipart语法解析。带Content-Length的真实HTTP截断由Node IncomingMessage报aborted/premature close，不作为成功完整正文转发。

## 上传上游超时预算

两个明确的multipart上传入口使用120秒上游超时，覆盖素材OSS默认60秒超时及文件转发时间，避免网关30秒先返回错误而素材随后提交的常见窗口。其它普通请求维持30秒，创作中心既有120秒保持不变。这个有限预算不能消除所有网络结果不确定性，不构成自动安全重试或恰好一次承诺。
