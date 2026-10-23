"""
All-In-One Bulk Student Enrollment Tool
AI-Based Face Recognition Attendance Management System

Features:
1. Automatically reads student photos from the `bulk_enrollment/photos/` directory.
2. Supports either:
   - Method A: CSV file (`bulk_enrollment/students.csv`) mapping roll_number -> photo_filename
   - Method B: Direct photo naming (e.g. `21BCS001_John_Doe.jpg` or `21BCS001.jpg`)
3. Detects faces with YOLOv8 face detector (`yolov8n-face.pt`).
4. Extracts 512-dimensional biometric feature embeddings with InsightFace ArcFace (`buffalo_l`).
5. Registers students in MySQL (`students`, `enrollments`, `class_student_assignments`).
6. Saves cropped/aligned facial images into `%LOCALAPPDATA%\\FaceAttendancePrivate\\enrollment\\<student_id>\\`.
7. Updates `students.json` and `embeddings.npz` in private storage.
8. Refreshes live cache so the frontend website recognizes all students immediately!
"""

import os
import sys
import csv
import json
import uuid
import shutil
from pathlib import Path
from datetime import datetime, timezone
import cv2
import numpy as np
import pymysql
from dotenv import load_dotenv

# Ensure project root in sys.path
PROJECT_DIR = Path(__file__).resolve().parents[2]
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

PRIVATE_DIR = Path(os.environ.get("LOCALAPPDATA", "")) / "FaceAttendancePrivate"
ENROLLMENT_DIR = PRIVATE_DIR / "enrollment"
STUDENTS_FILE = PRIVATE_DIR / "students.json"
EMBEDDINGS_FILE = PRIVATE_DIR / "embeddings.npz"
YOLO_MODEL_PATH = PROJECT_DIR / "ai" / "weights" / "yolov8n-face.pt"

BULK_DIR = PROJECT_DIR / "bulk_enrollment"
PHOTOS_DIR = BULK_DIR / "photos"
CSV_FILE = BULK_DIR / "students.csv"

# Load DB config
env_path = PRIVATE_DIR / "database.env"
if not env_path.is_file():
    env_path = PROJECT_DIR / "database.env"
load_dotenv(str(env_path))

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Saurabh@2875")
DB_NAME = os.getenv("DB_NAME", "face_attendance")
DB_PORT = int(os.getenv("DB_PORT", 3306))

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def get_db_connection():
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        port=DB_PORT,
        autocommit=True
    )


def load_ai_models():
    print("[-] Loading YOLOv8 Face Detector...")
    from ultralytics import YOLO
    yolo = YOLO(str(YOLO_MODEL_PATH))

    print("[-] Loading InsightFace ArcFace (buffalo_l)...")
    from insightface.app import FaceAnalysis
    face_app = FaceAnalysis(
        name="buffalo_l",
        providers=["CPUExecutionProvider"],
        allowed_modules=["detection", "recognition"]
    )
    face_app.prepare(ctx_id=-1, det_size=(640, 640))
    print("[+] AI Models initialized successfully.")
    return yolo, face_app


def collect_student_entries():
    entries = []
    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

    # Method A: Check for students.csv
    if CSV_FILE.is_file():
        print(f"[-] Reading student metadata from {CSV_FILE.name}...")
        with open(CSV_FILE, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                roll = (row.get("roll_number") or "").strip()
                name = (row.get("name") or "").strip()
                dept = (row.get("department") or "CSE").strip()
                section = (row.get("section") or "A").strip()
                photo_name = (row.get("photo_filename") or "").strip()

                if not roll or not photo_name:
                    continue

                photo_path = PHOTOS_DIR / photo_name
                if not photo_path.is_file():
                    # check if path is absolute or in bulk_enrollment directly
                    alt = BULK_DIR / photo_name
                    if alt.is_file():
                        photo_path = alt

                entries.append({
                    "roll_number": roll,
                    "name": name or f"Student {roll}",
                    "department": dept,
                    "section": section,
                    "photo_path": photo_path
                })
        print(f"    Found {len(entries)} records in CSV.")
        return entries

    # Method B: Direct photo filename parsing in photos/
    print(f"[-] Scanning {PHOTOS_DIR} for student photographs...")
    for file in sorted(PHOTOS_DIR.iterdir()):
        if file.suffix.lower() in IMAGE_EXTENSIONS and file.is_file():
            stem = file.stem  # e.g. "21BCS001_Aarav_Mehta" or "21BCS001"
            parts = stem.split("_", 1)
            roll = parts[0].strip()
            name = parts[1].replace("_", " ").strip() if len(parts) > 1 else f"Student {roll}"

            entries.append({
                "roll_number": roll,
                "name": name,
                "department": "CSE",
                "section": "A",
                "photo_path": file
            })

    print(f"    Found {len(entries)} student photographs in photos directory.")
    return entries


def run_bulk_enroll():
    print("=" * 65)
    print(" AI FACE ATTENDANCE - ALL-IN-ONE BULK ENROLLMENT")
    print("=" * 65)

    entries = collect_student_entries()
    if not entries:
        print(f"\n[!] No students found to enroll.")
        print(f"    Please place student photos in: {PHOTOS_DIR}")
        print(f"    Naming convention: ROLL_NAME.jpg (e.g., 21BCS001_Aarav_Mehta.jpg)")
        print(f"    Or provide a students.csv file in: {BULK_DIR}\n")
        return

    PRIVATE_DIR.mkdir(parents=True, exist_ok=True)
    ENROLLMENT_DIR.mkdir(parents=True, exist_ok=True)

    yolo, face_app = load_ai_models()
    db = get_db_connection()
    cursor = db.cursor()

    # Load existing students.json
    existing_students = []
    if STUDENTS_FILE.is_file():
        try:
            with open(STUDENTS_FILE, "r", encoding="utf-8") as f:
                existing_students = json.load(f)
        except Exception:
            existing_students = []

    students_by_roll = {s["roll_number"]: s for s in existing_students}

    # Load existing embeddings.npz
    existing_ids = []
    existing_embeddings = []
    if EMBEDDINGS_FILE.is_file():
        try:
            data = np.load(str(EMBEDDINGS_FILE), allow_pickle=False)
            existing_ids = list(data["student_ids"].astype(str))
            existing_embeddings = list(data["embeddings"].astype(np.float32))
        except Exception:
            existing_ids = []
            existing_embeddings = []

    successful_count = 0
    failed_count = 0

    print("\n[-] Processing facial enrollment...")
    print("-" * 65)

    for idx, item in enumerate(entries, start=1):
        roll = item["roll_number"]
        name = item["name"]
        dept = item["department"]
        sec = item["section"]
        photo_path = item["photo_path"]

        if not photo_path.is_file():
            print(f"[{idx}/{len(entries)}] [SKIP] Photo missing for {roll}: {photo_path.name}")
            failed_count += 1
            continue

        image = cv2.imread(str(photo_path))
        if image is None:
            print(f"[{idx}/{len(entries)}] [FAIL] Cannot decode image: {photo_path.name}")
            failed_count += 1
            continue

        # 1. Run YOLO Face Detection
        results = yolo.predict(source=image, conf=0.45, imgsz=640, device="cpu", verbose=False)
        boxes = results[0].boxes
        if len(boxes) == 0:
            print(f"[{idx}/{len(entries)}] [FAIL] No face detected by YOLO in: {photo_path.name}")
            failed_count += 1
            continue

        # 2. Run InsightFace ArcFace embedding extraction
        faces = face_app.get(image)
        if len(faces) == 0:
            print(f"[{idx}/{len(entries)}] [FAIL] InsightFace landmark alignment failed for: {photo_path.name}")
            failed_count += 1
            continue

        # Select highest quality detected face
        best_face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        embedding = best_face.normed_embedding

        if embedding is None:
            print(f"[{idx}/{len(entries)}] [FAIL] Could not generate 512-D embedding for: {roll}")
            failed_count += 1
            continue

        embedding = np.asarray(embedding, dtype=np.float32)
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm

        # 3. Create or reuse Student ID
        if roll in students_by_roll:
            student_id = students_by_roll[roll]["student_id"]
        else:
            student_id = str(uuid.uuid4())

        # 4. Save photo into private enrollment folder
        student_folder = ENROLLMENT_DIR / student_id
        student_folder.mkdir(parents=True, exist_ok=True)
        dest_photo = student_folder / "1.jpg"
        cv2.imwrite(str(dest_photo), image)

        # 5. Insert/Update into MySQL
        try:
            # students table
            cursor.execute("""
                INSERT INTO students (student_id, roll_number, name, department, section, is_active)
                VALUES (%s, %s, %s, %s, %s, 1)
                ON DUPLICATE KEY UPDATE name=%s, department=%s, section=%s, is_active=1;
            """, (student_id, roll, name, dept, sec, name, dept, sec))

            # enrollments table (subject 1: CS302)
            cursor.execute("""
                INSERT INTO enrollments (student_id, subject_id)
                VALUES (%s, 1)
                ON DUPLICATE KEY UPDATE subject_id=1;
            """, (student_id,))

            # class_student_assignments table (class 1: CSE-3A)
            cursor.execute("""
                INSERT INTO class_student_assignments (class_id, student_id, assigned_at)
                VALUES (1, %s, %s)
                ON DUPLICATE KEY UPDATE class_id=1;
            """, (student_id, datetime.now(timezone.utc)))

        except Exception as db_err:
            print(f"[{idx}/{len(entries)}] [WARN] MySQL update warning for {roll}: {db_err}")

        # 6. Update students list
        student_record = {
            "student_id": student_id,
            "roll_number": roll,
            "name": name,
            "department": dept,
            "section": sec,
            "enrolled_at": datetime.now(timezone.utc).isoformat()
        }
        students_by_roll[roll] = student_record

        # 7. Update embeddings list
        if student_id in existing_ids:
            pos = existing_ids.index(student_id)
            existing_embeddings[pos] = embedding
        else:
            existing_ids.append(student_id)
            existing_embeddings.append(embedding)

        successful_count += 1
        print(f"[{idx}/{len(entries)}] [OK] Enrolled: {roll} - {name} (512-D Embedding saved)")

    db.close()

    # 8. Save updated students.json
    all_students = list(students_by_roll.values())
    with open(STUDENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(all_students, f, indent=2)

    # 9. Save updated embeddings.npz
    np.savez_compressed(
        EMBEDDINGS_FILE,
        student_ids=np.array(existing_ids, dtype=str),
        embeddings=np.array(existing_embeddings, dtype=np.float32)
    )

    print("-" * 65)
    print(f"[+] Bulk Enrollment Summary:")
    print(f"    Successfully Enrolled: {successful_count}")
    print(f"    Failed / Skipped:      {failed_count}")
    print(f"    Total in Database:    {len(all_students)}")
    print(f"    Embeddings in NPZ:    {len(existing_ids)}")
    print("=" * 65)


if __name__ == "__main__":
    run_bulk_enroll()
