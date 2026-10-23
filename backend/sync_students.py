
import os
import json
import argparse
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from backend.database import SessionLocal
from backend.models import Student


PRIVATE_DIR = (
    Path(os.environ["LOCALAPPDATA"])
    / "FaceAttendancePrivate"
)

STUDENTS_FILE = PRIVATE_DIR / "students.json"


def sync_students(commit=False):
    if not STUDENTS_FILE.exists():
        print("ERROR: students.json not found.")
        return

    students = json.loads(
        STUDENTS_FILE.read_text(encoding="utf-8")
    )

    if not isinstance(students, list):
        raise ValueError("Student registry must be a list.")

    print(f"Found {len(students)} registered students.")

    # Validate all records before modifying MySQL
    required = (
        "student_id",
        "roll_number",
        "name",
        "department",
        "section"
    )

    seen_ids = set()
    seen_rolls = set()

    for record in students:
        for field in required:
            if not isinstance(record.get(field), str):
                raise ValueError(f"Invalid field: {field}")

            if not record[field].strip():
                raise ValueError(f"Empty field: {field}")

        student_id = record["student_id"].strip()
        roll = record["roll_number"].strip()

        if student_id in seen_ids or roll in seen_rolls:
            raise ValueError(
                "Duplicate student ID or roll number in JSON."
            )

        seen_ids.add(student_id)
        seen_rolls.add(roll)

    added = 0
    existing = 0

    with SessionLocal() as db:
        try:
            for record in students:
                student_id = record["student_id"].strip()
                roll_number = record["roll_number"].strip()

                by_id = db.get(Student, student_id)

                by_roll = db.scalar(
                    select(Student).where(
                        Student.roll_number == roll_number
                    )
                )

                # Do not accidentally link another
                # student's face ID to this roll number.
                if by_id and by_id.roll_number != roll_number:
                    raise ValueError(
                        "ID/roll-number conflict detected."
                    )

                if by_roll and by_roll.student_id != student_id:
                    raise ValueError(
                        "Roll number belongs to another ID."
                    )

                if by_id:
                    existing += 1
                    print("Already registered:", roll_number)
                    continue

                student = Student(
                    student_id=student_id,
                    roll_number=roll_number,
                    name=record["name"].strip(),
                    department=record["department"].strip(),
                    section=record["section"].strip(),
                    is_active=True
                )

                db.add(student)
                added += 1

                print("New student:", roll_number)

            if commit:
                db.commit()
                print("\nChanges committed to MySQL.")
            else:
                db.rollback()
                print("\nPreview only: no changes saved.")

        except (ValueError, SQLAlchemyError):
            db.rollback()
            raise

    print("New students:", added)
    print("Already existing:", existing)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--commit",
        action="store_true",
        help="Save validated changes to MySQL"
    )

    args = parser.parse_args()
    sync_students(commit=args.commit)
