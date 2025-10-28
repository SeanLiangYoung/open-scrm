# Start Customer Service
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServicePath = Join-Path $ProjectRoot "services\customer-service"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Customer Service (Port: 7002)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $ServicePath)) {
    Write-Host "[ERROR] Service directory not found: $ServicePath" -ForegroundColor Red
    exit 1
}

Push-Location $ServicePath
try {
    Write-Host "[START] Starting customer-service..." -ForegroundColor Green
    pnpm dev
} finally {
    Pop-Location
}

