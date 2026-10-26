# 消息模板与日志旧接口边界只读复核

2026-10-26，ALL40回归期间只读。审查MessageController、MessageTemplateService、MessageSendService、MessageLogService、实际DTO与gateway转发。排除已修复retry。未改产品代码或既有测试、未build、未启动HTTP/数据库。当前service/controller通过内存转译探针运行，仓库替换为可观察的内存行，不发生外部发送。

## 发现1：合法网关身份下畸形路径可更新或删除另一正确编号的本企业模板

MessageController.updateTemplate/deleteTemplate/getTemplate/getLog均直接parseInt(id)，没有规范十进制与安全精度校验。实际控制器+实际模板服务探针，可信企业1/操作者1，内存有企业1模板7及企业2模板8：

- updateTemplate('7tail',{templateName:'changed wrong path'})实际查询{id:7,corpId:1}，把模板7名称修改。
- deleteTemplate('7.9')实际删除{id:7,corpId:1}。企业2模板8保持原样。
- getLog('9007199254740993')实际向日志仓库传{id:9007199254740992,corpId:1}，发生舍入后查询。类似7e2/7tail会查询7，不是路径所指定的规范编号。

这是正常JWT可到达的路径输入问题：gateway已存在/api/message/*转发，鉴权不会校验路径编号；update的@Validate只约束body。无需伪造企业头或缺失内部身份即可触发。不能把它称跨企业修改，当前模板/日志服务where仍带corpId；直接影响是误读/误写/误删本企业另一编号对象。邻近v1消息日志详情同样parseInt路径，若做共用修复应一并审查，不因本轮集中legacy就宣称v1已严格。

最小建议：在任何仓库访问前严格解析路径，拒绝尾随字符、小数、指数、0、负数、空白和无法精确表示的编号。若保持当前数字服务签名，则正安全整数范围外400；若产品要读取合法超大bigint日志，应全链路传规范十进制字符串，不能先Number再回转。读/改/删用同一个已验证编号，服务直调用也需保护。至少覆盖4legacy路径×畸形/合法/外企，以及unsafe ID无查询/无写；正常网关双企测试用真实本企模板记录核对更新/删除未误中。

## 发现2：可选templateId未经企业归属校验写入单发/批量日志

MessageSendService.sendMessage与batchSendMessage将dto.templateId直接传入message_log.create，不先读取模板。实际BatchSendMessageDto schema接受合法数字8；实际sender探针以企业1、messageType5、targetType2、targetIds[1]、templateId8运行，模板8在另一企业fixture中：templateReads0，结果success1，最终日志为corpId1/templateId8/content为调用者明确提供内容/sendStatus1。当前类型5为明确Mock，不代表真实提供方送达。单发同样直接复制templateId。

这个问题由正常已认证请求可触发，影响是跨企业模板引用及错误审计归属，不是已经证实读取/渲染外企业模板内容。批量没有模板渲染：content仍为调用方明确传入或空字符串，不能夸大成窃取模板秘密。无效/不存在/停用模板也未被此路径校验，可生成没有可信模板来源的模拟日志。

最小建议：templateId存在时严格正安全整数校验，并在任何新日志之前按{id,corpId}检查可引用模板；不存在/外企统一404或约定错误，整批不得部分写入。明确是否要求启用状态及请求渠道一致，避免把所有可选templateId自动当“按模板发送”而偷偷改变现有explicit-content语义。若字段只允许自有审计关联也应执行企业归属校验。至少补单发/批量各自own、foreign、missing、invalid、disabled组合，外企拒绝不得透露内容或写日志；合法不带模板的Mock路径保持。

## 已保持的企业隔离与输入边界

MessageTemplateService更新/删除/详情均有{id,corpId}，列表where也固定当前corpId；MessageLogService详情/列表/统计固定corpId。sendByTemplate先getTemplate(dto.templateId,corpId)，只获取本企模板并检查status1，再渲染后调用sender；未发现通过正常JWT直接读取另一企业模板内容的路径。不存在/停用目前抛普通Error，可能成为500，这属于错误分类不足，不能拿它代替外企数据泄露结论。

实际CreateMessageTemplateDto schema探针拒绝未知corpId字段（报corpId is not allowed）；默认validate配置未放开unknown。因此create的对象spread和update Object.assign在内部任意对象直调时可以危险，但本轮未把绕过DTO的内部调用当作正常网关注入漏洞。

## 仅内部缺身份情形，和正常网关区分

上述legacy路由仍使用getTenantContext。该工具无头/无state时回退corp1/user1，坏企业头parseInt也有回退；故直接暴露内部服务而缺少身份边界时可以落企业1。本项是现有内部可信网络假设限制，不是匿名用户已经能经网关访问企业1：当前网关对这些受保护路由要求有效access JWT并覆盖身份头。本轮重点两发现不依赖此默认行为，已有正常可信身份的probe即可复现。

没有运行真实HTTP或数据库，不声称外网攻击已演示。当前渠道1至4明确未接通且sender会拒绝；探针成功仅类型5模拟，不能据此恢复旧占位送达承诺。修复待ALL40结束后主执行者排期，当前源码保持冻结。

## 后续修复状态

主执行者解除ALL40冻结后，按[完整性计划](../plans/2026-10-26-message-template-integrity.md)完成两项修复：路径严格解析与optional模板归属预检。新增80项及局部middleware9项通过，完整286单元与tsc通过；真实双企业13组首次通过，SQL无路径误中/跨企引用，清理已确认。详见[最终验证](2026-10-26-message-template-integrity.md)。上文保留原始只读发现与复现，不表示当前仍未修复；legacy内部默认身份假设不属于此次扩展改造。
