
import os
import sys
import json
import time
from pathlib import Path

import cv2
import numpy as np
import requests

from dotenv import load_dotenv
from ultralytics import YOLO
from insightface.app import FaceAnalysis


# ==========================================
# 1. PROJECT CONFIGURATION
# ==========================================

PROJECT_DIR = Path(__file__).resolve().parent.parent

PRIVATE_DIR = (
    Path(os.environ["LOCALAPPDATA"])
    / "FaceAttendancePrivate"
)

STUDENTS_FILE = PRIVATE_DIR / "students.json"
EMBEDDINGS_FILE = PRIVATE_DIR / "embeddings.npz"

YOLO_PATH = (
    PROJECT_DIR / "ai" / "weights"
    / "yolov8n-face.pt"
)

SECURITY_DIR = (
    PROJECT_DIR / "security"
    / "face-anti-spoofing"
)

SPOOF_MODEL_PATH = (
    SECURITY_DIR / "weights"
    / "MiniFASNetV2.onnx"
)

load_dotenv(PRIVATE_DIR / "database.env")

SCANNER_KEY = os.getenv("SCANNER_API_KEY")

SESSION_ID = 2

API_URL = (
    f"http://127.0.0.1:8000/api/"
    f"sessions/{SESSION_ID}/scan"
)


# ==========================================
# 2. RECOGNITION SETTINGS
# ==========================================

FACE_THRESHOLD = 0.55
LIVENESS_THRESHOLD = 0.80

REQUIRED_MATCHES = 3
PROCESS_INTERVAL = 0.25
RETRY_INTERVAL = 5.0

# Thresholds are experimental and require
# validation before real attendance use.


# ==========================================
# 3. VALIDATE REQUIRED FILES
# ==========================================

required_files = [
    STUDENTS_FILE,
    EMBEDDINGS_FILE,
    YOLO_PATH,
    SPOOF_MODEL_PATH
]

for file_path in required_files:
    if not file_path.is_file():
        raise SystemExit(
            f"Required file missing: {file_path}"
        )

if not SCANNER_KEY:
    raise SystemExit(
        "SCANNER_API_KEY missing in database.env"
    )


# ==========================================
# 4. IMPORT ANTI-SPOOFING MODEL
# ==========================================

sys.path.insert(0, str(SECURITY_DIR))

from onnx_inference import AntiSpoofingONNX


# ==========================================
# 5. LOAD REGISTERED STUDENTS
# ==========================================

with open(
    STUDENTS_FILE,
    "r",
    encoding="utf-8"
) as file:
    students = json.load(file)

student_lookup = {
    str(student["student_id"]): student
    for student in students
}

with np.load(
    EMBEDDINGS_FILE,
    allow_pickle=False
) as data:

    student_ids = data["student_ids"].astype(str)

    embeddings = data["embeddings"].astype(
        np.float32
    )

if (
    embeddings.ndim != 2
    or len(student_ids) != len(embeddings)
    or len(student_ids) == 0
):
    raise SystemExit(
        "Invalid or empty face embedding database."
    )

norms = np.linalg.norm(
    embeddings,
    axis=1,
    keepdims=True
)

if np.any(norms <= 1e-8):
    raise SystemExit(
        "Stored embeddings contain invalid vectors."
    )

embeddings = embeddings / norms

print(
    "Registered recognition profiles:",
    len(student_ids)
)


# ==========================================
# 6. LOAD AI MODELS
# ==========================================

print("Loading YOLO...")

yolo = YOLO(str(YOLO_PATH))


print("Loading InsightFace...")

face_app = FaceAnalysis(
    name="buffalo_l",
    providers=["CPUExecutionProvider"],
    allowed_modules=[
        "detection",
        "recognition"
    ]
)

face_app.prepare(
    ctx_id=-1,
    det_size=(640, 640)
)


print("Loading MiniFASNetV2...")

spoof_model = AntiSpoofingONNX(
    model_path=str(SPOOF_MODEL_PATH),
    scale=2.7
)

print("All models loaded successfully!")


# ==========================================
# 7. ATTENDANCE API FUNCTION
# ==========================================

# Students confirmed by the backend
submitted_students = set()

# Last API request time for each student
last_attempts = {}

# Store successful responses to display them
attendance_results = {}


def submit_attendance(student_id):
    """
    Send a locally verified student identity
    to the attendance backend.

    Must only be called after successful
    liveness and recognition checks.
    """

    if student_id in submitted_students:
        return attendance_results.get(
            student_id,
            "Already Marked"
        )

    now = time.monotonic()

    previous_attempt = last_attempts.get(
        student_id,
        float("-inf")
    )

    if now - previous_attempt < RETRY_INTERVAL:
        return "Waiting to retry"

    last_attempts[student_id] = now

    payload = {
        "student_id": student_id,
        "liveness_passed": True,
        "recognition_passed": True
    }

    try:
        response = requests.post(
            API_URL,
            headers={
                "x-scanner-key": SCANNER_KEY
            },
            json=payload,
            timeout=8
        )

    except requests.RequestException as error:
        print("API connection error:", error)
        return "Backend connection failed"

    if response.status_code == 200:

        try:
            data = response.json()
        except ValueError:
            return "Invalid backend response"

        backend_status = data.get("status")

        if backend_status == "PRESENT":
            result = "Attendance Marked"

        elif backend_status == "ALREADY_MARKED":
            result = "Already Marked"

        else:
            return "Unexpected backend response"

        submitted_students.add(student_id)
        attendance_results[student_id] = result

        return result

    if response.status_code == 401:
        return "Scanner authentication failed"

    if response.status_code == 403:
        return "Student not eligible"

    if response.status_code == 404:
        return "Student or session not found"

    if response.status_code == 409:
        return "Session closed or attendance conflict"

    print(
        "Backend error:",
        response.status_code,
        response.text[:300]
    )

    return f"API Error: {response.status_code}"


# ==========================================
# 8. RECOGNITION STATE
# ==========================================

current_student_id = None
consecutive_matches = 0

last_processed = 0.0

display_status = "Position face in camera"
display_name = ""
display_roll = ""

display_color = (0, 165, 255)

current_box = None
last_logged = None


def reset_recognition():
    global current_student_id
    global consecutive_matches
    global display_name
    global display_roll
    global last_logged

    current_student_id = None
    consecutive_matches = 0

    display_name = ""
    display_roll = ""

    last_logged = None


# ==========================================
# 9. OPEN CAMERA
# ==========================================

camera = cv2.VideoCapture(
    0,
    cv2.CAP_DSHOW
)

if not camera.isOpened():
    raise SystemExit(
        "Unable to access webcam."
    )

camera.set(
    cv2.CAP_PROP_FRAME_WIDTH,
    640
)

camera.set(
    cv2.CAP_PROP_FRAME_HEIGHT,
    480
)

print()
print("===================================")
print(" YOLO FACE ATTENDANCE SCANNER")
print("===================================")
print("Session ID:", SESSION_ID)
print("Press Q to exit")
print()


# ==========================================
# 10. MAIN ATTENDANCE LOOP
# ==========================================

try:

    while True:

        success, frame = camera.read()

        if not success:
            print("Failed to read camera frame.")
            break

        frame = cv2.flip(frame, 1)

        preview = frame.copy()

        now = time.monotonic()

        if now - last_processed >= PROCESS_INTERVAL:

            last_processed = now
            current_box = None

            # ----------------------------------
            # A. FACE DETECTION WITH YOLO
            # ----------------------------------

            results = yolo.predict(
                source=frame,
                conf=0.5,
                imgsz=640,
                device="cpu",
                verbose=False
            )

            boxes = results[0].boxes

            if len(boxes) == 0:

                display_status = "No face detected"
                display_color = (0, 0, 255)

                reset_recognition()

            elif len(boxes) > 1:

                display_status = "One student at a time"
                display_color = (0, 165, 255)

                reset_recognition()

            else:

                # ----------------------------------
                # B. FACE BOUNDING BOX
                # ----------------------------------

                height, width = frame.shape[:2]

                x1, y1, x2, y2 = map(
                    int,
                    boxes[0].xyxy[0].tolist()
                )

                x1 = max(0, min(x1, width))
                y1 = max(0, min(y1, height))

                x2 = max(0, min(x2, width))
                y2 = max(0, min(y2, height))

                current_box = (x1, y1, x2, y2)

                face_width = x2 - x1
                face_height = y2 - y1

                if (
                    face_width < 100
                    or face_height < 100
                ):

                    display_status = "Move closer"
                    display_color = (0, 165, 255)

                    reset_recognition()

                else:

                    # ------------------------------
                    # C. PASSIVE LIVENESS CHECK
                    # ------------------------------

                    try:

                        spoof_result = spoof_model.predict(
                            frame,
                            [x1, y1, x2, y2]
                        )

                        label = spoof_result.get(
                            "label", ""
                        )

                        liveness_score = float(
                            spoof_result.get(
                                "score", 0
                            )
                        )

                        is_live = (
                            label == "Real"
                            and liveness_score
                            >= LIVENESS_THRESHOLD
                        )

                    except Exception as error:

                        print(
                            "Anti-spoofing error:",
                            error
                        )

                        is_live = False

                    if not is_live:

                        display_status = "Liveness failed"
                        display_color = (0, 0, 255)

                        reset_recognition()

                    else:

                        # ------------------------------
                        # D. ARCFACE RECOGNITION
                        # ------------------------------

                        detected_faces = face_app.get(
                            frame
                        )

                        if len(detected_faces) != 1:

                            display_status = (
                                "Recognition unavailable"
                            )

                            display_color = (0, 165, 255)

                            reset_recognition()

                        else:

                            face_embedding = (
                                detected_faces[0]
                                .normed_embedding
                            )

                            if face_embedding is None:

                                display_status = (
                                    "Face features missing"
                                )

                                display_color = (
                                    0, 165, 255
                                )

                                reset_recognition()

                            else:

                                # --------------------------
                                # E. NORMALIZE EMBEDDING
                                # --------------------------

                                query = np.asarray(
                                    face_embedding,
                                    dtype=np.float32
                                )

                                query_norm = np.linalg.norm(
                                    query
                                )

                                if query_norm <= 1e-8:

                                    display_status = (
                                        "Invalid face features"
                                    )

                                    reset_recognition()

                                else:

                                    query = (
                                        query / query_norm
                                    )

                                    # ----------------------
                                    # F. IDENTIFY STUDENT
                                    # ----------------------

                                    scores = embeddings @ query

                                    best_index = int(
                                        np.argmax(scores)
                                    )

                                    best_score = float(
                                        scores[best_index]
                                    )

                                    best_id = student_ids[
                                        best_index
                                    ]

                                    if (
                                        best_score < FACE_THRESHOLD
                                        or best_id not in student_lookup
                                    ):

                                        display_status = (
                                            "Unknown student"
                                        )

                                        display_color = (
                                            0, 0, 255
                                        )

                                        reset_recognition()

                                    else:

                                        # ------------------
                                        # G. STABLE MATCH
                                        # ------------------

                                        if (
                                            best_id
                                            == current_student_id
                                        ):
                                            consecutive_matches += 1

                                        else:
                                            current_student_id = best_id
                                            consecutive_matches = 1

                                        if (
                                            consecutive_matches
                                            < REQUIRED_MATCHES
                                        ):

                                            display_status = (
                                                "Verifying face..."
                                            )

                                            display_color = (
                                                0, 165, 255
                                            )

                                            display_name = ""
                                            display_roll = ""

                                        else:

                                            student = student_lookup[
                                                best_id
                                            ]

                                            display_name = student[
                                                "name"
                                            ]

                                            display_roll = student[
                                                "roll_number"
                                            ]

                                            # ------------------
                                            # H. SEND ATTENDANCE
                                            # ------------------

                                            result = submit_attendance(
                                                best_id
                                            )

                                            display_status = result

                                            if result in (
                                                "Attendance Marked",
                                                "Already Marked"
                                            ):

                                                display_color = (
                                                    0, 255, 0
                                                )

                                            else:

                                                display_color = (
                                                    0, 0, 255
                                                )

                                            log_value = (
                                                best_id,
                                                result
                                            )

                                            if log_value != last_logged:

                                                print(
                                                    "Student:",
                                                    display_name
                                                )

                                                print(
                                                    "Roll:",
                                                    display_roll
                                                )

                                                print(
                                                    "Attendance:",
                                                    result
                                                )

                                                last_logged = log_value

        # ----------------------------------
        # I. DRAW FACE RECTANGLE
        # ----------------------------------

        if current_box is not None:

            bx1, by1, bx2, by2 = current_box

            cv2.rectangle(
                preview,
                (bx1, by1),
                (bx2, by2),
                display_color,
                2
            )

        # ----------------------------------
        # J. DISPLAY STATUS
        # ----------------------------------

        cv2.rectangle(
            preview,
            (0, 0),
            (preview.shape[1], 140),
            (25, 25, 25),
            -1
        )

        cv2.putText(
            preview,
            display_status,
            (15, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            display_color,
            2
        )

        if display_name:

            cv2.putText(
                preview,
                f"Name: {display_name}",
                (15, 65),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                2
            )

            cv2.putText(
                preview,
                f"Roll: {display_roll}",
                (15, 95),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                2
            )

        cv2.putText(
            preview,
            f"Session: {SESSION_ID} | Q to exit",
            (15, 125),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            1
        )

        cv2.imshow(
            "YOLO Face Attendance",
            preview
        )

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

finally:

    camera.release()
    cv2.destroyAllWindows()

    print("Scanner closed successfully.")
