import React, { useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { Student } from '../../types/attendance';
import { CLASSES_LIST, SUBJECTS_LIST } from '../../data/mockData';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Percent, 
  ScanFace, 
  Calendar, 
  BookOpen, 
  Clock, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles,
  AlertTriangle,
  Play,
  CheckCircle2,
  Lock,
  Search
} from 'lucide-react';

interface DashboardOverviewProps {
  onNavigate: (tab: string) => void;
  onOpenDetails: (studentId: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ 
  onNavigate,
  onOpenDetails
}) => {
  const {
    totalStudentsCount,
    presentCount,
    absentCount,
    attendancePercentage,
    selectedClassId,
    setSelectedClassId,
    selectedSection,
    setSelectedSection,
    selectedSubjectCode,
    setSelectedSubjectCode,
    selectedDate,
    setSelectedDate,
    selectedTimeSlot,
    setSelectedTimeSlot,
    sessionStatus,
    startSession,
    finalizeSession,
    submitAndResetAttendance,
    auditLogs,
    currentSession,
    students,
    presentRecords,
    absentRecords
  } = useAttendance();

  // Student Roll Number quick search state
  const [searchRollInput, setSearchRollInput] = useState('');
  const [searchedStudent, setSearchedStudent] = useState<Student | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleRollSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchRollInput.trim().toLowerCase();
    if (!query) {
      setSearchedStudent(null);
      setHasSearched(false);
      return;
    }
    const found = students.find(
      (s) => s.rollNumber.toLowerCase() === query || s.id.toLowerCase() === query || s.rollNumber.toLowerCase().includes(query)
    );
    setSearchedStudent(found || null);
    setHasSearched(true);
  };

  const currentClass = CLASSES_LIST.find((c) => c.id === selectedClassId) || CLASSES_LIST[0];
  const classSubjects = SUBJECTS_LIST.filter((s) => s.classId === selectedClassId);

  const TIME_SLOTS = [
    '09:30 AM - 12:15 PM',
    '01:15 PM - 03:45 PM',
    '02:15 PM - 04:45 PM (Lab)'
  ];

  return (
    <div className="space-y-6">
      {/* Session Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              Class Session Control & Filters
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select timetable parameters to filter real-time YOLO recognition stream and records
            </p>
          </div>

          <div className="flex items-center gap-2">
            {sessionStatus === 'scheduled' && (
              <button
                onClick={startSession}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Live YOLO Scan
              </button>
            )}
            {sessionStatus === 'in_progress' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('scanner')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors"
                >
                  <ScanFace className="w-4 h-4 text-blue-600" />
                  View Scanner
                </button>
                <button
                  onClick={submitAndResetAttendance}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Submit Attendance & Reset
                </button>
              </div>
            )}
            {sessionStatus === 'finalized' && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 rounded-lg border border-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Session Sealed
                </span>
                <button
                  onClick={submitAndResetAttendance}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Start Next Attendance Session
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Form controls grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-4">
          {/* Date Picker */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full text-xs font-mono font-medium py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Class & Section */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Class & Section
            </label>
            <select
              value={`${selectedClassId}|${selectedSection}`}
              onChange={(e) => {
                const [cId, sec] = e.target.value.split('|');
                setSelectedClassId(cId);
                setSelectedSection(sec);
              }}
              className="w-full text-xs font-medium py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {CLASSES_LIST.map((c) =>
                (c.sections || []).map((sec) => (
                  <option key={`${c.id}-${sec}`} value={`${c.id}|${sec}`}>
                    {c.name} ({sec})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Subject
            </label>
            <select
              value={selectedSubjectCode}
              onChange={(e) => setSelectedSubjectCode(e.target.value)}
              className="w-full text-xs font-medium py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {classSubjects.length > 0 ? (
                classSubjects.map((sub) => (
                  <option key={sub.code} value={sub.code}>
                    {sub.code}: {sub.name}
                  </option>
                ))
              ) : (
                <option value={selectedSubjectCode}>{selectedSubjectCode}</option>
              )}
            </select>
          </div>

          {/* Session / Time Slot */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Lecture Session
            </label>
            <select
              value={selectedTimeSlot}
              onChange={(e) => setSelectedTimeSlot(e.target.value)}
              className="w-full text-xs font-medium py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Attendance Submission Callout Banner */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-xl shadow-sm border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-white">Lecture Attendance Submission Portal</h3>
              <span className="text-[11px] font-mono bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded">
                Session {currentSession.id} · {presentCount} Present
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              After completing the attendance session, click <strong className="text-emerald-300">"Submit Attendance"</strong> to permanently save this session's records in MySQL and reset the system for the next class.
            </p>
          </div>
        </div>

        <button
          onClick={submitAndResetAttendance}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-lg shadow-lg hover:shadow-emerald-900/40 transition-all shrink-0 cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Submit Attendance</span>
        </button>
      </div>

      {/* Student Roll Number Live Lookup & Verification */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600" />
              Student Roll Number Search & Instant Status Lookup
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter any student roll number from III SU-1 to check real-time attendance status and biometric record
            </p>
          </div>
          <span className="text-[11px] font-mono font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
            Roster: III SU-1 (110 Students)
          </span>
        </div>

        <form onSubmit={handleRollSearch} className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Enter student roll number (e.g. 25951A05BK)..."
              value={searchRollInput}
              onChange={(e) => setSearchRollInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Roll Number</span>
          </button>
          {hasSearched && (
            <button
              type="button"
              onClick={() => {
                setSearchRollInput('');
                setSearchedStudent(null);
                setHasSearched(false);
              }}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
            >
              Clear
            </button>
          )}
        </form>

        {/* Search Results Display */}
        {hasSearched && (
          <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50/80">
            {searchedStudent ? (() => {
              const presentRec = presentRecords.find((r) => r.studentId === searchedStudent.id);
              const isPresent = !!presentRec;
              return (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={searchedStudent.avatarUrl || `/student-photos/${searchedStudent.id}.jpg`}
                      alt={searchedStudent.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.dataset.triedFallback) {
                          target.dataset.triedFallback = 'true';
                          target.src = `/api/students/${searchedStudent.id}/photo`;
                        } else {
                          target.onerror = null;
                          target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="24" fill="%232563eb"/><text x="50%" y="54%" font-family="sans-serif" font-size="16" font-weight="bold" fill="%23ffffff" dominant-baseline="middle" text-anchor="middle">${encodeURIComponent(searchedStudent.name.slice(0, 2).toUpperCase())}</text></svg>`;
                        }
                      }}
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-500/30"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">{searchedStudent.name}</h4>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                          {searchedStudent.rollNumber}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Class: {searchedStudent.className} · Section: {searchedStudent.section} · Overall Attendance: {searchedStudent.overallAttendancePercentage}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isPresent ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          PRESENT TODAY ({presentRec.method === 'face_recognition' ? 'YOLO Scan' : 'Manual'})
                        </span>
                        <span className="font-mono text-xs text-slate-500">{presentRec.timestamp}</span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-100 text-rose-800">
                        <UserX className="w-4 h-4 text-rose-600" />
                        ABSENT (Not Scanned)
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenDetails(searchedStudent.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition-colors"
                    >
                      View Profile Details
                    </button>
                  </div>
                </div>
              );
            })() : (
              <div className="text-center py-2 text-xs text-slate-500">
                No student found matching "<strong className="font-mono">{searchRollInput}</strong>" in III SU-1. Please verify the roll number.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Students */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Enrolled
            </span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
              {totalStudentsCount}
            </span>
            <span className="text-xs text-slate-500 ml-2">students</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{currentClass.name}</span>
            <span className="font-semibold text-slate-700">{selectedSection}</span>
          </div>
        </div>

        {/* Card 2: Present Students */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Present Today
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-extrabold text-emerald-700 font-mono tabular-nums">
                {presentCount}
              </span>
              <span className="text-xs text-slate-500 ml-2">verified</span>
            </div>
            <button
              onClick={() => onNavigate('present')}
              className="text-xs text-emerald-700 font-semibold hover:underline flex items-center gap-1"
            >
              View list <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
            <Sparkles className="w-3 h-3" />
            <span>YOLO AI + Verified Overrides</span>
          </div>
        </div>

        {/* Card 3: Absent Students */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Absent Students
            </span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-extrabold text-rose-600 font-mono tabular-nums">
                {absentCount}
              </span>
              <span className="text-xs text-slate-500 ml-2">unaccounted</span>
            </div>
            <button
              onClick={() => onNavigate('absent')}
              className="text-xs text-rose-700 font-semibold hover:underline flex items-center gap-1"
            >
              Review <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Requires faculty check</span>
            <span className="text-rose-600 font-bold">{absentCount} pending</span>
          </div>
        </div>

        {/* Card 4: Attendance Percentage */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Attendance Rate
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className={`text-3xl font-extrabold font-mono tabular-nums ${
                attendancePercentage >= 75 ? 'text-slate-900' : 'text-amber-600'
              }`}>
                {attendancePercentage}%
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Target ≥ 75%
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  attendancePercentage >= 75 ? 'bg-emerald-600' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, attendancePercentage)}%` }}
              />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] flex items-center justify-between">
            <span className="text-slate-500">Eligibility Standard</span>
            <span className={`font-semibold ${attendancePercentage >= 75 ? 'text-emerald-700' : 'text-amber-600'}`}>
              {attendancePercentage >= 75 ? 'Nominal' : 'Warning Level'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Split: Absent Action Queue & Recent Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Absent Students Quick Action Queue (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserX className="w-4 h-4 text-rose-600" />
                Absent Students Pending Verification ({absentCount})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Students not recognized by YOLO camera in current session. Verify presence and mark manually if needed.
              </p>
            </div>
            <button
              onClick={() => onNavigate('absent')}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline flex items-center gap-1"
            >
              Full Roster <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {absentRecords.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-900">All Students Accounted For</h4>
                <p className="text-xs text-slate-500 mt-1">
                  100% attendance recorded for this session. No absent students.
                </p>
              </div>
            ) : (
              absentRecords.slice(0, 5).map((rec) => {
                const student = students.find((s) => s.id === rec.studentId);
                return (
                  <div key={rec.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <img
                        src={student?.avatarUrl || `/student-photos/${rec.studentId}.jpg`}
                        alt={rec.studentName}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.dataset.triedFallback) {
                            target.dataset.triedFallback = 'true';
                            target.src = `/api/students/${rec.studentId}/photo`;
                          } else {
                            target.onerror = null;
                            target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="%232563eb"/><text x="50%" y="54%" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23ffffff" dominant-baseline="middle" text-anchor="middle">${encodeURIComponent(rec.studentName.slice(0, 2).toUpperCase())}</text></svg>`;
                          }
                        }}
                        className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200"
                      />
                      <div>
                        <button
                          onClick={() => student && onOpenDetails(student.id)}
                          className="text-xs font-bold text-slate-900 hover:text-blue-600 hover:underline text-left"
                        >
                          {rec.studentName}
                        </button>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                          <span className="font-bold text-slate-700">{rec.rollNumber}</span>
                          <span>·</span>
                          <span className="font-sans text-slate-400">Class {rec.className || 'III SU-1'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => student && onOpenDetails(student.id)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => onNavigate('absent')}
                        className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Mark Present
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Real-Time Audit & Activity Stream (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="p-5 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Live Attendance Events
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated YOLO detections & faculty overrides
            </p>
          </div>

          <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[380px]">
            {auditLogs.slice(0, 6).map((log) => {
              const isYolo = log.action === 'AUTO_SCAN_MATCH';
              const isManual = log.action === 'MANUAL_CORRECTION';
              const isStart = log.action === 'SESSION_START';

              return (
                <div
                  key={log.id}
                  className="p-3 rounded-lg border border-slate-100 bg-slate-50/70 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={`font-semibold ${
                      isYolo ? 'text-emerald-700' : isManual ? 'text-blue-700' : 'text-slate-700'
                    }`}>
                      {isYolo ? 'YOLO Face Match' : isManual ? 'Manual Correction' : 'Session Event'}
                    </span>
                    <span className="font-mono text-slate-400">{log.timestamp}</span>
                  </div>

                  <p className="text-slate-800 text-xs leading-snug">
                    {log.details}
                  </p>

                  {log.reason && (
                    <p className="text-[11px] text-slate-500 italic bg-white p-1 rounded border border-slate-200/60">
                      Reason: {log.reason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
