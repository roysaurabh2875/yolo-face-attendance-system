
import os
import sys
import json
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO
from insightface.app import FaceAnalysis

# -----------------------------------
# STEP 1: Paths
# -----------------------------------

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

sys.path.insert(0, str(SECURITY_DIR))

from onnx_inference import AntiSpoofingONNX

# -----------------------------------
# STEP 2: Load student information
# -----------------------------------

with open(STUDENTS_FILE, "r", encoding="utf-8") as f:
    students = json.load(f)

student_lookup = {
    s["student_id"]: s for s in students
}

with np.load(EMBEDDINGS_FILE, allow_pickle=False) as data:
    student_ids = data["student_ids"].astype(str)
    embeddings = data["embeddings"].astype(np.float32)

if len(student_ids) == 0:
    raise SystemExit("No face embeddings available.")

embeddings /= np.maximum(
    np.linalg.norm(embeddings, axis=1, keepdims=True),
    1e-8
)

# -----------------------------------
# STEP 3: Load AI models
# -----------------------------------

print("Loading YOLO...")
yolo = YOLO(str(YOLO_PATH))

print("Loading ArcFace...")
recognition_model = FaceAnalysis(
    name="buffalo_l",
    providers=["CPUExecutionProvider"],
    allowed_modules=["detection", "recognition"]
)

recognition_model.prepare(
    ctx_id=-1,
    det_size=(640, 640)
)

print("Loading MiniFASNet...")
spoof_model = AntiSpoofingONNX(
    model_path=str(SPOOF_MODEL_PATH),
    scale=2.7
)

# Experimental thresholds.
# These require calibration and spoof testing.
FACE_THRESHOLD = 0.55
LIVENESS_THRESHOLD = 0.80
REQUIRED_CONSECUTIVE = 3

last_id = None
match_count = 0

# -----------------------------------
# STEP 4: Open webcam
# -----------------------------------

camera = cv2.VideoCapture(0, cv2.CAP_DSHOW)

if not camera.isOpened():
    raise SystemExit("Unable to open webcam.")

print("Secure recognition started.")
print("Press Q to exit.")

try:
    while True:
        success, frame = camera.read()

        if not success:
            break

        frame = cv2.flip(frame, 1)
        preview = frame.copy()

        status = "Position one face in camera"
        student_name = ""
        roll_number = ""
        color = (0, 165, 255)

        # -----------------------------------
        # STEP 5: YOLO detection
        # -----------------------------------

        results = yolo.predict(
            frame,
            conf=0.5,
            imgsz=640,
            device="cpu",
            verbose=False
        )

        boxes = results[0].boxes

        if len(boxes) != 1:
            last_id = None
            match_count = 0

            if len(boxes) == 0:
                status = "No face detected"
            else:
                status = "Multiple faces detected"

        else:
            height, width = frame.shape[:2]

            x1, y1, x2, y2 = map(
                int,
                boxes[0].xyxy[0].tolist()
            )

            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(width, x2)
            y2 = min(height, y2)

            bbox = [x1, y1, x2, y2]

            cv2.rectangle(
                preview,
                (x1, y1),
                (x2, y2),
                (0, 255, 255),
                2
            )

            if x2 <= x1 or y2 <= y1:
                status = "Invalid face region"
                last_id = None
                match_count = 0

            else:
                # -----------------------------------
                # STEP 6: Anti-spoofing
                # -----------------------------------

                try:
                    spoof_result = spoof_model.predict(
                        frame, bbox
                    )

                    is_live = (
                        spoof_result["label"] == "Real"
                        and spoof_result["score"]
                        >= LIVENESS_THRESHOLD
                    )

                except Exception as error:
                    print("Liveness error:", error)
                    is_live = False

                if not is_live:
                    status = "Liveness failed - Retry"
                    color = (0, 0, 255)
                    last_id = None
                    match_count = 0

                else:
                    # -----------------------------------
                    # STEP 7: Face recognition
                    # -----------------------------------

                    faces = recognition_model.get(frame)

                    if len(faces) != 1:
                        status = "Recognition unavailable"
                        last_id = None
                        match_count = 0

                    else:
                        query = faces[0].normed_embedding

                        if query is None:
                            status = "Face features missing"
                            last_id = None
                            match_count = 0

                        else:
                            query = np.asarray(
                                query,
                                dtype=np.float32
                            )

                            query /= max(
                                np.linalg.norm(query),
                                1e-8
                            )

                            scores = embeddings @ query

                            best_index = int(np.argmax(scores))
                            best_score = float(scores[best_index])
                            best_id = student_ids[best_index]

                            if (
                                best_score < FACE_THRESHOLD
                                or best_id not in student_lookup
                            ):
                                status = "Unknown student"
                                last_id = None
                                match_count = 0

                            else:
                                if best_id == last_id:
                                    match_count += 1
                                else:
                                    last_id = best_id
                                    match_count = 1

                                if match_count >= REQUIRED_CONSECUTIVE:
                                    student = student_lookup[best_id]

                                    student_name = student["name"]
                                    roll_number = student["roll_number"]

                                    status = "Student recognized"
                                    color = (0, 255, 0)

                                else:
                                    status = "Verifying student..."

        # -----------------------------------
        # STEP 8: Display result
        # -----------------------------------

        cv2.rectangle(
            preview,
            (0, 0),
            (preview.shape[1], 115),
            (25, 25, 25),
            -1
        )

        cv2.putText(
            preview,
            status,
            (15, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            color,
            2
        )

        if student_name:
            cv2.putText(
                preview,
                f"Name: {student_name}",
                (15, 65),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                2
            )

            cv2.putText(
                preview,
                f"Roll: {roll_number}",
                (15, 95),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                2
            )

        cv2.imshow("Secure Face Recognition", preview)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

finally:
    camera.release()
    cv2.destroyAllWindows()
