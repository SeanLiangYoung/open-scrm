# CGS规范路径与bigint归属比较

依据asset-content-write-review已确认的两问题，仅修content-generation-service，不改Asset、Wiki共享部署、生成渠道或发布语义。当前controller/service既有number调用保持：规范十进制正安全整数路径，MAX_SAFE允许、超安全400，拒指数/hex/空白/尾字符/前导零；不把bigint缩为int4。完整PG bigint路径新能力不在本小修范围。

全部source/variant相关读写/compose/generate/push及job读取统一parser；服务getSource/getVariant/getJob的直接数字编号校验防绕过。批推在既有corp读取后，使用规范十进制精确比较水合sourceId，不将string先Number舍入。水合字符串须为PG正bigint界内规范十进制，numeric须正安全整数；错source/外企仍逐项失败，不改变批推逐项成功失败契约。

先新增controller矩阵与水合归属红测，观察红后实现；本服务全单元与tsc。可用新PG16内存转译当前实体/服务验证实际水合，外部acquisition/Wiki/LLM全为禁止外呼桩，不能运行clean构建/HTTP。最终记录测试数/PG行数/cleanup，保留他人工作，不提交。
