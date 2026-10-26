# 五服务实际启动与出站限制验证

日期：2026-10-26（Asia/Shanghai）。范围为 acquisition、integration、analytics、asset、content-generation 五个服务，使用独立 PostgreSQL16 / Redis，不涉及财务、真实第三方账号或既有项目数据库。

## 两种配置与复现

仓库根运行：

```bash
# 原始缺少OSS配置的轮廓：目前会因两项启动失败而非零退出
node code/scripts/test/overnight-runtime-boot.cjs

# 明确的无真实凭据启动夹具：本次五服务通过的复现入口
node code/scripts/test/overnight-runtime-boot.cjs --oss-fixture
```

脚本只使用本机已有 `postgres:16-alpine`、`redis:7-alpine` 镜像，不安装或下载依赖。创建仅loopback随机端口的一次性容器，等待 PostgreSQL TCP 就绪后执行完整初始化SQL。每个服务确认 `dist` 是忽略目录且没有受版本管理文件后，独立执行 `mw build --clean`，再由真实Midway Bootstrap加载生产dist与隔离配置。

按 `docs/facts/studio.md` 读取创作中心运行契约，生成/发布模式明确设为本地Mock，不调用生成或发布业务接口。未加载个人 `.env`；子进程环境从明确白名单构造，不继承真实LLM、OSS、Wiki或企微凭据及服务地址。日志、上传临时目录和TMPDIR均指向本次工件目录；服务生成dist是正常构建产物。

`--oss-fixture`仅提供**明显无效的测试凭据**和脚本拥有的loopback503端点，让OSS客户端可初始化；不伪造存储成功响应，不进行上传。其它服务URL同样指向拥有的隔离资源，不能误连用户本地服务。

## 启动前的出站保护

每个测试服务在导入Midway Bootstrap及业务包前安装限制，允许的网络目的只有本次拥有的loopback数据库、Redis和明确HTTP端口。覆盖Node TCP Socket、TLS、HTTP/HTTPS、fetch、DNS查找及解析器、UDP，以及可绕开父进程限制的子进程和Worker创建。未允许的主机、链路本地metadata地址、未拥有的loopback端口和Unix socket均拒绝。

每个子进程实际执行14项拒绝自检，包括 `example.invalid` 的TCP/TLS/HTTP/HTTPS/fetch、实际Axios调用、DNS/Resolver、反向查询、metadata地址、未拥有端口、子进程和Worker；这些调用在交给真实连接/DNS方法前失败。再实际确认本次PG的TCP连接和隔离HTTP503可以访问。5个进程总计70项拒绝自检通过，随后才进入业务启动阶段。

网络记录分为 `self-check` 与 `runtime`；本次实际业务启动阶段拒绝尝试为0，隔离HTTP端点只收到5次自检，没有LLM/OSS/企微业务请求。它是普通Node SDK路径的测试防护，不是生产部署的操作系统级网络隔离证明。

## 真实发现

默认未配置OSS的运行中，**acquisition与asset启动失败**。Midway OSS组件在应用生命周期中要求endpoint/region和凭据，实际抛出 `Must set endpoint or region in oss's config`，服务退出；不能因构建和实体读取成功就宣称应用能启动。

同轮integration、analytics、content-generation启动并返回 `/health` 200。没有修改产品源码隐藏该依赖，也没有把缺配置状态写成通过。该轮总体 `passed=false`，但自建资源清理通过。

随后运行明确标记的无真实连接的OSS夹具轮廓，五个服务全部启动成功。这证明该配置下的短时启动和数据库健康，不证明默认无配置可用或对象存储送达。

## 最终五项状态

- **acquisition**：clean构建通过，4实体/49映射列可读取，`/health` 200且数据库connected，`/health/ready` 200。
- **integration**：clean构建通过，2实体/22映射列可读取，`/health` 200且数据库connected，`/health/ready` 200。
- **analytics**：clean构建通过，3实体/45映射列可读取，`/health` 200且数据库connected，`/health/ready` 200。
- **asset**：clean构建通过，3实体/32映射列可读取，`/health` 200且数据库connected，`/health/ready` 200。
- **content-generation**：clean构建通过，4实体/47映射列可读取，`/health` 200且数据库connected；没有实现 `/health/ready`，实际404，准确记录为未实现。

总计 **5个服务、16个实体、195个映射列**。本次PostgreSQL版本主号严格断言16；五个服务的框架metadata初始化及各实体ORM读取通过。最终fixture轮廓的 `testsPassed`、`cleanup.passed`、`passed` 均为 `true`。

结束/中断/异常均只清理本次创建的进程、隔离资源监听器及两只容器，核对进程退出和容器不存在；清理失败使总体失败。最终5个服务子进程均退出，两只容器不存在，没有保留运行中的监听器。

## 证据与边界

最终14项自检版本的成功目录：`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-runtime-boot-xs15UD`。`result.json`记录每个服务的构建、metadata、HTTP、网络防护、清理结果；各服务子目录含 `service.log`、`network.jsonl` 与临时日志/上传目录。

默认OSS缺配置失败证据：同层 `open-scrm-runtime-boot-x1dsWs`；最初10项网络自检的fixture成功证据为 `open-scrm-runtime-boot-UQ6G67`，最终版已补全DNS辅助入口及进程/Worker自检。

没有验证真实对象存储、LLM生成、Wiki App、平台发布、企微账号、长期运行、全部业务HTTP或生产部署。`/health`中的数据库探测是真实SQL；`/ready`只是已实现路由本身的响应，不能扩大解释成全部外部依赖已经就绪。工件为临时目录，后续可被系统清理；上述命令可重跑。
