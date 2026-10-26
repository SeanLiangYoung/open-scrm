# 客户营销授权UI独立只读复核

范围为当前[CustomerMarketingConsent.vue](../../code/apps/operation-platform/src/components/CustomerMarketingConsent.vue)及[CustomerDetail.vue集成](../../code/apps/operation-platform/src/views/customer/CustomerDetail.vue)，对照既有授权API与作者界面用例。本轮没有修改组件、详情页或现有spec，没有构建、浏览器启动或真实HTTP。**未发现本轮能明确复现的重要新缺陷。**

## 客户绑定与证据语义

CustomerDetail第9行只在已加载customer时渲染详情，第105行将同一显示对象的customer.id传给组件，且以String(customer.id)作为key；未把URL编号直接作为授权写入对象，也未固定客户ID。授权组件第57–64行只允许规范十进制正安全整数，超安全、前导零、后缀及非正值均拒绝，避免转换后写到其他客户。

组件第47–49行的policyVersion/channel/locale及本次result均从空值开始；没有默认政策版本、默认证据渠道、默认locale、默认已同意状态。grant第70–86行要求明确证据及有效locale，发送字段只有customerId/purpose/policyVersion/channel/locale；revoke第102–105行只有customerId/purpose。没有客户端自填企业或操作者身份。

第4–5行明确“登记已经作出的授权”和“本次结果不代表完整状态或历史”。成功提示使用接口返回记录/撤回计数，第106行保留实际0值；没有localStorage缓存、状态查询伪接口或虚构历史。失败保留草稿与上一次已确认的操作结果，因此旧成功信息被明确标为“本次登记/撤回”，不被改写成当前完整授权状态。

## 忙状态与重新创建

grant第67行、revoke第97行都先检查busy，分别在79和100行、第一次await前同步设置。两个按钮同时依据busy禁用，错误和成功都在finally释放。实际受控Promise探针确认：pending grant时重复grant/revoke只产生1个请求；pending revoke时两种重入也只产生1个请求。

草稿字段在pending时仍可编辑，但请求体在发出时已经取得证据值，成功结果来自该请求响应且明确列出记录证据；回调没有清空草稿或关闭/重开弹窗，不存在通知中心旧回调清空新弹窗的相同机制。本轮没有把“允许编辑下一份证据”单独列为重要缺陷。

result/draft/busy均属于组件setup实例，父组件以customer.id作为key，因此客户对象ID改变时重新创建组件，不沿用另一客户的本次结果。内存探针实际创建两份当前setup实例：旧实例pending完成后，新实例result仍为空、draft仍为空、busy仍为空。此处是实例隔离探针加实际key源码证据，**不是实际DOM路由切换或浏览器重新挂载测试**。

## 独立执行证据与限制

执行 `node /tmp/customer-consent-review-probe.cjs`，输出 `passed:8, failed:0`。探针从当前SFC抽取script setup，去掉import后内存转译，使用真实Vue reactive/ref；仅注入可控API Promise、消息提示和defineProps数据，无网络、无组件内部浏览器钩子，无仓库源文件写入。

8组检查：空证据无默认授权且不写；明确客户ID及严格请求体；超安全/不规范客户ID双操作拒绝；grant pending双操作重入；grant失败保留；撤回0准确及失败保留旧结果；revoke pending双操作重入；新实例空状态且旧实例完成不污染。

该临时探针不是已注册CI项目测试，本轮没有重跑作者10个Mock浏览器用例或4个真实UI场景；历史证据见[作者报告](2026-10-26-customer-consent-ui.md)。本轮不把API替身或setup实例等同实际PG事务、网关鉴权、客户同意证据真实性或生产营销送达。详情页其他标签/跟进行为、整个路由对参数变化的通用刷新机制及授权历史读模型不在本项新增组件验收范围，不为了凑数将这些扩展建议列作已证实缺陷。
