
import os
import json
import time
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO
from insightface.app import FaceAnalysis

# ------------------------------
# 1. Configure file paths
# ------------------------------

BASE_DIR = Path(__file__).resolve().parent

YOLO_MODEL = BASE_DIR / "weights" / "yolov8n-face.pt"

PRIVATE_DIR = (
    Path(os.environ["LOCALAPPDATA"])
    / "FaceAttendancePrivate"
)

STUDENTS_FILE = PRIVATE_DIR / "students.json"
EMBEDDINGS_FILE = PRIVATE_DIR / "embeddings.npz"

if not STUDENTS_FILE.exists():
    raise SystemExit("students.json not found.")

if not EMBEDDINGS_FILE.exists():
    raise SystemExit(
        "embeddings.npz not found. "
        "Run generate_embeddings.py first."
    )

# ------------------------------
# 2. Load registered students
# ------------------------------

with open(STUDENTS_FILE, "r", encoding="utf-8") as file:
    students = json.load(file)

students_by_id = {
    student["student_id"]: student
    for student in students
}

with np.load(EMBEDDINGS_FILE, allow_pickle=False) as data:
    student_ids = data["student_ids"].astype(str)
    embeddings = data["embeddings"].astype(np.float32)

if len(student_ids) == 0:
    raise SystemExit("No registered embeddings found.")

# Normalize stored embeddings
norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
embeddings = embeddings / np.maximum(norms, 1e-8)

print("Registered recognition profiles:", len(student_ids))

# ------------------------------
# 3. Load YOLO and ArcFace
# ------------------------------

print("Loading YOLO...")
yolo = YOLO(str(YOLO_MODEL))

print("Loading InsightFace...")
face_app = FaceAnalysis(
    name="buffalo_l",
    providers=["CPUExecutionProvider"],
    allowed_modules=["detection", "recognition"]
)

face_app.prepare(
    ctx_id=-1,
    det_size=(640, 640)
)

# Initial experimental threshold.
# Must be calibrated before real attendance use.
MATCH_THRESHOLD = 0.55

# Require the same result repeatedly
REQUIRED_MATCHES = 3

last_student_id = None
consecutive_matches = 0
last_processing_time = 0.0
PROCESS_INTERVAL = 0.25

display_status = "Position one face in camera"
display_name = ""
display_roll = ""

# ------------------------------
# 4. Open webcam
# ------------------------------

camera = cv2.VideoCapture(0, cv2.CAP_DSHOW)

if not camera.isOpened():
    raise SystemExit("Camera could not be opened.")

print("Automatic recognition started.")
print("Press Q to exit.")

try:
    while True:
        success, frame = camera.read()

        if not success:
            print("Camera frame unavailable.")
            break

        frame = cv2.flip(frame, 1)
        preview = frame.copy()

        now = time.monotonic()

        if now - last_processing_time >= PROCESS_INTERVAL:
            last_processing_time = now

            result = yolo.predict(
                source=frame,
                conf=0.5,
                imgsz=640,
                device="cpu",
                verbose=False
            )[0]

            boxes = result.boxes

            if len(boxes) != 1:
                last_student_id = None
                consecutive_matches = 0
                display_name = ""
                display_roll = ""

                if len(boxes) == 0:
                    display_status = "No face detected"
                else:
                    display_status = "Only one face allowed"

            else:
                # InsightFace receives the full frame
                # so it can detect and align the face.
                detected_faces = face_app.get(frame)

                if len(detected_faces) != 1:
                    last_student_id = None
                    consecutive_matches = 0
                    display_name = ""
                    display_roll = ""
                    display_status = "Face alignment failed"

                else:
                    face = detected_faces[0]
                    query = face.normed_embedding

                    if query is None:
                        display_status = "Face features unavailable"
                        last_student_id = None
                        consecutive_matches = 0
                        display_name = ""
                        display_roll = ""

                    else:
                        query = np.asarray(
                            query,
                            dtype=np.float32
                        )

                        # Cosine similarity with all profiles
                        scores = embeddings @ query

                        best_index = int(np.argmax(scores))
                        best_score = float(scores[best_index])

                        best_id = student_ids[best_index]

                        # Reject uncertain recognition
                        if (
                            best_score < MATCH_THRESHOLD
                            or best_id not in students_by_id
                        ):
                            display_status = "Unknown student"
                            display_name = ""
                            display_roll = ""
                            last_student_id = None
                            consecutive_matches = 0

                        else:
                            if best_id == last_student_id:
                                consecutive_matches += 1
                            else:
                                last_student_id = best_id
                                consecutive_matches = 1

                            if consecutive_matches >= REQUIRED_MATCHES:
                                student = students_by_id[best_id]

                                display_name = student["name"]
                                display_roll = student["roll_number"]
                                display_status = "Student recognized"
                            else:
                                display_name = ""
                                display_roll = ""
                                display_status = "Verifying face..."

        # ------------------------------
        # 5. Draw results
        # ------------------------------

        cv2.rectangle(
            preview,
            (0, 0),
            (preview.shape[1], 115),
            (25, 25, 25),
            -1
        )

        color = (
            (0, 255, 0)
            if display_status == "Student recognized"
            else (0, 200, 255)
        )

        cv2.putText(
            preview,
            display_status,
            (15, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            color,
            2
        )

        if display_name:
            cv2.putText(
                preview,
                f"Name: {display_name}",
                (15, 65),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (255, 255, 255),
                2
            )

            cv2.putText(
                preview,
                f"Roll: {display_roll}",
                (15, 95),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (255, 255, 255),
                2
            )

        cv2.imshow(
            "Automatic Student Recognition",
            preview
        )

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

finally:
    camera.release()
    cv2.destroyAllWindows()
