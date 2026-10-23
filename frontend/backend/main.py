"""
YOLO Face Scanner Attendance System — FastAPI Backend
Run with:
    pip install -r requirements.txt
    uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import datetime
import sqlite3
import os

app = FastAPI(
    title="YOLO Face Scanner Attendance System API",
    description="Backend service for college attendance, YOLO facial recognition matching, and faculty audit trails.",
    version="1.0.0"
)

# Enable CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows frontend running on port 3000 or production URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "attendance.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Students table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        roll_number TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        class_id TEXT NOT NULL,
        section TEXT NOT NULL,
        face_embedding_id TEXT,
        overall_attendance REAL DEFAULT 85.0
    )
    """)

    # Attendance sessions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL,
        subject_code TEXT NOT NULL,
        date TEXT NOT NULL,
        time_slot TEXT NOT NULL,
        teacher_id TEXT NOT NULL,
        status TEXT DEFAULT 'in_progress',
        created_at TEXT NOT NULL
    )
    """)

    # Attendance records table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attendance_records (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        status TEXT NOT NULL,
        method TEXT,
        confidence_score REAL,
        recorded_at TEXT NOT NULL,
        modified_by_teacher TEXT,
        modification_reason TEXT,
        FOREIGN KEY(session_id) REFERENCES sessions(id),
        FOREIGN KEY(student_id) REFERENCES students(id),
        UNIQUE(session_id, student_id)
    )
    """)

    # Audit log table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        action TEXT NOT NULL,
        teacher_id TEXT,
        student_id TEXT,
        previous_status TEXT,
        new_status TEXT,
        reason TEXT,
        details TEXT
    )
    """)

    conn.commit()
    conn.close()

init_db()

# Request & Response Models
class LoginRequest(BaseModel):
    username_or_email: str
    password: str

class ManualCorrectionRequest(BaseModel):
    student_id: str
    session_id: str
    teacher_id: str
    teacher_name: str
    reason: str
    new_status: str = "present"

class YoloFaceDetection(BaseModel):
    student_id: str
    session_id: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    bounding_box: Optional[dict] = None

@app.get("/")
def root():
    return {
        "service": "YOLO Face Scanner Attendance API",
        "status": "online",
        "version": "1.0.0",
        "docs_url": "/docs"
    }

@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.datetime.now().isoformat()}

@app.post("/api/v1/auth/login")
def faculty_login(req: LoginRequest):
    # Verified teacher accounts
    if req.username_or_email.lower() in ["dr.sharma@college.edu", "emp-fac-2018-042"] and req.password == "Teacher@123":
        return {
            "token": "bearer_jwt_token_dr_sharma_authorized",
            "teacher": {
                "id": "TCH-1001",
                "name": "Dr. Priya Sharma",
                "department": "Computer Science & Engineering",
                "role": "TEACHER"
            }
        }
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid faculty credentials")

@app.post("/api/v1/attendance/manual-correct")
def manual_correct(req: ManualCorrectionRequest):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now_str = datetime.datetime.now().strftime("%I:%M:%S %p")

    # Check if student already marked to prevent duplicates
    cursor.execute("SELECT status FROM attendance_records WHERE session_id = ? AND student_id = ?", 
                   (req.session_id, req.student_id))
    existing = cursor.fetchone()

    previous_status = existing[0] if existing else "absent"

    if existing and existing[0] == req.new_status:
        conn.close()
        return {"status": "unchanged", "message": f"Student is already marked as {req.new_status}"}

    # Upsert attendance record
    record_id = f"REC-{req.session_id}-{req.student_id}"
    cursor.execute("""
    INSERT INTO attendance_records (id, session_id, student_id, status, method, recorded_at, modified_by_teacher, modification_reason)
    VALUES (?, ?, ?, ?, 'manual', ?, ?, ?)
    ON CONFLICT(session_id, student_id) DO UPDATE SET
        status = excluded.status,
        method = excluded.method,
        modified_by_teacher = excluded.modified_by_teacher,
        modification_reason = excluded.modification_reason,
        recorded_at = excluded.recorded_at
    """, (record_id, req.session_id, req.student_id, req.new_status, now_str, req.teacher_name, req.reason))

    # Log in audit trail
    cursor.execute("""
    INSERT INTO audit_logs (timestamp, action, teacher_id, student_id, previous_status, new_status, reason, details)
    VALUES (?, 'MANUAL_CORRECTION', ?, ?, ?, ?, ?, ?)
    """, (now_str, req.teacher_id, req.student_id, previous_status, req.new_status, req.reason, 
          f"Manual override by {req.teacher_name}. Reason: {req.reason}"))

    conn.commit()
    conn.close()

    return {
        "status": "success",
        "student_id": req.student_id,
        "new_status": req.new_status,
        "recorded_by": req.teacher_name,
        "timestamp": now_str
    }

@app.post("/api/v1/yolo/match-face")
def match_face(detection: YoloFaceDetection):
    if detection.confidence < 0.85:
        return {"status": "low_confidence", "action": "sent_to_review_queue", "confidence": detection.confidence}

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now_str = datetime.datetime.now().strftime("%I:%M:%S %p")
    record_id = f"REC-{detection.session_id}-{detection.student_id}"

    cursor.execute("""
    INSERT INTO attendance_records (id, session_id, student_id, status, method, confidence_score, recorded_at)
    VALUES (?, ?, ?, 'present', 'face_recognition', ?, ?)
    ON CONFLICT(session_id, student_id) DO UPDATE SET
        status = 'present',
        method = 'face_recognition',
        confidence_score = excluded.confidence_score,
        recorded_at = excluded.recorded_at
    """, (record_id, detection.session_id, detection.student_id, detection.confidence, now_str))

    cursor.execute("""
    INSERT INTO audit_logs (timestamp, action, student_id, details)
    VALUES (?, 'AUTO_SCAN_MATCH', ?, ?)
    """, (now_str, detection.student_id, f"YOLO model verified face with {detection.confidence*100:.1f}% confidence"))

    conn.commit()
    conn.close()

    return {"status": "verified", "student_id": detection.student_id, "confidence": detection.confidence}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
