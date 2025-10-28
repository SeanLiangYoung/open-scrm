# Start Auth Service
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServicePath = Join-Path $ProjectRoot "services\auth-service"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Auth Service (Port: 7000)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $ServicePath)) {
    Write-Host "[ERROR] Service directory not found: $ServicePath" -ForegroundColor Red
    exit 1
}

Push-Location $ServicePath
try {
    Write-Host "[START] Starting auth-service..." -ForegroundColor Green
    pnpm dev
} finally {
    Pop-Location
}

