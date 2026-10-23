@echo off
title YOLO Face Scanner - System Launcher
color 0E
echo ========================================================
echo   Launching Full Face Attendance System
echo   1. Starting Backend API at http://127.0.0.1:8000
echo   2. Starting Frontend at http://localhost:5173
echo ========================================================

start "Backend API" cmd /k "cd /d F:\Saurabh\Project\ATTENDANCE_FACE && call .venv\Scripts\activate.bat && python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak >nul

start "Frontend App" cmd /k "cd /d ""F:\Yolo Face Scanner\yolo-face-scanner-attendance-system"" && npm run dev"

echo Both services launched in separate windows!
echo Backend Docs: http://localhost:8000/docs
echo Frontend App: http://localhost:5173
pause
