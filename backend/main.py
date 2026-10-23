import os
import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Import academic_models first to ensure all tables are registered
import backend.academic_models
import backend.models
import backend.auth_models
import backend.schedule_models

from backend.database import test_connection
from backend.academic_routes import router as academic_router
from backend.attendance_routes import router as attendance_router
from backend.session_routes import router as session_router
from backend.report_routes import router as report_router
from backend.admin_routes import router as admin_router
from backend.assignment_routes import router as assignment_router
from backend.timetable_routes import router as timetable_router
from backend.scheduled_session_routes import router as scheduled_session_router
from backend.history_routes import router as history_router
from backend.analytics_routes import router as analytics_router
from backend.student_history_routes import router as student_history_router
from backend.date_range_routes import router as date_range_router
from backend.combined_export_routes import router as combined_export_router
from backend.auth_routes import router as auth_router, login, LoginRequest
from backend.account_routes import router as account_router
from backend.teacher_dashboard_routes import router as teacher_dashboard_router
from backend.live_api_routes import router as live_api_router

app = FastAPI(
    title="YOLO Face Scanner Attendance System API",
    description="Full-stack AI biometric face recognition attendance API with MySQL persistence",
    version="1.0.0"
)

# Enable CORS for Vite frontend and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static photos directory
photos_dir = Path("F:/Yolo Face Scanner/yolo-face-scanner-attendance-system/public/student-photos")
if not photos_dir.is_dir():
    photos_dir = PROJECT_ROOT / "frontend" / "public" / "student-photos"
if photos_dir.is_dir():
    app.mount("/student-photos", StaticFiles(directory=str(photos_dir)), name="student-photos")

# Include core system routers
app.include_router(live_api_router)
app.include_router(session_router)
app.include_router(academic_router)
app.include_router(attendance_router)
app.include_router(report_router)
app.include_router(admin_router)
app.include_router(assignment_router)
app.include_router(timetable_router)
app.include_router(scheduled_session_router)
app.include_router(history_router)
app.include_router(analytics_router)
app.include_router(student_history_router)
app.include_router(date_range_router)
app.include_router(combined_export_router)
app.include_router(auth_router)
app.include_router(account_router)
app.include_router(teacher_dashboard_router)


# API v1 alias for login
@app.post("/api/v1/auth/login")
def api_v1_login(data: LoginRequest, db=Depends(backend.database.get_db) if "Depends" in globals() else None):
    from fastapi import Depends
    return login(data, db)


@app.get("/")
def home():
    return {
        "service": "YOLO Face Scanner Attendance API",
        "status": "running",
        "docs_url": "/docs",
        "health_url": "/api/health"
    }


@app.get("/api/health/database")
def database_health():
    test_connection()
    return {"database": "connected"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
