# Asset与Content Studio写入边界只读扫描

2026-10-26。先读docs/facts/studio.md及asset/content-generation服务事实源、原创作服务计划，再审controller/DTO/service。仅以当前方法安全内存桩复现，无OSS、LLM、Wiki、acquisition调用，无真实DB/HTTP，未改生产源码/已注册测试或构建。

## 契约与实际入口

Studio是admin-platform创作中心，依赖部署配置的一套LLM Wiki地址/Token/Project与LLM适配器。该共享知识/生成依赖没有按企业配置的当前承诺，不能把共享Wiki工作区直接报告为“越企业知识库漏洞”。另一方面原内容服务计划明确所有持久写操作取corpId，source/job/variant仓库确实按企业过滤；这部分数据库行隔离仍应审核。

当前gateway实际转发 `/api/v1/content-studio/*` 到CGS，且保留原路径、注入JWT企业/用户，因此sources PATCH/DELETE、variants PATCH及batch push是真实已鉴权路径。Asset controller实际前缀为`/api/asset`与`/api/asset-category`，gateway仅注册`/api/v1/assets/*`且不rewrite，二者不匹配。故asset下面发现是服务直接入口/待路由接通前的风险，不能描述成当前默认网关可达攻击；不在本轮擅自增加别名让潜在问题暴露。

## 确认1：Studio Number路径转换可误更新/删除本企业源

ContentSourceController用Number(id)而非规范编号解析。实际controller+ContentSourceService探针，可信企业1，源1/原body与kbSelectedPaths：update('1e0',{title:'wrong path accepted'})实际查询{corpId:1,id:1}并改名；remove('0x1')同样查询并删除1。未提供的body/kbSelectedPaths/composeStatus保留，证明问题是路径误中而非partial清空。

合法JWT可经现有content-studio路由送这些字符串，DTO只校验body，不能阻止。仓库where仍有corpId，未证实跨企业读写。generation/job/variant相关路径也使用Number，需按同一规范逐入口检查；不能把“1e0可转换”当合法资源编号。最小建议规范十进制编号解析；bigint行若维持数字服务签名限制正安全范围，或全链路精确字符串，禁止先舍入再查。至少source GET/PATCH/DELETE和variant GET/PATCH非法矩阵零仓库/零外呼。

## 确认2：正常同企批推遇PG bigint水合形状被错误拒绝

GenerationService.batchPushDrafts先读取本企source与variant，再用`variant.sourceId !== sourceId`判断归属。controller把路径转换number，variant实体source_id声明bigint。当前安装pg的int8解析器对'1'实际返回字符串'1'。

独立探针将该真实解析器输出赋给本企variant.sourceId，实际batchPushDrafts(1,1,合法item)返回success false、错误Variant does not belong to this content source，下游push次数0。没有调用任何生成/发布依赖。此证据是实际方法加实际驱动水合值的复现，不是本轮新PG运行；已明确区别。最小修复是规范十进制精确身份比较/规范化后再比较，不把任意字符串宽松Number；补本企水合string与numeric兼容、外企/错source不推、超安全不舍入的用例，再以隔离PG验证。

批推本身逐item捕错、返回每项结果，未声明全批事务；不能把已有逐项成功/失败语义当新“原子性漏洞”。该比较修复也不能删掉企业过滤或source归属检查。

## Asset直接服务确认问题（当前网关不匹配，单独列出）

AssetController的GET/PUT/DELETE `/:id`及分类PUT/DELETE参数装饰器实际为@Query('id')而不是@Param。因此路径和操作编号没有绑定，带query id会控制服务编号；未传query会传NaN。源码可直接确认绑定，内存方法没有HTTP路由执行，本轮不把NaN断言成已实测数据库500，也不宣称默认网关可以利用。

实际AssetService.updateAsset(1,7,{categoryId:88})不查分类，向仓库update发送where{id7,corp1}与categoryId88；AssetCategoryService.createCategory(1,{name:'child',parentId:88})不查父级直接保存corp1/parent88。实际recordUsage(1,{assetId:99,...})先保存corp1/asset99使用记录，再按{id99,corp1}increment；桩返回affected0仍正常完成。由此可以确认没有外企/不存在引用预检，可能保存不属本企业的关联，不能夸大为已读到外企素材内容。后续接通路由前应先修参数绑定、ID范围、分类/父级/素材同企存在校验，并定义usage写入与计数事务；上传涉及OSS，需另外受控失败测试，不在本轮触碰外部文件。

## 未发现的注入/Partial与排除项

两服务已检查update接口均使用真实DTO类，没有发现Partial<T>装饰器元数据擦除。CGS source更新逐字段白名单且仅字段非undefined才赋值；variant更新仅title/body/structured加内部version递增，没有Object.assign(raw dto)主键或corp改写。真实UpdateContentSourceDto schema探针拒绝id/corp字段；实际源更新探针保持id/corp与省略元数据。structured任意JSON是内容分镜/标签等既有产品字段，不因允许对象就当主键注入。

Asset update/category update同样固定编辑字段，不展开raw body；虽传了undefined值到TypeORM.update，不能用会覆盖undefined的伪仓库推导数据库字段被清空。未知id/corp字段由真实DTO默认schema拒绝；upload未@Validate但手工构造固定dto，不直接复制multipart身份字段。未运行上传/删除OSS方法。

CGS source/variant/job读取where含corpId；batch逐项再核sourceId。single push-draft的accountId归属最终依赖acquisition接受端，属于另一任务的该服务审查，本轮只确认CGS转发，不在没有下游证据时宣称外企账号已发布。KB目录共享、模型请求、网络密钥、生产部署及完整Studio安全体系均不在本轮扩展范围。

## 后续优先级

先修当前网关真实可达的CGS路径误中与bigint批推比较，保留共享Wiki契约和逐项批推语义；asset路由不匹配是明确运行接入缺口，应与其已有写入关联校验一起规划再开放。需主执行者在50阶段回归结束后另行授权源码，当前维持冻结。

## CGS后续修复状态

按专属授权完成CGS规范路径与bigint归属比较修复，新增114回归、全服务148测试与tsc通过，实际隔离PG六组确认水合字符串本企匹配及错误源/外企拒绝。无真实Wiki/LLM/HTTP，详见[修复报告](2026-10-26-content-studio-identifiers.md)。Asset范围未修改，原直接服务/路由待办保持；上文CGS发现是修复前历史证据，不应误读为当前仍未修复。
