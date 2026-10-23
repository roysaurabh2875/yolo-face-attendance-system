# CollegeVision AI — Automated YOLOv8 Facial Recognition Attendance System

An enterprise-grade, institutional face-recognition attendance management system built with **FastAPI**, **YOLOv8 & 128-d Biometric Embeddings**, **React 18**, **Tailwind CSS**, and **MySQL**.

---

## 🌟 Key Features

### 1. 🛡️ Role-Based Access Control & Portals
- **Administrator Dashboard:**
  - Student Registration & Biometric Face Enrollment (Live webcam capture or photo upload).
  - Faculty & Staff Account Management (create, reset passwords, activate/deactivate).
  - Academic Structure Management (Departments, Semesters, Sections, Classes, Rooms).
  - Timetable Scheduling with conflict detection.
  - Institution-Wide Attendance Analytics & Exportable Master CSV Registers.
  - Cryptographic Security & Authentication Event Audit Trail.
- **Faculty Dashboard:**
  - Live YOLO Facial Recognition Camera Scanner with real-time bounding box recognition.
  - Present & Absent Rosters with real-time status counters.
  - Authorized Manual Overrides with reason tracking.
  - Finalize & Seal session records into permanent academic archives.
  - Session history with roster inspection and individual session CSV exports.

### 2. ⚡ Real-Time Computer Vision & Biometrics
- **YOLOv8 Face Detection:** High-speed multi-face detection in dynamic classroom lighting conditions.
- **Biometric Cosine Matching:** 128-dimensional facial embedding vectors matched with configurable threshold ($\ge 85\%$).
- **Anti-Duplicate Buffer:** Prevents repeatedly logging the same student within an ongoing session.

### 3. 🔒 Institutional Security & Integrity
- Sealed Session Records: Once finalized by faculty, session attendance cannot be modified without administrator clearance.
- Authentication Audit: All login attempts, token issuances, and manual overrides are cryptographically logged.

---

## 🏗️ Project Architecture

```
ATTENDANCE_FACE/
├── ai/                      # YOLO model weights and biometric embedding matchers
├── backend/                 # FastAPI REST API, SQLAlchemy ORM models, routes
│   ├── academic_routes.py   # Admin management for classes, rooms, timetables
│   ├── auth_routes.py       # JWT authentication and user roles
│   ├── live_api_routes.py   # Real-time YOLO face detection, attendance, sessions
│   ├── database.py          # MySQL SQLAlchemy database engine
│   └── models.py            # Database tables and relational schemas
├── frontend/                # React 18 + Vite + Tailwind CSS Single Page Application
│   ├── src/
│   │   ├── components/      # Admin, Faculty, Scanner, Dashboard views
│   │   ├── context/         # Centralized Attendance & Authentication State
│   │   ├── services/        # REST API client
│   │   └── types/           # TypeScript interfaces
│   ├── public/              # Static assets and student reference photos
│   └── package.json
├── data/                    # Registered facial embeddings and reference photos
├── face_attendance_backup.sql # Initial database schema & seed data
├── requirements.txt         # Python backend dependencies
└── start_full_system.bat    # One-click system launcher for Windows
```

---

## 🚀 Quick Setup & Installation

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & npm
- **MySQL Server 8.0+**

---

### Step 1: Database Setup
1. Open MySQL Workbench or MySQL CLI:
   ```sql
   CREATE DATABASE face_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Import the schema and seed data:
   ```bash
   mysql -u root -p face_attendance < face_attendance_backup.sql
   ```

---

### Step 2: Backend Configuration
1. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Configure environment variables:
   Copy `database.env.example` to `database.env` and set your MySQL password:
   ```env
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_NAME=face_attendance
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   ```
   Create `jwt_secret.key` with a random 32+ character key.

4. Start the backend server:
   ```bash
   python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   *Swagger API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)*

---

### Step 3: Frontend Configuration
1. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *Frontend Application: [http://localhost:5173](http://localhost:5173)*

---

### ⚡ One-Click Windows Launch
Double-click `start_full_system.bat` to launch both the FastAPI backend and React frontend concurrently in separate terminal windows.

---

## 🔑 Default Credentials

| Portal | Username / Email | Password | Access Level |
|---|---|---|---|
| **Admin Portal** | `admin` (or `admin@collegevision.edu`) | `Admin@2026` | Full Institutional Management |
| **Faculty Portal** | `faculty` (or `faculty@collegevision.edu`) | `Faculty@2026` | Live Scanner, Attendance Rosters |

---

## 📄 License
This project is open-source under the MIT License.
