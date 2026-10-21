# Script instalasi Playwright browser ke drive D
$ErrorActionPreference = "Stop"

if (-not (Test-Path "D:\temp")) {
    New-Item -ItemType Directory -Force -Path "D:\temp" | Out-Null
}
if (-not (Test-Path "D:\playwright-browsers")) {
    New-Item -ItemType Directory -Force -Path "D:\playwright-browsers" | Out-Null
}

$env:TEMP = "D:\temp"
$env:TMP = "D:\temp"
$env:PLAYWRIGHT_BROWSERS_PATH = "D:\playwright-browsers"

Write-Host "Mengunduh Chromium ke D:\playwright-browsers dengan TEMP di D:\temp..."
npx playwright install chromium
