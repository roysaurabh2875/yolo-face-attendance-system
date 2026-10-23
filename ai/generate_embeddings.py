
import os
import json
import cv2
import numpy as np

from pathlib import Path
from insightface.app import FaceAnalysis

# Private storage outside the OneDrive project
DATA_DIR = (
    Path(os.environ["LOCALAPPDATA"])
    / "FaceAttendancePrivate"
)

ENROLLMENT_DIR = DATA_DIR / "enrollment"
STUDENTS_FILE = DATA_DIR / "students.json"
EMBEDDINGS_FILE = DATA_DIR / "embeddings.npz"

if not STUDENTS_FILE.exists():
    raise SystemExit("Student registry not found.")

students = json.loads(
    STUDENTS_FILE.read_text(encoding="utf-8")
)

if not students:
    raise SystemExit("No registered students found.")

# Load ArcFace recognition and face alignment models
print("Loading InsightFace models...")

app = FaceAnalysis(
    name="buffalo_l",
    providers=["CPUExecutionProvider"],
    allowed_modules=["detection", "recognition"]
)

app.prepare(
    ctx_id=-1,
    det_size=(640, 640)
)

student_ids = []
student_embeddings = []

for student in students:
    student_id = student["student_id"]

    image_folder = ENROLLMENT_DIR / student_id

    if not image_folder.exists():
        print("Missing enrollment folder:", student_id)
        continue

    embeddings = []

    for image_path in sorted(image_folder.glob("*.jpg")):
        image = cv2.imread(str(image_path))

        if image is None:
            print("Cannot read:", image_path.name)
            continue

        faces = app.get(image)

        if len(faces) != 1:
            print(
                "Skipping",
                image_path.name,
                "- detected faces:",
                len(faces)
            )
            continue

        embedding = faces[0].normed_embedding

        if embedding is not None:
            embeddings.append(embedding)

    if not embeddings:
        print("No valid embeddings for:", student_id)
        continue

    # Average the registered face embeddings
    average = np.mean(
        np.asarray(embeddings, dtype=np.float32),
        axis=0
    )

    # Normalize the resulting vector
    norm = np.linalg.norm(average)

    if norm <= 1e-8:
        print("Invalid embedding:", student_id)
        continue

    average = average / norm

    student_ids.append(student_id)
    student_embeddings.append(average)

    print(
        f"Created embedding for student {student_id} "
        f"using {len(embeddings)} images."
    )

if not student_embeddings:
    raise SystemExit(
        "No valid face embeddings were generated."
    )

# Save outside the synchronized project folder
np.savez_compressed(
    EMBEDDINGS_FILE,
    student_ids=np.asarray(student_ids),
    embeddings=np.asarray(
        student_embeddings,
        dtype=np.float32
    )
)

print("\nEmbedding generation completed!")
print("Students processed:", len(student_ids))
print("Embedding dimensions:", student_embeddings[0].shape)
print("Saved in private local storage.")
