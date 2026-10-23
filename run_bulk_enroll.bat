@echo off
title AI Face Attendance - Bulk Student Enrollment
echo ============================================================
echo   AI Face Attendance System - Bulk Student Enrollment
echo ============================================================
echo.
echo Make sure you have placed student photos in:
echo   bulk_enrollment\photos\
echo.
echo Supported Photo Naming:
echo   ROLLNUMBER_FirstName_LastName.jpg  (e.g., 21BCS001_Aarav_Mehta.jpg)
echo   or ROLLNUMBER.jpg                  (e.g., 21BCS001.jpg)
echo.
echo Or supply:
echo   bulk_enrollment\students.csv
echo.
pause
echo.
echo Running AI Bulk Face Extraction and Database Enrollment...
echo.

"F:\Saurabh\Project\ATTENDANCE_FACE\.venv\Scripts\python.exe" "F:\Saurabh\Project\ATTENDANCE_FACE\ai\enrollment\bulk_enroll_all.py"

echo.
echo ============================================================
echo Bulk Enrollment Finished!
echo ============================================================
pause
