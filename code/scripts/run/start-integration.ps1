# Start Integration Service
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServicePath = Join-Path $ProjectRoot "services\integration-service"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Integration Service (Port: 7007)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $ServicePath)) {
    Write-Host "[ERROR] Service directory not found: $ServicePath" -ForegroundColor Red
    exit 1
}

Push-Location $ServicePath
try {
    Write-Host "[START] Starting integration-service..." -ForegroundColor Green
    pnpm dev
} finally {
    Pop-Location
}

