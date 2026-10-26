# CGS规范路径与bigint批推归属修复验证

2026-10-26，执行[专属计划](../plans/2026-10-26-content-studio-identifiers.md)。仅修改content-generation-service相关controller、两个service和新增identity工具/独立测试；未修改Asset、Wiki共享部署或其他业务源，未提交，保留共享工作树修改。

## 修复契约

source GET/PATCH/DELETE/compose、generate、job GET、variant GET/PATCH/push-draft、source batch-push十类路径统一规范十进制正安全整数校验，非法400且在业务/外呼前拒绝。保持现有number service调用，bigint不缩int4，MAX_SAFE可用，超安全路径明确400不舍入。本轮不新增全PG9223372036854775807字符串路径读写能力。服务getSource/getVariant/getJob直接数字调用也校验。

batchPushDrafts保留corp查询与source所属检查，改为规范十进制精确比较PG bigint字符串和请求数字。stored字符串限制PG正bigint界，numeric只接受正安全整数，拒歧义表示与溢出，不Number舍入。仍逐项成功/失败返回，不改为整批事务，不改变外部草稿语义。

## 单元红绿与类型检查

新增studio-path-integrity.spec.ts100例与studio-bigint-boundary.spec.ts14例，实际先95失败/19原有通过，修复后114全部通过。原有通过包括正常路径MAX_SAFE、错误源拒绝等，不把19例称新增先红。完整CGS17文件148测试全部通过，tsc --noEmit exit0。

命令：服务目录下 `./node_modules/.bin/vitest run` 与 `./node_modules/.bin/tsc --noEmit`。没有运行mw build、服务Bootstrap、HTTP或根runner。

## 实际隔离PG16六组

新增独立脚本 `code/scripts/test/overnight-studio-identifiers-postgres.cjs`，Node20.20.0，脚本create容器后立即登记再start，完整初始化当前PG SQL；实际TypeORM载入当前source/variant/link实体和内存转译当前方法，不触碰dist。

1. 实际PG16与metadata读取证实variant.sourceId为字符串'10'。
2. 同企批推own source10/variant100成功；同企错source变体101、外企变体200逐项失败且不触发本地桩，第一条本地publish link成功落库。
3. source9007199254740991实际bigint行可读且对应变体批推成功，无int4截断或Number舍入。
4. 实际controller update('1e1')/remove('0xa')均400，PG源10原名与4行总数不变。
5. 规范路径10更新仅改title，body/composeStatus保留；企业901不能取企业902源，外企body保持。
6. 本地获取草稿桩恰2次，实际link仅(901,100,7001)/(901,103,7002)，消息0；所有HTTP(S)/fetch入口设置禁止外呼，externalAttempts0。

该桩仅返回本地固定草稿ID以验证当前本地写入链，不冒充真实acquisition/Wiki/LLM成功；没有真正生成、推送或发布。实际PG证明不是单纯用数字对象代替水合结果。

证据 `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-studio-identifiers-pg-ppkR66/result.json`：checkCount6、expectedSources4、expectedVariants4、expectedLocalLinks2、localAcquisitionStubCalls2、externalAttempts0、testsPassed/cleanup.passed/passed true，exit0。PG61077，自有容器02f6a21b9d7d21e68ab4c24a9296a1e49cb5bf24ea79d18495f47bd13b24e014确认不存在；database-evidence.json保留精确本地行。

运行命令：

```bash
PATH=/Users/seanliang/.nvm/versions/node/v20.20.0/bin:$PATH node code/scripts/test/overnight-studio-identifiers-postgres.cjs
```

## 限制与冻结交付

本轮只执行新增测试红/绿各一次、本服务全单元一次、tsc一次、独立PG一次与语法检查；未构建或运行HTTP、未运行全50、未触碰外部平台。原扫描中Asset参数/引用和网关不匹配仍为独立待办，不因CGS通过而解决；共享Wiki部署不被重定义。源码和新脚本现稳定冻结，交由主执行者接续最后三组与全量回归。
