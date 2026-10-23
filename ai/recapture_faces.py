
import cv2
import json
import uuid
from pathlib import Path
from datetime import datetime, timezone
from ultralytics import YOLO

# Paths
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "weights" / "yolov8n-face.pt"

# Keep biometric data outside the OneDrive project
import os
DATA_DIR = (
    Path(os.environ["LOCALAPPDATA"])
    / "FaceAttendancePrivate"
)
ENROLLMENT_DIR = DATA_DIR / "enrollment"
REGISTRY_PATH = DATA_DIR / "students.json"

ENROLLMENT_DIR.mkdir(parents=True, exist_ok=True)

# Student details are entered ONLY during registration
name = input("Enter student name: ").strip()
roll_number = input("Enter roll number: ").strip()
department = input("Enter department: ").strip()
section = input("Enter section: ").strip()

if not all([name, roll_number, department, section]):
    raise SystemExit("All student fields are required.")

consent = input(
    "Student consents to face enrollment? (yes/no): "
).strip().lower()

if consent != "yes":
    raise SystemExit("Enrollment cancelled.")

# Load existing registrations
if REGISTRY_PATH.exists():
    students = json.loads(
        REGISTRY_PATH.read_text(encoding="utf-8")
    )
else:
    students = []

if any(
    student["roll_number"] == roll_number
    for student in students
):
    raise SystemExit("Roll number already registered.")

student_id = str(uuid.uuid4())
student_dir = ENROLLMENT_DIR / student_id
student_dir.mkdir()

model = YOLO(str(MODEL_PATH))
camera = cv2.VideoCapture(0, cv2.CAP_DSHOW)

if not camera.isOpened():
    student_dir.rmdir()
    raise SystemExit("Camera could not be opened.")

MAX_IMAGES = 5
captured = 0

print("Press SPACE to capture a face image.")
print("Press Q to cancel registration.")

try:
    while captured < MAX_IMAGES:
        success, frame = camera.read()

        if not success:
            break

        frame = cv2.flip(frame, 1)

        results = model.predict(
            frame,
            conf=0.5,
            imgsz=640,
            device="cpu",
            verbose=False
        )

        boxes = results[0].boxes
        preview = frame.copy()
        valid_face = None

        if len(boxes) == 1:
            x1, y1, x2, y2 = map(
                int, boxes[0].xyxy[0].tolist()
            )

            height, width = frame.shape[:2]
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(width, x2)
            y2 = min(height, y2)

            if (x2 - x1) >= 100 and (y2 - y1) >= 100:
                valid_face = frame.copy()
                color = (0, 255, 0)
                status = "Press SPACE to capture"
            else:
                color = (0, 165, 255)
                status = "Move closer to the camera"

            cv2.rectangle(
                preview, (x1, y1), (x2, y2), color, 2
            )

        elif len(boxes) == 0:
            status = "No face detected"
        else:
            status = "Only one face allowed"

        cv2.rectangle(
            preview,
            (0, 0),
            (preview.shape[1], 75),
            (30, 30, 30),
            -1
        )

        cv2.putText(
            preview,
            status,
            (15, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2
        )

        cv2.putText(
            preview,
            f"Captured: {captured}/{MAX_IMAGES}",
            (15, 60),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 255),
            2
        )

        cv2.imshow("Student Registration", preview)

        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):
            break

        if key == 32 and valid_face is not None:
            output = student_dir / f"face_{captured + 1}.jpg"

            if cv2.imwrite(str(output), valid_face):
                captured += 1
                print(f"Captured image {captured}/{MAX_IMAGES}")

finally:
    camera.release()
    cv2.destroyAllWindows()

if captured == MAX_IMAGES:
    students.append({
        "student_id": student_id,
        "name": name,
        "roll_number": roll_number,
        "department": department,
        "section": section,
        "registered_at": datetime.now(
            timezone.utc
        ).isoformat()
    })

    REGISTRY_PATH.write_text(
        json.dumps(students, indent=2),
        encoding="utf-8"
    )

    print("\nStudent registered successfully!")
    print("Name:", name)
    print("Roll number:", roll_number)
    print("Images captured:", captured)
else:
    for image in student_dir.glob("*.jpg"):
        image.unlink()

    student_dir.rmdir()
    print("Registration cancelled or incomplete.")
