# Start Asset Service
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServicePath = Join-Path $ProjectRoot "services\asset-service"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Asset Service (Port: 7005)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $ServicePath)) {
    Write-Host "[ERROR] Service directory not found: $ServicePath" -ForegroundColor Red
    exit 1
}

Push-Location $ServicePath
try {
    Write-Host "[START] Starting asset-service..." -ForegroundColor Green
    pnpm dev
} finally {
    Pop-Location
}

