# SCRM系统 - 构建测试脚本
# 测试所有包和服务的编译

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"
$script:TestResults = @()
$script:StartTime = Get-Date

function Write-TestHeader {
    Write-Host "`n" -NoNewline
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  SCRM Build Test" -ForegroundColor Cyan
    Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Test-Build {
    param(
        [string]$Name,
        [string]$Path,
        [string]$Type
    )
    
    $testStart = Get-Date
    Write-Host "[$Type] Testing $Name" -ForegroundColor Yellow
    
    Push-Location $Path
    
    $output = pnpm build 2>&1
    $success = $LASTEXITCODE -eq 0
    
    $duration = ((Get-Date) - $testStart).TotalSeconds
    
    $result = @{
        Name = $Name
        Type = $Type
        Test = "Build"
        Success = $success
        Duration = $duration
        Output = if ($Verbose -and -not $success) { $output } else { "" }
    }
    
    $script:TestResults += $result
    
    if ($success) {
        Write-Host "  [PASS] Build completed ($([math]::Round($duration, 2))s)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Build failed ($([math]::Round($duration, 2))s)" -ForegroundColor Red
        if ($Verbose) {
            Write-Host $output -ForegroundColor Red
        }
    }
    
    Pop-Location
}

Write-TestHeader

$codeRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $codeRoot

Write-Host "=== Testing Shared Packages ===" -ForegroundColor Cyan
Test-Build "shared-types" "packages/shared-types" "Package"
Test-Build "shared-utils" "packages/shared-utils" "Package"
Test-Build "shared-constants" "packages/shared-constants" "Package"
Test-Build "server-common" "packages/server-common" "Package"

Write-Host "`n=== Testing Microservices ===" -ForegroundColor Cyan
Test-Build "gateway-service" "services/gateway-service" "Service"
Test-Build "auth-service" "services/auth-service" "Service"
Test-Build "customer-service" "services/customer-service" "Service"
Test-Build "integration-service" "services/integration-service" "Service"
Test-Build "message-service" "services/message-service" "Service"
Test-Build "operation-service" "services/operation-service" "Service"
Test-Build "acquisition-service" "services/acquisition-service" "Service"
Test-Build "analytics-service" "services/analytics-service" "Service"
Test-Build "asset-service" "services/asset-service" "Service"
Test-Build "finance-service" "services/finance-service" "Service"

Pop-Location

# 生成测试报告
$totalDuration = ((Get-Date) - $script:StartTime).TotalSeconds
$passCount = ($script:TestResults | Where-Object { $_.Success }).Count
$failCount = ($script:TestResults | Where-Object { -not $_.Success }).Count
$totalCount = $script:TestResults.Count

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total:    $totalCount tests" -ForegroundColor White
Write-Host "Passed:   $passCount tests" -ForegroundColor Green
Write-Host "Failed:   $failCount tests" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host "Duration: $([math]::Round($totalDuration, 2))s" -ForegroundColor White
Write-Host ""

Write-Host ""
if ($failCount -eq 0) {
    Write-Host "All build tests passed!" -ForegroundColor Green
    Write-Host ""
    exit 0
} else {
    Write-Host "Some build tests failed!" -ForegroundColor Red
    Write-Host ""
    exit 1
}

