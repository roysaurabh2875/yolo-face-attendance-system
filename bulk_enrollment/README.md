# Bulk Student Enrollment Guide

Use this folder to enroll all your students at once into the **AI Face Attendance System**.

---

## How to Add All Students at Once

### Method 1: Drop Photos into `photos/` (Easiest)
1. Place student face photographs into the `bulk_enrollment/photos/` folder.
2. Name the files using either format:
   - `ROLLNUMBER_FirstName_LastName.jpg` (e.g., `21BCS001_Aarav_Mehta.jpg`)
   - OR `ROLLNUMBER.jpg` (e.g., `21BCS001.jpg`)
3. Double-click `run_bulk_enroll.bat` (or run `python ai/enrollment/bulk_enroll_all.py`).

---

### Method 2: Use CSV File + Photos
1. Copy `students_template.csv` to `students.csv`.
2. Fill in the columns:
   ```csv
   roll_number,name,department,section,photo_filename
   21BCS001,Aarav Mehta,CSE,A,aarav.jpg
   21BCS002,Ananya Deshmukh,CSE,A,ananya.jpg
   ```
3. Place `aarav.jpg` and `ananya.jpg` inside `bulk_enrollment/photos/`.
4. Double-click `run_bulk_enroll.bat`.

---

## What Happens Automatically:
- YOLOv8 detects the face position.
- InsightFace ArcFace calculates the **512-dimensional facial embedding vector**.
- MySQL records are created in `students`, `enrollments`, and `class_student_assignments`.
- Biometric vectors are saved in `embeddings.npz` and `students.json`.
- The web portal immediately shows all enrolled students and recognizes them on the camera!
