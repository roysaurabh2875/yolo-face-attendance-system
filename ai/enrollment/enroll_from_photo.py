
import argparse
import json
import os
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

from ultralytics import YOLO
from insightface.app import FaceAnalysis


PROJECT_DIR = Path(__file__).resolve().parents[2]

PRIVATE_DIR = (
    Path(os.environ["LOCALAPPDATA"])
    / "FaceAttendancePrivate"
)

STUDENTS_FILE = PRIVATE_DIR / "students.json"
EMBEDDINGS_FILE = PRIVATE_DIR / "embeddings.npz"
ENROLLMENT_DIR = PRIVATE_DIR / "enrollment"

YOLO_FILE = (
    PROJECT_DIR / "ai" / "weights"
    / "yolov8n-face.pt"
)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}

MIN_IMAGE_WIDTH = 160
MIN_IMAGE_HEIGHT = 160
MIN_FACE_SIZE = 80

# Conservative duplicate-identity warning.
# This is not a calibrated recognition threshold.
DUPLICATE_SIMILARITY = 0.65


def load_students():
    if not STUDENTS_FILE.is_file():
        raise RuntimeError(
            f"Student database missing: {STUDENTS_FILE}"
        )

    with STUDENTS_FILE.open(
        "r", encoding="utf-8"
    ) as file:
        students = json.load(file)

    if not isinstance(students, list):
        raise RuntimeError(
            "Expected a list in students.json"
        )

    return students


def find_student(students, roll_number):
    matches = [
        student for student in students
        if str(student.get("roll_number", "")).strip()
        == roll_number
    ]

    if not matches:
        raise RuntimeError(
            "Roll number not found in students.json. "
            "Register the student record first."
        )

    if len(matches) > 1:
        raise RuntimeError(
            "Duplicate roll number in students.json."
        )

    student = matches[0]

    if not student.get("student_id"):
        raise RuntimeError(
            "Student ID missing from student record."
        )

    return student


def read_photo(photo_path):
    if not photo_path.is_file():
        raise RuntimeError(
            f"Photo not found: {photo_path}"
        )

    if photo_path.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise RuntimeError(
            "Only JPG, JPEG and PNG photographs are allowed."
        )

    # Limit input size before image decoding.
    if photo_path.stat().st_size > 10 * 1024 * 1024:
        raise RuntimeError(
            "Photo must be smaller than 10 MB."
        )

    # np.fromfile handles Windows Unicode paths.
    raw = np.fromfile(
        str(photo_path), dtype=np.uint8
    )

    image = cv2.imdecode(raw, cv2.IMREAD_COLOR)

    if image is None:
        raise RuntimeError(
            "Unable to decode the photograph."
        )

    height, width = image.shape[:2]

    if (
        width < MIN_IMAGE_WIDTH
        or height < MIN_IMAGE_HEIGHT
    ):
        raise RuntimeError(
            "Photograph resolution is too low."
        )

    if width * height > 20_000_000:
        raise RuntimeError(
            "Photograph dimensions are too large."
        )

    return image


def load_models():
    if not YOLO_FILE.is_file():
        raise RuntimeError(
            f"YOLO model missing: {YOLO_FILE}"
        )

    print("Loading YOLO...")
    yolo = YOLO(str(YOLO_FILE))

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

    return yolo, face_app


def extract_embedding(image, yolo, face_app):
    results = yolo.predict(
        source=image,
        conf=0.5,
        imgsz=640,
        device="cpu",
        verbose=False
    )

    boxes = results[0].boxes

    if len(boxes) == 0:
        raise RuntimeError(
            "No face detected in the photograph."
        )

    if len(boxes) != 1:
        raise RuntimeError(
            "Photograph must contain exactly one face."
        )

    x1, y1, x2, y2 = map(
        int, boxes[0].xyxy[0].tolist()
    )

    face_width = x2 - x1
    face_height = y2 - y1

    if (
        face_width < MIN_FACE_SIZE
        or face_height < MIN_FACE_SIZE
    ):
        raise RuntimeError(
            "Detected face is too small."
        )

    # Basic blur screening. This is a heuristic,
    # not a complete photograph-quality assessment.
    face_crop = image[
        max(0, y1):min(image.shape[0], y2),
        max(0, x1):min(image.shape[1], x2)
    ]

    if face_crop.size == 0:
        raise RuntimeError("Invalid face crop.")

    gray = cv2.cvtColor(
        face_crop, cv2.COLOR_BGR2GRAY
    )

    sharpness = cv2.Laplacian(
        gray, cv2.CV_64F
    ).var()

    print(f"Face sharpness score: {sharpness:.2f}")

    # Very low scores suggest an unusable image.
    if sharpness < 10:
        raise RuntimeError(
            "Face image appears severely blurred."
        )

    faces = face_app.get(image)

    if len(faces) != 1:
        raise RuntimeError(
            "InsightFace could not identify exactly "
            "one face in the photograph."
        )

    embedding = faces[0].normed_embedding

    if embedding is None:
        raise RuntimeError(
            "Unable to extract face embedding."
        )

    embedding = np.asarray(
        embedding, dtype=np.float32
    )

    if (
        embedding.shape != (512,)
        or not np.all(np.isfinite(embedding))
    ):
        raise RuntimeError(
            "Invalid face embedding."
        )

    norm = float(np.linalg.norm(embedding))

    if norm <= 1e-8:
        raise RuntimeError(
            "Face embedding has zero magnitude."
        )

    return embedding / norm


def load_existing_embeddings():
    if not EMBEDDINGS_FILE.is_file():
        return (
            np.array([], dtype="<U36"),
            np.empty((0, 512), dtype=np.float32)
        )

    with np.load(
        EMBEDDINGS_FILE, allow_pickle=False
    ) as data:
        ids = data["student_ids"].astype(str).copy()
        vectors = data["embeddings"].astype(
            np.float32
        ).copy()

    if (
        vectors.ndim != 2
        or vectors.shape[1] != 512
        or len(ids) != len(vectors)
    ):
        raise RuntimeError(
            "Existing embeddings have an invalid format."
        )

    if (
        not np.all(np.isfinite(vectors))
        or len(set(ids.tolist())) != len(ids)
    ):
        raise RuntimeError(
            "Existing embeddings contain invalid "
            "values or duplicate student IDs."
        )

    if len(vectors):
        norms = np.linalg.norm(
            vectors, axis=1, keepdims=True
        )

        if np.any(norms <= 1e-8):
            raise RuntimeError(
                "Existing embeddings have zero magnitude."
            )

        vectors = vectors / norms

    return ids, vectors


def check_identity_conflicts(
    new_embedding,
    student_id,
    ids,
    vectors
):
    if len(ids) == 0:
        return

    other_indices = [
        index for index, stored_id in enumerate(ids)
        if stored_id != student_id
    ]

    if not other_indices:
        return

    similarities = (
        vectors[other_indices] @ new_embedding
    )

    best_position = int(np.argmax(similarities))
    best_similarity = float(
        similarities[best_position]
    )

    conflicting_id = ids[
        other_indices[best_position]
    ]

    print(
        "Highest similarity to another student:",
        f"{best_similarity:.4f}"
    )

    if best_similarity >= DUPLICATE_SIMILARITY:
        raise RuntimeError(
            "Possible duplicate identity detected. "
            f"Existing student ID: {conflicting_id}. "
            "Verify the photograph manually before "
            "attempting enrollment."
        )


def save_embeddings_atomically(ids, vectors):
    PRIVATE_DIR.mkdir(
        parents=True, exist_ok=True
    )

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="wb",
            suffix=".npz",
            prefix="embeddings_",
            dir=PRIVATE_DIR,
            delete=False
        ) as temp:
            temp_path = Path(temp.name)

            np.savez_compressed(
                temp,
                student_ids=ids,
                embeddings=vectors
            )

            temp.flush()
            os.fsync(temp.fileno())

        # Confirm that the new file can be read.
        with np.load(
            temp_path, allow_pickle=False
        ) as check:
            if len(check["student_ids"]) != len(ids):
                raise RuntimeError(
                    "Embedding file verification failed."
                )

        if EMBEDDINGS_FILE.exists():
            backup_path = PRIVATE_DIR / (
                "embeddings_backup_"
                + datetime.now(timezone.utc).strftime(
                    "%Y%m%d_%H%M%S_%f"
                )
                + ".npz"
            )

            shutil.copy2(
                EMBEDDINGS_FILE,
                backup_path
            )

            print(
                "Embedding backup created:",
                backup_path
            )

        os.replace(
            temp_path,
            EMBEDDINGS_FILE
        )

        temp_path = None

    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


def save_private_photo(photo_path, student_id):
    destination_dir = ENROLLMENT_DIR / student_id

    destination_dir.mkdir(
        parents=True, exist_ok=True
    )

    destination = (
        destination_dir
        / f"imported_photo{photo_path.suffix.lower()}"
    )

    # Stage a private copy before replacing the final path.
    with tempfile.NamedTemporaryFile(
        mode="wb",
        prefix="photo_",
        suffix=photo_path.suffix.lower(),
        dir=destination_dir,
        delete=False
    ) as temp:
        temp_path = Path(temp.name)

    try:
        shutil.copyfile(photo_path, temp_path)
        os.replace(temp_path, destination)
    finally:
        temp_path.unlink(missing_ok=True)

    return destination


def enroll_from_photo(photo_path, roll_number, replace):
    students = load_students()

    student = find_student(
        students, roll_number
    )

    student_id = str(student["student_id"])

    print()
    print("Student:", student["name"])
    print("Roll number:", student["roll_number"])
    print("Student ID:", student_id)

    ids, vectors = load_existing_embeddings()

    already_enrolled = student_id in ids.tolist()

    if already_enrolled and not replace:
        raise RuntimeError(
            "This student already has a recognition "
            "profile. Use --replace only after "
            "verifying the student identity."
        )

    image = read_photo(photo_path)

    yolo, face_app = load_models()

    print("Detecting face and extracting features...")

    embedding = extract_embedding(
        image, yolo, face_app
    )

    check_identity_conflicts(
        embedding, student_id, ids, vectors
    )

    if already_enrolled:
        index = ids.tolist().index(student_id)
        vectors[index] = embedding
    else:
        ids = np.append(
            ids, np.array([student_id], dtype="<U36")
        )

        vectors = np.vstack([
            vectors,
            embedding.reshape(1, 512)
        ])

    # Preserve the photograph privately before
    # enabling its recognition profile.
    saved_photo = save_private_photo(
        photo_path, student_id
    )

    save_embeddings_atomically(
        ids.astype("<U36"),
        vectors.astype(np.float32)
    )

    print()
    print("PHOTO ENROLLMENT SUCCESSFUL")
    print("Student:", student["name"])
    print("Roll:", student["roll_number"])
    print("Total recognition profiles:", len(ids))
    print("Private photograph:", saved_photo)


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Admin-side enrollment from an existing "
            "individual student photograph."
        )
    )

    parser.add_argument(
        "--roll",
        required=True,
        help="Existing student roll number"
    )

    parser.add_argument(
        "--photo",
        required=True,
        type=Path,
        help="Path to JPG or PNG student photograph"
    )

    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace an existing recognition profile"
    )

    args = parser.parse_args()

    # Simple safeguard for the local admin workflow.
    # Real API-based access control will be added later.
    if args.replace:
        confirmation = input(
            "Type REPLACE to confirm profile "
            "replacement: "
        )

        if confirmation != "REPLACE":
            raise SystemExit(
                "Profile replacement cancelled."
            )

    try:
        enroll_from_photo(
            photo_path=args.photo.resolve(),
            roll_number=args.roll.strip(),
            replace=args.replace
        )
    except Exception as error:
        raise SystemExit(
            f"Photo enrollment failed: {error}"
        )


if __name__ == "__main__":
    main()

# .\.venv\Scripts\python.exe ai\enrollment\enroll_from_photo.py --roll "25951A05BL" --photo "F:\Dataset Images\25951A05BL.jpg"