# SCRM系统 - 完整测试脚本
# 执行所有测试并生成详细报告

param(
    [switch]$Verbose,
    [switch]$GenerateReport
)

$ErrorActionPreference = "Continue"
$script:AllResults = @()
$script:StartTime = Get-Date

function Write-TestHeader {
    Write-Host "`n" -NoNewline
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "  SCRM System - Full Test Suite" -ForegroundColor Cyan
    Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Test-Package {
    param(
        [string]$Name,
        [string]$Path,
        [string]$Type
    )
    
    Write-Host "[$Type] Testing $Name" -ForegroundColor Yellow
    Push-Location $Path
    
    # 构建测试
    $buildStart = Get-Date
    $buildOutput = pnpm build 2>&1
    $buildSuccess = $LASTEXITCODE -eq 0
    $buildDuration = ((Get-Date) - $buildStart).TotalSeconds
    
    $script:AllResults += [PSCustomObject]@{
        Name = $Name
        Type = $Type
        Test = "Build"
        Success = $buildSuccess
        Duration = $buildDuration
    }
    
    if ($buildSuccess) {
        Write-Host "  [PASS] Build" -ForegroundColor Green -NoNewline
        Write-Host " ($([math]::Round($buildDuration, 2))s)"
    } else {
        Write-Host "  [FAIL] Build" -ForegroundColor Red -NoNewline
        Write-Host " ($([math]::Round($buildDuration, 2))s)"
    }
    
    # 类型检查
    $typeStart = Get-Date
    $typeOutput = pnpm type-check 2>&1
    $typeSuccess = $LASTEXITCODE -eq 0
    $typeDuration = ((Get-Date) - $typeStart).TotalSeconds
    
    $script:AllResults += [PSCustomObject]@{
        Name = $Name
        Type = $Type
        Test = "TypeCheck"
        Success = $typeSuccess
        Duration = $typeDuration
    }
    
    if ($typeSuccess) {
        Write-Host "  [PASS] Type Check" -ForegroundColor Green -NoNewline
        Write-Host " ($([math]::Round($typeDuration, 2))s)"
    } else {
        Write-Host "  [FAIL] Type Check" -ForegroundColor Red -NoNewline
        Write-Host " ($([math]::Round($typeDuration, 2))s)"
    }
    
    # 验证构建产物
    $distExists = Test-Path "dist"
    $script:AllResults += [PSCustomObject]@{
        Name = $Name
        Type = $Type
        Test = "Artifact"
        Success = $distExists
        Duration = 0
    }
    
    if ($distExists) {
        Write-Host "  [PASS] Build Artifact" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Build Artifact" -ForegroundColor Red
    }
    
    Pop-Location
    Write-Host ""
}

Write-TestHeader

$scriptPath = Split-Path -Parent $PSScriptRoot
$codeRoot = Split-Path -Parent $scriptPath
Push-Location $codeRoot

Write-Host "=== Testing Shared Packages ===" -ForegroundColor Cyan
Write-Host ""
Test-Package "shared-types" "packages/shared-types" "Package"
Test-Package "shared-utils" "packages/shared-utils" "Package"
Test-Package "shared-constants" "packages/shared-constants" "Package"
Test-Package "server-common" "packages/server-common" "Package"

Write-Host "=== Testing Microservices ===" -ForegroundColor Cyan
Write-Host ""
Test-Package "gateway-service" "services/gateway-service" "Service"
Test-Package "auth-service" "services/auth-service" "Service"
Test-Package "customer-service" "services/customer-service" "Service"
Test-Package "integration-service" "services/integration-service" "Service"
Test-Package "message-service" "services/message-service" "Service"
Test-Package "operation-service" "services/operation-service" "Service"
Test-Package "acquisition-service" "services/acquisition-service" "Service"
Test-Package "analytics-service" "services/analytics-service" "Service"
Test-Package "asset-service" "services/asset-service" "Service"
Test-Package "finance-service" "services/finance-service" "Service"

Pop-Location

# 统计结果
$totalDuration = ((Get-Date) - $script:StartTime).TotalSeconds
$passCount = ($script:AllResults | Where-Object { $_.Success }).Count
$failCount = ($script:AllResults | Where-Object { -not $_.Success }).Count
$totalCount = $script:AllResults.Count

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Test Summary" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total Tests:  $totalCount" -ForegroundColor White
Write-Host "Passed:       $passCount" -ForegroundColor Green
Write-Host "Failed:       $failCount" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host "Success Rate: $([math]::Round($passCount / $totalCount * 100, 2))%" -ForegroundColor White
Write-Host "Duration:     $([math]::Round($totalDuration, 2))s" -ForegroundColor White
Write-Host ""

# 生成测试报告
if ($GenerateReport) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $reportPath = Join-Path $codeRoot "docs\tests\test-report-$timestamp.md"
    
    Write-Host "Generating test report: $reportPath" -ForegroundColor Cyan
    
    $report = @"
# SCRM系统测试报告

**生成时间**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  
**测试类型**: 完整测试（构建 + 类型检查 + 构建产物验证）  
**执行时长**: $([math]::Round($totalDuration, 2))秒

---

## 📊 测试结果总览

- **总测试数**: $totalCount
- **通过**: $passCount [PASS]
- **失败**: $failCount $(if ($failCount -eq 0) { "[PASS]" } else { "[FAIL]" })
- **通过率**: $([math]::Round($passCount / $totalCount * 100, 2))%

---

## 📋 详细测试结果

| 包/服务 | 类型 | 构建 | 类型检查 | 构建产物 |
|---------|------|------|----------|----------|
"@

    # 按包分组结果
    $packages = $script:AllResults | Group-Object -Property Name | Sort-Object Name
    foreach ($pkg in $packages) {
        $name = $pkg.Name
        $type = $pkg.Group[0].Type
        
        $buildItem = $pkg.Group | Where-Object { $_.Test -eq "Build" } | Select-Object -First 1
        $typeItem = $pkg.Group | Where-Object { $_.Test -eq "TypeCheck" } | Select-Object -First 1
        $artifactItem = $pkg.Group | Where-Object { $_.Test -eq "Artifact" } | Select-Object -First 1
        
        $buildIcon = if($buildItem -and $buildItem.Success){"[PASS]"}else{"[FAIL]"}
        $typeIcon = if($typeItem -and $typeItem.Success){"[PASS]"}else{"[FAIL]"}
        $artifactIcon = if($artifactItem -and $artifactItem.Success){"[PASS]"}else{"[FAIL]"}
        
        $report += "`n| $name | $type | $buildIcon | $typeIcon | $artifactIcon |"
    }
    
    $report += @"


---

## ⏱️ 性能统计

| 包/服务 | 构建时间 | 类型检查时间 |
|---------|----------|--------------|
"@

    foreach ($pkg in $packages) {
        $name = $pkg.Name
        $buildItem = $pkg.Group | Where-Object { $_.Test -eq "Build" } | Select-Object -First 1
        $typeItem = $pkg.Group | Where-Object { $_.Test -eq "TypeCheck" } | Select-Object -First 1
        
        $buildTime = if ($buildItem -and $buildItem.Duration) { 
            [math]::Round([double]$buildItem.Duration, 2) 
        } else { 0 }
        
        $typeTime = if ($typeItem -and $typeItem.Duration) { 
            [math]::Round([double]$typeItem.Duration, 2) 
        } else { 0 }
        
        $report += "`n| $name | ${buildTime}s | ${typeTime}s |"
    }
    
    $report += @"


---

## 🎯 测试结论

"@

    if ($failCount -eq 0) {
        $report += @"

[PASS] **所有测试通过！**

代码质量良好，可以继续开发或部署。
"@
    } else {
        $report += @"

[FAIL] **测试失败！**

有 $failCount 个测试失败，请检查失败的测试项并修复问题。
"@
    }
    
    $report += @"


---

**测试执行命令**: ``````powershell
.\scripts\test\full-test.ps1 -GenerateReport
``````

**下次测试**: 建议在代码修改后重新运行测试
"@

    # 使用UTF8编码保存报告，避免中文乱码
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($reportPath, $report, $utf8NoBom)
    Write-Host "Report generated: $reportPath" -ForegroundColor Green
}

Write-Host ""
if ($failCount -eq 0) {
    Write-Host "All tests passed!" -ForegroundColor Green
    Write-Host ""
    exit 0
} else {
    Write-Host "Some tests failed!" -ForegroundColor Red
    Write-Host ""
    exit 1
}

