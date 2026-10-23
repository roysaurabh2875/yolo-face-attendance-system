@echo off
title YOLO Face Attendance - Backend API (Port 8000)
color 0A
echo ========================================================
echo   Starting YOLO Face Attendance Backend API (FastAPI)
echo   Host: 127.0.0.1  Port: 8000
echo ========================================================
cd /d "%~dp0"
call .venv\Scripts\activate.bat
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
pause
