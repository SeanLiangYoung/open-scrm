# 消息失败重试企业隔离验证

2026-10-26，实际 Node20.20.0、PostgreSQL16、Redis7；仅使用新建一次性数据库。未调用外部消息提供方。

## 缺陷与修复

原控制器唯一生产调用点未传企业身份；服务仅按ID和失败状态查询，企业A可重试B失败日志。新增回归17例在原实现全部失败，修复后17例全部通过。查询现在同时限定corpId、ID集合和失败状态。服务入口拒绝缺失、非数字或非正安全整数企业身份；日志ID支持数字标量或非空数组，原始数组最多100条、全部正安全整数，查询前去重。外企、不存在、已成功日志均不返回细节、不修改。

控制器采用与现有授权接口一致的完整企业/操作者可信上下文校验；缺失身份401，不使用默认企业1。网关注入头存在时以该完整身份为准，无头时接受完整state.user。外部客户端必须通过网关；这次不改变服务内部网络信任模型。实际DTO拒绝数字字符串、空数组、小数、非正值及超100条，重试路由使用局部400验证状态，响应success/data/message结构保持。

## 自动验证

新增服务17例、控制器及真实DTO13例。完整消息服务13文件128测试全部通过，TypeScript无错误。实际构建auth、message、gateway均通过。

独立运行：

```bash
PATH=/Users/seanliang/.nvm/versions/node/v20.20.0/bin:/tmp/open-scrm-tools:$PATH node code/scripts/test/overnight-message-retry-http.cjs
```

真实HTTP八组断言全部通过：两企业真实登录；匿名401；A携带伪造B身份头请求B日志返回空结果；混合及重复ID只重试A失败日志一次；实际SQL确认B行与已有成功行不变；五类无效DTO400；B持自己令牌及伪造A头仍只能重试自己标量ID；成功行再次请求不重发。发送仅为明确类型5 Mock。未声明真实渠道送达、并发恰好一次或完整服务授权审计。

最终SQL日志9101/9102分别属于企业1/2、类型5、成功状态1、retry_count1；原成功日志9103仍retry_count0、send_time空。总记录恰为3条。只在B自己请求后B失败日志才转成功。

实际证据：`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-message-retry-http-TGYAsp/result.json`：checkCount8、testsPassed true、cleanup.passed true、passed true，exit0。PG55447、Redis55486、auth55513、message55514、gateway55515；服务进程94933/94946/94956全部退出，两个自有容器确认不存在。

首次脚本运行Ao2upK因测试工具误读登录响应为data.accessToken而失败，已更正为实际顶层accessToken及实际/api/message/retry路径，失败运行同样确认清理成功；该失败不是产品通过证据。

## 兼容边界

旧数字标量和合法数字数组保持；不合法数字字符串和无界数组现在拒绝。服务方法签名新增corpId，仓库搜索确认唯一生产调用点同步更新。渠道1至4占位成功问题保持独立报告，未混入本修复；见[渠道审查](2026-10-26-message-channel-honesty-review.md)。
