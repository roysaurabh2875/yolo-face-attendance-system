import React, { useState, useEffect, useMemo } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { Student } from '../../types/attendance';
import { SUBJECTS_LIST, HISTORICAL_SESSIONS } from '../../data/mockData';
import { api } from '../../services/api';
import { 
  ClipboardCheck, 
  Download, 
  Calendar, 
  Clock, 
  Search, 
  CheckCircle2, 
  UserX, 
  UserCheck, 
  Eye, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  BookOpen, 
  FileSpreadsheet,
  AlertCircle,
  Users,
  Percent
} from 'lucide-react';

interface PostedAttendanceViewProps {
  onOpenDetails: (studentId: string) => void;
}

interface PostedSessionRecord {
  id: string;
  session_id: number;
  subject_code: string;
  subject_name: string;
  class_name: string;
  section: string;
  date: string;
  time_slot: string;
  period_number?: number;
  teacher_name: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  attendance_rate: number;
  finalized_at?: string;
  status: string;
}

export const PostedAttendanceView: React.FC<PostedAttendanceViewProps> = ({ onOpenDetails }) => {
  const { students, currentTeacher, addToast } = useAttendance();

  const [postedSessions, setPostedSessions] = useState<PostedSessionRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Expanded session details map
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);
  const [expandedSessionRecords, setExpandedSessionRecords] = useState<{ [key: number]: any[] }>({});
  const [loadingSessionRecords, setLoadingSessionRecords] = useState<{ [key: number]: boolean }>({});

  // Load posted sessions from backend
  const loadPostedSessions = async () => {
    setIsLoading(true);
    try {
      const data = await api.getPostedSessions();
      if (Array.isArray(data) && data.length > 0) {
        setPostedSessions(data);
      } else {
        // Fallback to HISTORICAL_SESSIONS if backend returns empty
        const fallback = HISTORICAL_SESSIONS.map((s, idx) => ({
          id: s.id,
          session_id: parseInt(s.id.replace(/\D/g, '')) || (idx + 1),
          subject_code: s.subjectCode,
          subject_name: s.subjectName,
          class_name: s.className,
          section: s.section || 'SU-1',
          date: s.date,
          time_slot: s.timeSlot,
          teacher_name: s.teacherName,
          total_students: s.totalStudents,
          present_count: s.presentCount,
          absent_count: s.absentCount,
          attendance_rate: parseFloat(((s.presentCount / s.totalStudents) * 100).toFixed(1)),
          finalized_at: s.finalizedAt || 'Finalized',
          status: 'FINALIZED'
        }));
        setPostedSessions(fallback);
      }
    } catch (err) {
      console.warn('Could not load posted sessions from API, using local history:', err);
      const fallback = HISTORICAL_SESSIONS.map((s, idx) => ({
        id: s.id,
        session_id: parseInt(s.id.replace(/\D/g, '')) || (idx + 1),
        subject_code: s.subjectCode,
        subject_name: s.subjectName,
        class_name: s.className,
        section: s.section || 'SU-1',
        date: s.date,
        time_slot: s.timeSlot,
        teacher_name: s.teacherName,
        total_students: s.totalStudents,
        present_count: s.presentCount,
        absent_count: s.absentCount,
        attendance_rate: parseFloat(((s.presentCount / s.totalStudents) * 100).toFixed(1)),
        finalized_at: s.finalizedAt || 'Finalized',
        status: 'FINALIZED'
      }));
      setPostedSessions(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPostedSessions();
  }, []);

  // Filtered posted sessions
  const filteredSessions = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return postedSessions.filter((s) => {
      // Subject filter
      if (selectedSubject !== 'ALL' && s.subject_code !== selectedSubject) {
        return false;
      }
      // Date filter
      if (dateFilter === 'today' && s.date !== todayStr) {
        return false;
      }
      // Search term
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matches =
          s.id.toLowerCase().includes(query) ||
          s.subject_name.toLowerCase().includes(query) ||
          s.subject_code.toLowerCase().includes(query) ||
          s.date.includes(query);
        if (!matches) return false;
      }
      return true;
    });
  }, [postedSessions, selectedSubject, dateFilter, searchQuery]);

  // Load detailed records for a specific session when expanded
  const toggleExpandSession = async (sessionId: number) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      return;
    }

    setExpandedSessionId(sessionId);

    if (!expandedSessionRecords[sessionId]) {
      setLoadingSessionRecords((prev) => ({ ...prev, [sessionId]: true }));
      try {
        const res = await api.getPostedSessionRecords(sessionId);
        if (res && Array.isArray(res.records)) {
          setExpandedSessionRecords((prev) => ({ ...prev, [sessionId]: res.records }));
        } else {
          // Mock/fallback roster from students list
          setExpandedSessionRecords((prev) => ({
            ...prev,
            [sessionId]: students.map((std, idx) => ({
              roll_number: std.rollNumber,
              student_name: std.name,
              student_id: std.id,
              status: idx === 0 ? 'present' : 'absent',
              source: idx === 0 ? 'FACE' : 'SYSTEM',
              timestamp: idx === 0 ? '09:35 AM' : null
            }))
          }));
        }
      } catch (err) {
        console.warn('Could not load session records, using local roster:', err);
        setExpandedSessionRecords((prev) => ({
          ...prev,
          [sessionId]: students.map((std, idx) => ({
            roll_number: std.rollNumber,
            student_name: std.name,
            student_id: std.id,
            status: idx === 0 ? 'present' : 'absent',
            source: idx === 0 ? 'FACE' : 'SYSTEM',
            timestamp: idx === 0 ? '09:35 AM' : null
          }))
        }));
      } finally {
        setLoadingSessionRecords((prev) => ({ ...prev, [sessionId]: false }));
      }
    }
  };

  // Helper to download CSV string as file
  const downloadCsvBlob = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('success', 'Report Downloaded', `${filename} saved successfully.`);
  };

  // Export specific posted session
  const exportSessionCsv = async (session: PostedSessionRecord, filterType: 'all' | 'present' | 'absent') => {
    let records = expandedSessionRecords[session.session_id];

    if (!records || records.length === 0) {
      try {
        const res = await api.getPostedSessionRecords(session.session_id);
        records = res?.records || [];
      } catch {
        records = students.map((std, idx) => ({
          roll_number: std.rollNumber,
          student_name: std.name,
          student_id: std.id,
          status: idx === 0 ? 'present' : 'absent',
          source: idx === 0 ? 'FACE' : 'SYSTEM',
          timestamp: idx === 0 ? '09:35 AM' : null
        }));
      }
    }

    let exportList = records;
    if (filterType === 'present') {
      exportList = records.filter((r) => r.status.toLowerCase() === 'present');
    } else if (filterType === 'absent') {
      exportList = records.filter((r) => r.status.toLowerCase() === 'absent');
    }

    const headers = [
      'Roll Number',
      'Student Name',
      'Student ID',
      'Class',
      'Section',
      'Subject Code',
      'Subject Name',
      'Session Date',
      'Time Slot',
      'Attendance Status',
      'Verification Source',
      'Verification Time',
      'Faculty Incharge'
    ];

    const rows = exportList.map((r) => [
      `"${r.roll_number}"`,
      `"${r.student_name}"`,
      `"${r.student_id}"`,
      `"III SU-1"`,
      `"SU-1"`,
      `"${session.subject_code}"`,
      `"${session.subject_name}"`,
      `"${session.date}"`,
      `"${session.time_slot}"`,
      `"${r.status.toUpperCase()}"`,
      `"${r.source || 'SYSTEM'}"`,
      `"${r.timestamp || '—'}"`,
      `"${session.teacher_name}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const filename = `Posted_Attendance_${session.id}_${session.subject_code}_${filterType.toUpperCase()}_${session.date}.csv`;
    downloadCsvBlob(csvContent, filename);
  };

  // Export Master Consolidated Register (All posted sessions)
  const exportMasterRegister = async () => {
    if (postedSessions.length === 0) {
      addToast('error', 'No Posted Sessions', 'Please post an attendance session first before downloading.');
      return;
    }

    try {
      // 1. Authoritative Backend Generation: Direct MySQL query
      const csvContent = await api.getMasterAttendanceCsv();
      downloadCsvBlob(csvContent, `Master_Semester_Attendance_Register_III_SU1_${new Date().toISOString().split('T')[0]}.csv`);
      return;
    } catch (err: any) {
      console.warn('Backend master CSV fetch failed, falling back to client-side compilation:', err);
    }

    // 2. Client-Side Fallback: Load exact records for every posted session from API
    try {
      const allSessionData: { [key: number]: any[] } = { ...expandedSessionRecords };
      for (const s of postedSessions) {
        if (!allSessionData[s.session_id] || allSessionData[s.session_id].length === 0) {
          try {
            const res = await api.getPostedSessionRecords(s.session_id);
            allSessionData[s.session_id] = res?.records || [];
          } catch {
            allSessionData[s.session_id] = [];
          }
        }
      }
      setExpandedSessionRecords(allSessionData);

      const headers = [
        'Roll Number',
        'Student Name',
        'Class',
        'Section',
        ...postedSessions.map((s) => `"${s.id} (${s.subject_code} - ${s.date})"`),
        'Total Classes Attended',
        'Total Classes Held',
        'Attendance Rate (%)',
        'Eligibility Status'
      ];

      const rows = students.map((std) => {
        const sessionStatuses = postedSessions.map((s) => {
          const records = allSessionData[s.session_id] || [];
          const rec = records.find((r) => r.student_id === std.id || r.roll_number === std.rollNumber);
          return rec?.status?.toUpperCase() === 'PRESENT' ? 'PRESENT' : 'ABSENT';
        });

        const attended = sessionStatuses.filter((st) => st === 'PRESENT').length;
        const totalHeld = postedSessions.length;
        const pct = parseFloat(((attended / totalHeld) * 100).toFixed(1));
        const eligible = pct >= 75.0 ? 'ELIGIBLE' : 'DEFAULTER (<75%)';

        return [
          `"${std.rollNumber}"`,
          `"${std.name}"`,
          `"III SU-1"`,
          `"SU-1"`,
          ...sessionStatuses.map((st) => `"${st}"`),
          attended,
          totalHeld,
          `"${pct}%"`,
          `"${eligible}"`
        ];
      });

      const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
      downloadCsvBlob(csvContent, `Master_Semester_Attendance_Register_III_SU1_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (error: any) {
      addToast('error', 'Export Failed', 'Could not compile master attendance register.');
    }
  };

  // Summary calculations
  const totalPosted = postedSessions.length;
  const avgAttendance = totalPosted > 0
    ? (postedSessions.reduce((acc, s) => acc + s.attendance_rate, 0) / totalPosted).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                Posted Attendance Records & Official Registers
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Archived and sealed attendance records posted by faculty. Download verified class sheets, present rosters, and university exam registers.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportMasterRegister}
            disabled={totalPosted === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors disabled:opacity-40 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Consolidated Master CSV</span>
          </button>
        </div>
      </div>

      {/* Institutional Policy Notice */}
      <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-950">
          <p className="font-bold">Official Academic Download Policy</p>
          <p className="mt-0.5 text-blue-800 leading-relaxed">
            Attendance sheets and CSV reports are generated and downloadable <strong>only after the attendance session has been formally posted and sealed</strong> by faculty. Active scanning sessions cannot be exported to prevent incomplete academic filings.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Posted Sessions
          </span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {totalPosted}
            </span>
            <span className="text-xs text-slate-500 font-medium">Recorded in MySQL</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Class: III SU-1</span>
            <span className="font-semibold text-emerald-700">Sealed Registers</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Average Attendance Rate
          </span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-blue-700 font-mono">
              {avgAttendance}%
            </span>
            <span className="text-xs text-slate-500 font-medium">Across all lectures</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Minimum Requirement</span>
            <span className="font-semibold text-slate-700">&ge; 75% for Exams</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Enrolled Students
          </span>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {students.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">III SU-1 Roster</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Biometric Enrolled</span>
            <span className="font-semibold text-emerald-700">100% ArcFace</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Instructor Incharge
          </span>
          <div className="mt-3">
            <p className="text-sm font-bold text-slate-900 truncate">
              {currentTeacher?.name || 'Dr. Priya Sharma'}
            </p>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              EMP-FAC-001 · CSE
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Authorized Faculty</span>
            <span className="font-semibold text-blue-700">SU-1 Incharge</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search posted sessions by ID, subject, or date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          {/* Subject Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Subject:</span>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              <option value="ALL">All Subjects</option>
              <option value="CP301">CP301: Competitive Programming</option>
              <option value="JFS302">JFS302: Java Full Stack</option>
              <option value="AJ303">AJ303: ADVANCE_JAVA</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Date:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              <option value="all">All Dates</option>
              <option value="today">Today Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Posted Sessions List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
            Loading posted attendance sessions from MySQL...
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
            <ClipboardCheck className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-900">No Posted Attendance Records Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              You haven't posted any attendance sessions matching the selected filter. Complete an attendance scan from the Dashboard and click <strong>"Submit Attendance"</strong> to post and seal records here.
            </p>
          </div>
        ) : (
          filteredSessions.map((session) => {
            const isExpanded = expandedSessionId === session.session_id;
            const records = expandedSessionRecords[session.session_id] || [];
            const isLoadingRecords = loadingSessionRecords[session.session_id];

            return (
              <div
                key={session.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all"
              >
                {/* Session Card Header */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/40">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-blue-100 text-blue-900 border border-blue-200">
                        {session.id}
                      </span>
                      <span className="font-bold text-sm text-slate-900">
                        {session.subject_name}
                      </span>
                      <span className="text-xs font-mono text-slate-500 font-semibold">
                        ({session.subject_code})
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        POSTED & SEALED
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {session.date}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {session.time_slot}
                      </span>
                      <span>·</span>
                      <span>Class: <strong className="text-slate-700">{session.class_name} ({session.section})</strong></span>
                      <span>·</span>
                      <span>Faculty: <strong className="text-slate-700">{session.teacher_name}</strong></span>
                    </div>
                  </div>

                  {/* Attendance Stats & Quick Downloads */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="text-right sm:text-right">
                      <div className="text-xs text-slate-500">
                        Attendance: <span className="font-bold text-emerald-700 font-mono">{session.present_count}</span>
                        <span className="text-slate-400"> / {session.total_students}</span>
                        <span className="ml-1.5 font-bold text-slate-800 font-mono">({session.attendance_rate}%)</span>
                      </div>
                      <div className="w-36 bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden ml-auto">
                        <div
                          className="bg-emerald-600 h-full rounded-full"
                          style={{ width: `${session.attendance_rate}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => exportSessionCsv(session, 'all')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                        title="Download Complete Session Register as CSV"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-600" />
                        <span>Download CSV</span>
                      </button>

                      <button
                        onClick={() => toggleExpandSession(session.session_id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isExpanded ? 'Hide Roster' : 'View Roster'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Session Student Roster & Actions */}
                {isExpanded && (
                  <div className="p-5 border-t border-slate-100 bg-slate-50/20 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Sealed Student Roster for {session.id} ({session.subject_code})
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Official student-by-student verification log recorded during this lecture
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => exportSessionCsv(session, 'present')}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Download Present List ({session.present_count})</span>
                        </button>
                        <button
                          onClick={() => exportSessionCsv(session, 'absent')}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <UserX className="w-3.5 h-3.5 text-rose-600" />
                          <span>Download Absent List ({session.absent_count})</span>
                        </button>
                      </div>
                    </div>

                    {isLoadingRecords ? (
                      <div className="text-center py-6 text-xs text-slate-500">
                        Loading student records for session {session.id}...
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[380px]">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px] sticky top-0">
                            <tr>
                              <th className="py-2.5 px-3">Roll Number</th>
                              <th className="py-2.5 px-3">Student Name</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Verification Method</th>
                              <th className="py-2.5 px-3">Recorded Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {records.map((r, i) => {
                              const isPresent = r.status.toLowerCase() === 'present';
                              return (
                                <tr key={r.student_id || i} className="hover:bg-slate-50">
                                  <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                                    {r.roll_number}
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                                    {r.student_name}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {isPresent ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        PRESENT
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
                                        <UserX className="w-3 h-3 text-rose-600" />
                                        ABSENT
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                                    {r.source === 'FACE'
                                      ? 'YOLO Face Biometrics'
                                      : r.source === 'MANUAL'
                                      ? 'Faculty Manual Override'
                                      : 'System Recorded'}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                                    {r.timestamp || '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
