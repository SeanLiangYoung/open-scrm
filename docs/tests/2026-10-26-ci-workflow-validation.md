# CI工作流定义校验修复

2026-10-26。真实推送后检查发现两个工作流运行在创建jobs前失败，非业务测试失败：

- [dcd8e73对应运行40340745205](https://github.com/SeanLiangYoung/open-scrm/actions/runs/40340745205)
- [6ff5ff4对应运行40342562131](https://github.com/SeanLiangYoung/open-scrm/actions/runs/40342562131)

GitHub API返回jobs=[]。actionlint1.7.12对原工作流精确复现：job.env的`${{ runner.temp }}`不允许使用runner上下文，退出1。改为checkout后执行`echo "TMPDIR=$RUNNER_TEMP" >> "$GITHUB_ENV"`，后续步骤获得同一临时目录，上传路径保持对应。修复后actionlint退出0，无诊断。红绿日志见[evidence](evidence/2026-10-26-ci-workflow/actionlint-red.log)。

同时注册已验证的素材PG、素材HTTP及启动失败清理检查。保留原main/master/develop推送与PR触发范围，没有为当前分支绕开触发规则，也未创建PR；本地语法通过不代表远程业务作业已运行。后续合入前须在符合触发条件的PR/分支核对实际远程结果。
