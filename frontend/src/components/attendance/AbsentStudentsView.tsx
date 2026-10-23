import React, { useState, useMemo } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { Student } from '../../types/attendance';
import { CLASSES_LIST, SUBJECTS_LIST } from '../../data/mockData';
import { 
  UserX, 
  Search, 
  Download, 
  UserCheck, 
  Eye, 
  AlertCircle, 
  Clock, 
  Filter,
  CheckCircle2,
  Lock,
  ShieldCheck
} from 'lucide-react';

interface AbsentStudentsViewProps {
  onOpenDetails: (studentId: string) => void;
  onOpenCorrectionModal: (student: Student, action: 'mark_present' | 'mark_absent') => void;
}

export const AbsentStudentsView: React.FC<AbsentStudentsViewProps> = ({
  onOpenDetails,
  onOpenCorrectionModal
}) => {
  const {
    absentRecords,
    students,
    selectedClassId,
    setSelectedClassId,
    selectedSection,
    setSelectedSection,
    selectedSubjectCode,
    setSelectedSubjectCode,
    selectedDate,
    setSelectedDate,
    currentSession,
    sessionStatus,
    currentTeacher,
    exportCsv
  } = useAttendance();

  const [searchTerm, setSearchTerm] = useState('');

  // Filter absent records
  const filteredRecords = useMemo(() => {
    return absentRecords.filter((rec) => {
      const term = searchTerm.toLowerCase().trim();
      if (!term) return true;
      return (
        rec.studentName.toLowerCase().includes(term) ||
        rec.studentId.toLowerCase().includes(term) ||
        rec.rollNumber.toLowerCase().includes(term)
      );
    });
  }, [absentRecords, searchTerm]);

  const handleSearchRoll = () => {
    // setSearchTerm is reactive; user can click button or press Enter
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-50 text-rose-700 rounded-lg">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                Absent Students Verification Roster
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Students not recognized by the YOLO vision scanner. Faculty can manually verify attendance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            Attendance sheets downloadable after posting
          </span>
        </div>
      </div>

      {/* Session Finalized Lock Callout */}
      {sessionStatus === 'finalized' ? (
        <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 text-amber-400 rounded-lg">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-white">Attendance Finalized & Sealed</p>
              <p className="text-xs text-slate-300 mt-0.5">
                Session closed. Ordinary faculty edits are locked. Under academic rules, only Administrator accounts have the authority to modify finalized attendance.
              </p>
            </div>
          </div>
          {currentTeacher?.role === 'ADMIN' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold whitespace-nowrap">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              ADMIN OVERRIDE ENABLED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-xs font-semibold whitespace-nowrap">
              <Lock className="w-3.5 h-3.5" />
              FACULTY EDIT LOCKED
            </span>
          )}
        </div>
      ) : (
        /* Action Guidance Callout */
        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <p className="font-semibold">Faculty Attendance Correction Protocol</p>
            <p className="mt-0.5 text-amber-800 leading-relaxed">
              Use the <strong className="font-bold">"Mark as Present"</strong> button for students who were present in the hall but missed automatic YOLO recognition (due to camera angle, lighting, late entry, or scanner hardware glitch). Every manual correction requires a recorded reason and is logged with your faculty credentials.
            </p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        {/* Roll Number Search with dedicated Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student roll number (e.g. 25951A05BK) or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <button
            type="button"
            onClick={handleSearchRoll}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Roll Number</span>
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
            >
              Clear
            </button>
          )}
        </div>

        {/* Timetable Filter row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedSection(e.target.value);
              }}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-md font-semibold text-slate-800"
            >
              {CLASSES_LIST.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Subject</label>
            <select
              value={selectedSubjectCode}
              onChange={(e) => setSelectedSubjectCode(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-md"
            >
              {SUBJECTS_LIST.filter(s => s.classId === selectedClassId).map((s) => (
                <option key={s.code} value={s.code}>{s.code}: {s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-md font-mono"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="text-xs text-slate-600 font-medium">
            Currently <span className="font-bold text-rose-600 font-mono tabular-nums">{filteredRecords.length}</span> students marked absent
          </div>
          <div className="text-xs text-slate-500 font-mono">
            Session: <span className="text-slate-700 font-semibold">{currentSession.timeSlot}</span>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-900">Zero Absent Students</h3>
            <p className="text-xs text-slate-500 mt-1">
              All students have either been recognized by YOLO or manually marked present.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Roll No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Semester Rate</th>
                  <th className="py-3 px-4">Guardian Contact</th>
                  <th className="py-3 px-4 text-right">Attendance Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((rec) => {
                  const student = students.find((s) => s.id === rec.studentId);
                  const isLowAttendance = student && student.overallAttendancePercentage < 75;

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Roll Number */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {rec.rollNumber}
                      </td>

                      {/* Name & Avatar */}
                      <td className="py-3 px-4">
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
                                target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="%232563eb"/><text x="50%" y="54%" font-family="sans-serif" font-size="11" font-weight="bold" fill="%23ffffff" dominant-baseline="middle" text-anchor="middle">${encodeURIComponent(rec.studentName.slice(0, 2).toUpperCase())}</text></svg>`;
                              }
                            }}
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                          />
                          <div>
                            <button
                              onClick={() => onOpenDetails(rec.studentId)}
                              className="font-bold text-slate-900 hover:text-blue-600 hover:underline text-left block"
                            >
                              {rec.studentName}
                            </button>
                            <span className="text-[11px] text-slate-400 font-mono">
                              III SU-1 ({student?.section || 'SU-1'})
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                        {rec.className}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                          ABSENT
                        </span>
                      </td>

                      {/* Cumulative Rate */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className={`font-semibold ${isLowAttendance ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                            {student?.overallAttendancePercentage}%
                          </span>
                          {isLowAttendance && (
                            <span className="text-[10px] text-rose-600 font-medium bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
                              &lt;75%
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Guardian Contact */}
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        <div className="font-sans font-medium text-slate-800">
                          {student?.guardianName && student.guardianName !== 'Parent / Guardian' ? student.guardianName : 'Parent / Guardian'}
                        </div>
                        <div className="text-slate-400 font-mono">
                          {student?.guardianPhone && !student.guardianPhone.includes('99881 10000') && student.guardianPhone !== '—' ? student.guardianPhone : 'Not Registered'}
                        </div>
                      </td>

                      {/* Action: Mark as Present Button */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            onClick={() => onOpenDetails(rec.studentId)}
                            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          >
                            Details
                          </button>

                          {student && (
                            sessionStatus === 'finalized' ? (
                              currentTeacher?.role === 'ADMIN' ? (
                                <button
                                  onClick={() => onOpenCorrectionModal(student, 'mark_present')}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                                  title="Admin Override: You have Administrator power to modify finalized records"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Mark Present (Admin)</span>
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-lg cursor-not-allowed opacity-75"
                                  title="Attendance locked: Session is finalized. Only Admin has authority to change."
                                >
                                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Locked (Admin Only)</span>
                                </button>
                              )
                            ) : (
                              <button
                                onClick={() => onOpenCorrectionModal(student, 'mark_present')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Mark as Present</span>
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
