import os
import re
import json
import time
import uuid
import base64
from datetime import datetime, date, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any

import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session

from backend.database import get_db, SessionLocal
from backend.models import Student, AttendanceSession, Attendance, AttendanceAudit, Subject, Enrollment
from backend.academic_models import Teacher, AcademicClass, TeachingAssignment, ClassStudentAssignment, Classroom, Timetable
from backend.schedule_models import AttendanceSessionSchedule, AttendanceSessionRoster
from backend.auth_models import UserAccount
from backend.auth_security import get_current_user, create_access_token, ACCESS_TOKEN_MINUTES
from backend.password_security import hash_password

router = APIRouter(tags=["Live Attendance & YOLO Integration"])

PROJECT_DIR = Path(__file__).resolve().parent.parent
PRIVATE_DIR = Path(os.environ.get("LOCALAPPDATA", "")) / "FaceAttendancePrivate"
YOLO_WEIGHTS = PROJECT_DIR / "ai" / "weights" / "yolov8n-face.pt"

# Global lazy loaders for AI models
_yolo_model = None
_face_app = None
_embeddings_cache = None


def get_yolo_model():
    global _yolo_model
    if _yolo_model is None:
        if YOLO_WEIGHTS.is_file():
            from ultralytics import YOLO
            _yolo_model = YOLO(str(YOLO_WEIGHTS))
        else:
            print(f"Warning: YOLO weights not found at {YOLO_WEIGHTS}")
    return _yolo_model


def get_face_embeddings(force_reload: bool = False):
    global _embeddings_cache
    if force_reload or _embeddings_cache is None:
        emb_file = PRIVATE_DIR / "embeddings.npz"
        if not emb_file.is_file():
            emb_file = PROJECT_DIR / "embeddings.npz"

        students_file = PRIVATE_DIR / "students.json"
        if not students_file.is_file():
            students_file = PROJECT_DIR / "students.json"

        lookup = {}
        if students_file.is_file():
            try:
                with open(students_file, "r", encoding="utf-8") as f:
                    students_list = json.load(f)
                    for s in students_list:
                        lookup[str(s["student_id"])] = s
            except Exception as e:
                print(f"Error loading students.json: {e}")

        if emb_file.is_file():
            try:
                data = np.load(str(emb_file), allow_pickle=False)
                student_ids = data["student_ids"].astype(str)
                embeddings = data["embeddings"].astype(np.float32)
                norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
                embeddings = embeddings / np.maximum(norms, 1e-8)
                _embeddings_cache = (student_ids, embeddings, lookup)
            except Exception as e:
                print(f"Error loading embeddings.npz: {e}")
                _embeddings_cache = ([], None, lookup)
        else:
            _embeddings_cache = ([], None, lookup)
    return _embeddings_cache


# -------------------------------------------------------------
# 1. System Health
# -------------------------------------------------------------
@router.get("/api/health")
def system_health():
    yolo_ready = YOLO_WEIGHTS.is_file()
    emb_ready = (PRIVATE_DIR / "embeddings.npz").is_file() or (PROJECT_DIR / "embeddings.npz").is_file()
    return {
        "status": "healthy",
        "service": "YOLO Face Attendance System API",
        "timestamp": datetime.now().isoformat(),
        "database": "connected",
        "yolo_model_available": yolo_ready,
        "face_embeddings_available": emb_ready
    }


# -------------------------------------------------------------
# 2. Registered Students
# -------------------------------------------------------------
@router.get("/api/students")
def get_students(db: Session = Depends(get_db)):
    students = db.query(Student).all()
    _, _, lookup = get_face_embeddings()

    # Calculate real-time cumulative attendance from posted/finalized sessions
    total_finalized = db.query(AttendanceSession).filter(AttendanceSession.status == "FINALIZED").count()
    attended_counts = {}
    if total_finalized > 0:
        rows = (
            db.query(Attendance.student_id, func.count(Attendance.attendance_id))
            .join(AttendanceSession, Attendance.session_id == AttendanceSession.session_id)
            .filter(AttendanceSession.status == "FINALIZED", Attendance.status == "PRESENT")
            .group_by(Attendance.student_id)
            .all()
        )
        attended_counts = {r[0]: r[1] for r in rows}

    res = []
    for s in students:
        info = lookup.get(s.student_id, {})
        attended = attended_counts.get(s.student_id, 0)
        pct = round((attended / total_finalized) * 100, 1) if total_finalized > 0 else 0.0
        res.append({
            "id": s.student_id,
            "rollNumber": s.roll_number,
            "name": s.name,
            "email": info.get("email", f"{s.roll_number.lower()}@students.college.edu"),
            "avatarUrl": f"/student-photos/{s.student_id}.jpg",
            "photoUrl": f"/api/students/{s.student_id}/photo",
            "classId": "SU1",
            "className": "III SU-1",
            "section": s.section or "SU-1",
            "department": s.department or "CSE",
            "overallAttendancePercentage": pct,
            "totalLecturesAttended": attended,
            "totalLecturesConducted": total_finalized,
            "faceRegistered": s.student_id in lookup or True,
            "faceEmbeddingId": f"EMB-512D-{s.roll_number}"
        })
    return res


@router.get("/api/students/{student_id}/photo")
def get_student_photo(student_id: str, db: Session = Depends(get_db)):
    # 1. Check enrollment folder
    enroll_photo = PRIVATE_DIR / "enrollment" / student_id / "1.jpg"
    if enroll_photo.is_file():
        return FileResponse(str(enroll_photo), media_type="image/jpeg")

    # 2. Check by student_id or roll number in DB
    student = db.query(Student).filter(
        (Student.student_id == student_id) | (Student.roll_number == student_id)
    ).first()

    if student:
        enroll_photo2 = PRIVATE_DIR / "enrollment" / student.student_id / "1.jpg"
        if enroll_photo2.is_file():
            return FileResponse(str(enroll_photo2), media_type="image/jpeg")

        bulk_dir = PROJECT_DIR / "bulk_enrollment" / "photos"
        matches = list(bulk_dir.glob(f"{student.roll_number}*"))
        if matches and matches[0].is_file():
            return FileResponse(str(matches[0]), media_type="image/jpeg")

    # 3. Direct glob in bulk photos
    bulk_dir = PROJECT_DIR / "bulk_enrollment" / "photos"
    matches = list(bulk_dir.glob(f"{student_id}*"))
    if matches and matches[0].is_file():
        return FileResponse(str(matches[0]), media_type="image/jpeg")

    # 4. Fallback initials SVG
    initials = (student.name[:2] if student and student.name else student_id[:2]).upper()
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="32" fill="#2563eb"/>
      <text x="50%" y="54%" font-family="system-ui, sans-serif" font-size="22" font-weight="bold" fill="#ffffff" dominant-baseline="middle" text-anchor="middle">{initials}</text>
    </svg>"""
    return Response(content=svg, media_type="image/svg+xml")


@router.get("/api/students/by-roll/{roll_number}/photo")
def get_student_photo_by_roll(roll_number: str, db: Session = Depends(get_db)):
    return get_student_photo(roll_number, db)


@router.get("/api/students/{student_id}/history")
def get_student_attendance_history(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(
        (Student.student_id == student_id) | (Student.roll_number == student_id)
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    actual_id = student.student_id

    records = (
        db.query(Attendance, AttendanceSession, Subject)
        .join(AttendanceSession, Attendance.session_id == AttendanceSession.session_id)
        .outerjoin(Subject, AttendanceSession.subject_id == Subject.subject_id)
        .filter(Attendance.student_id == actual_id)
        .order_by(AttendanceSession.session_id.desc())
        .all()
    )

    # Fetch audit logs to obtain any faculty override reason for manual records
    att_ids = [att.attendance_id for att, _, _ in records]
    audits = (
        db.query(AttendanceAudit)
        .filter(AttendanceAudit.attendance_id.in_(att_ids))
        .order_by(AttendanceAudit.changed_at.desc())
        .all()
    ) if att_ids else []
    audit_by_att_id = {}
    for a in audits:
        if a.attendance_id not in audit_by_att_id:
            audit_by_att_id[a.attendance_id] = a

    history = []
    for att, sess, subj in records:
        time_slot = "09:30 AM - 12:15 PM"
        audit = audit_by_att_id.get(att.attendance_id)
        is_manual = (att.source == "MANUAL")

        if is_manual:
            method = "manual"
            notes = audit.reason if audit else "Faculty Manual Override"
        elif att.source == "FACE" or att.status == "PRESENT":
            method = "face_recognition"
            notes = f"Recorded in Session #{sess.session_id} ({sess.status})"
        else:
            method = "none"
            notes = f"Recorded in Session #{sess.session_id} ({sess.status})"

        history.append({
            "session_id": sess.session_id,
            "date": str(sess.session_date),
            "period": sess.period_number,
            "subject": subj.subject_name if subj else "Competitive Programming",
            "subject_code": subj.subject_code if subj else f"CP{300 + sess.period_number}",
            "status": att.status.lower(),
            "method": method,
            "time": time_slot,
            "notes": notes
        })

    return {
        "student_id": actual_id,
        "roll_number": student.roll_number,
        "name": student.name,
        "total_records": len(history),
        "history": history
    }


# -------------------------------------------------------------
# 3. Active Session Management
# -------------------------------------------------------------
def get_or_create_active_session(db: Session) -> AttendanceSession:
    # Look for ACTIVE or REVIEW session first
    session = db.query(AttendanceSession).filter(
        AttendanceSession.status.in_(["ACTIVE", "REVIEW"])
    ).order_by(AttendanceSession.session_id.desc()).first()

    if session:
        return session

    # If all existing sessions are FINALIZED, create a new session for the next period
    latest_today = db.query(AttendanceSession).filter(
        AttendanceSession.session_date == date.today()
    ).order_by(AttendanceSession.period_number.desc()).first()

    next_period = (latest_today.period_number + 1) if latest_today else 1
    subj = db.query(Subject).first()
    subj_id = subj.subject_id if subj else 1

    new_session = AttendanceSession(
        subject_id=subj_id,
        section="SU-1",
        session_date=date.today(),
        period_number=next_period,
        status="REVIEW",
        started_at=None
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session


@router.get("/api/sessions/active")
def get_active_session_data(db: Session = Depends(get_db)):
    session = get_or_create_active_session(db)
    subject = db.get(Subject, session.subject_id)
    students = db.query(Student).filter(Student.is_active == True).all()

    # Get attendance records for this session
    attendance_rows = db.query(Attendance).filter(Attendance.session_id == session.session_id).all()
    attendance_by_id = {a.student_id: a for a in attendance_rows}

    # Fetch audit logs to see manual teacher edits
    audits = db.query(AttendanceAudit).join(Attendance).filter(Attendance.session_id == session.session_id).all()
    audit_by_att_id = {audit.attendance_id: audit for audit in audits}

    all_records = []
    present_count = 0
    absent_count = 0

    for s in students:
        rec = attendance_by_id.get(s.student_id)
        current_status = rec.status.lower() if rec else "absent"
        if current_status == "present":
            present_count += 1
        else:
            absent_count += 1

        is_manual = bool(rec and rec.source == "MANUAL")
        audit_entry = audit_by_att_id.get(rec.attendance_id) if (rec and is_manual) else None
        all_records.append({
            "id": f"REC-{session.session_id}-{s.student_id}",
            "sessionId": str(session.session_id),
            "studentId": s.student_id,
            "studentName": s.name,
            "rollNumber": s.roll_number,
            "classId": "SU1",
            "className": "III SU-1",
            "section": s.section or "SU-1",
            "subjectCode": subject.subject_code if subject else "CP301",
            "subjectName": subject.subject_name if subject else "Competitive Programming",
            "date": session.session_date.isoformat(),
            "timeSlot": "09:30 AM - 12:15 PM",
            "status": current_status,
            "method": "manual" if is_manual else ("face_recognition" if (rec and rec.source == "FACE") else None),
            "confidenceScore": 0.965 if (rec and rec.source == "FACE") else None,
            "timestamp": rec.marked_at.strftime("%I:%M:%S %p") if (rec and rec.marked_at) else None,
            "modifiedByTeacherName": audit_entry.changed_by if (is_manual and audit_entry) else None,
            "modificationReason": audit_entry.reason if (is_manual and audit_entry) else None,
            "modifiedAt": audit_entry.changed_at.strftime("%I:%M:%S %p") if (is_manual and audit_entry) else None
        })

    status_mapped = "in_progress" if session.status == "ACTIVE" else ("scheduled" if session.status == "REVIEW" else "finalized")

    return {
        "session": {
            "id": str(session.session_id),
            "classId": "SU1",
            "className": "III SU-1",
            "section": session.section or "SU-1",
            "subjectCode": subject.subject_code if subject else "CP301",
            "subjectName": subject.subject_name if subject else "Competitive Programming",
            "date": session.session_date.isoformat(),
            "timeSlot": "09:30 AM - 12:15 PM",
            "room": "Room 301",
            "teacherId": "TCH-1001",
            "teacherName": "Dr. Priya Sharma",
            "status": status_mapped,
            "totalStudents": len(students),
            "presentCount": present_count,
            "absentCount": absent_count
        },
        "records": all_records,
        "totalStudents": len(students),
        "presentCount": present_count,
        "absentCount": absent_count
    }


@router.post("/api/sessions/start-active")
def start_active_session(db: Session = Depends(get_db)):
    session = get_or_create_active_session(db)
    session.status = "ACTIVE"
    if not session.started_at:
        session.started_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "success", "session_status": "in_progress", "session_id": session.session_id}


@router.post("/api/sessions/pause-active")
def pause_active_session(db: Session = Depends(get_db)):
    session = get_or_create_active_session(db)
    session.status = "REVIEW"
    session.ended_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "success", "session_status": "scheduled", "session_id": session.session_id}


@router.post("/api/sessions/finalize-active")
def finalize_active_session(db: Session = Depends(get_db)):
    session = get_or_create_active_session(db)
    session.status = "FINALIZED"
    session.ended_at = datetime.now(timezone.utc)

    # Ensure all unmarked students are explicitly marked absent
    students = db.query(Student).filter(Student.is_active == True).all()
    existing_records = {a.student_id: a for a in db.query(Attendance).filter(Attendance.session_id == session.session_id).all()}

    for s in students:
        if s.student_id not in existing_records:
            db.add(Attendance(
                session_id=session.session_id,
                student_id=s.student_id,
                status="ABSENT",
                source="SYSTEM",
                marked_at=datetime.now(timezone.utc)
            ))
    db.commit()
    return {"status": "success", "session_status": "finalized", "session_id": session.session_id}


@router.post("/api/sessions/submit-and-reset")
def submit_and_reset_session(db: Session = Depends(get_db)):
    """
    Submits current attendance session to permanent MySQL records, seals it as FINALIZED,
    and initializes a clean next session so the system resets for the next class.
    """
    # 1. Finalize the active or review session
    session = db.query(AttendanceSession).filter(
        AttendanceSession.status.in_(["ACTIVE", "REVIEW"])
    ).order_by(AttendanceSession.session_id.desc()).first()

    if not session:
        session = db.query(AttendanceSession).order_by(AttendanceSession.session_id.desc()).first()

    prev_session_id = None
    if session:
        session.status = "FINALIZED"
        session.ended_at = datetime.now(timezone.utc)
        prev_session_id = session.session_id

        # Mark all unmarked students as absent
        students = db.query(Student).filter(Student.is_active == True).all()
        existing_records = {
            a.student_id: a for a in db.query(Attendance).filter(Attendance.session_id == session.session_id).all()
        }
        for s in students:
            if s.student_id not in existing_records:
                db.add(Attendance(
                    session_id=session.session_id,
                    student_id=s.student_id,
                    status="ABSENT",
                    source="SYSTEM",
                    marked_at=datetime.now(timezone.utc)
                ))
        db.commit()

    # 2. Create the next clean session
    subj_id = session.subject_id if session else 1
    next_period = (session.period_number + 1) if session else 1

    new_session = AttendanceSession(
        subject_id=subj_id,
        section="SU-1",
        session_date=date.today(),
        period_number=next_period,
        status="REVIEW",
        started_at=None
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    return {
        "status": "success",
        "message": "Current session submitted & finalized. System reset for next attendance session.",
        "previous_session_id": prev_session_id,
        "new_session_id": new_session.session_id,
        "new_period": new_session.period_number
    }


# -------------------------------------------------------------
# 4. Posted Attendance Records & Official Registers (Finalized Sessions Only)
# -------------------------------------------------------------
@router.get("/api/sessions/posted")
def get_posted_sessions(db: Session = Depends(get_db)):
    """
    Returns all finalized attendance sessions posted by faculty.
    Attendance reports and registers can ONLY be viewed and downloaded from here.
    """
    sessions = db.query(AttendanceSession).filter(
        AttendanceSession.status == "FINALIZED"
    ).order_by(AttendanceSession.session_id.desc()).all()

    total_active_students = db.query(Student).filter(Student.is_active == True).count()

    results = []
    for s in sessions:
        subj = db.get(Subject, s.subject_id)
        present_cnt = db.query(Attendance).filter(
            Attendance.session_id == s.session_id,
            Attendance.status == "PRESENT"
        ).count()
        absent_cnt = max(0, total_active_students - present_cnt)
        rate = round((present_cnt / total_active_students * 100), 1) if total_active_students > 0 else 0.0

        results.append({
            "id": f"SES-{s.session_id:03d}",
            "session_id": s.session_id,
            "subject_code": subj.subject_code if subj else "CP301",
            "subject_name": subj.subject_name if subj else "Competitive Programming",
            "class_name": "III SU-1",
            "section": s.section or "SU-1",
            "date": s.session_date.isoformat(),
            "time_slot": "09:30 AM - 12:15 PM",
            "period_number": s.period_number,
            "teacher_name": "Dr. Priya Sharma",
            "total_students": total_active_students,
            "present_count": present_cnt,
            "absent_count": absent_cnt,
            "attendance_rate": rate,
            "finalized_at": s.ended_at.strftime("%I:%M %p") if s.ended_at else "Finalized",
            "status": "FINALIZED"
        })

    return results


@router.get("/api/sessions/posted/{session_id}/records")
def get_posted_session_records(session_id: int, db: Session = Depends(get_db)):
    """
    Returns student-level breakdown for a specific posted attendance session.
    """
    session = db.get(AttendanceSession, session_id)
    if not session or session.status != "FINALIZED":
        raise HTTPException(status_code=404, detail="Finalized attendance session not found")

    subj = db.get(Subject, session.subject_id)
    students = db.query(Student).filter(Student.is_active == True).order_by(Student.roll_number.asc()).all()
    attendance_rows = {
        a.student_id: a for a in db.query(Attendance).filter(Attendance.session_id == session_id).all()
    }

    records = []
    for s in students:
        rec = attendance_rows.get(s.student_id)
        status = rec.status.lower() if rec else "absent"
        source = rec.source if rec else "SYSTEM"
        timestamp = rec.marked_at.strftime("%I:%M:%S %p") if (rec and rec.marked_at) else None

        records.append({
            "student_id": s.student_id,
            "roll_number": s.roll_number,
            "student_name": s.name,
            "department": s.department or "CSE",
            "section": s.section or "SU-1",
            "status": status,
            "source": source,
            "timestamp": timestamp,
            "subject_code": subj.subject_code if subj else "CP301",
            "subject_name": subj.subject_name if subj else "Competitive Programming",
            "date": session.session_date.isoformat(),
            "time_slot": "09:30 AM - 12:15 PM"
        })

    return {
        "session_id": session_id,
        "date": session.session_date.isoformat(),
        "subject_name": subj.subject_name if subj else "Competitive Programming",
        "subject_code": subj.subject_code if subj else "CP301",
        "total_students": len(students),
        "records": records
    }


@router.get("/api/sessions/posted/master-csv")
def get_master_attendance_csv(db: Session = Depends(get_db)):
    """
    Generates and returns the authoritative Consolidated Master Attendance CSV 
    matrix across all posted/finalized sessions. Directly queries MySQL database.
    """
    sessions = db.query(AttendanceSession).filter(
        AttendanceSession.status == "FINALIZED"
    ).order_by(AttendanceSession.session_id.asc()).all()

    if not sessions:
        raise HTTPException(status_code=400, detail="No posted attendance sessions found to export")

    students = db.query(Student).filter(Student.is_active == True).order_by(Student.roll_number.asc()).all()
    session_ids = [s.session_id for s in sessions]

    # Pre-fetch all attendance records for finalized sessions
    attendance_rows = db.query(Attendance).filter(Attendance.session_id.in_(session_ids)).all()
    # Map (session_id, student_id) -> status
    att_map = {(a.session_id, a.student_id): (a.status or "ABSENT").upper() for a in attendance_rows}

    # Fetch subjects map
    subjects_map = {sub.subject_id: sub for sub in db.query(Subject).all()}

    # Headers
    headers = [
        "Roll Number",
        "Student Name",
        "Class",
        "Section"
    ]
    for s in sessions:
        sub = subjects_map.get(s.subject_id)
        sub_code = sub.subject_code if sub else f"SUB{s.subject_id}"
        d_str = s.session_date.strftime("%Y-%m-%d") if s.session_date else "N/A"
        headers.append(f"SES-{s.session_id:03d} ({sub_code} - {d_str} P{s.period_number})")

    headers.extend([
        "Total Classes Attended",
        "Total Classes Held",
        "Attendance Rate (%)",
        "Eligibility Status"
    ])

    total_held = len(sessions)
    csv_rows = [",".join(f'"{h}"' for h in headers)]

    for s in students:
        row = [
            f'"{s.roll_number}"',
            f'"{s.name}"',
            '"III SU-1"',
            f'"{s.section or "SU-1"}"'
        ]
        attended_count = 0
        for sess in sessions:
            status = att_map.get((sess.session_id, s.student_id), "ABSENT")
            if status == "PRESENT":
                attended_count += 1
                row.append('"PRESENT"')
            else:
                row.append('"ABSENT"')

        pct = round((attended_count / total_held) * 100, 1) if total_held > 0 else 0.0
        eligible = "ELIGIBLE" if pct >= 75.0 else "DEFAULTER (<75%)"

        row.extend([
            str(attended_count),
            str(total_held),
            f'"{pct}%"',
            f'"{eligible}"'
        ])
        csv_rows.append(",".join(row))

    csv_content = "\r\n".join(csv_rows)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="Master_Semester_Attendance_Register_III_SU1_{date.today().isoformat()}.csv"'
        }
    )


# -------------------------------------------------------------
# 4. Manual Attendance Correction
# -------------------------------------------------------------
class ManualCorrectionBody(BaseModel):
    student_id: str
    session_id: Optional[str] = None
    teacher_id: Optional[str] = "TCH-1001"
    teacher_name: Optional[str] = "Dr. Priya Sharma"
    reason: str
    status: Optional[str] = None
    new_status: Optional[str] = None
    user_role: Optional[str] = "TEACHER"


@router.post("/api/attendance/manual-correct")
@router.post("/api/v1/attendance/manual-correct")
def manual_correction(body: ManualCorrectionBody, db: Session = Depends(get_db)):
    new_status = (body.status or body.new_status or "present").strip().upper()
    reason = body.reason.strip() or "Teacher manual override"
    student_id = body.student_id.strip()

    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    session = None
    if body.session_id and body.session_id.isdigit():
        session = db.get(AttendanceSession, int(body.session_id))
    if not session:
        session = get_or_create_active_session(db)

    # Security check: Once finalized, ONLY ADMIN has highest power to modify attendance
    if session.status == "FINALIZED":
        role = (body.user_role or "").strip().upper()
        if role != "ADMIN":
            raise HTTPException(
                status_code=403,
                detail="Attendance has been posted and finalized. Only an Administrator has the authority to make changes."
            )

    # Find or create Attendance record
    rec = db.query(Attendance).filter(
        Attendance.session_id == session.session_id,
        Attendance.student_id == student.student_id
    ).first()

    prev_status = rec.status if rec else "ABSENT"

    if rec:
        rec.status = new_status
        rec.source = "MANUAL"
        rec.marked_at = datetime.now(timezone.utc)
    else:
        rec = Attendance(
            session_id=session.session_id,
            student_id=student.student_id,
            status=new_status,
            source="MANUAL",
            marked_at=datetime.now(timezone.utc)
        )
        db.add(rec)
        db.flush()

    # Log in audit trail
    db.add(AttendanceAudit(
        attendance_id=rec.attendance_id,
        previous_status=prev_status,
        new_status=new_status,
        changed_by=body.teacher_name or "Authorized Faculty",
        reason=reason,
        changed_at=datetime.now(timezone.utc)
    ))
    db.commit()

    return {
        "status": "success",
        "student_id": student.student_id,
        "new_status": new_status.lower(),
        "recorded_by": body.teacher_name or "Faculty",
        "timestamp": datetime.now().strftime("%I:%M:%S %p")
    }


# -------------------------------------------------------------
# 5. Audit Logs
# -------------------------------------------------------------
@router.get("/api/audit-logs")
def get_audit_logs(db: Session = Depends(get_db)):
    audits = (
        db.query(AttendanceAudit, Attendance, Student)
        .join(Attendance, AttendanceAudit.attendance_id == Attendance.attendance_id)
        .join(Student, Attendance.student_id == Student.student_id)
        .order_by(AttendanceAudit.changed_at.desc())
        .limit(100)
        .all()
    )

    results = []
    for audit, att, stu in audits:
        results.append({
            "id": f"AUD-{audit.audit_id}",
            "timestamp": audit.changed_at.strftime("%I:%M:%S %p"),
            "action": "MANUAL_CORRECTION" if att.source == "MANUAL" else "AUTO_SCAN_MATCH",
            "teacherName": audit.changed_by,
            "studentId": stu.student_id,
            "studentName": stu.name,
            "previousStatus": audit.previous_status.lower(),
            "newStatus": audit.new_status.lower(),
            "reason": audit.reason,
            "details": f"Status adjusted from {audit.previous_status} to {audit.new_status} by {audit.changed_by}. Reason: {audit.reason}"
        })
    return results


# -------------------------------------------------------------
# 6. YOLO Live Face Detection from Webcam Frames
# -------------------------------------------------------------
class DetectFrameBody(BaseModel):
    image: str = Field(..., description="Base64 encoded JPEG/PNG frame")
    session_id: Optional[str] = None
    min_confidence: Optional[float] = 0.50


@router.post("/api/yolo/detect-frame")
def detect_frame_yolo(body: DetectFrameBody, db: Session = Depends(get_db)):
    """
    Receives camera frame from React frontend, runs YOLOv8 face detection,
    computes face embeddings, identifies student, and records attendance.
    """
    raw_b64 = body.image
    if "," in raw_b64:
        raw_b64 = raw_b64.split(",", 1)[1]

    try:
        img_bytes = base64.b64decode(raw_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Could not decode image")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image format: {e}")

    h_img, w_img = frame.shape[:2]
    yolo = get_yolo_model()
    student_ids, embeddings, lookup = get_face_embeddings()

    detections = []

    # Run YOLO face detection
    if yolo is not None:
        try:
            results = yolo.predict(source=frame, conf=0.40, imgsz=640, device="cpu", verbose=False)
            boxes = results[0].boxes

            session = None
            if body.session_id and body.session_id.isdigit():
                session = db.get(AttendanceSession, int(body.session_id))
            if not session:
                session = get_or_create_active_session(db)

            # Lazy load InsightFace for recognition if needed
            global _face_app
            if _face_app is None:
                try:
                    from insightface.app import FaceAnalysis
                    _face_app = FaceAnalysis(
                        name="buffalo_l",
                        providers=["CPUExecutionProvider"],
                        allowed_modules=["detection", "recognition"]
                    )
                    _face_app.prepare(ctx_id=-1, det_size=(640, 640))
                except Exception as ex:
                    print(f"InsightFace load warning: {ex}")

            detected_faces = []
            if _face_app is not None:
                try:
                    detected_faces = _face_app.get(frame)
                except Exception as ex:
                    print(f"FaceAnalysis inference error: {ex}")

            for i, box in enumerate(boxes):
                xyxy = box.xyxy[0].cpu().numpy()
                x1, y1, x2, y2 = map(int, xyxy)
                conf = float(box.conf[0].cpu().numpy())

                # Normalized percentages for frontend bounding box CSS
                x_pct = max(0.0, min(100.0, (x1 / w_img) * 100))
                y_pct = max(0.0, min(100.0, (y1 / h_img) * 100))
                w_pct = max(2.0, min(100.0, ((x2 - x1) / w_img) * 100))
                h_pct = max(2.0, min(100.0, ((y2 - y1) / h_img) * 100))

                matched_student = None
                matched_conf = conf

                # Compare with InsightFace extracted embeddings
                if detected_faces and len(embeddings) > 0:
                    for f in detected_faces:
                        fx1, fy1, fx2, fy2 = f.bbox
                        # Check overlap with YOLO box
                        if max(x1, fx1) < min(x2, fx2) and max(y1, fy1) < min(y2, fy2):
                            if f.embedding is not None:
                                emb = f.embedding / np.maximum(np.linalg.norm(f.embedding), 1e-8)
                                sims = np.dot(embeddings, emb)
                                best_idx = int(np.argmax(sims))
                                best_sim = float(sims[best_idx])
                                if best_sim >= 0.45:
                                    s_id = str(student_ids[best_idx])
                                    matched_student = lookup.get(s_id)
                                    matched_conf = best_sim
                            break

                if matched_student:
                    student_id = matched_student.get("student_id")
                    student_name = matched_student.get("name")
                    roll_number = matched_student.get("roll_number")

                    attendance_state = "marked_now"
                    # Mark present in database session
                    if session and session.status in ("ACTIVE", "REVIEW"):
                        rec = db.query(Attendance).filter(
                            Attendance.session_id == session.session_id,
                            Attendance.student_id == student_id
                        ).first()
                        if not rec:
                            rec = Attendance(
                                session_id=session.session_id,
                                student_id=student_id,
                                status="PRESENT",
                                source="FACE",
                                marked_at=datetime.now(timezone.utc)
                            )
                            db.add(rec)
                            db.commit()
                            attendance_state = "marked_now"
                        elif rec.status == "PRESENT":
                            attendance_state = "already_marked"
                        else:
                            rec.status = "PRESENT"
                            rec.source = "FACE"
                            rec.marked_at = datetime.now(timezone.utc)
                            db.commit()
                            attendance_state = "marked_now"

                    detections.append({
                        "id": f"det-{i}-{int(time.time()*1000)}",
                        "student_id": student_id,
                        "name": student_name,
                        "roll_number": roll_number,
                        "label": f"{student_name} [{roll_number}]",
                        "confidence": f"{matched_conf * 100:.1f}%",
                        "confidence_score": matched_conf,
                        "attendance_state": attendance_state,
                        "message": "Already Marked" if attendance_state == "already_marked" else "Attendance Marked",
                        "x": round(x_pct, 1),
                        "y": round(y_pct, 1),
                        "w": round(w_pct, 1),
                        "h": round(h_pct, 1),
                        "status": "recognized"
                    })
                else:
                    detections.append({
                        "id": f"unrec-{i}-{int(time.time()*1000)}",
                        "label": "Face Detected",
                        "confidence": f"{conf * 100:.1f}%",
                        "confidence_score": conf,
                        "x": round(x_pct, 1),
                        "y": round(y_pct, 1),
                        "w": round(w_pct, 1),
                        "h": round(h_pct, 1),
                        "status": "unrecognized"
                    })
        except Exception as ex:
            print(f"YOLO detection exception: {ex}")

    return {
        "status": "success",
        "face_count": len(detections),
        "detections": detections,
        "processed_at": datetime.now().isoformat()
    }


# -------------------------------------------------------------
# 7. Direct YOLO Match (Compatibility with YOLO client)
# -------------------------------------------------------------
class YoloDirectMatch(BaseModel):
    student_id: str
    session_id: Optional[str] = "2"
    confidence: float = Field(default=0.95, ge=0.0, le=1.0)


@router.post("/api/v1/yolo/match-face")
def direct_yolo_match(data: YoloDirectMatch, db: Session = Depends(get_db)):
    session = None
    if data.session_id and data.session_id.isdigit():
        session = db.get(AttendanceSession, int(data.session_id))
    if not session:
        session = get_or_create_active_session(db)

    student = db.get(Student, data.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    rec = db.query(Attendance).filter(
        Attendance.session_id == session.session_id,
        Attendance.student_id == student.student_id
    ).first()

    if not rec:
        rec = Attendance(
            session_id=session.session_id,
            student_id=student.student_id,
            status="PRESENT",
            source="FACE",
            marked_at=datetime.now(timezone.utc)
        )
        db.add(rec)
    else:
        rec.status = "PRESENT"
        rec.source = "FACE"
        rec.marked_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "status": "verified",
        "student_id": student.student_id,
        "confidence": data.confidence,
        "recorded_at": datetime.now().strftime("%I:%M:%S %p")
    }


# =============================================================
# 8. ADMIN DASHBOARD APIS (ACADEMIC GOVERNANCE & BIOMETRICS)
# =============================================================

@router.get("/api/admin/overview-stats")
def get_admin_overview_stats(db: Session = Depends(get_db)):
    total_students = db.query(Student).count()
    total_active_students = db.query(Student).filter(Student.is_active == True).count()
    total_teachers = db.query(Teacher).count()
    total_classes = db.query(AcademicClass).count()
    total_subjects = db.query(Subject).count()
    total_classrooms = db.query(Classroom).count()
    total_sessions = db.query(AttendanceSession).count()
    finalized_sessions = db.query(AttendanceSession).filter(AttendanceSession.status == "FINALIZED").count()
    
    total_att = db.query(Attendance).count()
    present_att = db.query(Attendance).filter(Attendance.status == "PRESENT").count()
    overall_rate = round((present_att / total_att * 100), 1) if total_att > 0 else 0.0

    return {
        "total_students": total_students,
        "total_active_students": total_active_students,
        "total_teachers": total_teachers,
        "total_classes": total_classes,
        "total_subjects": total_subjects,
        "total_classrooms": total_classrooms,
        "total_sessions": total_sessions,
        "finalized_sessions": finalized_sessions,
        "overall_attendance_rate": overall_rate
    }


class StudentCreateBody(BaseModel):
    roll_number: str
    name: str
    department: str = "CSE"
    section: str = "SU-1"
    email: Optional[str] = None
    phone: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    class_id: Optional[int] = 1
    face_image: Optional[str] = None


@router.post("/api/admin/students")
def admin_register_student(body: StudentCreateBody, db: Session = Depends(get_db)):
    roll = body.roll_number.strip().upper()
    existing = db.query(Student).filter(Student.roll_number == roll).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Roll number {roll} already exists.")

    student_id = str(uuid.uuid4())
    new_student = Student(
        student_id=student_id,
        roll_number=roll,
        name=body.name.strip(),
        department=body.department.strip().upper(),
        section=body.section.strip().upper(),
        is_active=True
    )
    db.add(new_student)
    db.commit()

    if body.class_id:
        try:
            assign = ClassStudentAssignment(
                class_id=body.class_id,
                student_id=student_id
            )
            db.add(assign)
            db.commit()
        except Exception:
            db.rollback()

    students_file = PRIVATE_DIR / "students.json"
    if students_file.is_file():
        try:
            with open(students_file, "r", encoding="utf-8") as f:
                s_list = json.load(f)
            s_list.append({
                "student_id": student_id,
                "roll_number": roll,
                "name": body.name.strip(),
                "department": body.department.strip().upper(),
                "section": body.section.strip().upper(),
                "email": body.email or f"{roll.lower()}@students.college.edu",
                "phone": body.phone or "+91 99881 12233",
                "guardian_name": body.guardian_name or "Parent / Guardian",
                "guardian_phone": body.guardian_phone or "+91 99881 10000"
            })
            with open(students_file, "w", encoding="utf-8") as f:
                json.dump(s_list, f, indent=2)
        except Exception as e:
            print(f"Error updating students.json: {e}")

    # If face image was supplied during registration (via live webcam or upload), extract InsightFace embedding
    face_enrolled = False
    if body.face_image:
        try:
            img_b64 = body.face_image
            if "," in img_b64:
                img_b64 = img_b64.split(",")[1]
            img_bytes = base64.b64decode(img_b64)
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is not None:
                global _face_app
                if _face_app is None:
                    from insightface.app import FaceAnalysis
                    _face_app = FaceAnalysis(name="buffalo_s", providers=["CPUExecutionProvider"])
                    _face_app.prepare(ctx_id=-1, det_size=(640, 640))
                faces = _face_app.get(frame)
                if faces and len(faces) > 0:
                    faces = sorted(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]), reverse=True)
                    face_emb = np.asarray(faces[0].embedding, dtype=np.float32)
                    norm = np.linalg.norm(face_emb)
                    if norm > 0:
                        face_emb = face_emb / norm
                    enroll_folder = PRIVATE_DIR / "enrollment" / student_id
                    enroll_folder.mkdir(parents=True, exist_ok=True)
                    cv2.imwrite(str(enroll_folder / "1.jpg"), frame)

                    emb_file = PRIVATE_DIR / "embeddings.npz"
                    current_ids = []
                    current_embs = []
                    if emb_file.is_file():
                        try:
                            data = np.load(str(emb_file), allow_pickle=False)
                            current_ids = list(data["student_ids"].astype(str))
                            current_embs = list(data["embeddings"].astype(np.float32))
                        except Exception:
                            pass
                    current_ids.append(student_id)
                    current_embs.append(face_emb)
                    np.savez_compressed(
                        str(emb_file),
                        student_ids=np.array(current_ids, dtype=str),
                        embeddings=np.array(current_embs, dtype=np.float32)
                    )
                    face_enrolled = True
        except Exception as e:
            print(f"Direct face enrollment notice: {e}")

    global _embeddings_cache
    _embeddings_cache = None

    return {
        "success": True,
        "message": f"Student {roll} registered successfully" + (" with biometric face vector enrolled" if face_enrolled else ""),
        "student_id": student_id,
        "face_enrolled": face_enrolled
    }


class EnrollFaceBody(BaseModel):
    image: str


@router.post("/api/admin/students/{student_id}/enroll-face")
def admin_enroll_face(student_id: str, body: EnrollFaceBody, db: Session = Depends(get_db)):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    img_b64 = body.image
    if "," in img_b64:
        img_b64 = img_b64.split(",")[1]
    
    try:
        img_bytes = base64.b64decode(img_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Could not decode image")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image format: {e}")

    global _face_app
    if _face_app is None:
        try:
            from insightface.app import FaceAnalysis
            _face_app = FaceAnalysis(name="buffalo_s", providers=["CPUExecutionProvider"])
            _face_app.prepare(ctx_id=-1, det_size=(640, 640))
        except Exception as ex:
            raise HTTPException(status_code=500, detail=f"InsightFace model unavailable: {ex}")

    faces = _face_app.get(frame)
    if not faces or len(faces) == 0:
        raise HTTPException(status_code=400, detail="No face detected in the provided image. Please ensure good lighting and face the camera directly.")

    faces = sorted(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]), reverse=True)
    face_emb = faces[0].embedding
    face_emb = np.asarray(face_emb, dtype=np.float32)
    norm = np.linalg.norm(face_emb)
    if norm > 0:
        face_emb = face_emb / norm

    enroll_folder = PRIVATE_DIR / "enrollment" / student_id
    enroll_folder.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(enroll_folder / "1.jpg"), frame)

    emb_file = PRIVATE_DIR / "embeddings.npz"
    current_ids = []
    current_embs = []
    if emb_file.is_file():
        try:
            data = np.load(str(emb_file), allow_pickle=False)
            current_ids = list(data["student_ids"].astype(str))
            current_embs = list(data["embeddings"].astype(np.float32))
        except Exception as e:
            print(f"Error loading existing embeddings.npz: {e}")

    if student_id in current_ids:
        idx = current_ids.index(student_id)
        current_embs[idx] = face_emb
    else:
        current_ids.append(student_id)
        current_embs.append(face_emb)

    np.savez_compressed(
        str(emb_file),
        student_ids=np.array(current_ids, dtype=str),
        embeddings=np.array(current_embs, dtype=np.float32)
    )

    global _embeddings_cache
    _embeddings_cache = None

    subjects = db.query(Subject).all()
    for sub in subjects:
        existing_enr = db.query(Enrollment).filter(
            Enrollment.student_id == student_id,
            Enrollment.subject_id == sub.subject_id
        ).first()
        if not existing_enr:
            db.add(Enrollment(student_id=student_id, subject_id=sub.subject_id))
    db.commit()

    return {
        "success": True,
        "message": f"Biometric face enrolled successfully for {student.name} ({student.roll_number})",
        "student_id": student_id,
        "face_detected": True
    }


@router.patch("/api/admin/students/{student_id}/status")
def toggle_student_status(student_id: str, db: Session = Depends(get_db)):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.is_active = not student.is_active
    db.commit()
    return {
        "success": True,
        "student_id": student_id,
        "is_active": student.is_active,
        "message": f"Student {'activated' if student.is_active else 'deactivated'} successfully"
    }


@router.get("/api/admin/sessions/all")
def get_all_admin_sessions(db: Session = Depends(get_db)):
    sessions = db.query(AttendanceSession).order_by(AttendanceSession.session_id.desc()).all()
    results = []
    for s in sessions:
        subj = db.get(Subject, s.subject_id)
        present_cnt = db.query(Attendance).filter(
            Attendance.session_id == s.session_id,
            Attendance.status == "PRESENT"
        ).count()
        absent_cnt = db.query(Attendance).filter(
            Attendance.session_id == s.session_id,
            Attendance.status == "ABSENT"
        ).count()
        total_cnt = present_cnt + absent_cnt
        if total_cnt == 0:
            total_cnt = 110
            absent_cnt = 110

        results.append({
            "session_id": s.session_id,
            "id": f"SES-{s.session_id:03d}",
            "subject_code": subj.subject_code if subj else "CP301",
            "subject_name": subj.subject_name if subj else "Competitive Programming",
            "class_name": "III SU-1",
            "section": s.section or "SU-1",
            "date": s.session_date.isoformat() if s.session_date else "",
            "time_slot": "09:30 AM - 12:15 PM",
            "period_number": s.period_number,
            "teacher_name": "Dr. Priya Sharma",
            "status": s.status,
            "total_students": total_cnt,
            "present_count": present_cnt,
            "absent_count": absent_cnt,
            "attendance_rate": round((present_cnt / total_cnt) * 100, 1) if total_cnt > 0 else 0.0
        })
    return results


class CreateSessionBody(BaseModel):
    subject_id: int = 1
    section: str = "SU-1"
    session_date: Optional[str] = None
    period_number: int = 1


@router.post("/api/admin/sessions/create")
def admin_create_session(body: CreateSessionBody, db: Session = Depends(get_db)):
    s_date = date.fromisoformat(body.session_date) if body.session_date else date.today()
    new_sess = AttendanceSession(
        subject_id=body.subject_id,
        section=body.section,
        session_date=s_date,
        period_number=body.period_number,
        status="ACTIVE"
    )
    db.add(new_sess)
    db.commit()
    db.refresh(new_sess)
    return {
        "success": True,
        "message": f"Attendance session #{new_sess.session_id} created successfully",
        "session_id": new_sess.session_id
    }


@router.post("/api/admin/sessions/{session_id}/finalize")
def admin_finalize_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(AttendanceSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    active_students = db.query(Student).filter(Student.is_active == True).all()
    existing_attendance = {
        a.student_id: a for a in db.query(Attendance).filter(Attendance.session_id == session_id).all()
    }
    
    for s in active_students:
        if s.student_id not in existing_attendance:
            db.add(Attendance(
                session_id=session_id,
                student_id=s.student_id,
                status="ABSENT",
                source="SYSTEM",
                marked_at=datetime.now(timezone.utc)
            ))
    
    session.status = "FINALIZED"
    db.commit()
    return {"success": True, "message": f"Session #{session_id} finalized successfully"}


@router.get("/api/admin/auth-events")
def get_auth_events(db: Session = Depends(get_db)):
    from backend.auth_models import AuthenticationAudit
    events = db.query(AuthenticationAudit).order_by(AuthenticationAudit.audit_id.desc()).limit(50).all()
    return [
        {
            "id": e.audit_id,
            "username": e.username,
            "user_id": e.user_id,
            "event_type": e.event_type,
            "timestamp": e.event_time.strftime("%Y-%m-%d %I:%M:%S %p") if e.event_time else ""
        }
        for e in events
    ]


# =========================================================================
# COMPREHENSIVE ADMIN PORTAL OPERATIONS (CLASSES, ROOMS, TEACHERS, TIMETABLE)
# =========================================================================

class ClassUpdateModel(BaseModel):
    class_code: Optional[str] = None
    department: Optional[str] = None
    academic_year: Optional[str] = None
    year_number: Optional[int] = None
    semester_number: Optional[int] = None
    section: Optional[str] = None
    is_active: Optional[bool] = None

@router.put('/api/admin/classes/{class_id}')
def update_admin_class(class_id: int, body: ClassUpdateModel, db: Session = Depends(get_db)):
    ac = db.get(AcademicClass, class_id)
    if not ac:
        raise HTTPException(status_code=404, detail='Academic class not found')
    if body.class_code is not None:
        ac.class_code = body.class_code.strip().upper()
    if body.department is not None:
        ac.department = body.department.strip().upper()
    if body.academic_year is not None:
        ac.academic_year = body.academic_year.strip()
    if body.year_number is not None:
        ac.year_number = body.year_number
    if body.semester_number is not None:
        ac.semester_number = body.semester_number
    if body.section is not None:
        ac.section = body.section.strip().upper()
    if body.is_active is not None:
        ac.is_active = body.is_active
    db.commit()
    db.refresh(ac)
    return {'success': True, 'message': f'Class {ac.class_code} updated successfully'}

@router.patch('/api/admin/classes/{class_id}/status')
def toggle_admin_class_status(class_id: int, db: Session = Depends(get_db)):
    ac = db.get(AcademicClass, class_id)
    if not ac:
        raise HTTPException(status_code=404, detail='Academic class not found')
    ac.is_active = not ac.is_active
    db.commit()
    return {'success': True, 'is_active': ac.is_active, 'message': f'Class status toggled to {ac.is_active}'}


class ClassroomUpdateModel(BaseModel):
    room_number: Optional[str] = None
    building: Optional[str] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None

@router.put('/api/admin/classrooms/{room_id}')
def update_admin_classroom(room_id: int, body: ClassroomUpdateModel, db: Session = Depends(get_db)):
    room = db.get(Classroom, room_id)
    if not room:
        raise HTTPException(status_code=404, detail='Classroom not found')
    if body.room_number is not None:
        room.room_number = body.room_number.strip().upper()
    if body.building is not None:
        room.building = body.building.strip()
    if body.capacity is not None:
        room.capacity = body.capacity
    if body.is_active is not None:
        room.is_active = body.is_active
    db.commit()
    db.refresh(room)
    return {'success': True, 'message': f'Room {room.room_number} updated successfully'}

@router.patch('/api/admin/classrooms/{room_id}/status')
def toggle_admin_classroom_status(room_id: int, db: Session = Depends(get_db)):
    room = db.get(Classroom, room_id)
    if not room:
        raise HTTPException(status_code=404, detail='Classroom not found')
    room.is_active = not room.is_active
    db.commit()
    return {'success': True, 'is_active': room.is_active, 'message': f'Room status toggled to {room.is_active}'}


class TeacherUpdateModel(BaseModel):
    employee_code: Optional[str] = None
    teacher_name: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None

@router.put('/api/admin/teachers/{teacher_id}')
def update_admin_teacher(teacher_id: int, body: TeacherUpdateModel, db: Session = Depends(get_db)):
    teacher = db.get(Teacher, teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail='Teacher not found')
    if body.employee_code is not None:
        teacher.employee_code = body.employee_code.strip().upper()
    if body.teacher_name is not None:
        teacher.teacher_name = body.teacher_name.strip()
    if body.department is not None:
        teacher.department = body.department.strip().upper()
    if body.email is not None:
        teacher.email = body.email.strip().lower() if body.email.strip() else None
    if body.is_active is not None:
        teacher.is_active = body.is_active
    db.commit()
    db.refresh(teacher)
    return {'success': True, 'message': f'Faculty {teacher.teacher_name} updated successfully'}

@router.patch('/api/admin/teachers/{teacher_id}/status')
def toggle_admin_teacher_status(teacher_id: int, db: Session = Depends(get_db)):
    teacher = db.get(Teacher, teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail='Teacher not found')
    teacher.is_active = not teacher.is_active
    db.commit()
    return {'success': True, 'is_active': teacher.is_active, 'message': f'Faculty status toggled to {teacher.is_active}'}


class QuickTeacherCreate(BaseModel):
    employee_code: str
    teacher_name: str
    department: str = 'CSE'
    email: Optional[str] = None
    create_login: bool = False
    login_username: Optional[str] = None
    login_password: Optional[str] = None

@router.post('/api/admin/teachers/quick-create')
def quick_create_teacher(body: QuickTeacherCreate, db: Session = Depends(get_db)):
    emp_code = body.employee_code.strip().upper()
    existing = db.query(Teacher).filter(Teacher.employee_code == emp_code).first()
    if existing:
        raise HTTPException(status_code=409, detail=f'Employee code {emp_code} already exists')
    
    email = body.email.strip().lower() if body.email and body.email.strip() else None
    if email:
        if db.query(Teacher).filter(Teacher.email == email).first():
            raise HTTPException(status_code=409, detail='Email is already registered')

    new_t = Teacher(
        employee_code=emp_code,
        teacher_name=body.teacher_name.strip(),
        department=body.department.strip().upper(),
        email=email,
        is_active=True
    )
    db.add(new_t)
    db.commit()
    db.refresh(new_t)

    created_user = None
    if body.create_login and body.login_username and body.login_password:
        u_name = body.login_username.strip().lower()
        if db.query(UserAccount).filter(UserAccount.username == u_name).first():
            raise HTTPException(status_code=409, detail=f'Username {u_name} already exists')
        acc = UserAccount(
            username=u_name,
            password_hash=hash_password(body.login_password.strip()),
            role='TEACHER',
            teacher_id=new_t.teacher_id,
            is_active=True
        )
        db.add(acc)
        db.commit()
        created_user = u_name

    return {
        'success': True,
        'message': f'Faculty {new_t.teacher_name} registered successfully' + (f' with login account "{created_user}"' if created_user else ''),
        'teacher_id': new_t.teacher_id
    }


class CreateAccountDirect(BaseModel):
    username: str
    password: str
    role: str = 'TEACHER'
    teacher_id: Optional[int] = None

@router.post('/api/admin/accounts/create-user')
def create_account_direct(body: CreateAccountDirect, db: Session = Depends(get_db)):
    u_name = body.username.strip().lower()
    if not u_name or len(u_name) < 3:
        raise HTTPException(status_code=422, detail='Username must be at least 3 characters')
    if len(body.password.strip()) < 6:
        raise HTTPException(status_code=422, detail='Password must contain at least 6 characters')

    if db.query(UserAccount).filter(UserAccount.username == u_name).first():
        raise HTTPException(status_code=409, detail=f'Username "{u_name}" already exists')

    if body.role == 'TEACHER' and body.teacher_id:
        existing_t = db.query(UserAccount).filter(UserAccount.teacher_id == body.teacher_id).first()
        if existing_t:
            raise HTTPException(status_code=409, detail='This teacher already has a login account')

    acc = UserAccount(
        username=u_name,
        password_hash=hash_password(body.password.strip()),
        role=body.role.upper(),
        teacher_id=body.teacher_id if body.role == 'TEACHER' else None,
        is_active=True
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return {'success': True, 'message': f'User account "{u_name}" created successfully', 'user_id': acc.user_id}


# Timetable Management API
class TimetableEntryCreate(BaseModel):
    class_id: int
    subject_id: int
    teacher_id: int
    classroom_id: int
    day_of_week: int = 1
    period_number: int = 1
    start_time: str = '09:30'
    end_time: str = '12:15'

@router.post('/api/admin/timetable/entry')
def create_timetable_entry(body: TimetableEntryCreate, db: Session = Depends(get_db)):
    assignment = db.query(TeachingAssignment).filter(
        TeachingAssignment.class_id == body.class_id,
        TeachingAssignment.subject_id == body.subject_id,
        TeachingAssignment.teacher_id == body.teacher_id
    ).first()

    if not assignment:
        assignment = TeachingAssignment(
            class_id=body.class_id,
            subject_id=body.subject_id,
            teacher_id=body.teacher_id,
            is_active=True
        )
        db.add(assignment)
        db.commit()
        db.refresh(assignment)

    from datetime import time as dt_time
    def parse_t(s):
        parts = s.strip().split(':')
        return dt_time(int(parts[0]), int(parts[1]))

    st = parse_t(body.start_time)
    et = parse_t(body.end_time)

    conflict = db.query(Timetable).filter(
        Timetable.day_of_week == body.day_of_week,
        Timetable.period_number == body.period_number,
        Timetable.room_id == body.classroom_id,
        Timetable.is_active == True
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail=f'Classroom is already occupied on Day {body.day_of_week}, Period {body.period_number}')

    slot = Timetable(
        teaching_assignment_id=assignment.teaching_assignment_id,
        room_id=body.classroom_id,
        day_of_week=body.day_of_week,
        period_number=body.period_number,
        start_time=st,
        end_time=et,
        is_active=True
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return {'success': True, 'message': 'Timetable slot created successfully', 'timetable_id': slot.timetable_id}


class TimetableEntryUpdate(BaseModel):
    classroom_id: Optional[int] = None
    day_of_week: Optional[int] = None
    period_number: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_active: Optional[bool] = None

@router.put('/api/admin/timetable/{timetable_id}')
def update_timetable_entry(timetable_id: int, body: TimetableEntryUpdate, db: Session = Depends(get_db)):
    slot = db.get(Timetable, timetable_id)
    if not slot:
        raise HTTPException(status_code=404, detail='Timetable entry not found')

    from datetime import time as dt_time
    def parse_t(s):
        parts = s.strip().split(':')
        return dt_time(int(parts[0]), int(parts[1]))

    if body.classroom_id is not None:
        slot.room_id = body.classroom_id
    if body.day_of_week is not None:
        slot.day_of_week = body.day_of_week
    if body.period_number is not None:
        slot.period_number = body.period_number
    if body.start_time is not None:
        slot.start_time = parse_t(body.start_time)
    if body.end_time is not None:
        slot.end_time = parse_t(body.end_time)
    if body.is_active is not None:
        slot.is_active = body.is_active

    db.commit()
    return {'success': True, 'message': 'Timetable slot updated successfully'}

@router.delete('/api/admin/timetable/{timetable_id}')
def delete_timetable_entry(timetable_id: int, db: Session = Depends(get_db)):
    slot = db.get(Timetable, timetable_id)
    if not slot:
        raise HTTPException(status_code=404, detail='Timetable entry not found')
    db.delete(slot)
    db.commit()
    return {'success': True, 'message': f'Timetable entry #{timetable_id} deleted successfully'}


# =========================================================================
# STUDENT, FACULTY, AND USER ACCOUNT EDIT & DELETE OPERATIONS
# =========================================================================

class StudentUpdateBody(BaseModel):
    name: Optional[str] = None
    roll_number: Optional[str] = None
    department: Optional[str] = None
    section: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None

@router.put("/api/admin/students/{student_id}")
def update_admin_student(student_id: str, body: StudentUpdateBody, db: Session = Depends(get_db)):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if body.name is not None:
        student.name = body.name.strip()
    if body.roll_number is not None:
        student.roll_number = body.roll_number.strip().upper()
    if body.department is not None:
        student.department = body.department.strip().upper()
    if body.section is not None:
        student.section = body.section.strip().upper()

    db.commit()
    db.refresh(student)

    # Update students.json
    students_file = PRIVATE_DIR / "students.json"
    if not students_file.is_file():
        students_file = PROJECT_DIR / "students.json"
    if students_file.is_file():
        try:
            with open(students_file, "r", encoding="utf-8") as f:
                s_list = json.load(f)
            for s in s_list:
                if str(s.get("student_id")) == str(student_id):
                    if body.name is not None: s["name"] = student.name
                    if body.roll_number is not None: s["roll_number"] = student.roll_number
                    if body.department is not None: s["department"] = student.department
                    if body.section is not None: s["section"] = student.section
                    if body.email is not None: s["email"] = body.email
                    if body.phone is not None: s["phone"] = body.phone
                    if body.guardian_name is not None: s["guardian_name"] = body.guardian_name
                    if body.guardian_phone is not None: s["guardian_phone"] = body.guardian_phone
            with open(students_file, "w", encoding="utf-8") as f:
                json.dump(s_list, f, indent=2)
        except Exception as e:
            print(f"Error syncing student update to json: {e}")

    global _embeddings_cache
    _embeddings_cache = None

    return {"success": True, "message": f"Student {student.roll_number} updated successfully"}

@router.delete("/api/admin/students/{student_id}")
def delete_admin_student(student_id: str, db: Session = Depends(get_db)):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    roll = student.roll_number
    # Remove enrollments & class student assignments
    db.query(Enrollment).filter(Enrollment.student_id == student_id).delete()
    db.query(ClassStudentAssignment).filter(ClassStudentAssignment.student_id == student_id).delete()
    db.query(Attendance).filter(Attendance.student_id == student_id).delete()
    db.delete(student)
    db.commit()

    # Update students.json
    students_file = PRIVATE_DIR / "students.json"
    if not students_file.is_file():
        students_file = PROJECT_DIR / "students.json"
    if students_file.is_file():
        try:
            with open(students_file, "r", encoding="utf-8") as f:
                s_list = json.load(f)
            s_list = [s for s in s_list if str(s.get("student_id")) != str(student_id)]
            with open(students_file, "w", encoding="utf-8") as f:
                json.dump(s_list, f, indent=2)
        except Exception as e:
            print(f"Error syncing student deletion to json: {e}")

    # Remove from embeddings.npz
    emb_file = PRIVATE_DIR / "embeddings.npz"
    if emb_file.is_file():
        try:
            data = np.load(str(emb_file), allow_pickle=False)
            ids = list(data["student_ids"].astype(str))
            embs = list(data["embeddings"].astype(np.float32))
            if student_id in ids:
                idx = ids.index(student_id)
                ids.pop(idx)
                embs.pop(idx)
                np.savez_compressed(
                    str(emb_file),
                    student_ids=np.array(ids, dtype=str),
                    embeddings=np.array(embs, dtype=np.float32)
                )
        except Exception as e:
            print(f"Error removing from embeddings.npz: {e}")

    global _embeddings_cache
    _embeddings_cache = None

    return {"success": True, "message": f"Student {roll} deleted successfully"}


@router.delete("/api/admin/teachers/{teacher_id}")
def delete_admin_teacher(teacher_id: int, db: Session = Depends(get_db)):
    teacher = db.get(Teacher, teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Faculty not found")

    name = teacher.teacher_name
    # Unlink or remove accounts
    db.query(UserAccount).filter(UserAccount.teacher_id == teacher_id).delete()
    # Unlink teaching assignments
    db.query(TeachingAssignment).filter(TeachingAssignment.teacher_id == teacher_id).delete()
    db.delete(teacher)
    db.commit()
    return {"success": True, "message": f"Faculty member {name} deleted successfully"}


class AccountUpdateBody(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None
    teacher_id: Optional[int] = None
    is_active: Optional[bool] = None

@router.put("/api/admin/accounts/{user_id}")
def update_admin_account(user_id: int, body: AccountUpdateBody, db: Session = Depends(get_db)):
    acc = db.get(UserAccount, user_id)
    if not acc:
        raise HTTPException(status_code=404, detail="User account not found")

    if body.username is not None:
        u_name = body.username.strip().lower()
        if u_name != acc.username:
            if db.query(UserAccount).filter(UserAccount.username == u_name).first():
                raise HTTPException(status_code=409, detail=f"Username {u_name} already exists")
            acc.username = u_name
    if body.role is not None:
        acc.role = body.role.strip().upper()
    if body.teacher_id is not None:
        acc.teacher_id = body.teacher_id if acc.role == "TEACHER" else None
    if body.is_active is not None:
        acc.is_active = body.is_active

    db.commit()
    db.refresh(acc)
    return {"success": True, "message": f"Account {acc.username} updated successfully"}

@router.delete("/api/admin/accounts/{user_id}")
def delete_admin_account(user_id: int, db: Session = Depends(get_db)):
    acc = db.get(UserAccount, user_id)
    if not acc:
        raise HTTPException(status_code=404, detail="User account not found")

    username = acc.username
    db.delete(acc)
    db.commit()
    return {"success": True, "message": f"User account '{username}' deleted successfully"}
