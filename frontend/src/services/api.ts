/**
 * API Client for YOLO Face Attendance Backend
 * Connects React frontend with the FastAPI backend running on port 8000.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function getAuthToken(): string | null {
  return sessionStorage.getItem('yolo_attendance_token');
}

export function setAuthToken(token: string) {
  sessionStorage.setItem('yolo_attendance_token', token);
}

export function clearAuthToken() {
  sessionStorage.removeItem('yolo_attendance_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Prepend base URL if relative
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMsg = `Server error ${res.status}`;
      try {
        const errorJson = await res.json();
        errorMsg = errorJson.detail || errorJson.message || errorMsg;
      } catch {
        // use default error message
      }
      throw new Error(errorMsg);
    }

    return await res.json();
  } catch (err: any) {
    console.warn(`[API] Error on ${endpoint}:`, err.message);
    throw err;
  }
}

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  database: string;
  yolo_model_available?: boolean;
  face_embeddings_available?: boolean;
}

export interface LoginResponse {
  access_token: string;
  token?: string;
  token_type: string;
  expires_in: number;
  user: {
    user_id: number;
    username: string;
    role: string;
    teacher_id?: number;
  };
  teacher?: {
    id: string;
    teacher_id?: number;
    name: string;
    email: string;
    employeeId: string;
    department: string;
    role: string;
  };
}

export interface SessionDataResponse {
  session: {
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
    status: 'scheduled' | 'in_progress' | 'finalized';
    totalStudents: number;
    presentCount: number;
    absentCount: number;
  };
  records: any[];
  totalStudents: number;
  presentCount: number;
  absentCount: number;
}

export interface YoloDetectionResult {
  status: string;
  face_count: number;
  detections: Array<{
    id: string;
    student_id?: string;
    name?: string;
    roll_number?: string;
    label: string;
    confidence: string;
    confidence_score?: number;
    x: number;
    y: number;
    w: number;
    h: number;
    status: 'recognized' | 'low_confidence' | 'unrecognized';
  }>;
}

export const api = {
  // 1. Health check
  async checkHealth(): Promise<HealthResponse> {
    return request<HealthResponse>('/api/health');
  },

  // 2. Authentication
  async login(usernameOrEmail: string, password: string): Promise<LoginResponse> {
    const res = await request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: usernameOrEmail,
        password,
      }),
    });
    if (res.token || res.access_token) {
      setAuthToken(res.token || res.access_token);
    }
    return res;
  },

  async registerTeacher(data: {
    name: string;
    email: string;
    employeeId: string;
    department: string;
    designation: string;
    phone: string;
    office: string;
    password: string;
  }): Promise<LoginResponse> {
    const res = await request<LoginResponse>('/api/auth/register-teacher', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.token || res.access_token) {
      setAuthToken(res.token || res.access_token);
    }
    return res;
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors on logout
    } finally {
      clearAuthToken();
    }
  },

  // 3. Students
  async getStudents(): Promise<any[]> {
    return request<any[]>('/api/students');
  },

  // 4. Session Operations
  async getActiveSession(): Promise<SessionDataResponse> {
    return request<SessionDataResponse>('/api/sessions/active');
  },

  async startActiveSession(): Promise<{ status: string; session_status: string; session_id: number }> {
    return request('/api/sessions/start-active', { method: 'POST' });
  },

  async pauseActiveSession(): Promise<{ status: string; session_status: string; session_id: number }> {
    return request('/api/sessions/pause-active', { method: 'POST' });
  },

  async finalizeActiveSession(): Promise<{ status: string; session_status: string; session_id: number }> {
    return request('/api/sessions/finalize-active', { method: 'POST' });
  },

  async submitAndResetSession(): Promise<{
    status: string;
    message: string;
    previous_session_id?: number;
    new_session_id: number;
    new_period: number;
  }> {
    return request('/api/sessions/submit-and-reset', { method: 'POST' });
  },

  async getPostedSessions(): Promise<any[]> {
    return request<any[]>('/api/sessions/posted');
  },

  async getPostedSessionRecords(sessionId: number | string): Promise<{
    session_id: number;
    date: string;
    subject_name: string;
    subject_code: string;
    total_students: number;
    records: any[];
  }> {
    return request(`/api/sessions/posted/${sessionId}/records`);
  },

  async getMasterAttendanceCsv(): Promise<string> {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const url = `${API_BASE_URL}/api/sessions/posted/master-csv`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      let err = `Server error ${res.status}`;
      try {
        const j = await res.json();
        err = j.detail || err;
      } catch {}
      throw new Error(err);
    }
    return await res.text();
  },

  // 5. Manual Attendance Correction
  async manualCorrect(data: {
    student_id: string;
    session_id?: string;
    status: 'present' | 'absent';
    reason: string;
    teacher_name?: string;
    user_role?: string;
  }): Promise<{ status: string; student_id: string; new_status: string; timestamp: string }> {
    return request('/api/attendance/manual-correct', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 6. Audit Trail
  async getAuditLogs(): Promise<any[]> {
    return request<any[]>('/api/audit-logs');
  },

  // 7. YOLO Face Detection from Webcam Frame
  async detectFrame(imageBase64: string, sessionId?: string): Promise<YoloDetectionResult> {
    return request<YoloDetectionResult>('/api/yolo/detect-frame', {
      method: 'POST',
      body: JSON.stringify({
        image: imageBase64,
        session_id: sessionId,
      }),
    });
  },

  // 8. Admin Portal APIs
  async getAdminOverviewStats(): Promise<any> {
    return request('/api/admin/overview-stats');
  },

  async getAdminSessions(): Promise<any[]> {
    return request<any[]>('/api/admin/sessions/all');
  },

  async adminRegisterStudent(data: {
    roll_number: string;
    name: string;
    department?: string;
    section?: string;
    email?: string;
    phone?: string;
    guardian_name?: string;
    guardian_phone?: string;
    class_id?: number;
  }): Promise<{ success: boolean; message: string; student_id: string }> {
    return request('/api/admin/students', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async adminEnrollFace(studentId: string, imageBase64: string): Promise<{ success: boolean; message: string }> {
    return request(`/api/admin/students/${studentId}/enroll-face`, {
      method: 'POST',
      body: JSON.stringify({ image: imageBase64 }),
    });
  },

  async toggleStudentStatus(studentId: string): Promise<{ success: boolean; is_active: boolean; message: string }> {
    return request(`/api/admin/students/${studentId}/status`, {
      method: 'PATCH',
    });
  },

  async updateAdminStudent(studentId: string, data: any): Promise<any> {
    return request(`/api/admin/students/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteAdminStudent(studentId: string): Promise<any> {
    return request(`/api/admin/students/${studentId}`, {
      method: 'DELETE',
    });
  },

  async adminCreateSession(data: {
    subject_id: number;
    section: string;
    session_date?: string;
    period_number: number;
  }): Promise<{ success: boolean; session_id: number }> {
    return request('/api/admin/sessions/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async adminFinalizeSession(sessionId: number): Promise<{ success: boolean; message: string }> {
    return request(`/api/admin/sessions/${sessionId}/finalize`, {
      method: 'POST',
    });
  },

  async getAuthEvents(): Promise<any[]> {
    return request<any[]>('/api/admin/auth-events');
  },

  async getAdminClasses(): Promise<any> {
    return request('/api/admin/classes');
  },

  async createAdminClass(data: any): Promise<any> {
    return request('/api/admin/classes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAdminClass(classId: number, data: any): Promise<any> {
    return request(`/api/admin/classes/${classId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async toggleAdminClassStatus(classId: number): Promise<any> {
    return request(`/api/admin/classes/${classId}/status`, {
      method: 'PATCH',
    });
  },

  async getAdminClassrooms(): Promise<any> {
    return request('/api/admin/classrooms');
  },

  async createAdminClassroom(data: any): Promise<any> {
    return request('/api/admin/classrooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAdminClassroom(roomId: number, data: any): Promise<any> {
    return request(`/api/admin/classrooms/${roomId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async toggleAdminClassroomStatus(roomId: number): Promise<any> {
    return request(`/api/admin/classrooms/${roomId}/status`, {
      method: 'PATCH',
    });
  },

  async getAdminTeachers(): Promise<any> {
    return request('/api/admin/teachers');
  },

  async createAdminTeacher(data: any): Promise<any> {
    return request('/api/admin/teachers/quick-create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAdminTeacher(teacherId: number, data: any): Promise<any> {
    return request(`/api/admin/teachers/${teacherId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async toggleAdminTeacherStatus(teacherId: number): Promise<any> {
    return request(`/api/admin/teachers/${teacherId}/status`, {
      method: 'PATCH',
    });
  },

  async deleteAdminTeacher(teacherId: number): Promise<any> {
    return request(`/api/admin/teachers/${teacherId}`, {
      method: 'DELETE',
    });
  },

  async getAdminAccounts(): Promise<any[]> {
    const res: any = await request('/api/admin/accounts');
    return Array.isArray(res) ? res : (res?.accounts || []);
  },

  async createAdminAccount(data: any): Promise<any> {
    return request('/api/admin/accounts/create-user', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAdminAccount(userId: number, data: any): Promise<any> {
    return request(`/api/admin/accounts/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteAdminAccount(userId: number): Promise<any> {
    return request(`/api/admin/accounts/${userId}`, {
      method: 'DELETE',
    });
  },

  async resetAccountPassword(userId: number, password: string): Promise<any> {
    return request(`/api/admin/accounts/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password: password }),
    });
  },

  async toggleAccountStatus(userId: number, isActive: boolean): Promise<any> {
    return request(`/api/admin/accounts/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
  },

  async getAdminTimetable(): Promise<any> {
    return request('/api/admin/timetable');
  },

  async createAdminTimetable(data: any): Promise<any> {
    return request('/api/admin/timetable/entry', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAdminTimetable(timetableId: number, data: any): Promise<any> {
    return request(`/api/admin/timetable/${timetableId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteAdminTimetable(timetableId: number): Promise<any> {
    return request(`/api/admin/timetable/${timetableId}`, {
      method: 'DELETE',
    });
  },

  async getStudentHistory(studentId: string): Promise<any> {
    return request(`/api/students/${encodeURIComponent(studentId)}/history`);
  },
};
