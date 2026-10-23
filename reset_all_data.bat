@echo off
title AI Face Attendance - Clean Reset All Data
color 0C
echo ============================================================
echo   WARNING: YOU ARE ABOUT TO PURGE ALL SYSTEM DATA
echo ============================================================
echo   This will:
echo   1. Delete all student facial biometric embeddings.
echo   2. Delete all captured face photos and registry records.
echo   3. Delete all past attendance records and audit logs.
echo   4. Re-create clean administrator and faculty accounts:
echo        Admin:   admin       / Admin@123456
echo        Admin:   saurabh2875 / Saurabh@2875
echo        Teacher: faculty001  / Faculty@123456
echo ============================================================
echo.
set /p confirm=Type YES to confirm reset: 
if /i not "%confirm%"=="YES" (
    echo Reset cancelled.
    pause
    exit /b
)

echo.
echo Performing complete system purge...
"F:\Saurabh\Project\ATTENDANCE_FACE\.venv\Scripts\python.exe" "F:\Saurabh\Project\ATTENDANCE_FACE\backend\reset_database_and_biometrics.py"
echo.
pause
