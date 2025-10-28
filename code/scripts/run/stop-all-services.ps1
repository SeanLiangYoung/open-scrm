# ============================================
# Stop All Backend Services
# ============================================

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Open SCRM - Stop All Services" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Define all service ports
$ports = @(7000, 7001, 7002, 7003, 7004, 7005, 7006, 7007, 7008, 7009)

Write-Host "[TIP] Preparing to stop services on ports 7000-7009..." -ForegroundColor Yellow
Write-Host ""

$killedCount = 0

foreach ($port in $ports) {
    Write-Host "[CHECK] Checking port $port..." -ForegroundColor Cyan
    
    try {
        # Find processes using the port
        $connections = netstat -ano | Select-String ":$port\s" | Select-String "LISTENING"
        
        if ($connections) {
            foreach ($connection in $connections) {
                # Extract PID
                $pid = $connection.ToString().Trim() -split '\s+' | Select-Object -Last 1
                
                if ($pid -match '^\d+$') {
                    try {
                        $process = Get-Process -Id $pid -ErrorAction Stop
                        Write-Host "[KILL] Port $port (PID: $pid, Process: $($process.ProcessName))" -ForegroundColor Yellow
                        Stop-Process -Id $pid -Force -ErrorAction Stop
                        $killedCount++
                        Write-Host "[OK] Killed" -ForegroundColor Green
                    } catch {
                        Write-Host "[WARN] Cannot kill process $pid" -ForegroundColor Red
                    }
                }
            }
        } else {
            Write-Host "[SKIP] Port $port is not in use" -ForegroundColor Gray
        }
    } catch {
        Write-Host "[ERROR] Error checking port ${port}: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Stop Complete" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Killed: $killedCount processes" -ForegroundColor $(if ($killedCount -gt 0) { "Green" } else { "Gray" })
Write-Host ""

if ($killedCount -eq 0) {
    Write-Host "[TIP] No running services found" -ForegroundColor Yellow
} else {
    Write-Host "[TIP] All services stopped" -ForegroundColor Green
}

Write-Host ""
