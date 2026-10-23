"""
Enroll III SU-1 Students and Faces
AI-Based Face Recognition Attendance Management System

Enrolls the 110 students of III SU-1 from G:/2025 into:
1. MySQL database (students, enrollments, class_student_assignments)
2. Private biometrics storage (%LOCALAPPDATA%\\FaceAttendancePrivate)
3. Generates 512-D ArcFace embeddings and saves to embeddings.npz and students.json
"""

import os
import sys
import json
import uuid
import shutil
from pathlib import Path
from datetime import datetime, timezone
import cv2
import numpy as np
import pymysql
from dotenv import load_dotenv

PROJECT_DIR = Path(__file__).resolve().parents[2]
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

PRIVATE_DIR = Path(os.environ.get("LOCALAPPDATA", "")) / "FaceAttendancePrivate"
ENROLLMENT_DIR = PRIVATE_DIR / "enrollment"
STUDENTS_FILE = PRIVATE_DIR / "students.json"
EMBEDDINGS_FILE = PRIVATE_DIR / "embeddings.npz"
YOLO_MODEL_PATH = PROJECT_DIR / "ai" / "weights" / "yolov8n-face.pt"
SOURCE_PHOTOS_DIR = Path("G:/2025")
PROJECT_PHOTOS_DIR = PROJECT_DIR / "bulk_enrollment" / "photos"

# Load DB configuration
env_path = PRIVATE_DIR / "database.env"
if not env_path.is_file():
    env_path = PROJECT_DIR / "database.env"
load_dotenv(str(env_path))

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Saurabh@2875")
DB_NAME = os.getenv("DB_NAME", "face_attendance")
DB_PORT = int(os.getenv("DB_PORT", 3306))

# Student roster provided by user for class III SU-1
SU1_RAW_ROSTER = """1,25951a0501,PEDDINTI AASHRITHA,CSE
2,25951a0502,MOHAMMED ABDUL RAZZAQ,CSE
3,25951a0503,AKULA ABHIRAM NAIDU,CSE
4,25951a0508,KATHARE ADITYA,CSE
5,25951a0510,SHAIK AFREEN,CSE
6,25951a0511,AHISH ROHAN KETARAJU,CSE
7,25951a0512,CHERUKURI AISHWARYA,CSE
8,25951a0516,BOJJA AKASH,CSE
9,25951a0518,MUNJAM AKSHAY,CSE
10,25951a0521,ADDAGULLA AKSHITH,CSE
11,25951a0527,KANAPARTHY ANANDH,CSE
12,25951a0533,JOEL ARADHYA GEDDAM,CSE
13,25951a0537,MASINI ASHWITH YADAV,CSE
14,25951a0540,MOHAMMED AYAAN,CSE
15,25951a0546,DAVULURI BHANU VENKATA SIVA RAMA KRISHNA,CSE
16,25951a0548,TALAKANTI BHARGAV REDDY,CSE
17,25951a0549,BHUKYA BHARGAVI,CSE
18,25951a0550,SINGUPURAPU BHARGAVI,CSE
19,25951a0551,ROHAN BHASKARAN,CSE
20,25951a0552,CHATLA BHAVANI,CSE
21,25951a0553,SEETA BHAVANI,CSE
22,25951a0554,KOLLI BHAVIKA,CSE
23,25951a0561,CHANDHIRI BRINDA REDDY,CSE
24,25951a0565,SAJJANAPU CHINMAY KRISHNA,CSE
25,25951a0566,GUDAVALLI CHOTI,CSE
26,25951a0569,DEEKSHITHA MALLA,CSE
27,25951a0579,YANDAPALLY DURGA SAI MANOJ,CSE
28,25951a0581,D ESHWAR,CSE
29,25951a0587,JADALA GANESH,CSE
30,25951a0590,TIPPA GAYATHRI,CSE
31,25951a0594,BADA GOPIKA MADHU PRIYA,CSE
32,25951a0598,GREESHMA RENAPURE,CSE
33,25951a0599,TEJAVATHU GURUCHANDRA,CSE
34,25951a05a3,KUNTA HARINI,CSE
35,25951a05a8,KOLASANI HARSHITA,CSE
36,25951a05a9,MOTHE HARSHITH RAO,CSE
37,25951a05ae,I HRUTHIK KUMAR REDDY,CSE
38,25951a05ag,A ISHWARYA,CSE
39,25951a05ah,DHARA JAGADEESHWAR,CSE
40,25951a05al,RAPOLU JAHNAVI,CSE
41,25951a05am,ANUGU JAHNAVI,CSE
42,25951a05an,AKULA JASHWANTH,CSE
43,25951a05aq,LELLA JASWANTH,CSE
44,25951a05ar,SINGAM JASWANTH,CSE
45,25951a05au,KUNAMNENI JAYANTH,CSE
46,25951a05ax,SOMIDI JOSHNA,CSE
47,25951a05ay,MANUBOTHULA JYOTHI,CSE
48,25951a05az,GADDAPARA JYOTHI SAGAR,CSE
49,25951a05b0,DALIPARTHI JYOTHI SAI RAM,CSE
50,25951a05b1,YALLAPU JYOTHI SRI,CSE
51,25951a05b3,MAGGIDI KANNAIAH,CSE
52,25951a05b4,JATOTH KARTHIK KUMAR,CSE
53,25951a05b8,AKKALA KAVYA SUDHA,CSE
54,25951a05ba,BOLLEPOGU KEZIYA,CSE
55,25951a05bf,SRIRAMULA KOUSHIK,CSE
56,25951a05bg,BAKKA KOWSHIK,CSE
57,25951a05bk,SAURABH KUMAR ROY,CSE
58,25951a05bl,SATYAM KUMAR VERMA,CSE
59,25951a05bn,VADAGANA LAASYA SREE,CSE
60,25951a05bq,SINGEETHAM LAHARI,CSE
61,25951a05br,MARLAPALLI LAKSHMI SATWIKA,CSE
62,25951a05bu,PINGALI LAKSHMI VISHNU CHARAN,CSE
63,25951a05bx,PATIVADA LIKITHA,CSE
64,25951a05by,KATAKAM LOKESH,CSE
65,25951a05c4,JALUGARI MAHESH,CSE
66,25951a05c5,GANGAPURI MAHESH REDDY,CSE
67,25951a05ce,CHINTHAKINDI MANUCHARAN,CSE
68,25951a05cg,ILLURU MEGHAJ REDDY,CSE
69,25951a05cm,SUNKARI MONA,CSE
70,25951a05cp,MANNEM MURARI,CSE
71,25951a05ct,HANSIKA NAGULAPALLY,CSE
72,25951a05cw,RONGALI NANDIKA LAXMI NARAYANI,CSE
73,25951a05cx,AGURLA NANDINI,CSE
74,25951a05cy,GUDIMETLA NANDINI,CSE
75,25951a05d0,NAINI NARENDHAR REDDY,CSE
76,25951a05d3,NAVYA SRI RAVULACHERUVU,CSE
77,25951a05d4,VELIMINETI NAVYA SRI,CSE
78,25951a05d7,GOPAGANI NIKHIL,CSE
79,25951a05d8,KADUDURAM NIKHIL,CSE
80,25951a05d9,RANGA NIKHIL REDDY,CSE
81,25951a05da,NIKHITA RANGINENI,CSE
82,25951a05dd,ANNALURI OM SAI AKHIL,CSE
83,25951a05dk,VARRE PHANI KUMAR,CSE
84,25951a05du,PRANAY KUMAR MASI,CSE
85,25951a05dv,KAVALI PRANAY TEJA,CSE
86,25951a05e1,SAIREDDYGARI PRAVALLIKA,CSE
87,25951a05e7,PRIYANSHU JHA,CSE
88,25951a05e8,KONALA PRUDHVI CHARAN,CSE
89,25951a05eb,PUJARI RAHUL,CSE
90,25951a05ec,VELUGULA RAHUL,CSE
91,25951a05ee,BOGARI RAKESH,CSE
92,25951a05eh,KADARLA RASHMIK VASHISTA,CSE
93,25951a05ej,N RATHINAM,CSE
94,25951a05en,BOMMINENI RISHIKA,CSE
95,25951a05ev,AKULA ROHAN,CSE
96,25951a05ew,MODEM ROHAN,CSE
97,25951a05f0,MUNJAMPALLI RUPESH,CSE
98,25951a05f1,MOHAMMED SAAD ALI,CSE
99,25951a05f3,KUSHAL SAHA,CSE
100,25951a05f5,SANGAM SAHASRA,CSE
101,25951a05f6,GANGAPURAM SAHIL,CSE
102,25951a05f7,DONTHA SAHITH,CSE
103,25951a05f9,MANTRIPRAGADA SAI AAKARSHA,CSE
104,25951a05fm,EEMANI SAI HARSHINI,CSE
105,25951a05ft,NIMMAKAYALA SAI NARASIMHA REDDY,CSE
106,25951a05fu,PALLERLA SAI SKANDHAN,CSE
107,25951a05g0,VANAMPALLY SAI VISHAL REDDY,CSE
108,25951a05g4,SHAIK SALEHA,CSE
109,25951a05g8,SUKTE SANDHYA,CSE
110,25951a05g9,BAVANI SANDYA RANI,CSE"""


def run_enrollment():
    print("=" * 70)
    print(" ENROLLING III SU-1 CLASS STUDENTS & FACIAL EMBEDDINGS")
    print("=" * 70)

    # 1. Map all photos in G:/2025 by lowercased stem
    print("[-] Indexing face photographs in G:/2025...")
    if not SOURCE_PHOTOS_DIR.exists():
        raise SystemExit(f"Source folder not found: {SOURCE_PHOTOS_DIR}")

    photo_map = {}
    for f in SOURCE_PHOTOS_DIR.iterdir():
        if f.is_file() and f.suffix.lower() in (".jpg", ".jpeg", ".png"):
            stem = f.stem.lower()
            photo_map[stem] = f

    print(f"    Indexed {len(photo_map)} photos from G:/2025")

    # 2. Parse the SU-1 Roster
    students_to_process = []
    for line in SU1_RAW_ROSTER.strip().splitlines():
        parts = line.split(",")
        s_no = int(parts[0].strip())
        roll_raw = parts[1].strip()
        roll_clean = roll_raw.upper()
        name = parts[2].strip()
        dept = parts[3].strip()

        photo_file = photo_map.get(roll_raw.lower())
        if not photo_file:
            # Check prefix
            for k, p in photo_map.items():
                if k.startswith(roll_raw.lower()):
                    photo_file = p
                    break

        if not photo_file:
            print(f"[!] Warning: Photo not found for {roll_clean} - {name}")
            continue

        students_to_process.append({
            "s_no": s_no,
            "roll": roll_clean,
            "name": name,
            "dept": dept,
            "photo_file": photo_file
        })

    print(f"[+] Total students in III SU-1 ready to enroll: {len(students_to_process)}")

    # 3. Load AI Models
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
    print("[+] AI models initialized.")

    # 4. Prepare DB and Storage
    PRIVATE_DIR.mkdir(parents=True, exist_ok=True)
    ENROLLMENT_DIR.mkdir(parents=True, exist_ok=True)
    PROJECT_PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

    conn = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        port=DB_PORT,
        autocommit=True
    )
    cursor = conn.cursor()

    # Update or insert academic class for III SU-1
    cursor.execute("""
        INSERT INTO academic_classes (class_id, class_code, department, academic_year, year_number, semester_number, section, is_active)
        VALUES (1, 'III SU-1', 'CSE', '2026-2027', 3, 5, 'SU-1', 1)
        ON DUPLICATE KEY UPDATE class_code='III SU-1', department='CSE', section='SU-1', is_active=1;
    """)

    # Ensure teaching assignment exists for Dr. Priya Sharma
    cursor.execute("""
        INSERT INTO teaching_assignments (teaching_assignment_id, teacher_id, subject_id, class_id, is_active)
        VALUES (1, 1, 1, 1, 1)
        ON DUPLICATE KEY UPDATE teacher_id=1, subject_id=1, class_id=1, is_active=1;
    """)

    all_students_records = []
    all_student_ids = []
    all_embeddings = []

    success_count = 0
    fail_count = 0

    print("\n[-] Processing facial biometric registration...")
    print("-" * 70)

    for item in students_to_process:
        s_no = item["s_no"]
        roll = item["roll"]
        name = item["name"]
        dept = item["dept"]
        photo_path = item["photo_file"]

        # Deterministic UUID based on roll number
        student_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"student.su1.{roll}"))

        # Read photo
        img = cv2.imread(str(photo_path))
        if img is None:
            print(f"[{s_no:03d}/110] [FAIL] Could not read image: {photo_path.name}")
            fail_count += 1
            continue

        # Extract InsightFace face crop & embedding
        faces = face_app.get(img)
        if len(faces) == 0:
            # Fallback check with YOLO
            res = yolo.predict(source=img, conf=0.35, imgsz=640, device="cpu", verbose=False)
            if len(res[0].boxes) > 0:
                b = res[0].boxes[0].xyxy[0].cpu().numpy().astype(int)
                crop = img[max(0, b[1]):b[3], max(0, b[0]):b[2]]
                faces = face_app.get(crop)

        if len(faces) == 0:
            print(f"[{s_no:03d}/110] [FAIL] Face detection failed for: {roll} ({name})")
            fail_count += 1
            continue

        # Select primary face
        best_face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        emb = best_face.normed_embedding

        if emb is None:
            print(f"[{s_no:03d}/110] [FAIL] Embedding extraction failed for: {roll}")
            fail_count += 1
            continue

        emb = np.asarray(emb, dtype=np.float32)
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm

        # Save photo into private enrollment folder
        student_folder = ENROLLMENT_DIR / student_id
        student_folder.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(student_folder / "1.jpg"), img)

        # Also copy photo into project bulk_enrollment/photos
        shutil.copyfile(str(photo_path), str(PROJECT_PHOTOS_DIR / f"{roll}_{name.replace(' ', '_')}.jpg"))

        # Insert into MySQL
        cursor.execute("""
            INSERT INTO students (student_id, roll_number, name, department, section, is_active)
            VALUES (%s, %s, %s, %s, 'SU-1', 1)
            ON DUPLICATE KEY UPDATE name=%s, department=%s, section='SU-1', is_active=1;
        """, (student_id, roll, name, dept, name, dept))

        cursor.execute("""
            INSERT INTO enrollments (student_id, subject_id)
            VALUES (%s, 1)
            ON DUPLICATE KEY UPDATE subject_id=1;
        """, (student_id,))

        cursor.execute("""
            INSERT INTO class_student_assignments (class_id, student_id, assigned_at)
            VALUES (1, %s, %s)
            ON DUPLICATE KEY UPDATE class_id=1;
        """, (student_id, datetime.now(timezone.utc)))

        # Append in-memory records
        all_students_records.append({
            "student_id": student_id,
            "roll_number": roll,
            "name": name,
            "department": dept,
            "section": "SU-1",
            "class_name": "III SU-1",
            "enrolled_at": datetime.now(timezone.utc).isoformat()
        })
        all_student_ids.append(student_id)
        all_embeddings.append(emb)

        success_count += 1
        print(f"[{s_no:03d}/110] [OK] Enrolled: {roll} - {name} (Face Vector Saved)")

    conn.close()

    # 5. Save students.json
    with open(STUDENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(all_students_records, f, indent=2)

    # 6. Save embeddings.npz
    np.savez_compressed(
        EMBEDDINGS_FILE,
        student_ids=np.array(all_student_ids, dtype=str),
        embeddings=np.array(all_embeddings, dtype=np.float32)
    )

    print("-" * 70)
    print("[+] ENROLLMENT COMPLETED SUCCESSFULLY!")
    print(f"    Total Processed:    {len(students_to_process)}")
    print(f"    Successfully Saved: {success_count}")
    print(f"    Failed:             {fail_count}")
    print(f"    Saved in students.json: {len(all_students_records)}")
    print(f"    Vectors in embeddings.npz: {len(all_embeddings)}")
    print("=" * 70)


if __name__ == "__main__":
    run_enrollment()
