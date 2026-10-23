export type AttendanceStatus = 'present' | 'absent' | 'late';
export type AttendanceMethod = 'face_recognition' | 'manual';
export type SessionStatus = 'scheduled' | 'in_progress' | 'finalized';

export interface AuthUser {
  userId: number;
  username: string;
  role: 'ADMIN' | 'TEACHER';
  teacherId?: number;
  name: string;
  email: string;
  employeeId?: string;
  department?: string;
  designation?: string;
  avatarUrl?: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  department: string;
  designation: string;
  role: 'TEACHER' | 'ADMIN';
  avatarUrl: string;
  phone: string;
  office: string;
}

export interface Student {
  id: string;
  rollNumber: string;
  name: string;
  email: string;
  classId: string;
  className: string;
  section: string;
  avatarUrl: string;
  phone: string;
  guardianName: string;
  guardianPhone: string;
  overallAttendancePercentage: number;
  totalLecturesAttended: number;
  totalLecturesConducted: number;
  faceRegistered: boolean;
  faceEmbeddingId: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  classId: string;
  className: string;
  section: string;
  subjectCode: string;
  subjectName: string;
  date: string;
  timeSlot: string;
  status: AttendanceStatus;
  method?: AttendanceMethod;
  confidenceScore?: number; // e.g. 0.985
  timestamp?: string; // Time recorded
  modifiedByTeacherId?: string;
  modifiedByTeacherName?: string;
  modificationReason?: string;
  modifiedAt?: string;
}

export interface AttendanceSession {
  id: string;
  classId: string;
  className: string;
  section: string;
  subjectCode: string;
  subjectName: string;
  date: string;
  timeSlot: string;
  room: string;
  teacherId: string;
  teacherName: string;
  status: SessionStatus;
  startTime?: string;
  endTime?: string;
  finalizedAt?: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: 'MANUAL_CORRECTION' | 'SESSION_START' | 'SESSION_FINALIZED' | 'SESSION_END' | 'AUTO_SCAN_MATCH';
  teacherId?: string;
  teacherName?: string;
  studentId?: string;
  studentName?: string;
  previousStatus?: AttendanceStatus;
  newStatus?: AttendanceStatus;
  reason?: string;
  details: string;
}

export interface ClassOption {
  id: string;
  name: string;
  department?: string;
  sections?: string[];
}

export interface SubjectOption {
  code: string;
  name: string;
  classId: string;
}

export interface YoloDetectionAlert {
  id: string;
  timestamp: string;
  studentId?: string;
  studentName?: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  status: 'recognized' | 'low_confidence' | 'unrecognized';
}
