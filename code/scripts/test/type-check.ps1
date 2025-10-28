# SCRM系统 - 类型检查测试脚本
# 测试所有包和服务的TypeScript类型检查

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"
$script:TestResults = @()
$script:StartTime = Get-Date

function Write-TestHeader {
    Write-Host "`n" -NoNewline
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  SCRM Type Check Test" -ForegroundColor Cyan
    Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Test-TypeCheck {
    param(
        [string]$Name,
        [string]$Path,
        [string]$Type
    )
    
    $testStart = Get-Date
    Write-Host "[$Type] Checking $Name" -ForegroundColor Yellow
    
    Push-Location $Path
    
    $output = pnpm type-check 2>&1
    $success = $LASTEXITCODE -eq 0
    
    $duration = ((Get-Date) - $testStart).TotalSeconds
    
    $result = @{
        Name = $Name
        Type = $Type
        Test = "TypeCheck"
        Success = $success
        Duration = $duration
        Output = if ($Verbose -and -not $success) { $output } else { "" }
    }
    
    $script:TestResults += $result
    
    if ($success) {
        Write-Host "  [PASS] Type check passed ($([math]::Round($duration, 2))s)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Type check failed ($([math]::Round($duration, 2))s)" -ForegroundColor Red
        if ($Verbose) {
            Write-Host $output -ForegroundColor Red
        }
    }
    
    Pop-Location
}

Write-TestHeader

$codeRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $codeRoot

Write-Host "=== Checking Shared Packages ===" -ForegroundColor Cyan
Test-TypeCheck "shared-types" "packages/shared-types" "Package"
Test-TypeCheck "shared-utils" "packages/shared-utils" "Package"
Test-TypeCheck "shared-constants" "packages/shared-constants" "Package"
Test-TypeCheck "server-common" "packages/server-common" "Package"

Write-Host "`n=== Checking Microservices ===" -ForegroundColor Cyan
Test-TypeCheck "gateway-service" "services/gateway-service" "Service"
Test-TypeCheck "auth-service" "services/auth-service" "Service"
Test-TypeCheck "customer-service" "services/customer-service" "Service"
Test-TypeCheck "integration-service" "services/integration-service" "Service"
Test-TypeCheck "message-service" "services/message-service" "Service"
Test-TypeCheck "operation-service" "services/operation-service" "Service"
Test-TypeCheck "acquisition-service" "services/acquisition-service" "Service"
Test-TypeCheck "analytics-service" "services/analytics-service" "Service"
Test-TypeCheck "asset-service" "services/asset-service" "Service"
Test-TypeCheck "finance-service" "services/finance-service" "Service"

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
Write-Host "Total:    $totalCount checks" -ForegroundColor White
Write-Host "Passed:   $passCount checks" -ForegroundColor Green
Write-Host "Failed:   $failCount checks" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host "Duration: $([math]::Round($totalDuration, 2))s" -ForegroundColor White
Write-Host ""

Write-Host ""
if ($failCount -eq 0) {
    Write-Host "All type checks passed!" -ForegroundColor Green
    Write-Host ""
    exit 0
} else {
    Write-Host "Some type checks failed!" -ForegroundColor Red
    Write-Host ""
    exit 1
}

