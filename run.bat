@echo off
echo ========================================================
echo   Starting MoneyArnold - Financial Buddy
echo ========================================================
echo.

cd /d "%~dp0backend"

REM Check if root .venv exists
if exist "..\.venv\Scripts\activate.bat" (
    echo Activating virtual environment from .venv...
    call "..\.venv\Scripts\activate.bat"
) else if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment from backend\venv...
    call "venv\Scripts\activate.bat"
)

echo.
echo Starting FastAPI server with Azure AI Foundry integration...
echo Open your browser at: http://localhost:8000
echo.
python -m uvicorn app.main:app --reload --port 8000

pause
