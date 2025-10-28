# ============================================
# Start All Backend Services
# ============================================

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Get project root directory
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Open SCRM - Start All Services" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check pnpm
Write-Host "[CHECK] Verifying pnpm installation..." -ForegroundColor Yellow
try {
    $pnpmVersion = pnpm --version
    Write-Host "[OK] pnpm version: $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] pnpm not found, please install pnpm first" -ForegroundColor Red
    Write-Host "Install command: npm install -g pnpm" -ForegroundColor Yellow
    exit 1
}

# Check dependencies
Write-Host ""
Write-Host "[CHECK] Verifying dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "$ProjectRoot\node_modules")) {
    Write-Host "[INFO] Dependencies not found, installing..." -ForegroundColor Yellow
    Push-Location $ProjectRoot
    pnpm install
    Pop-Location
    Write-Host "[OK] Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "[OK] Dependencies installed" -ForegroundColor Green
}

# Define all services
$services = @(
    @{ Name = "gateway-service"; Port = 7001; Path = "services/gateway-service"; Desc = "API Gateway" },
    @{ Name = "auth-service"; Port = 7000; Path = "services/auth-service"; Desc = "Auth Service" },
    @{ Name = "customer-service"; Port = 7002; Path = "services/customer-service"; Desc = "Customer Service" },
    @{ Name = "acquisition-service"; Port = 7003; Path = "services/acquisition-service"; Desc = "Acquisition Service" },
    @{ Name = "operation-service"; Port = 7004; Path = "services/operation-service"; Desc = "Operation Service" },
    @{ Name = "asset-service"; Port = 7005; Path = "services/asset-service"; Desc = "Asset Service" },
    @{ Name = "message-service"; Port = 7006; Path = "services/message-service"; Desc = "Message Service" },
    @{ Name = "integration-service"; Port = 7007; Path = "services/integration-service"; Desc = "Integration Service" },
    @{ Name = "analytics-service"; Port = 7008; Path = "services/analytics-service"; Desc = "Analytics Service" },
    @{ Name = "finance-service"; Port = 7009; Path = "services/finance-service"; Desc = "Finance Service" }
)

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Preparing to start $($services.Count) services" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Display service list
foreach ($service in $services) {
    Write-Host "  [$($service.Port)] $($service.Name) - $($service.Desc)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[TIP] Each service will run in a separate window" -ForegroundColor Yellow
Write-Host "[TIP] Please ensure ports 7000-7009 are not occupied" -ForegroundColor Yellow
Write-Host ""

# Ask for confirmation
$confirm = Read-Host "Continue to start all services? (Y/N)"
if ($confirm -ne 'Y' -and $confirm -ne 'y') {
    Write-Host "[CANCEL] Operation cancelled by user" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Starting services..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($service in $services) {
    $servicePath = Join-Path $ProjectRoot $service.Path
    
    Write-Host "[START] $($service.Name) (Port: $($service.Port))..." -ForegroundColor Cyan
    
    if (-not (Test-Path $servicePath)) {
        Write-Host "[ERROR] Service directory not found: $servicePath" -ForegroundColor Red
        $failCount++
        continue
    }
    
    try {
        # Create startup command
        $header = "========================================"
        $titleCmd = "Write-Host '$header' -ForegroundColor Cyan"
        $nameCmd = "Write-Host '  $($service.Desc)' -ForegroundColor Cyan"
        $portCmd = "Write-Host '  Port: $($service.Port)' -ForegroundColor Cyan"
        $footerCmd = "Write-Host '$header' -ForegroundColor Cyan"
        $emptyCmd = "Write-Host ''"
        $devCmd = "pnpm dev"
        
        $fullCommand = "cd '$servicePath'; $titleCmd; $nameCmd; $portCmd; $footerCmd; $emptyCmd; $devCmd"
        
        # Start service in new window
        Start-Process powershell -ArgumentList "-NoExit", "-Command", $fullCommand -WindowStyle Normal
        
        Write-Host "[OK] $($service.Name) started" -ForegroundColor Green
        $successCount++
        
        # Wait a moment to avoid starting too many processes at once
        Start-Sleep -Milliseconds 500
    } catch {
        Write-Host "[ERROR] Failed to start $($service.Name): $($_.Exception.Message)" -ForegroundColor Red
        $failCount++
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Startup Complete" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Success: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Gray" })
Write-Host ""
Write-Host "[TIP] Services are starting, please wait a moment..." -ForegroundColor Yellow
Write-Host "[TIP] Each service displays its log in a separate window" -ForegroundColor Yellow
Write-Host "[TIP] To stop all services, run: .\scripts\stop-all-services.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "Service URLs:" -ForegroundColor Cyan
foreach ($service in $services) {
    Write-Host "  $($service.Desc): http://localhost:$($service.Port)/health" -ForegroundColor Gray
}
Write-Host ""
Write-Host "[TIP] Press any key to close this window..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
