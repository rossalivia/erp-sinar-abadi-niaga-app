# Script eksekusi Playwright E2E Tests
$ErrorActionPreference = "Stop"

$env:TEMP = "D:\temp"
$env:TMP = "D:\temp"
$env:PLAYWRIGHT_BROWSERS_PATH = "D:\playwright-browsers"

Write-Host "Menjalankan Playwright E2E Tests..."
npx playwright test tests/e2e/01-auth-noindex.spec.ts
