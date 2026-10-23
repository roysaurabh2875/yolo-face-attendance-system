import React, { useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { 
  History, 
  ShieldCheck, 
  UserCheck, 
  Search, 
  Download, 
  Sparkles, 
  Play, 
  Lock,
  Filter
} from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const { auditLogs, students } = useAttendance();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | 'manual' | 'auto'>('all');

  const filteredLogs = auditLogs.filter((log) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (log.details || '').toLowerCase().includes(term) ||
      (log.teacherName || '').toLowerCase().includes(term) ||
      (log.studentName || '').toLowerCase().includes(term) ||
      (log.reason || '').toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (actionFilter === 'manual' && log.action !== 'MANUAL_CORRECTION') return false;
    if (actionFilter === 'auto' && log.action !== 'AUTO_SCAN_MATCH') return false;

    return true;
  });

  const exportAuditLogCsv = () => {
    const headers = ['Log ID', 'Timestamp', 'Action Type', 'Instructor Name', 'Student Name', 'Previous Status', 'New Status', 'Reason', 'Details'];
    const rows = filteredLogs.map((l) => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${l.action}"`,
      `"${l.teacherName || 'System'}"`,
      `"${l.studentName || 'N/A'}"`,
      `"${l.previousStatus || 'N/A'}"`,
      `"${l.newStatus || 'N/A'}"`,
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Attendance_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                Institutional Attendance Audit Trail
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Cryptographically bound record of faculty manual overrides and YOLO facial recognition events
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={exportAuditLogCsv}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Audit Log CSV</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit trail by student, teacher name, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="w-full sm:w-auto flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Filter Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as any)}
            className="text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg font-medium"
          >
            <option value="all">All Events</option>
            <option value="manual">Manual Faculty Overrides Only</option>
            <option value="auto">YOLO Model Auto-Scans Only</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 text-xs text-slate-600 font-medium">
          Showing <span className="font-bold text-slate-900 font-mono">{filteredLogs.length}</span> recorded compliance entries
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Authorized Instructor</th>
                <th className="py-3 px-4">Student Affected</th>
                <th className="py-3 px-4">Transition</th>
                <th className="py-3 px-4">Reason / Verification Justification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const isManual = log.action === 'MANUAL_CORRECTION';
                const isAuto = log.action === 'AUTO_SCAN_MATCH';
                const isStart = log.action === 'SESSION_START';
                const isFinal = log.action === 'SESSION_FINALIZED';

                return (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {log.timestamp}
                    </td>

                    <td className="py-3 px-4">
                      {isManual ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <ShieldCheck className="w-3 h-3 text-amber-700" />
                          MANUAL OVERRIDE
                        </span>
                      ) : isAuto ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          <Sparkles className="w-3 h-3 text-blue-700" />
                          YOLO AUTO SCAN
                        </span>
                      ) : isStart ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Play className="w-3 h-3 text-emerald-700" />
                          SESSION START
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          <Lock className="w-3 h-3 text-slate-600" />
                          {log.action}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-800">
                      {log.teacherName || 'System AI Service'}
                    </td>

                    <td className="py-3 px-4">
                      {log.studentName ? (
                        <div>
                          <span className="font-semibold text-slate-900">{log.studentName}</span>
                          {(() => {
                            const st = students.find((s) => s.id === log.studentId);
                            const roll = st?.rollNumber;
                            return roll ? (
                              <span className="block text-[11px] text-slate-500 font-mono">
                                Roll: {roll}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Entire Class</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px]">
                      {log.previousStatus && log.newStatus ? (
                        <span className="text-slate-600">
                          <span className="text-rose-600 font-semibold">{log.previousStatus.toUpperCase()}</span>
                          {' → '}
                          <span className="text-emerald-700 font-semibold">{log.newStatus.toUpperCase()}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-700">
                      {log.reason ? (
                        <div className="font-medium text-slate-800">
                          {log.reason}
                        </div>
                      ) : null}
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {log.details}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
