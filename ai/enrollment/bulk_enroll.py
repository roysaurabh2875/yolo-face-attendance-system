
import argparse
import csv
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parents[1]

SINGLE_ENROLL_SCRIPT = (
    SCRIPT_DIR / "enroll_from_photo.py"
)

PRIVATE_DIR = (
    Path.home() / "AppData" / "Local"
    / "FaceAttendancePrivate"
)

STUDENTS_FILE = PRIVATE_DIR / "students.json"
EMBEDDINGS_FILE = PRIVATE_DIR / "embeddings.npz"

IMAGE_TYPES = {".jpg", ".jpeg", ".png"}


def file_hash(path):
    hasher = hashlib.sha256()

    with path.open("rb") as file:
        for block in iter(
            lambda: file.read(1024 * 1024), b""
        ):
            hasher.update(block)

    return hasher.hexdigest()


def existing_profiles():
    if not EMBEDDINGS_FILE.exists():
        return set()

    with np.load(
        EMBEDDINGS_FILE,
        allow_pickle=False
    ) as data:
        return set(
            data["student_ids"].astype(str).tolist()
        )


def registered_students():
    with STUDENTS_FILE.open(
        encoding="utf-8"
    ) as file:
        students = json.load(file)

    return {
        str(student["roll_number"]): student
        for student in students
    }


def load_mapping(csv_file, photos_dir):
    with csv_file.open(
        newline="",
        encoding="utf-8-sig"
    ) as file:

        reader = csv.DictReader(file)

        required = {
            "roll_number",
            "photo_filename"
        }

        if not required.issubset(
            set(reader.fieldnames or [])
        ):
            raise ValueError(
                "CSV must contain roll_number "
                "and photo_filename columns."
            )

        rows = []

        for line_number, row in enumerate(
            reader, start=2
        ):
            roll = (
                row.get("roll_number") or ""
            ).strip()

            filename = (
                row.get("photo_filename") or ""
            ).strip()

            # Restrict CSV mappings to individual
            # filenames inside the selected folder.
            if (
                not roll
                or not filename
                or Path(filename).name != filename
                or "/" in filename
                or "\\" in filename
                or filename in (".", "..")
            ):
                raise ValueError(
                    f"Invalid mapping on CSV line "
                    f"{line_number}"
                )

            photo = photos_dir / filename

            rows.append({
                "line": line_number,
                "roll": roll,
                "photo": photo
            })

    return rows


def validate(rows):
    students = registered_students()
    profiles = existing_profiles()

    seen_rolls = set()
    seen_images = {}
    results = []

    for entry in rows:
        roll = entry["roll"]
        photo = entry["photo"]

        problems = []

        if roll in seen_rolls:
            problems.append(
                "Duplicate roll number in CSV"
            )

        seen_rolls.add(roll)

        student = students.get(roll)

        if student is None:
            problems.append(
                "Student record not registered"
            )

        elif str(student["student_id"]) in profiles:
            problems.append(
                "Existing recognition profile"
            )

        if not photo.is_file():
            problems.append("Photograph missing")

        elif photo.suffix.lower() not in IMAGE_TYPES:
            problems.append("Unsupported image type")

        elif photo.stat().st_size > 10 * 1024 * 1024:
            problems.append("Image exceeds 10 MB")

        else:
            digest = file_hash(photo)

            if digest in seen_images:
                problems.append(
                    "Identical photograph used "
                    f"for {seen_images[digest]}"
                )

            seen_images[digest] = roll

        results.append({
            **entry,
            "valid": len(problems) == 0,
            "reason": (
                "; ".join(problems)
                if problems else "Ready for review"
            )
        })

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Bulk student photograph enrollment"
    )

    parser.add_argument(
        "--csv",
        type=Path,
        required=True
    )

    parser.add_argument(
        "--photos",
        type=Path,
        required=True
    )

    parser.add_argument(
        "--commit",
        action="store_true",
        help="Apply valid enrollments after review"
    )

    args = parser.parse_args()

    csv_file = args.csv.resolve()
    photos_dir = args.photos.resolve()

    if not csv_file.is_file():
        parser.error("CSV file not found")

    if not photos_dir.is_dir():
        parser.error("Photograph folder not found")

    rows = load_mapping(
        csv_file, photos_dir
    )

    if not rows:
        raise SystemExit("CSV has no student mappings")

    results = validate(rows)

    print("\nBULK ENROLLMENT PREVIEW")
    print("=" * 60)

    for item in results:
        status = (
            "READY" if item["valid"]
            else "SKIPPED"
        )

        print(
            f"{status} | {item['roll']} | "
            f"{item['photo'].name} | "
            f"{item['reason']}"
        )

    ready = sum(
        item["valid"] for item in results
    )

    skipped = len(results) - ready

    print("\nTotal:", len(results))
    print("Ready:", ready)
    print("Skipped:", skipped)

    if not args.commit:
        print(
            "\nPreview only. No embeddings changed."
        )
        return

    if skipped:
        raise SystemExit(
            "Import blocked: fix or remove all "
            "invalid CSV rows before committing."
        )

    if ready == 0:
        raise SystemExit(
            "No students available for enrollment."
        )

    print(
        "\nVerify that each photograph belongs "
        "to its mapped student."
    )

    confirmation = input(
        "Type IMPORT to continue: "
    )

    if confirmation != "IMPORT":
        raise SystemExit("Import cancelled")

    succeeded = 0
    failures = []

    for item in results:
        print(
            f"\nProcessing roll {item['roll']}..."
        )

        command = [
            sys.executable,
            str(SINGLE_ENROLL_SCRIPT),
            "--roll",
            item["roll"],
            "--photo",
            str(item["photo"])
        ]

        result = subprocess.run(
            command,
            check=False
        )

        if result.returncode == 0:
            succeeded += 1
        else:
            failures.append(item["roll"])

    print("\nBULK ENROLLMENT RESULTS")
    print("=" * 40)
    print("Successful:", succeeded)
    print("Failed:", len(failures))

    if failures:
        print("Failed roll numbers:")
        for roll in failures:
            print(" -", roll)

        raise SystemExit(1)


if __name__ == "__main__":
    main()
