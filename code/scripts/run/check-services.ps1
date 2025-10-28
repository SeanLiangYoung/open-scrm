# ============================================
# Check All Backend Services Status
# ============================================

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Open SCRM - Service Health Check" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Define all services
$services = @(
    @{ Name = "gateway-service"; Port = 7001; Desc = "API Gateway" },
    @{ Name = "auth-service"; Port = 7000; Desc = "Auth Service" },
    @{ Name = "customer-service"; Port = 7002; Desc = "Customer Service" },
    @{ Name = "acquisition-service"; Port = 7003; Desc = "Acquisition Service" },
    @{ Name = "operation-service"; Port = 7004; Desc = "Operation Service" },
    @{ Name = "asset-service"; Port = 7005; Desc = "Asset Service" },
    @{ Name = "message-service"; Port = 7006; Desc = "Message Service" },
    @{ Name = "integration-service"; Port = 7007; Desc = "Integration Service" },
    @{ Name = "analytics-service"; Port = 7008; Desc = "Analytics Service" },
    @{ Name = "finance-service"; Port = 7009; Desc = "Finance Service" }
)

$runningCount = 0
$stoppedCount = 0

foreach ($service in $services) {
    Write-Host "[$($service.Port)] $($service.Desc)..." -NoNewline
    
    try {
        # Check if port is in use
        $connection = netstat -ano | Select-String ":$($service.Port)\s" | Select-String "LISTENING"
        
        if ($connection) {
            # Try to access health check endpoint
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:$($service.Port)/health" -TimeoutSec 2 -ErrorAction Stop
                
                if ($response.StatusCode -eq 200) {
                    Write-Host " [RUNNING]" -ForegroundColor Green
                    $runningCount++
                } else {
                    Write-Host " [ERROR]" -ForegroundColor Yellow
                    $stoppedCount++
                }
            } catch {
                Write-Host " [PORT OCCUPIED BUT SERVICE ERROR]" -ForegroundColor Yellow
                $stoppedCount++
            }
        } else {
            Write-Host " [STOPPED]" -ForegroundColor Gray
            $stoppedCount++
        }
    } catch {
        Write-Host " [CHECK FAILED]" -ForegroundColor Red
        $stoppedCount++
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Running: $runningCount / $($services.Count)" -ForegroundColor $(if ($runningCount -eq $services.Count) { "Green" } else { "Yellow" })
Write-Host "Stopped: $stoppedCount / $($services.Count)" -ForegroundColor $(if ($stoppedCount -gt 0) { "Gray" } else { "Green" })
Write-Host ""

if ($runningCount -eq $services.Count) {
    Write-Host "[STATUS] All services running normally!" -ForegroundColor Green
} elseif ($runningCount -gt 0) {
    Write-Host "[STATUS] Some services are running, please check stopped services" -ForegroundColor Yellow
} else {
    Write-Host "[STATUS] All services are stopped" -ForegroundColor Red
    Write-Host "[TIP] Run this command to start services: .\scripts\start-all-services.ps1" -ForegroundColor Yellow
}

Write-Host ""
