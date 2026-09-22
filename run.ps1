Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Starting MoneyArnold - Financial Buddy" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "backend")

if (Test-Path "..\.venv\Scripts\Activate.ps1") {
    Write-Host "Activating virtual environment (.venv)..." -ForegroundColor Yellow
    & "..\.venv\Scripts\Activate.ps1"
} elseif (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "Activating virtual environment (backend\venv)..." -ForegroundColor Yellow
    & "venv\Scripts\Activate.ps1"
}

Write-Host "`nServer launching at: http://localhost:8000`n" -ForegroundColor Green
python -m uvicorn app.main:app --reload --port 8000
