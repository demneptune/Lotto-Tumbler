@echo off
REM --------------------------------------
REM Mini batch file to serve LottoTumbler.html
REM using Python's simple HTTP server and open browser
REM --------------------------------------

REM 1️ Check if Python is installed
python --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo Python is not installed or not on PATH.
    echo Please install Python 3 and make sure 'python' works in command line.
    pause
    exit /b
)

REM 2️ Start a simple HTTP server on port 8000
REM    (current directory must contain LottoTumbler.html)
start "" python -m http.server 8000

REM 3️ Open default browser pointing to LottoTumbler.html
timeout /t 1 >nul
start "" http://127.0.0.1:8000/LottoTumbler.html

REM 4️ Optional: keep the batch window open so server runs
echo Server running at http://127.0.0.1:8000/
echo Press Ctrl+C in this window to stop the server.
pause
