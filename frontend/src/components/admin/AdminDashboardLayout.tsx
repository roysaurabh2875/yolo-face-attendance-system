import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { api } from '../../services/api';
import { Student } from '../../types/attendance';
import { 
  ShieldCheck, 
  Users, 
  UserCheck, 
  UserX, 
  GraduationCap, 
  BookOpen, 
  School, 
  Calendar, 
  Clock, 
  Download, 
  FileSpreadsheet, 
  Lock, 
  Key, 
  History, 
  Search, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Camera, 
  Upload, 
  LogOut, 
  Eye, 
  RefreshCw, 
  ChevronRight,
  ShieldAlert,
  Percent,
  Sparkles,
  SlidersHorizontal,
  X,
  ScanFace,
  Edit2,
  Trash2,
  Laptop,
  Smartphone,
  Video,
  Power,
  Menu,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface AdminDashboardLayoutProps {
  onOpenLiveScanner?: () => void;
}

export const AdminDashboardLayout: React.FC<AdminDashboardLayoutProps> = ({ onOpenLiveScanner }) => {
  const { currentUser, logout, students, refreshData, addToast } = useAttendance();

  // Active module tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'students' | 'faculty' | 'academic' | 'timetable' | 'sessions' | 'reports' | 'security'
  >('overview');

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Stats
  const [stats, setStats] = useState<any>({
    total_students: 110,
    total_active_students: 110,
    total_teachers: 1,
    total_classes: 1,
    total_subjects: 3,
    total_classrooms: 1,
    total_sessions: 0,
    finalized_sessions: 0,
    overall_attendance_rate: 0.0
  });

  // Data states
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [authEvents, setAuthEvents] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [classroomsList, setClassroomsList] = useState<any[]>([]);
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [timetableList, setTimetableList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Student search & filter
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentForFace, setSelectedStudentForFace] = useState<Student | null>(null);

  // Modals state
  const [showStudentRegModal, setShowStudentRegModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);

  const [showFaceEnrollModal, setShowFaceEnrollModal] = useState(false);
  const [showTeacherRegModal, setShowTeacherRegModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<any>(null);

  const [showAccountCreateModal, setShowAccountCreateModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [selectedAccountForReset, setSelectedAccountForReset] = useState<any>(null);

  // Academic Modals state (Add / Edit)
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);

  const [showClassroomModal, setShowClassroomModal] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<any>(null);

  const [showTimetableModal, setShowTimetableModal] = useState(false);
  const [editingTimetable, setEditingTimetable] = useState<any>(null);

  const [showSessionCreateModal, setShowSessionCreateModal] = useState(false);

  // Form States
  const [newStudent, setNewStudent] = useState({
    roll_number: '',
    name: '',
    department: 'CSE',
    section: 'SU-1',
    email: '',
    phone: '',
    guardian_name: '',
    guardian_phone: ''
  });

  // Student Registration Photo state
  const [regPhotoSource, setRegPhotoSource] = useState<'none' | 'camera' | 'upload'>('none');
  const [regPhotoBase64, setRegPhotoBase64] = useState<string>('');

  // Standalone Face Enrollment Photo state
  const [enrollPhotoBase64, setEnrollPhotoBase64] = useState<string>('');
  const [enrollPhotoSource, setEnrollPhotoSource] = useState<'camera' | 'upload'>('camera');

  // Camera Devices & Laptop Camera Prioritization
  const [videoDevices, setVideoDevices] = useState<Array<{
    deviceId: string;
    label: string;
    isLaptop: boolean;
  }>>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [webcamStreaming, setWebcamStreaming] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Faculty form
  const [newTeacher, setNewTeacher] = useState({
    employee_code: '',
    teacher_name: '',
    department: 'CSE',
    email: '',
    create_login: true,
    login_username: '',
    login_password: 'Faculty@123'
  });

  // User Account form
  const [newAccount, setNewAccount] = useState({
    username: '',
    password: '',
    teacher_id: 1,
    role: 'TEACHER'
  });

  const [resetPassInput, setResetPassInput] = useState('');

  // Class form
  const [classFormData, setClassFormData] = useState({
    class_code: '',
    department: 'CSE',
    academic_year: '2026-2027',
    year_number: 3,
    semester_number: 5,
    section: 'SU-1'
  });

  // Classroom form
  const [classroomFormData, setClassroomFormData] = useState({
    room_number: '',
    building: 'Academic Block 3',
    capacity: 60
  });

  // Timetable form
  const [timetableFormData, setTimetableFormData] = useState({
    class_id: 1,
    subject_id: 1,
    teacher_id: 1,
    classroom_id: 1,
    day_of_week: 1,
    period_number: 1,
    start_time: '09:30',
    end_time: '12:15'
  });

  // Session form
  const [newSessionData, setNewSessionData] = useState({
    subject_id: 1,
    section: 'SU-1',
    session_date: new Date().toISOString().split('T')[0],
    period_number: 1
  });

  // Camera Enumeration with Laptop Camera Prioritization
  const enumerateCameras = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');

      const classified = videoInputs.map((d, index) => {
        const rawLabel = d.label || `Camera ${index + 1}`;
        const lower = rawLabel.toLowerCase();

        const isPhoneOrVirtual =
          lower.includes('phone') ||
          lower.includes('droidcam') ||
          lower.includes('iriun') ||
          lower.includes('camo') ||
          lower.includes('virtual') ||
          lower.includes('continuity') ||
          lower.includes('link to windows') ||
          lower.includes('epoccam') ||
          lower.includes('obs');

        const isLaptop =
          lower.includes('integrated') ||
          lower.includes('internal') ||
          lower.includes('laptop') ||
          lower.includes('builtin') ||
          lower.includes('front') ||
          lower.includes('hd webcam') ||
          lower.includes('webcam') ||
          !isPhoneOrVirtual;

        const displayName = isLaptop && !isPhoneOrVirtual
          ? `💻 ${rawLabel || 'Laptop Integrated Webcam'}`
          : isPhoneOrVirtual
          ? `📱 ${rawLabel || 'Phone / Virtual Camera'}`
          : `📷 ${rawLabel}`;

        return {
          deviceId: d.deviceId,
          label: displayName,
          isLaptop: isLaptop && !isPhoneOrVirtual
        };
      });

      classified.sort((a, b) => (b.isLaptop ? 1 : 0) - (a.isLaptop ? 1 : 0));
      setVideoDevices(classified);

      if (classified.length > 0) {
        setSelectedDeviceId((curr) => {
          if (curr && classified.some((c) => c.deviceId === curr)) return curr;
          const best = classified.find((c) => c.isLaptop) || classified[0];
          return best.deviceId;
        });
      }
    } catch (err) {
      console.warn('Camera device enumeration failed:', err);
    }
  }, []);

  useEffect(() => {
    enumerateCameras();
  }, [enumerateCameras]);

  // Start Webcam with Selected Device
  const startWebcam = async (deviceId?: string) => {
    stopWebcam();
    try {
      const devId = deviceId || selectedDeviceId;
      const constraints: MediaStreamConstraints = {
        video: devId
          ? { deviceId: { exact: devId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setWebcamStreaming(true);
      }
      enumerateCameras();
    } catch (err) {
      console.error('Camera startup error:', err);
      addToast('error', 'Webcam Error', 'Could not access the selected camera. Please check permissions.');
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setWebcamStreaming(false);
  };

  const switchCamera = (newDevId: string) => {
    setSelectedDeviceId(newDevId);
    if (webcamStreaming) {
      startWebcam(newDevId);
    }
  };

  // Capture frame to base64
  const captureFrame = (onCapture: (b64: string) => void) => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL('image/jpeg', 0.92);
      onCapture(b64);
      stopWebcam();
    }
  };

  // Fetch initial admin overview data
  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, sessRes, eventsRes, classesRes, roomsRes, teachersRes, accountsRes, ttRes] = await Promise.all([
        api.getAdminOverviewStats().catch(() => null),
        api.getAdminSessions().catch(() => []),
        api.getAuthEvents().catch(() => []),
        api.getAdminClasses().catch(() => ({ classes: [] })),
        api.getAdminClassrooms().catch(() => ({ classrooms: [] })),
        api.getAdminTeachers().catch(() => ({ teachers: [] })),
        api.getAdminAccounts().catch(() => []),
        api.getAdminTimetable().catch(() => ({ timetable: [] }))
      ]);

      if (statsRes) setStats(statsRes);
      if (Array.isArray(sessRes)) setAllSessions(sessRes);
      if (Array.isArray(eventsRes)) setAuthEvents(eventsRes);
      if (classesRes?.classes) setClassesList(classesRes.classes);
      if (roomsRes?.classrooms) setClassroomsList(roomsRes.classrooms);
      if (teachersRes?.teachers) setTeachersList(teachersRes.teachers);
      if (Array.isArray(accountsRes)) setAccountsList(accountsRes);
      if (ttRes?.timetable) setTimetableList(ttRes.timetable);
    } catch (e) {
      console.warn('Error loading admin data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  // Filter students
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.rollNumber.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.section.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  // Handle register student with optional live photo or uploaded image
  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.roll_number || !newStudent.name) {
      addToast('error', 'Missing Information', 'Roll Number and Name are mandatory.');
      return;
    }

    try {
      const payload = {
        ...newStudent,
        face_image: regPhotoBase64 || undefined
      };

      const res = await api.adminRegisterStudent(payload);
      if (res.success) {
        addToast(
          'success', 
          'Student Registered', 
          res.face_enrolled 
            ? `Registered ${newStudent.roll_number} with InsightFace Biometrics!` 
            : `Registered ${newStudent.roll_number} - ${newStudent.name}`
        );

        setShowStudentRegModal(false);
        stopWebcam();
        setRegPhotoBase64('');
        setRegPhotoSource('none');
        setNewStudent({
          roll_number: '',
          name: '',
          department: 'CSE',
          section: 'SU-1',
          email: '',
          phone: '',
          guardian_name: '',
          guardian_phone: ''
        });
        refreshData();
        loadAdminData();
      }
    } catch (err: any) {
      addToast('error', 'Registration Failed', err.message);
    }
  };

  // Student Update / Edit
  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      const res = await api.updateAdminStudent(editingStudent.id, editingStudent);
      if (res.success) {
        addToast('success', 'Student Updated', res.message);
        setEditingStudent(null);
        refreshData();
        loadAdminData();
      }
    } catch (err: any) {
      addToast('error', 'Student Update Failed', err.message);
    }
  };

  // Student Deletion
  const handleDeleteStudent = async (student: Student) => {
    if (!window.confirm(`Are you sure you want to permanently delete student ${student.rollNumber} - ${student.name}? This will also delete their biometric face vector.`)) return;
    try {
      const res = await api.deleteAdminStudent(student.id);
      if (res.success) {
        addToast('info', 'Student Deleted', res.message);
        refreshData();
        loadAdminData();
      }
    } catch (err: any) {
      addToast('error', 'Delete Failed', err.message);
    }
  };

  // Submit Biometric Enrollment for existing student
  const handleEnrollFaceSubmit = async () => {
    if (!selectedStudentForFace || !enrollPhotoBase64) {
      addToast('error', 'Missing Photo', 'Please capture or upload a face photograph first.');
      return;
    }

    try {
      const res = await api.adminEnrollFace(selectedStudentForFace.id, enrollPhotoBase64);
      if (res.success) {
        addToast('success', 'Face Biometrics Enrolled', res.message);
        setShowFaceEnrollModal(false);
        stopWebcam();
        setEnrollPhotoBase64('');
        setSelectedStudentForFace(null);
        refreshData();
      }
    } catch (err: any) {
      addToast('error', 'Face Enrollment Failed', err.message);
    }
  };

  // Toggle Student Status
  const handleToggleStudent = async (studentId: string) => {
    try {
      const res = await api.toggleStudentStatus(studentId);
      if (res.success) {
        addToast('info', 'Status Updated', res.message);
        refreshData();
      }
    } catch (err: any) {
      addToast('error', 'Update Failed', err.message);
    }
  };

  // Faculty Creation / Quick Register
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacher.employee_code || !newTeacher.teacher_name) {
      addToast('error', 'Missing Fields', 'Employee Code and Faculty Name are required.');
      return;
    }

    try {
      const res = await api.createAdminTeacher(newTeacher);
      if (res.success || res.message) {
        addToast('success', 'Faculty Registered', res.message || `Registered ${newTeacher.teacher_name}`);
        setShowTeacherRegModal(false);
        setNewTeacher({
          employee_code: '',
          teacher_name: '',
          department: 'CSE',
          email: '',
          create_login: true,
          login_username: '',
          login_password: 'Faculty@123'
        });
        loadAdminData();
      }
    } catch (err: any) {
      addToast('error', 'Faculty Creation Failed', err.message);
    }
  };

  // Faculty Update / Edit
  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    try {
      const res = await api.updateAdminTeacher(editingTeacher.teacher_id, editingTeacher);
      if (res.success) {
        addToast('success', 'Faculty Updated', res.message);
        setEditingTeacher(null);
        loadAdminData();
      }
    } catch (err: any) {
      addToast('error', 'Update Failed', err.message);
    }
  };

  // Faculty Deletion
  const handleDeleteTeacher = async (teacher: any) => {
    if (!window.confirm(`Are you sure you want to delete faculty member ${teacher.teacher_name}? Their linked user account and teaching assignments will also be unlinked.`)) return;
    try {
      const res = await api.deleteAdminTeacher(teacher.teacher_id);
      if (res.success) {
        addToast('info', 'Faculty Deleted', res.message);
        loadAdminData();
      }
    } catch (err: any) {
      addToast('error', 'Delete Failed', err.message);
    }
  };

  // Toggle Faculty Status
  const handleToggleTeacher = async (teacherId: number) => {
    try {
      const res = await api.toggleAdminTeacherStatus(teacherId);
      if (res.success) {
        addToast('info', 'Faculty Status Changed', res.message);
        loadAdminData();
      }
    } catch (err: any) {
      addToast('error', 'Toggle Failed', err.message);
    }
  };

  // Account Creation
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.username || !newAccount.password) {
      addToast('error', 'Missing Fields', 'Username and Password are required.');
      return;
    }
    try {
      const res = await api.createAdminAccount(newAccount);
      if (res.success) {
        addToast('success', 'Login Account Created', res.message);
        setShowAccountCreateModal(false);
        setNewAccount({ username: '', password: '', teacher_id: 1, role: 'TEACHER' });
        loadAdminData();
      }
    } catch (err: any) {
      addToast('error', 'Account Creation Failed', err.message);
    }
  };

  // Account Update / Edit
  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    try {
      const res = await api.updateAdminAccount(editingAccount.user_id, editingAccount);
      if (res.success) {
        addToast('success', 'Account Updated', res.message);
        setEditingAccount(null);
        loadAdminData();
      }
    } catch (err: any) {
      addToast('error', 'Account Update Failed', err.message);
    }
  };

  // Account Deletion
  const handleDeleteAccount = async (account: any) => {
    if (account.username === 'admin' || account.username === 'saurabh2875') {
      addToast('error', 'Protected Account', 'Root administrator accounts cannot be deleted.');
      return;
    }
    if (!window.confirm(`Delete user login account "${account.username}"?`)) return;
    try {
      const res = await api.deleteAdminAccount(account.user_id);
      if (res.success) {
        addToast('info', 'Account Deleted', res.message);
        loadAdminData();
      }
    } catch (err: any) {
      addToast('error', 'Delete Failed', err.message);
    }
  };

  // Toggle Account Active / Inactive
  const handleToggleAccount = async (account: any) => {
    try {
      const res = await api.toggleAccountStatus(account.user_id, !account.is_active);
      if (res) {
        addToast('info', 'Account Status Changed', `Account ${account.username} is now ${!account.is_active ? 'Active' : 'Disabled'}`);
        loadAdminData();
      }
    } catch (err: any) {
      addToast('error', 'Update Failed', err.message);
    }
  };

  // Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountForReset || !resetPassInput) return;
    try {
      await api.resetAccountPassword(selectedAccountForReset.user_id, resetPassInput);
      addToast('success', 'Password Reset', `Password updated for ${selectedAccountForReset.username}`);
      setShowPasswordResetModal(false);
      setResetPassInput('');
      loadAdminData();
    } catch (err: any) {
      addToast('error', 'Reset Failed', err.message);
    }
  };

  // Create or Update Academic Class
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClass) {
        const res = await api.updateAdminClass(editingClass.class_id, classFormData);
        addToast('success', 'Class Updated', res.message);
      } else {
        await api.createAdminClass(classFormData);
        addToast('success', 'Academic Class Created', `Created ${classFormData.class_code}`);
      }
      setShowClassModal(false);
      setEditingClass(null);
      loadAdminData();
    } catch (err: any) {
      addToast('error', 'Class Action Failed', err.message);
    }
  };

  const handleToggleClass = async (classId: number) => {
    try {
      const res = await api.toggleAdminClassStatus(classId);
      addToast('info', 'Class Status Toggled', res.message);
      loadAdminData();
    } catch (err: any) {
      addToast('error', 'Toggle Failed', err.message);
    }
  };

  // Create or Update Classroom
  const handleSaveClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClassroom) {
        const res = await api.updateAdminClassroom(editingClassroom.room_id, classroomFormData);
        addToast('success', 'Classroom Updated', res.message);
      } else {
        await api.createAdminClassroom(classroomFormData);
        addToast('success', 'Classroom Registered', `Room ${classroomFormData.room_number}`);
      }
      setShowClassroomModal(false);
      setEditingClassroom(null);
      loadAdminData();
    } catch (err: any) {
      addToast('error', 'Classroom Action Failed', err.message);
    }
  };

  const handleToggleClassroom = async (roomId: number) => {
    try {
      const res = await api.toggleAdminClassroomStatus(roomId);
      addToast('info', 'Classroom Status Toggled', res.message);
      loadAdminData();
    } catch (err: any) {
      addToast('error', 'Toggle Failed', err.message);
    }
  };

  // Save Timetable Slot
  const handleSaveTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTimetable) {
        const res = await api.updateAdminTimetable(editingTimetable.timetable_id, timetableFormData);
        addToast('success', 'Timetable Updated', res.message);
      } else {
        const res = await api.createAdminTimetable(timetableFormData);
        addToast('success', 'Timetable Slot Scheduled', res.message);
      }
      setShowTimetableModal(false);
      setEditingTimetable(null);
      loadAdminData();
    } catch (err: any) {
      addToast('error', 'Timetable Action Failed', err.message);
    }
  };

  const handleDeleteTimetable = async (timetableId: number) => {
    if (!window.confirm('Are you sure you want to delete this timetable slot?')) return;
    try {
      const res = await api.deleteAdminTimetable(timetableId);
      addToast('info', 'Timetable Deleted', res.message);
      loadAdminData();
    } catch (err: any) {
      addToast('error', 'Delete Failed', err.message);
    }
  };

  // Create Session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.adminCreateSession(newSessionData);
      if (res.success) {
        addToast('success', 'Session Scheduled', `Session #${res.session_id} is now scheduled.`);
        setShowSessionCreateModal(false);
        loadAdminData();
      }
    } catch (err: any) {
      addToast('error', 'Session Creation Failed', err.message);
    }
  };

  // Finalize Session
  const handleFinalizeSession = async (sessionId: number) => {
    try {
      const res = await api.adminFinalizeSession(sessionId);
      if (res.success) {
        addToast('success', 'Session Finalized', res.message);
        loadAdminData();
      }
    } catch (err: any) {
      addToast('error', 'Finalization Failed', err.message);
    }
  };

  // State for session roster inspection and CSV download
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);
  const [expandedRecords, setExpandedRecords] = useState<Record<number, any[]>>({});
  const [loadingSessionRecords, setLoadingSessionRecords] = useState<Record<number, boolean>>({});
  const [downloadingSessionId, setDownloadingSessionId] = useState<number | null>(null);

  const handleToggleExpandSession = async (sessionId: number) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      return;
    }
    setExpandedSessionId(sessionId);
    if (!expandedRecords[sessionId]) {
      setLoadingSessionRecords((prev) => ({ ...prev, [sessionId]: true }));
      try {
        const res = await api.getPostedSessionRecords(sessionId);
        if (res?.records && Array.isArray(res.records)) {
          setExpandedRecords((prev) => ({ ...prev, [sessionId]: res.records }));
        }
      } catch (err) {
        console.warn('Could not load session records:', err);
      } finally {
        setLoadingSessionRecords((prev) => ({ ...prev, [sessionId]: false }));
      }
    }
  };

  const handleDownloadSessionCsv = async (s: any) => {
    const sessionId = s.session_id || parseInt(String(s.id).replace(/\D/g, ''), 10);
    setDownloadingSessionId(sessionId);
    try {
      const res = await api.getPostedSessionRecords(sessionId);
      const recordsToExport = res?.records && Array.isArray(res.records) ? res.records : [];

      const sessionIdentifier = s.id || `SES-${String(sessionId).padStart(3, '0')}`;
      const subjectCode = s.subject_code || 'CP301';
      const subjectName = s.subject_name || 'Competitive Programming';
      const className = s.class_name || 'III SU-1';
      const section = s.section || 'SU-1';
      const dateStr = s.date || new Date().toISOString().split('T')[0];
      const timeSlot = s.time_slot || '09:30 AM - 12:15 PM';
      const totalStudents = s.total_students || 110;
      const presentCount = s.present_count || 0;
      const absentCount = s.absent_count !== undefined ? s.absent_count : (totalStudents - presentCount);
      const rate = s.attendance_rate !== undefined ? s.attendance_rate : (totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(1) : '0.0');

      const csvRows: string[][] = [
        ["CollegeVision Institutional Attendance Register - Session Report"],
        [`Session ID: ${sessionIdentifier}`],
        [`Subject: ${subjectCode} - ${subjectName}`],
        [`Class: ${className} | Section: ${section}`],
        [`Date: ${dateStr} | Time Slot: ${timeSlot}`],
        [`Total Students: ${totalStudents} | Present: ${presentCount} | Absent: ${absentCount} | Attendance Rate: ${rate}%`],
        [],
        ["Roll Number", "Student Name", "Department", "Section", "Status", "Detection Source", "Timestamp"]
      ];

      recordsToExport.forEach((r: any) => {
        csvRows.push([
          r.roll_number || r.student_id,
          `"${r.student_name}"`,
          r.department || 'CSE',
          r.section || section,
          (r.status || 'absent').toUpperCase(),
          r.source || 'SYSTEM',
          r.timestamp || '-'
        ]);
      });

      const csvContent = csvRows.map((row) => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Session_Attendance_${sessionIdentifier}_${subjectCode}_${dateStr}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'Session Register Downloaded', `Attendance CSV for ${sessionIdentifier} (${subjectCode}) downloaded.`);
    } catch (err: any) {
      addToast('error', 'Download Failed', err.message || 'Could not download session attendance records.');
    } finally {
      setDownloadingSessionId(null);
    }
  };

  const DAYS_MAP: Record<number, string> = {
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
    7: 'Sunday'
  };

  const sidebarNavItems = [
    { id: 'overview', label: 'Institutional Overview', icon: SlidersHorizontal, badge: null },
    { id: 'students', label: 'Students & Biometrics', icon: Users, badge: `${students.length}` },
    { id: 'faculty', label: 'Faculty & Logins', icon: GraduationCap, badge: `${teachersList.length}` },
    { id: 'academic', label: 'Classes & Rooms', icon: School, badge: `${classesList.length}` },
    { id: 'timetable', label: 'Timetables & Schedule', icon: Calendar, badge: `${timetableList.length}` },
    { id: 'sessions', label: 'Attendance Sessions', icon: Clock, badge: `${allSessions.length}` },
    { id: 'reports', label: 'Reports & Register', icon: FileSpreadsheet, badge: 'CSV' },
    { id: 'security', label: 'Security & Audit', icon: History, badge: `${authEvents.length}` }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Admin Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950 border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center font-bold text-sm shadow-inner">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white tracking-tight leading-tight">
                CollegeVision Admin Console
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                SUPER ADMIN
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Institutional Governance, Biometric Management & Academic Controls
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          {onOpenLiveScanner && (
            <button
              onClick={onOpenLiveScanner}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors cursor-pointer"
              title="Launch live webcam face recognition scanner feed"
            >
              <ScanFace className="w-4 h-4" />
              <span className="hidden sm:inline">View Live YOLO Scanner</span>
            </button>
          )}

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          {/* User Profile Pill */}
          <div className="flex items-center gap-2 text-xs">
            <div className="text-right hidden md:block">
              <span className="block font-semibold text-white leading-none">
                {currentUser?.username.toUpperCase()}
              </span>
              <span className="text-[10px] text-amber-400">Chief Administrator</span>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700/60 transition-colors cursor-pointer"
              title="Logout from Admin Console"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container with LEFT SIDEBAR & Content Area */}
      <div className="flex-1 flex max-w-[1800px] w-full mx-auto relative">
        {/* Mobile Backdrop */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-950/70 z-40 lg:hidden backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* ========================================================================= */}
        {/* LEFT SIDEBAR NAVIGATION (MOVED TO THE LEFT AS REQUESTED)                   */}
        {/* ========================================================================= */}
        <aside
          className={`fixed lg:sticky top-0 lg:top-[57px] left-0 z-40 lg:z-10 w-64 h-full lg:h-[calc(100vh-57px)] bg-slate-950/95 lg:bg-slate-950 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          {/* Mobile Drawer Header */}
          <div className="p-4 flex items-center justify-between border-b border-slate-800 lg:hidden">
            <span className="font-bold text-white text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" /> Navigation
            </span>
            <button onClick={() => setMobileSidebarOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Governance Suites
          </div>

          {/* Navigation Items List */}
          <div className="flex-1 px-3 space-y-1 overflow-y-auto">
            {sidebarNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                      active ? 'bg-amber-500/30 text-amber-200' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sidebar Footer Info */}
          <div className="p-4 border-t border-slate-800/80 text-[11px] text-slate-400 bg-slate-950/60">
            <div className="flex items-center gap-2 text-slate-300 font-semibold mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              MySQL Engine Live
            </div>
            <div className="text-[10px] text-slate-500">Port 8000 · Model YOLOv8</div>
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* RIGHT MAIN CONTENT AREA                                                   */}
        {/* ========================================================================= */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-mono mb-4 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Synchronizing live academic database records...
            </div>
          )}

          {/* 1. OVERVIEW SUITE */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-amber-900/30 via-slate-800/80 to-slate-800/80 border border-amber-500/20 rounded-2xl p-6 relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      CollegeVision Academic Administration Center
                    </h1>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                      Full governance authority over students, biometric face recognition vectors, faculty assignments, classrooms, collision-free timetables, and master attendance registers.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={loadAdminData}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Sync Database</span>
                    </button>
                    <button
                      onClick={() => {
                        setRegPhotoSource('none');
                        setRegPhotoBase64('');
                        setShowStudentRegModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Enroll Student</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span>Total Students</span>
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">{stats.total_students}</div>
                  <div className="text-[11px] text-emerald-400 mt-1">Class III SU-1 Active</div>
                </div>

                <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span>Enrolled Vectors</span>
                    <ScanFace className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">330</div>
                  <div className="text-[11px] text-slate-400 mt-1">InsightFace 512-d</div>
                </div>

                <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span>Faculty Members</span>
                    <GraduationCap className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">{teachersList.length || stats.total_teachers}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Department CSE</div>
                </div>

                <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span>Academic Classes</span>
                    <School className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">{classesList.length || stats.total_classes}</div>
                  <div className="text-[11px] text-slate-400 mt-1">III SU-1 (2026-2027)</div>
                </div>

                <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span>Subjects</span>
                    <BookOpen className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">{stats.total_subjects}</div>
                  <div className="text-[11px] text-slate-400 mt-1">CP301, JFS302, AJ303</div>
                </div>

                <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span>Attendance Sessions</span>
                    <Clock className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">{allSessions.length}</div>
                  <div className="text-[11px] text-emerald-400 mt-1">Submitted in MySQL</div>
                </div>
              </div>

              {/* Quick Actions Action Bar */}
              <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                  Quick Administrative Operations
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <button
                    onClick={() => {
                      setRegPhotoSource('none');
                      setRegPhotoBase64('');
                      setShowStudentRegModal(true);
                    }}
                    className="p-3 bg-slate-900/80 hover:bg-slate-900 rounded-xl border border-slate-700 hover:border-amber-500/40 text-left transition-all group cursor-pointer"
                  >
                    <Users className="w-5 h-5 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-white">Enroll New Student</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">With Live Webcam or Photo Upload</div>
                  </button>

                  <button
                    onClick={() => setShowTeacherRegModal(true)}
                    className="p-3 bg-slate-900/80 hover:bg-slate-900 rounded-xl border border-slate-700 hover:border-blue-500/40 text-left transition-all group cursor-pointer"
                  >
                    <GraduationCap className="w-5 h-5 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-white">Register Faculty & Account</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Create Teacher Profile + Login</div>
                  </button>

                  <button
                    onClick={() => {
                      setEditingClass(null);
                      setClassFormData({
                        class_code: '',
                        department: 'CSE',
                        academic_year: '2026-2027',
                        year_number: 3,
                        semester_number: 5,
                        section: 'SU-1'
                      });
                      setShowClassModal(true);
                    }}
                    className="p-3 bg-slate-900/80 hover:bg-slate-900 rounded-xl border border-slate-700 hover:border-purple-500/40 text-left transition-all group cursor-pointer"
                  >
                    <School className="w-5 h-5 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-white">Add Academic Class</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Define Dept, Year, & Section</div>
                  </button>

                  <button
                    onClick={() => {
                      setEditingTimetable(null);
                      setShowTimetableModal(true);
                    }}
                    className="p-3 bg-slate-900/80 hover:bg-slate-900 rounded-xl border border-slate-700 hover:border-emerald-500/40 text-left transition-all group cursor-pointer"
                  >
                    <Calendar className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-white">Schedule Timetable Slot</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Allocate Period, Room, & Teacher</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. STUDENTS & BIOMETRICS SUITE */}
          {activeTab === 'students' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-400" />
                    Student Directory & Biometric Vectors ({filteredStudents.length} of {students.length})
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Class III SU-1 enrolled students with 512-dimensional facial recognition vectors
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search Roll No or Name..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 w-48 sm:w-64"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setRegPhotoSource('none');
                      setRegPhotoBase64('');
                      setShowStudentRegModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Register Student</span>
                  </button>
                </div>
              </div>

              {/* Students Table with Edit and Delete buttons */}
              <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/90 text-slate-400 font-semibold sticky top-0 z-10 border-b border-slate-700">
                      <tr>
                        <th className="py-3 px-4">Roll Number</th>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Class & Section</th>
                        <th className="py-3 px-4">Biometrics</th>
                        <th className="py-3 px-4">Attendance Rate</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {filteredStudents.map((st) => (
                        <tr key={st.id} className="hover:bg-slate-800/60 transition-colors">
                          <td className="py-2.5 px-4 font-bold text-amber-300">{st.rollNumber}</td>
                          <td className="py-2.5 px-4 font-sans text-white font-medium">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={st.avatarUrl || `/student-photos/${st.id}.jpg`}
                                alt={st.name}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  if (!target.dataset.triedFallback) {
                                    target.dataset.triedFallback = 'true';
                                    target.src = `/api/students/${st.id}/photo`;
                                  } else {
                                    target.onerror = null;
                                    target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><rect width="28" height="28" rx="14" fill="%23334155"/><text x="50%" y="54%" font-family="sans-serif" font-size="10" font-weight="bold" fill="%23cbd5e1" dominant-baseline="middle" text-anchor="middle">${encodeURIComponent(st.name.slice(0, 2).toUpperCase())}</text></svg>`;
                                  }
                                }}
                                className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-600 shrink-0"
                              />
                              <span>{st.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-300">III SU-1 ({st.section})</td>
                          <td className="py-2.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              Enrolled
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-300">
                            {st.overallAttendancePercentage ? `${st.overallAttendancePercentage}%` : '0.0%'}
                          </td>
                          <td className="py-2.5 px-4">
                            <button
                              onClick={() => handleToggleStudent(st.id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                              title="Click to toggle active status"
                            >
                              <UserCheck className="w-3 h-3 text-emerald-400" /> Active
                            </button>
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            {/* Re-enroll Face Button */}
                            <button
                              onClick={() => {
                                setSelectedStudentForFace(st);
                                setEnrollPhotoBase64('');
                                setEnrollPhotoSource('camera');
                                setShowFaceEnrollModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 transition-colors mr-1.5 cursor-pointer"
                              title="Re-enroll facial biometric photograph"
                            >
                              <Camera className="w-3 h-3" />
                              <span className="hidden sm:inline">Face</span>
                            </button>

                            {/* Edit Student Button */}
                            <button
                              onClick={() => {
                                setEditingStudent({
                                  id: st.id,
                                  roll_number: st.rollNumber,
                                  name: st.name,
                                  department: st.classId || 'CSE',
                                  section: st.section || 'SU-1',
                                  email: st.email || '',
                                  phone: st.phone || '',
                                  guardian_name: st.guardianName || '',
                                  guardian_phone: st.guardianPhone || ''
                                });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors mr-1.5 cursor-pointer"
                              title="Edit student profile details"
                            >
                              <Edit2 className="w-3 h-3 text-amber-400" />
                              <span>Edit</span>
                            </button>

                            {/* Delete Student Button */}
                            <button
                              onClick={() => handleDeleteStudent(st)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition-colors cursor-pointer"
                              title="Permanently delete student"
                            >
                              <Trash2 className="w-3 h-3 text-rose-400" />
                              <span>Delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 3. FACULTY & USER ACCOUNTS SUITE */}
          {activeTab === 'faculty' && (
            <div className="space-y-6">
              {/* Faculty Section with Edit & Delete */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-amber-400" />
                      Faculty Roster & Department Staff ({teachersList.length})
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Authorized academic teachers assigned to classes and lecture timetables
                    </p>
                  </div>
                  <button
                    onClick={() => setShowTeacherRegModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Register Faculty</span>
                  </button>
                </div>

                <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-700">
                      <tr>
                        <th className="py-3 px-4">Employee Code</th>
                        <th className="py-3 px-4">Teacher Name</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {teachersList.map((t) => (
                        <tr key={t.teacher_id} className="hover:bg-slate-800/60 transition-colors">
                          <td className="py-3 px-4 font-bold text-blue-400">{t.employee_code}</td>
                          <td className="py-3 px-4 font-sans text-white font-medium">{t.teacher_name}</td>
                          <td className="py-3 px-4 text-slate-300">{t.department}</td>
                          <td className="py-3 px-4 text-slate-400 font-sans">{t.email || 'N/A'}</td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleToggleTeacher(t.teacher_id)}
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer ${
                                t.is_active
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              {t.is_active ? 'Active' : 'Disabled'}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {/* Edit Faculty */}
                            <button
                              onClick={() => setEditingTeacher(t)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors mr-1.5 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3 text-amber-400" /> Edit
                            </button>

                            {/* Delete Faculty */}
                            <button
                              onClick={() => handleDeleteTeacher(t)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3 text-rose-400" /> Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* User Login Accounts Section with Edit & Delete */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Key className="w-5 h-5 text-amber-400" />
                      Portal User Accounts & Authentication Credentials ({accountsList.length})
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Argon2id cryptographically secured accounts with role permissions (ADMIN vs TEACHER)
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAccountCreateModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create User Login</span>
                  </button>
                </div>

                <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-700">
                      <tr>
                        <th className="py-3 px-4">User ID</th>
                        <th className="py-3 px-4">Username</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Linked Teacher</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {accountsList.map((acc) => (
                        <tr key={acc.user_id} className="hover:bg-slate-800/60 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-400">#{acc.user_id}</td>
                          <td className="py-3 px-4 font-bold text-white">{acc.username}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                              acc.role === 'ADMIN'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            }`}>
                              {acc.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-sans">
                            {acc.teacher_name || 'System Administrator'}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleToggleAccount(acc)}
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer ${
                                acc.is_active
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              {acc.is_active ? 'Active' : 'Disabled'}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {/* Reset Password */}
                            <button
                              onClick={() => {
                                setSelectedAccountForReset(acc);
                                setResetPassInput('');
                                setShowPasswordResetModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/30 transition-colors mr-1.5 cursor-pointer"
                              title="Reset Password"
                            >
                              <Key className="w-3 h-3" />
                              <span className="hidden sm:inline">Pass</span>
                            </button>

                            {/* Edit Account */}
                            <button
                              onClick={() => setEditingAccount(acc)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors mr-1.5 cursor-pointer"
                              title="Edit User Account"
                            >
                              <Edit2 className="w-3 h-3 text-amber-400" />
                              <span>Edit</span>
                            </button>

                            {/* Delete Account */}
                            <button
                              onClick={() => handleDeleteAccount(acc)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition-colors cursor-pointer"
                              title="Delete Account"
                            >
                              <Trash2 className="w-3 h-3 text-rose-400" />
                              <span>Delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4. CLASSES & CLASSROOMS SUITE */}
          {activeTab === 'academic' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Academic Classes */}
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80">
                  <div>
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      <School className="w-4 h-4 text-amber-400" />
                      Academic Classes ({classesList.length})
                    </h3>
                    <p className="text-[11px] text-slate-400">Class codes, departments, and academic cohorts</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingClass(null);
                      setClassFormData({
                        class_code: '',
                        department: 'CSE',
                        academic_year: '2026-2027',
                        year_number: 3,
                        semester_number: 5,
                        section: 'SU-1'
                      });
                      setShowClassModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Class</span>
                  </button>
                </div>

                <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">Class Code</th>
                        <th className="py-2.5 px-3">Dept</th>
                        <th className="py-2.5 px-3">Year / Sem</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {classesList.map((c) => (
                        <tr key={c.class_id} className="hover:bg-slate-800/60">
                          <td className="py-2.5 px-3 font-bold text-amber-300">{c.class_code}</td>
                          <td className="py-2.5 px-3 text-slate-300">{c.department}</td>
                          <td className="py-2.5 px-3 text-slate-400">Yr {c.year_number} · Sem {c.semester_number}</td>
                          <td className="py-2.5 px-3">
                            <button
                              onClick={() => handleToggleClass(c.class_id)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer ${
                                c.is_active ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              {c.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => {
                                setEditingClass(c);
                                setClassFormData({
                                  class_code: c.class_code,
                                  department: c.department,
                                  academic_year: c.academic_year,
                                  year_number: c.year_number,
                                  semester_number: c.semester_number,
                                  section: c.section
                                });
                                setShowClassModal(true);
                              }}
                              className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 text-[11px] cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3 inline mr-1 text-amber-400" /> Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Classrooms */}
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80">
                  <div>
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-cyan-400" />
                      Lecture Halls & Classrooms ({classroomsList.length})
                    </h3>
                    <p className="text-[11px] text-slate-400">Room numbers, building wings, and seating capacity</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingClassroom(null);
                      setClassroomFormData({
                        room_number: '',
                        building: 'Academic Block 3',
                        capacity: 60
                      });
                      setShowClassroomModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Room</span>
                  </button>
                </div>

                <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">Room Number</th>
                        <th className="py-2.5 px-3">Building Location</th>
                        <th className="py-2.5 px-3">Capacity</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {classroomsList.map((r) => (
                        <tr key={r.room_id} className="hover:bg-slate-800/60">
                          <td className="py-2.5 px-3 font-bold text-cyan-300">Room {r.room_number}</td>
                          <td className="py-2.5 px-3 text-slate-300 font-sans">{r.building}</td>
                          <td className="py-2.5 px-3 text-slate-400">{r.capacity} seats</td>
                          <td className="py-2.5 px-3">
                            <button
                              onClick={() => handleToggleClassroom(r.room_id)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer ${
                                r.is_active ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              {r.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => {
                                setEditingClassroom(r);
                                setClassroomFormData({
                                  room_number: r.room_number,
                                  building: r.building,
                                  capacity: r.capacity
                                });
                                setShowClassroomModal(true);
                              }}
                              className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 text-[11px] cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3 inline mr-1 text-cyan-400" /> Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 5. TIMETABLE SUITE */}
          {activeTab === 'timetable' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-400" />
                    Master Academic Timetable ({timetableList.length} scheduled periods)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Automated period scheduling, classroom allocation, and collision-free timetable management
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingTimetable(null);
                    setTimetableFormData({
                      class_id: classesList[0]?.class_id || 1,
                      subject_id: 1,
                      teacher_id: teachersList[0]?.teacher_id || 1,
                      classroom_id: classroomsList[0]?.room_id || 1,
                      day_of_week: 1,
                      period_number: 1,
                      start_time: '09:30',
                      end_time: '12:15'
                    });
                    setShowTimetableModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Timetable Slot</span>
                </button>
              </div>

              {/* Timetable Table List */}
              <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Day</th>
                      <th className="py-3 px-4">Period & Timings</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4">Faculty</th>
                      <th className="py-3 px-4">Room</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {timetableList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                          No timetable slots scheduled yet. Click <strong>"Add Timetable Slot"</strong> to schedule one.
                        </td>
                      </tr>
                    ) : (
                      timetableList.map((slot) => (
                        <tr key={slot.timetable_id} className="hover:bg-slate-800/60 transition-colors">
                          <td className="py-3 px-4 font-bold text-amber-300">
                            {slot.day_name || DAYS_MAP[slot.day_of_week] || `Day ${slot.day_of_week}`}
                          </td>
                          <td className="py-3 px-4 text-white">
                            Period {slot.period_number} · {slot.start_time} - {slot.end_time}
                          </td>
                          <td className="py-3 px-4 text-cyan-300 font-bold">
                            {slot.subject_code} - {slot.subject_name}
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-sans">{slot.class_code}</td>
                          <td className="py-3 px-4 text-slate-300 font-sans">{slot.teacher_name}</td>
                          <td className="py-3 px-4 text-blue-400 font-bold">Room {slot.room_number}</td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => {
                                setEditingTimetable(slot);
                                setTimetableFormData({
                                  class_id: slot.class_id || 1,
                                  subject_id: slot.subject_id || 1,
                                  teacher_id: slot.teacher_id || 1,
                                  classroom_id: slot.room_id || 1,
                                  day_of_week: slot.day_of_week || 1,
                                  period_number: slot.period_number || 1,
                                  start_time: slot.start_time || '09:30',
                                  end_time: slot.end_time || '12:15'
                                });
                                setShowTimetableModal(true);
                              }}
                              className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 mr-2 cursor-pointer"
                              title="Edit Timetable Slot"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                            </button>
                            <button
                              onClick={() => handleDeleteTimetable(slot.timetable_id)}
                              className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded-lg cursor-pointer"
                              title="Delete Timetable Slot"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. ATTENDANCE SESSIONS SUITE */}
          {activeTab === 'sessions' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    Attendance Sessions & Live Governance ({allSessions.length})
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Monitor active classroom face recognitions, review posted sessions, or finalize records
                  </p>
                </div>
                <button
                  onClick={() => setShowSessionCreateModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Schedule New Session</span>
                </button>
              </div>

              <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Session ID</th>
                      <th className="py-3 px-4">Subject & Class</th>
                      <th className="py-3 px-4">Date & Slot</th>
                      <th className="py-3 px-4">Present / Total</th>
                      <th className="py-3 px-4">Attendance Rate</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {allSessions.map((s) => {
                      const isExpanded = expandedSessionId === s.session_id;
                      const isDownloading = downloadingSessionId === s.session_id;
                      const records = expandedRecords[s.session_id];
                      const isLoadingRoster = loadingSessionRecords[s.session_id];

                      return (
                        <React.Fragment key={s.session_id}>
                          <tr className={`hover:bg-slate-800/60 transition-colors ${isExpanded ? 'bg-slate-800/90' : ''}`}>
                            <td className="py-3 px-4 font-bold text-amber-400">
                              <button
                                type="button"
                                onClick={() => handleToggleExpandSession(s.session_id)}
                                className="inline-flex items-center gap-1.5 hover:text-amber-300 cursor-pointer text-left"
                                title="Click to view session student roster"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-blue-400" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                                )}
                                <span>{s.id}</span>
                              </button>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-white font-sans">{s.subject_name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{s.subject_code} · {s.class_name} ({s.section})</div>
                            </td>
                            <td className="py-3 px-4 text-slate-300">
                              <div>{s.date}</div>
                              <div className="text-[11px] text-slate-400">{s.time_slot}</div>
                            </td>
                            <td className="py-3 px-4 text-white">
                              <span className="text-emerald-400 font-bold">{s.present_count}</span> / {s.total_students}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-200">
                              {s.attendance_rate}%
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                s.status === 'FINALIZED'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              }`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {/* Download CSV for this session */}
                                <button
                                  type="button"
                                  onClick={() => handleDownloadSessionCsv(s)}
                                  disabled={isDownloading}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/90 hover:bg-slate-600 text-white rounded-lg text-xs font-bold border border-slate-600 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                                  title="Download attendance sheet CSV for this session"
                                >
                                  <Download className={`w-3.5 h-3.5 text-emerald-400 ${isDownloading ? 'animate-bounce' : ''}`} />
                                  <span>{isDownloading ? 'Downloading...' : 'Download CSV'}</span>
                                </button>

                                {/* Roster View Toggle */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleExpandSession(s.session_id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-colors cursor-pointer"
                                  title="Inspect student list"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>{isExpanded ? 'Hide' : 'Roster'}</span>
                                </button>

                                {/* Finalize Session button if pending */}
                                {s.status !== 'FINALIZED' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleFinalizeSession(s.session_id)}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                                  >
                                    Finalize Session
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-slate-400 bg-slate-900/60 border border-slate-800">
                                    <Lock className="w-3 h-3 text-slate-500" />
                                    Locked
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Session Roster Drawer */}
                          {isExpanded && (
                            <tr className="bg-slate-900/95 border-b border-slate-700">
                              <td colSpan={7} className="p-4">
                                <div className="bg-slate-800/90 rounded-xl border border-slate-700/90 p-4 space-y-3 shadow-md">
                                  <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-700/70 gap-2">
                                    <div>
                                      <h4 className="text-xs font-bold text-white flex items-center gap-2">
                                        <Users className="w-4 h-4 text-blue-400" />
                                        Attendance Roster for Session {s.id} ({s.subject_code} - {s.subject_name})
                                      </h4>
                                      <p className="text-[11px] text-slate-400 mt-0.5">
                                        Date: {s.date} | Class: {s.class_name} ({s.section}) | Present: <span className="text-emerald-400 font-bold">{s.present_count}</span>, Absent: <span className="text-rose-400 font-bold">{s.total_students - s.present_count}</span>
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadSessionCsv(s)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      <span>Download Session CSV</span>
                                    </button>
                                  </div>

                                  {isLoadingRoster ? (
                                    <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                                      <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                                      <span>Loading attendance records from database...</span>
                                    </div>
                                  ) : records && records.length > 0 ? (
                                    <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-700/60 font-sans">
                                      <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-900/90 text-[10px] uppercase font-bold text-slate-400 sticky top-0 border-b border-slate-700">
                                          <tr>
                                            <th className="py-2 px-3">Roll Number</th>
                                            <th className="py-2 px-3">Student Name</th>
                                            <th className="py-2 px-3">Status</th>
                                            <th className="py-2 px-3">Source</th>
                                            <th className="py-2 px-3">Timestamp</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/60 font-mono text-[11px]">
                                          {records.map((r: any, rIdx: number) => {
                                            const isPresent = (r.status || '').toLowerCase() === 'present';
                                            return (
                                              <tr key={r.student_id || r.roll_number || rIdx} className="hover:bg-slate-700/40">
                                                <td className="py-2 px-3 font-bold text-white">
                                                  {r.roll_number || r.student_id}
                                                </td>
                                                <td className="py-2 px-3 font-medium text-slate-200 font-sans">
                                                  {r.student_name || 'Student'}
                                                </td>
                                                <td className="py-2 px-3">
                                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                    isPresent
                                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                                  }`}>
                                                    {isPresent && <UserCheck className="w-3 h-3 text-emerald-400" />}
                                                    {(r.status || 'ABSENT').toUpperCase()}
                                                  </span>
                                                </td>
                                                <td className="py-2 px-3 text-slate-400 text-[10px]">
                                                  {r.source || 'SYSTEM'}
                                                </td>
                                                <td className="py-2 px-3 text-slate-400 text-[10px]">
                                                  {r.timestamp || '-'}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <div className="py-4 text-center text-xs text-slate-400 italic">
                                      No individual student records recorded for this session.
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 7. REPORTS & EXPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-slate-800/90 p-5 rounded-2xl border border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                    Institutional Reports & Consolidated Registers
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Download official university attendance registers, session breakdowns, and semester matrix exports
                  </p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const csvText = await api.getMasterAttendanceCsv();
                      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Master_Semester_Attendance_Register_III_SU1_${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      addToast('success', 'Master CSV Exported', 'Downloaded complete semester register.');
                    } catch (e: any) {
                      addToast('error', 'Export Failed', e.message);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Master Consolidated CSV</span>
                </button>
              </div>

              <div className="bg-slate-800/90 p-5 rounded-2xl border border-slate-700/80">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  University Exam Eligibility Audit (75% Threshold)
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Students below 75% aggregate attendance require departmental condonation review before university examination enrollment.
                </p>
                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 text-xs text-slate-300 font-mono">
                  <span className="font-semibold text-white font-sans">Institutional Status: </span>
                  All {students.length} students currently tracked under Class III SU-1 curriculum.
                </div>
              </div>
            </div>
          )}

          {/* 8. SECURITY & AUDIT LOGS */}
          {activeTab === 'security' && (
            <div className="space-y-5">
              <div className="bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-400" />
                  Authentication Audit Trail & Security Logs ({authEvents.length})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cryptographically logged authentication attempts, token issuances, and security events from table `authentication_audit`
                </p>
              </div>

              <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Event ID</th>
                      <th className="py-3 px-4">Username</th>
                      <th className="py-3 px-4">User ID</th>
                      <th className="py-3 px-4">Event Classification</th>
                      <th className="py-3 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {authEvents.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-800/60">
                        <td className="py-2.5 px-4 text-slate-400">#{ev.id}</td>
                        <td className="py-2.5 px-4 font-bold text-white">{ev.username}</td>
                        <td className="py-2.5 px-4 text-slate-300">USER-{ev.user_id}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            {ev.event_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-400">{ev.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: STUDENT REGISTRATION WITH LIVE PIC OR UPLOAD IMAGE               */}
      {/* ========================================================================= */}
      {showStudentRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                Register New Student & Biometrics
              </h3>
              <button 
                onClick={() => {
                  stopWebcam();
                  setShowStudentRegModal(false);
                }} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterStudent} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Roll Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 238W1A1299"
                    value={newStudent.roll_number}
                    onChange={(e) => setNewStudent({ ...newStudent, roll_number: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Student Full Name"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Department</label>
                  <input
                    type="text"
                    value={newStudent.department}
                    onChange={(e) => setNewStudent({ ...newStudent, department: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Section</label>
                  <input
                    type="text"
                    value={newStudent.section}
                    onChange={(e) => setNewStudent({ ...newStudent, section: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              {/* BIOMETRIC FACE ENROLLMENT SECTION (Live Pic or Upload) */}
              <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300 flex items-center gap-1.5">
                    <ScanFace className="w-4 h-4" /> Biometric Face Photograph
                  </span>
                  <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setRegPhotoSource('camera');
                        startWebcam();
                      }}
                      className={`px-2 py-1 rounded flex items-center gap-1 cursor-pointer ${regPhotoSource === 'camera' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400'}`}
                    >
                      <Camera className="w-3 h-3" /> Live Pic
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stopWebcam();
                        setRegPhotoSource('upload');
                      }}
                      className={`px-2 py-1 rounded flex items-center gap-1 cursor-pointer ${regPhotoSource === 'upload' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400'}`}
                    >
                      <Upload className="w-3 h-3" /> Upload Image
                    </button>
                  </div>
                </div>

                {/* Option A: LIVE CAMERA WITH LAPTOP WEBCAM SELECTOR */}
                {regPhotoSource === 'camera' && (
                  <div className="space-y-2">
                    {/* Camera Selector Dropdown */}
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-slate-400 whitespace-nowrap">Camera Source:</label>
                      <select
                        value={selectedDeviceId}
                        onChange={(e) => switchCamera(e.target.value)}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                      >
                        {videoDevices.map((dev, idx) => (
                          <option key={dev.deviceId || idx} value={dev.deviceId}>
                            {dev.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="relative rounded-xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center border border-slate-700">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {!webcamStreaming && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-slate-400 gap-2">
                          <Camera className="w-8 h-8 text-slate-500" />
                          <span>Camera ready to stream</span>
                          <button
                            type="button"
                            onClick={() => startWebcam()}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold cursor-pointer"
                          >
                            Turn On Laptop Camera
                          </button>
                        </div>
                      )}
                    </div>

                    {webcamStreaming && (
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => captureFrame((b64) => setRegPhotoBase64(b64))}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Capture Live Photo</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Option B: UPLOAD IMAGE */}
                {regPhotoSource === 'upload' && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => setRegPhotoBase64(evt.target?.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="block w-full text-[11px] text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                    />
                  </div>
                )}

                {/* Captured Photo Preview */}
                {regPhotoBase64 && (
                  <div className="flex items-center gap-3 p-2 bg-slate-800 rounded-xl border border-emerald-500/30">
                    <img src={regPhotoBase64} alt="Captured Face" className="w-16 h-16 object-cover rounded-lg border border-slate-600" />
                    <div className="flex-1">
                      <div className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Face Photo Attached
                      </div>
                      <div className="text-[10px] text-slate-400">Will be converted to 512-d InsightFace vector on submit</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRegPhotoBase64('')}
                      className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopWebcam();
                    setShowStudentRegModal(false);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-white shadow-lg cursor-pointer"
                >
                  Register Student & Enroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1B: EDIT EXISTING STUDENT DETAILS                                   */}
      {/* ========================================================================= */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                Edit Student Profile
              </h3>
              <button onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateStudent} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Roll Number</label>
                  <input
                    type="text"
                    required
                    value={editingStudent.roll_number}
                    onChange={(e) => setEditingStudent({ ...editingStudent, roll_number: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editingStudent.name}
                    onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Department</label>
                  <input
                    type="text"
                    value={editingStudent.department}
                    onChange={(e) => setEditingStudent({ ...editingStudent, department: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Section</label>
                  <input
                    type="text"
                    value={editingStudent.section}
                    onChange={(e) => setEditingStudent({ ...editingStudent, section: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={editingStudent.email}
                  onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    value={editingStudent.phone}
                    onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Guardian Name</label>
                  <input
                    type="text"
                    value={editingStudent.guardian_name}
                    onChange={(e) => setEditingStudent({ ...editingStudent, guardian_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-sans"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold text-white shadow-lg cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: STANDALONE FACE ENROLLMENT (RE-ENROLL FACE)                      */}
      {/* ========================================================================= */}
      {showFaceEnrollModal && selectedStudentForFace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ScanFace className="w-5 h-5 text-amber-400" />
                  Biometric Face Enrollment
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  {selectedStudentForFace.rollNumber} · {selectedStudentForFace.name}
                </p>
              </div>
              <button 
                onClick={() => {
                  stopWebcam();
                  setShowFaceEnrollModal(false);
                }} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Method Switcher */}
              <div className="grid grid-cols-2 p-1 bg-slate-900 rounded-xl border border-slate-700 text-center font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setEnrollPhotoSource('camera');
                    startWebcam();
                  }}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer ${enrollPhotoSource === 'camera' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                >
                  <Camera className="w-3.5 h-3.5" /> 💻 Laptop Webcam
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopWebcam();
                    setEnrollPhotoSource('upload');
                  }}
                  className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer ${enrollPhotoSource === 'upload' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                >
                  <Upload className="w-3.5 h-3.5" /> Upload File
                </button>
              </div>

              {enrollPhotoSource === 'camera' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-slate-400">Select Camera:</label>
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => switchCamera(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                    >
                      {videoDevices.map((dev, idx) => (
                        <option key={dev.deviceId || idx} value={dev.deviceId}>
                          {dev.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="relative rounded-xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center border border-slate-700">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    {!webcamStreaming && (
                      <button
                        type="button"
                        onClick={() => startWebcam()}
                        className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl cursor-pointer"
                      >
                        Start Laptop Camera
                      </button>
                    )}
                  </div>

                  {webcamStreaming && (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => captureFrame((b64) => setEnrollPhotoBase64(b64))}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 font-bold text-white rounded-xl shadow-md cursor-pointer"
                      >
                        Capture Biometric Portrait
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => setEnrollPhotoBase64(evt.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="block w-full text-[11px] text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white cursor-pointer"
                  />
                </div>
              )}

              {enrollPhotoBase64 && (
                <div className="flex items-center gap-3 p-2 bg-slate-900 rounded-xl border border-emerald-500/40">
                  <img src={enrollPhotoBase64} alt="Ready" className="w-14 h-14 object-cover rounded-lg border border-slate-700" />
                  <div className="flex-1 text-emerald-400 font-bold">Face snapshot ready for 512-d extraction</div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopWebcam();
                    setShowFaceEnrollModal(false);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEnrollFaceSubmit}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white shadow-lg cursor-pointer"
                >
                  Enroll Vector into Database
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: FACULTY REGISTRATION & USER ACCOUNT                             */}
      {/* ========================================================================= */}
      {showTeacherRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-400" />
                Register Faculty & Teacher Account
              </h3>
              <button onClick={() => setShowTeacherRegModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTeacher} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Employee Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EMP-FAC-002"
                  value={newTeacher.employee_code}
                  onChange={(e) => {
                    const code = e.target.value.toUpperCase();
                    setNewTeacher({ 
                      ...newTeacher, 
                      employee_code: code,
                      login_username: newTeacher.login_username || code.toLowerCase().replace(/[^a-z0-9]/g, '')
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Faculty Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Rajesh Kumar"
                  value={newTeacher.teacher_name}
                  onChange={(e) => setNewTeacher({ ...newTeacher, teacher_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Department</label>
                  <input
                    type="text"
                    value={newTeacher.department}
                    onChange={(e) => setNewTeacher({ ...newTeacher, department: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="rajesh@college.edu"
                    value={newTeacher.email}
                    onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-sans"
                  />
                </div>
              </div>

              {/* Login Account Checkbox */}
              <div className="pt-2 border-t border-slate-700/80">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-300">
                  <input
                    type="checkbox"
                    checked={newTeacher.create_login}
                    onChange={(e) => setNewTeacher({ ...newTeacher, create_login: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-blue-600"
                  />
                  <span>Create portal login account for this teacher now</span>
                </label>

                {newTeacher.create_login && (
                  <div className="mt-3 p-3 bg-slate-900 rounded-xl border border-slate-700 space-y-2">
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-0.5">Username</label>
                      <input
                        type="text"
                        required={newTeacher.create_login}
                        value={newTeacher.login_username}
                        onChange={(e) => setNewTeacher({ ...newTeacher, login_username: e.target.value.toLowerCase() })}
                        className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-0.5">Password (min 6 characters)</label>
                      <input
                        type="text"
                        required={newTeacher.create_login}
                        value={newTeacher.login_password}
                        onChange={(e) => setNewTeacher({ ...newTeacher, login_password: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTeacherRegModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold text-white shadow-lg cursor-pointer"
                >
                  Register Faculty
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: EDIT EXISTING FACULTY                                            */}
      {/* ========================================================================= */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                Edit Faculty Details
              </h3>
              <button onClick={() => setEditingTeacher(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateTeacher} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Employee Code</label>
                <input
                  type="text"
                  value={editingTeacher.employee_code}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, employee_code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Faculty Name</label>
                <input
                  type="text"
                  value={editingTeacher.teacher_name}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, teacher_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-sans"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={editingTeacher.email || ''}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-sans"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold text-white shadow-lg cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: CREATE DIRECT USER LOGIN ACCOUNT                                 */}
      {/* ========================================================================= */}
      {showAccountCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                Create Portal Login Account
              </h3>
              <button onClick={() => setShowAccountCreateModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateAccount} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Account Role</label>
                <select
                  value={newAccount.role}
                  onChange={(e) => setNewAccount({ ...newAccount, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                >
                  <option value="TEACHER">TEACHER (Faculty Portal)</option>
                  <option value="ADMIN">ADMIN (Full Governance)</option>
                </select>
              </div>

              {newAccount.role === 'TEACHER' && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Link to Faculty Member</label>
                  <select
                    value={newAccount.teacher_id}
                    onChange={(e) => setNewAccount({ ...newAccount, teacher_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    {teachersList.map((t) => (
                      <option key={t.teacher_id} value={t.teacher_id}>
                        {t.teacher_name} ({t.employee_code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Username (min 3 chars)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. faculty002"
                  value={newAccount.username}
                  onChange={(e) => setNewAccount({ ...newAccount, username: e.target.value.toLowerCase() })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Password (min 6 chars)</label>
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={newAccount.password}
                  onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAccountCreateModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold text-white shadow-lg cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5B: EDIT USER ACCOUNT DETAILS                                       */}
      {/* ========================================================================= */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                Edit User Account
              </h3>
              <button onClick={() => setEditingAccount(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateAccount} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={editingAccount.username}
                  onChange={(e) => setEditingAccount({ ...editingAccount, username: e.target.value.toLowerCase() })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Role</label>
                <select
                  value={editingAccount.role}
                  onChange={(e) => setEditingAccount({ ...editingAccount, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                >
                  <option value="TEACHER">TEACHER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              {editingAccount.role === 'TEACHER' && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Linked Faculty Member</label>
                  <select
                    value={editingAccount.teacher_id || ''}
                    onChange={(e) => setEditingAccount({ ...editingAccount, teacher_id: parseInt(e.target.value) || null })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="">-- No Link --</option>
                    {teachersList.map((t) => (
                      <option key={t.teacher_id} value={t.teacher_id}>
                        {t.teacher_name} ({t.employee_code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold text-white shadow-lg cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: RESET ACCOUNT PASSWORD                                           */}
      {/* ========================================================================= */}
      {showPasswordResetModal && selectedAccountForReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                Reset Password
              </h3>
              <button onClick={() => setShowPasswordResetModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-700">
                <div className="text-slate-400 text-[11px]">User Account</div>
                <div className="text-white font-bold text-sm">{selectedAccountForReset.username}</div>
                <div className="text-[10px] text-amber-400">{selectedAccountForReset.role}</div>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">New Password (min 6 chars)</label>
                <input
                  type="password"
                  required
                  placeholder="New Secure Password"
                  value={resetPassInput}
                  onChange={(e) => setResetPassInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordResetModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold text-white cursor-pointer"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: ADD / EDIT ACADEMIC CLASS                                        */}
      {/* ========================================================================= */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <School className="w-5 h-5 text-amber-400" />
                {editingClass ? 'Edit Academic Class' : 'Add New Academic Class'}
              </h3>
              <button onClick={() => setShowClassModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveClass} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Class Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. III SU-1 or CSE-2A-2026"
                  value={classFormData.class_code}
                  onChange={(e) => setClassFormData({ ...classFormData, class_code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Department</label>
                  <input
                    type="text"
                    value={classFormData.department}
                    onChange={(e) => setClassFormData({ ...classFormData, department: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Academic Year</label>
                  <input
                    type="text"
                    value={classFormData.academic_year}
                    onChange={(e) => setClassFormData({ ...classFormData, academic_year: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Year No.</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={classFormData.year_number}
                    onChange={(e) => setClassFormData({ ...classFormData, year_number: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Semester</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={classFormData.semester_number}
                    onChange={(e) => setClassFormData({ ...classFormData, semester_number: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Section</label>
                  <input
                    type="text"
                    value={classFormData.section}
                    onChange={(e) => setClassFormData({ ...classFormData, section: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold text-white shadow-lg cursor-pointer"
                >
                  {editingClass ? 'Update Class' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: ADD / EDIT CLASSROOM                                             */}
      {/* ========================================================================= */}
      {showClassroomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                {editingClassroom ? 'Edit Classroom' : 'Register Classroom'}
              </h3>
              <button onClick={() => setShowClassroomModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveClassroom} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Room Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 301, Lab 4"
                  value={classroomFormData.room_number}
                  onChange={(e) => setClassroomFormData({ ...classroomFormData, room_number: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Building Location</label>
                <input
                  type="text"
                  value={classroomFormData.building}
                  onChange={(e) => setClassroomFormData({ ...classroomFormData, building: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-sans"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Seating Capacity</label>
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={classroomFormData.capacity}
                  onChange={(e) => setClassroomFormData({ ...classroomFormData, capacity: parseInt(e.target.value) || 60 })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowClassroomModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-bold text-white shadow-lg cursor-pointer"
                >
                  {editingClassroom ? 'Update Room' : 'Save Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 9: ADD / EDIT TIMETABLE SLOT                                        */}
      {/* ========================================================================= */}
      {showTimetableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                {editingTimetable ? 'Edit Timetable Slot' : 'Add Timetable Slot'}
              </h3>
              <button onClick={() => setShowTimetableModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveTimetable} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Academic Class</label>
                  <select
                    value={timetableFormData.class_id}
                    onChange={(e) => setTimetableFormData({ ...timetableFormData, class_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    {classesList.map((c) => (
                      <option key={c.class_id} value={c.class_id}>
                        {c.class_code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Subject</label>
                  <select
                    value={timetableFormData.subject_id}
                    onChange={(e) => setTimetableFormData({ ...timetableFormData, subject_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    <option value={1}>CP301: Competitive Programming</option>
                    <option value={2}>JFS302: Java Full Stack</option>
                    <option value={3}>AJ303: ADVANCE_JAVA</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Assigned Faculty</label>
                  <select
                    value={timetableFormData.teacher_id}
                    onChange={(e) => setTimetableFormData({ ...timetableFormData, teacher_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    {teachersList.map((t) => (
                      <option key={t.teacher_id} value={t.teacher_id}>
                        {t.teacher_name} ({t.employee_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Classroom</label>
                  <select
                    value={timetableFormData.classroom_id}
                    onChange={(e) => setTimetableFormData({ ...timetableFormData, classroom_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    {classroomsList.map((r) => (
                      <option key={r.room_id} value={r.room_id}>
                        Room {r.room_number} ({r.building})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Day of Week</label>
                  <select
                    value={timetableFormData.day_of_week}
                    onChange={(e) => setTimetableFormData({ ...timetableFormData, day_of_week: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Period Number</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={timetableFormData.period_number}
                    onChange={(e) => setTimetableFormData({ ...timetableFormData, period_number: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Start Time</label>
                  <input
                    type="time"
                    value={timetableFormData.start_time}
                    onChange={(e) => setTimetableFormData({ ...timetableFormData, start_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">End Time</label>
                  <input
                    type="time"
                    value={timetableFormData.end_time}
                    onChange={(e) => setTimetableFormData({ ...timetableFormData, end_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTimetableModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold text-white shadow-lg cursor-pointer"
                >
                  {editingTimetable ? 'Update Timetable' : 'Schedule Timetable Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 10: SCHEDULE ATTENDANCE SESSION                                     */}
      {/* ========================================================================= */}
      {showSessionCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                Schedule Attendance Session
              </h3>
              <button onClick={() => setShowSessionCreateModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSession} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Subject</label>
                <select
                  value={newSessionData.subject_id}
                  onChange={(e) => setNewSessionData({ ...newSessionData, subject_id: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                >
                  <option value={1}>CP301: Competitive Programming</option>
                  <option value={2}>JFS302: Java Full Stack</option>
                  <option value={3}>AJ303: ADVANCE_JAVA</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Period Number</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={newSessionData.period_number}
                    onChange={(e) => setNewSessionData({ ...newSessionData, period_number: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Section</label>
                  <input
                    type="text"
                    value={newSessionData.section}
                    onChange={(e) => setNewSessionData({ ...newSessionData, section: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Date</label>
                <input
                  type="date"
                  value={newSessionData.session_date}
                  onChange={(e) => setNewSessionData({ ...newSessionData, session_date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSessionCreateModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-white shadow-lg cursor-pointer"
                >
                  Schedule Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
