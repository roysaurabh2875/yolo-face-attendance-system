"""
Database and Biometrics Reset Script for AI Face Attendance System
Cleans all test data, resets biometric embeddings, purges old attendance logs,
and sets up a clean slate with administrator and faculty accounts.
"""

import os
import sys
import shutil
import json
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
import pymysql
from dotenv import load_dotenv

# 1. Resolve paths
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

PRIVATE_DIR = Path(os.environ.get("LOCALAPPDATA", "")) / "FaceAttendancePrivate"

env_path = PRIVATE_DIR / "database.env"
if not env_path.is_file():
    env_path = BASE_DIR / "database.env"

load_dotenv(str(env_path))

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Saurabh@2875")
DB_NAME = os.getenv("DB_NAME", "face_attendance")
DB_PORT = int(os.getenv("DB_PORT", 3306))

# Import password hashing from backend
from backend.password_security import hash_password


def reset_biometric_files():
    print("[-] Clearing biometric private directory...")
    PRIVATE_DIR.mkdir(parents=True, exist_ok=True)

    # Clear enrollment images
    enrollment_dir = PRIVATE_DIR / "enrollment"
    if enrollment_dir.exists():
        shutil.rmtree(enrollment_dir, ignore_errors=True)
    enrollment_dir.mkdir(parents=True, exist_ok=True)
    print("    Cleared enrollment image directory.")

    # Reset students.json
    students_file = PRIVATE_DIR / "students.json"
    with open(students_file, "w", encoding="utf-8") as f:
        json.dump([], f, indent=2)
    print("    Reset students.json to empty list [].")

    # Reset embeddings.npz
    embeddings_file = PRIVATE_DIR / "embeddings.npz"
    empty_ids = np.array([], dtype=str)
    empty_embeddings = np.empty((0, 512), dtype=np.float32)
    np.savez_compressed(embeddings_file, student_ids=empty_ids, embeddings=empty_embeddings)
    print("    Reset embeddings.npz to empty (0, 512).")

    # Delete any backup .npz files
    for backup in PRIVATE_DIR.glob("embeddings_backup_*.npz"):
        try:
            backup.unlink()
            print(f"    Deleted old backup: {backup.name}")
        except Exception as e:
            print(f"    Could not delete {backup.name}: {e}")


def reset_database():
    print("[-] Resetting MySQL database tables...")
    conn = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        port=DB_PORT,
        autocommit=True
    )
    cursor = conn.cursor()

    # Disable FK checks to allow clean truncation
    cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")

    tables_to_truncate = [
        "attendance_audit",
        "attendance",
        "attendance_session_roster",
        "attendance_session_schedule",
        "attendance_sessions",
        "class_student_assignments",
        "enrollments",
        "students",
        "timetable",
        "teaching_assignments",
        "authentication_audit",
        "teachers",
        "user_accounts",
        "academic_classes",
        "classrooms",
        "subjects"
    ]

    for tbl in tables_to_truncate:
        try:
            cursor.execute(f"TRUNCATE TABLE `{tbl}`;")
            print(f"    Truncated `{tbl}`")
        except Exception as ex:
            print(f"    Could not truncate `{tbl}`: {ex}")

    cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")

    # 3. Seed Clean Master Data
    print("[-] Seeding clean academic master data...")

    # Class
    cursor.execute("""
        INSERT INTO academic_classes (class_id, class_code, department, academic_year, year_number, semester_number, section, is_active)
        VALUES (1, 'CSE-3A', 'CSE', '2026-2027', 3, 5, 'A', 1);
    """)

    # Classroom
    cursor.execute("""
        INSERT INTO classrooms (room_id, room_number, building, capacity, is_active)
        VALUES (1, '301', 'Academic Block 3', 60, 1);
    """)

    # Subject
    cursor.execute("""
        INSERT INTO subjects (subject_id, subject_code, subject_name)
        VALUES (1, 'CS302', 'Computer Vision & Biometrics');
    """)

    # Clean Faculty profile
    cursor.execute("""
        INSERT INTO teachers (teacher_id, employee_code, teacher_name, department, email, is_active)
        VALUES (1, 'EMP-FAC-001', 'Dr. Priya Sharma', 'CSE', 'dr.sharma@college.edu', 1);
    """)

    # Clean Accounts
    print("[-] Creating clean user accounts...")
    now = datetime.now(timezone.utc)

    # 1. Primary Administrator (admin / Admin@123456)
    admin_pw_hash = hash_password("Admin@123456")
    cursor.execute("""
        INSERT INTO user_accounts (username, password_hash, role, teacher_id, is_active, created_at, updated_at, token_version, failed_login_attempts)
        VALUES ('admin', %s, 'ADMIN', NULL, 1, %s, %s, 1, 0);
    """, (admin_pw_hash, now, now))
    print("    Created ADMIN account: admin / Admin@123456")

    # 2. Personal Administrator (saurabh2875 / Saurabh@2875)
    saurabh_pw_hash = hash_password("Saurabh@2875")
    cursor.execute("""
        INSERT INTO user_accounts (username, password_hash, role, teacher_id, is_active, created_at, updated_at, token_version, failed_login_attempts)
        VALUES ('saurabh2875', %s, 'ADMIN', NULL, 1, %s, %s, 1, 0);
    """, (saurabh_pw_hash, now, now))
    print("    Created ADMIN account: saurabh2875 / Saurabh@2875")

    # 3. Clean Faculty Account (faculty001 / Faculty@123456)
    faculty_pw_hash = hash_password("Faculty@123456")
    cursor.execute("""
        INSERT INTO user_accounts (username, password_hash, role, teacher_id, is_active, created_at, updated_at, token_version, failed_login_attempts)
        VALUES ('faculty001', %s, 'TEACHER', 1, 1, %s, %s, 1, 0);
    """, (faculty_pw_hash, now, now))
    print("    Created TEACHER account: faculty001 / Faculty@123456 (Linked to Dr. Priya Sharma)")

    # 4. Teaching assignment
    cursor.execute("""
        INSERT INTO teaching_assignments (teaching_assignment_id, teacher_id, subject_id, class_id, is_active)
        VALUES (1, 1, 1, 1, 1);
    """)

    conn.close()
    print("[+] Database clean reset completed successfully.")


if __name__ == "__main__":
    print("=" * 60)
    print(" AI FACE ATTENDANCE - SYSTEM CLEAN RESET")
    print("=" * 60)
    reset_biometric_files()
    reset_database()
    print("=" * 60)
    print("System has been cleanly purged!")
    print("Login accounts created:")
    print("  1. Admin:   admin       / Admin@123456")
    print("  2. Admin:   saurabh2875 / Saurabh@2875")
    print("  3. Teacher: faculty001  / Faculty@123456")
    print("=" * 60)
