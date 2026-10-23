
import cv2
from pathlib import Path
from ultralytics import YOLO

# Get the directory of the current Python file
BASE_DIR = Path(__file__).resolve().parent

# Path to the downloaded face detection model
MODEL_PATH = BASE_DIR / "weights" / "yolov8n-face.pt"

# Load YOLO face detection model
model = YOLO(str(MODEL_PATH))

# Open webcam
camera = cv2.VideoCapture(0, cv2.CAP_DSHOW)

if not camera.isOpened():
    print("ERROR: Unable to open webcam")
    raise SystemExit(1)

print("YOLO Face Detection Started")
print("Press Q to close the camera")

try:
    while True:
        success, frame = camera.read()

        if not success:
            print("ERROR: Cannot read camera frame")
            break

        # Mirror camera preview
        frame = cv2.flip(frame, 1)

        # Detect faces
        results = model.predict(
            source=frame,
            conf=0.45,
            imgsz=640,
            device="cpu",
            verbose=False
        )

        boxes = results[0].boxes
        face_count = len(boxes)

        # Determine detection status
        if face_count == 0:
            status = "No face detected"
            color = (0, 0, 255)

        elif face_count == 1:
            status = "One face detected - Ready"
            color = (0, 255, 0)

        else:
            status = "Multiple faces detected"
            color = (0, 165, 255)

        # Draw bounding boxes around faces
        for box in boxes:
            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0].tolist()
            )

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                color,
                2
            )

        # Display detection status
        cv2.rectangle(
            frame,
            (0, 0),
            (frame.shape[1], 70),
            (30, 30, 30),
            -1
        )

        cv2.putText(
            frame,
            status,
            (15, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            color,
            2
        )

        cv2.putText(
            frame,
            f"Faces: {face_count}",
            (15, 55),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2
        )

        cv2.imshow("YOLO Face Detection", frame)

        # Press Q to exit
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

finally:
    camera.release()
    cv2.destroyAllWindows()
