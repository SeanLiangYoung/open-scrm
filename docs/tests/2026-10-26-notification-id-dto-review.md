# 通知身份DTO与SOP模板引用一致性准备

2026-10-26。当前SOP任务占用实际窗口，本轮仅新增独立测试和只读探针，不修改生产源码、不构建或启动HTTP。

## 通知DTO实际红证据

新增 `code/services/message-service/src/dto/notification-identifiers-strict.spec.ts`，直接调用当前@midwayjs/validate.getSchema，对CreateNotificationDto.userIds与MarkReadDto.notificationIds验证。58例实际26失败/32通过。失败是预期应拒绝却被当前Joi接受的输入，包括规范数字字符串、指数字符串、带空白/前导零、数组中的数字字符串，以及空数组/101项/非正/小数等。布尔、嵌套数组、十六进制字符串及unsafe中部分当前已经拒绝，不能把32原有通过例都称作新增先红。

批准目标：JSON数字scalar或1至100项JSON数字数组，每项正安全整数，strict不转换字符串；MAX_SAFE数字与100项合法数组继续支持，通知身份是bigint，不能错误套模板int4上限。单项和数组schema都要约束，不仅把服务函数直接调用的严格性当HTTP严格性。建议只改这两个字段，不更改其他通知DTO/错误码或广域验证配置。实现等待主执行者在SOP窗口释放后明确授权。

现有NotificationService直接拒字符串不能阻止DTO先把'1e0'转换为1的请求；MarkRead同样在控制器之前丢失原始输入表示。这是HTTP输入边界缺口，不据此声称跨企业访问，后端企业条件仍存在。

## SOP消息动作templateId只读发现

直接内存转译当前validateSopAction与SopExecutionService，替换httpService为记录请求体并返回明确本地成功，不访问真实URL。stepType1/messageType5/content明确正文，templateId分别为'7'、'1e0'、true、2147483648：四项都通过helper并原样保留，但执行下游请求体均没有templateId。pushMaterial源码同样省略。没有实际模板引用或外企正文被读取，问题是未校验配置且静默丢弃引用元数据。

当前消息接口optional templateId要求数字1..2147483647并本企存在；本企disabled/不同channel只作元数据引用允许，explicit content不渲染。SOP现文档明确兼容员工/标签/目标规范十进制字符串，但未找到消息action.templateId字符串的明确允许条款；步骤顶层templateId还可能表示SOP模板归属，不要和action中的消息模板引用混同。

建议主执行者/SOP作者明确是否支持该可选消息引用：若支持，保存与执行都验证templateId为模板int4范围；若文档决定兼容legacy canonical字符串，执行必须精确规范化为number并转发，拒指数/十六进制/布尔/数组/越界。若不支持，则在保存和执行拒绝该未知字段，不能悄悄忽略而表现为“已按模板执行”。本轮不修改operation代码，已将实际probe输出和契约建议发送主执行者及SOP作者。

## DTO实现与当前验证

主执行者授权后，仅修改notification.dto.ts中CreateNotificationDto.userIds与MarkReadDto.notificationIds：strict数字正安全整数标量，或1至100项同规则数组。其余字段、默认框架422、服务直接调用400和UI均未修改。独立58例现全部通过，完整message22文件362测试及tsc --noEmit通过，源码已通知SOP作者稳定；其数字ID payload结构兼容。

新独立overnight-notification-identifiers-http.cjs与cleanup自检已准备（语法通过），尚未构建/HTTP，等待SOP实际窗口释放。计划实际双企业46个非法create/read请求422并零写、数字MAX_SAFE员工/通知编号两种bigint能力、100项数组、去重、跨企mark-read过滤与既有foreign员工400，SQL精确8通知/0message。未将准备状态称实际通过。

## 独立真实双企业HTTP12组完成

SOP窗口释放后，Node20.20.0独占auth/message/gateway实际构建与新PG16/Redis运行overnight-notification-identifiers-http.cjs，首次12组全部通过、exit0。两真实登录；46种创建/已读非法输入请求全部默认422，种子通知3行且未读状态完全不变；数字MAX_SAFE员工接收和数字MAX_SAFE通知已读均实际成功，未缩为int32；100项合法数字数组可提交并去重；mixed已读仅处理本企行，伪造身份头不能覆盖JWT；B自己标记成功。合法格式但外企员工组合仍服务400且没有部分通知写入。

最终SQL通知恰8行：企业1/user1共5（已读2）、企业1/user9007199254740991共2（未读2）、企业2/user9002共1（已读1）。种子id9101、9102、9007199254740991分别仅在自己企业有效请求后变已读；message_log0行，无提供方发送。

证据 `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-notification-identifiers-http-Lgtn9h/result.json`：checkCount12、expectedNotificationRows8、invalidRequests46、testsPassed/cleanup.passed/passed true，exit0。PG51017、Redis51024、auth51045、message51046、gateway51047；自有服务与两个容器确认清理。

新cleanup自检亦通过：`.../open-scrm-notification-identifiers-http-JYHJ0E`故意docker start失败，业务harness exit1、testsPassed/passed false、cleanup true、0子服务，唯一已创建容器7ed0aba7827c5aed93a11f699941d76ee00967c7f837c77d0e98f58b37a85b7b确认不存在；缺profile直接启动仍guardexit1。自检成功不计为API业务组。
