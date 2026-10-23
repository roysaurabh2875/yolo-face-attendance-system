import React, { useState, useMemo } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { Student } from '../../types/attendance';
import { CLASSES_LIST, SUBJECTS_LIST } from '../../data/mockData';
import { 
  UserCheck, 
  Search, 
  Download, 
  ArrowUpDown, 
  ScanFace, 
  ShieldCheck, 
  Eye, 
  Filter,
  UserX,
  FileSpreadsheet,
  Lock
} from 'lucide-react';

interface PresentStudentsViewProps {
  onOpenDetails: (studentId: string) => void;
  onOpenCorrectionModal: (student: Student, action: 'mark_present' | 'mark_absent') => void;
}

type SortField = 'name' | 'id' | 'time';
type SortOrder = 'asc' | 'desc';

export const PresentStudentsView: React.FC<PresentStudentsViewProps> = ({
  onOpenDetails,
  onOpenCorrectionModal
}) => {
  const {
    presentRecords,
    students,
    selectedClassId,
    setSelectedClassId,
    selectedSection,
    setSelectedSection,
    selectedSubjectCode,
    setSelectedSubjectCode,
    selectedDate,
    setSelectedDate,
    sessionStatus,
    currentTeacher,
    exportCsv
  } = useAttendance();

  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<'all' | 'face_recognition' | 'manual'>('all');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Filter and sort
  const filteredRecords = useMemo(() => {
    return presentRecords
      .filter((rec) => {
        // Search term check
        const term = searchTerm.toLowerCase().trim();
        if (term) {
          const matchesSearch =
            rec.studentName.toLowerCase().includes(term) ||
            rec.studentId.toLowerCase().includes(term) ||
            rec.rollNumber.toLowerCase().includes(term);

          if (!matchesSearch) return false;
        }

        // Method filter check
        if (methodFilter !== 'all') {
          if (rec.method !== methodFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortField === 'name') {
          comp = a.studentName.localeCompare(b.studentName);
        } else if (sortField === 'id') {
          comp = a.studentId.localeCompare(b.studentId);
        } else if (sortField === 'time') {
          comp = (a.timestamp || '').localeCompare(b.timestamp || '');
        }
        return sortOrder === 'asc' ? comp : -comp;
      });
  }, [presentRecords, searchTerm, methodFilter, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                Present Students Directory
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Verified attendance records recorded by YOLO scanner and authorized faculty
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
      {sessionStatus === 'finalized' && (
        <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 text-amber-400 rounded-lg">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-white">Attendance Finalized & Sealed</p>
              <p className="text-xs text-slate-300 mt-0.5">
                Records are sealed in MySQL. Only Administrator accounts have the authority to modify finalized attendance.
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
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
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

          {/* Verification Method Filter */}
          <div className="w-full sm:w-auto flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Method:</span>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as any)}
              className="text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="all">All Methods</option>
              <option value="face_recognition">YOLO AI Only</option>
              <option value="manual">Manual Override Only</option>
            </select>
          </div>
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

      {/* Present Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="text-xs text-slate-600 font-medium">
            Showing <span className="font-bold text-slate-900 font-mono tabular-nums">{filteredRecords.length}</span> present students
          </div>
          <div className="text-xs text-slate-500 font-mono">
            Status Code: <span className="text-emerald-700 font-bold">200_PRESENT</span>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center">
            <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-700">No matching present records</h3>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting your search query or verification filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th 
                    className="py-3 px-4 cursor-pointer hover:text-slate-900"
                    onClick={() => toggleSort('id')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Roll No</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 cursor-pointer hover:text-slate-900"
                    onClick={() => toggleSort('name')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Student Name</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Status</th>
                  <th 
                    className="py-3 px-4 cursor-pointer hover:text-slate-900"
                    onClick={() => toggleSort('time')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Attendance Time</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Verification Method</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((rec) => {
                  const student = students.find((s) => s.id === rec.studentId);
                  const isFaceScan = rec.method === 'face_recognition';

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
                                target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="%2310b981"/><text x="50%" y="54%" font-family="sans-serif" font-size="11" font-weight="bold" fill="%23ffffff" dominant-baseline="middle" text-anchor="middle">${encodeURIComponent(rec.studentName.slice(0, 2).toUpperCase())}</text></svg>`;
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
                      <td className="py-3 px-4 text-slate-700 font-mono font-bold whitespace-nowrap">
                        {rec.className}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          PRESENT
                        </span>
                      </td>

                      {/* Attendance Time */}
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {rec.timestamp || '09:02 AM'}
                      </td>

                      {/* Verification Method */}
                      <td className="py-3 px-4">
                        {isFaceScan ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200/70">
                            <ScanFace className="w-3.5 h-3.5 text-blue-600" />
                            <span>YOLO AI</span>
                            <span className="font-mono text-blue-600">
                              ({((rec.confidenceScore || 0.984) * 100).toFixed(1)}%)
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200/70">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                            <span>Manual Override</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenDetails(rec.studentId)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="View Student Attendance Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {student && (
                            sessionStatus === 'finalized' ? (
                              currentTeacher?.role === 'ADMIN' ? (
                                <button
                                  onClick={() => onOpenCorrectionModal(student, 'mark_absent')}
                                  className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                                  title="Admin Override: Adjust to Absent"
                                >
                                  <UserX className="w-4 h-4" />
                                </button>
                              ) : (
                                <span
                                  className="p-1.5 text-slate-300 inline-block cursor-not-allowed"
                                  title="Attendance locked: Session is finalized. Only Admin has authority to change."
                                >
                                  <Lock className="w-4 h-4" />
                                </span>
                              )
                            ) : (
                              <button
                                onClick={() => onOpenCorrectionModal(student, 'mark_absent')}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                title="Adjust to Absent (Faculty Correction)"
                              >
                                <UserX className="w-4 h-4" />
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
