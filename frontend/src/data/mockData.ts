import { Teacher, Student, AttendanceRecord, AttendanceSession, AuditLogEntry, ClassOption, SubjectOption } from '../types/attendance';

export const AUTHORIZED_TEACHERS: Teacher[] = [
  {
    id: 'TCH-1001',
    name: 'Dr. Priya Sharma',
    email: 'dr.sharma@college.edu',
    employeeId: 'EMP-FAC-001',
    department: 'CSE',
    designation: 'Faculty & Lab Incharge',
    role: 'TEACHER',
    avatarUrl: '',
    phone: '+91 98765 43210',
    office: 'Academic Block 3, Room 301'
  }
];

export const CLASSES_LIST: ClassOption[] = [
  {
    id: 'SU1',
    name: 'III SU-1',
    department: 'CSE',
    sections: ['SU-1']
  },
  {
    id: 'III SU-1',
    name: 'III SU-1',
    department: 'CSE',
    sections: ['SU-1']
  }
];

export const SUBJECTS_LIST: SubjectOption[] = [
  {
    code: 'CP301',
    name: 'Competitive Programming',
    classId: 'SU1'
  },
  {
    code: 'JFS302',
    name: 'Java Full Stack',
    classId: 'SU1'
  },
  {
    code: 'AJ303',
    name: 'ADVANCE_JAVA',
    classId: 'SU1'
  },
  {
    code: 'CP301',
    name: 'Competitive Programming',
    classId: 'III SU-1'
  },
  {
    code: 'JFS302',
    name: 'Java Full Stack',
    classId: 'III SU-1'
  },
  {
    code: 'AJ303',
    name: 'ADVANCE_JAVA',
    classId: 'III SU-1'
  }
];

// Clean state: Populated dynamically from backend / MySQL
export const INITIAL_STUDENTS: Student[] = [];

export const CURRENT_DATE_STRING = new Date().toISOString().split('T')[0];

export const INITIAL_SESSION: AttendanceSession = {
  id: 'SES-001',
  classId: 'SU1',
  className: 'III SU-1',
  section: 'SU-1',
  subjectCode: 'CP301',
  subjectName: 'Competitive Programming',
  date: CURRENT_DATE_STRING,
  timeSlot: '09:30 AM - 12:15 PM',
  room: 'Room 301 (CSE Lab)',
  teacherId: 'TCH-1001',
  teacherName: 'Dr. Priya Sharma',
  status: 'scheduled',
  startTime: '09:30 AM',
  totalStudents: 110,
  presentCount: 0,
  absentCount: 110
};

// Clean state: Initially empty
export const INITIAL_ATTENDANCE_RECORDS: AttendanceRecord[] = [];

// Clean state: Initially empty
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];

// Clean state: Initially empty
export const HISTORICAL_SESSIONS: AttendanceSession[] = [];
