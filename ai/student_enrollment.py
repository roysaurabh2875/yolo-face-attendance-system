
import json
import os
import subprocess
import sys
import tempfile
import uuid

from datetime import datetime
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
AI_DIR = PROJECT_ROOT / "ai"

PRIVATE_DIR = Path(
    os.environ.get("LOCALAPPDATA", str(Path.home()))
) / "FaceAttendancePrivate"

STUDENTS_FILE = PRIVATE_DIR / "students.json"

CAMERA_SCRIPT = AI_DIR / "register_student.py"
PHOTO_SCRIPT = AI_DIR / "enrollment" / "enroll_from_photo.py"


def load_students():
    if not STUDENTS_FILE.exists():
        return []

    with STUDENTS_FILE.open("r", encoding="utf-8") as file:
        students = json.load(file)

    if not isinstance(students, list):
        raise ValueError("Unexpected students.json format")

    return students


def save_students(students):
    PRIVATE_DIR.mkdir(parents=True, exist_ok=True)

    # Write safely so a failed write doesn't corrupt the registry.
    fd, temporary_path = tempfile.mkstemp(
        prefix="students_",
        suffix=".tmp",
        dir=PRIVATE_DIR
    )

    try:
        with os.fdopen(fd, "w", encoding="utf-8") as file:
            json.dump(students, file, indent=2)
            file.flush()
            os.fsync(file.fileno())

        os.replace(temporary_path, STUDENTS_FILE)

    finally:
        if os.path.exists(temporary_path):
            os.remove(temporary_path)


def ask_details():
    print("\n--- Student Details ---")

    name = input("Enter student name: ").strip()
    roll = input("Enter roll number: ").strip().upper()
    department = input("Enter department: ").strip()
    section = input("Enter section: ").strip().upper()

    if not all([name, roll, department, section]):
        print("All student details are required.")
        return None

    consent = input(
        "Student consents to face enrollment? (yes/no): "
    ).strip().lower()

    if consent != "yes":
        print("Registration cancelled: consent required.")
        return None

    return {
        "name": name,
        "roll_number": roll,
        "department": department,
        "section": section,
    }


def camera_enrollment():
    print("\nStarting live camera registration...")

    if not CAMERA_SCRIPT.is_file():
        print("Camera registration script not found.")
        return

    subprocess.run(
        [sys.executable, str(CAMERA_SCRIPT)],
        cwd=str(PROJECT_ROOT),
        check=False
    )


def photo_enrollment():
    print("\nStarting photograph registration...")

    details = ask_details()

    if details is None:
        return

    roll = details["roll_number"]

    photo_path = input(
        "\nEnter full photograph path: "
    ).strip().strip('"').strip("'")

    photo = Path(photo_path)

    if not photo.is_file():
        print("Photograph not found. Check the path.")
        return

    if photo.suffix.lower() not in (".jpg", ".jpeg", ".png"):
        print("Only JPG, JPEG and PNG are supported.")
        return

    if not PHOTO_SCRIPT.is_file():
        print("Photo enrollment script not found.")
        return

    students = load_students()

    existing = next(
        (
            student for student in students
            if student.get("roll_number", "").upper() == roll
        ),
        None
    )

    if existing:
        print("\nRoll number already registered.")
        print("Student:", existing.get("name"))
        print("Proceeding with face enrollment for this record.")

        confirm = input(
            "Is this the correct student? (yes/no): "
        ).strip().lower()

        if confirm != "yes":
            print("Enrollment cancelled.")
            return
    else:
        new_student = {
            "student_id": str(uuid.uuid4()),
            **details,
            "registered_at": datetime.now().astimezone().isoformat()
        }

        students.append(new_student)
        save_students(students)

        print("\nStudent record created successfully.")

    print("\nProcessing photograph with YOLO and InsightFace...")

    result = subprocess.run(
        [
            sys.executable,
            str(PHOTO_SCRIPT),
            "--roll", roll,
            "--photo", str(photo.resolve())
        ],
        cwd=str(PROJECT_ROOT),
        check=False
    )

    if result.returncode == 0:
        print("\nPhotograph enrollment completed successfully.")
    else:
        print("\nPhotograph enrollment did not complete.")
        print("Check the error above.")
        print("The student record remains available for retry.")


def main():
    print("\n====================================")
    print(" YOLO FACE ATTENDANCE SYSTEM")
    print(" STUDENT REGISTRATION")
    print("====================================")

    print("\nSelect enrollment method:")
    print("1. Live Face Scanning (Camera)")
    print("2. Register Using Photograph")
    print("3. Exit")

    choice = input("\nEnter your choice (1/2/3): ").strip()

    if choice == "1":
        camera_enrollment()

    elif choice == "2":
        photo_enrollment()

    elif choice == "3":
        print("Registration cancelled.")

    else:
        print("Invalid choice. Select 1, 2 or 3.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"\nRegistration error: {error}")
        sys.exit(1)
