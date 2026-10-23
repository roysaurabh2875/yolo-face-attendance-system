import React, { useState } from 'react';
import { Student } from '../../types/attendance';
import { useAttendance } from '../../context/AttendanceContext';
import { AlertTriangle, UserCheck, Shield, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  student: Student | null;
  targetAction: 'mark_present' | 'mark_absent';
  onClose: () => void;
}

const REASON_OPTIONS = [
  'Face recognition failed (lighting or camera angle)',
  'Student attended but login failed / late gate entry',
  'Technical issue with YOLO scanning hardware',
  'Approved medical or departmental duty permission',
  'Other administrative faculty override'
];

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  student,
  targetAction,
  onClose
}) => {
  const { currentTeacher, markAsPresentManual, markAsAbsentManual } = useAttendance();
  const [selectedReason, setSelectedReason] = useState(REASON_OPTIONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !student) return null;

  const handleConfirm = () => {
    setIsSubmitting(true);
    const finalReason = selectedReason === 'Other administrative faculty override' && customReason.trim()
      ? `Other: ${customReason.trim()}`
      : selectedReason;

    if (targetAction === 'mark_present') {
      markAsPresentManual(student.id, finalReason);
    } else {
      markAsAbsentManual(student.id, finalReason);
    }

    setIsSubmitting(false);
    onClose();
  };

  const isMarkingPresent = targetAction === 'mark_present';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div 
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${isMarkingPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {isMarkingPresent ? <UserCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isMarkingPresent ? 'Confirm Attendance Override' : 'Confirm Status Correction'}
              </h3>
              <p className="text-xs text-slate-500">
                Manual override will be recorded in the audit trail
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Student Info Card */}
          <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
            <img
              src={student.avatarUrl || `/student-photos/${student.id}.jpg`}
              alt={student.name}
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.dataset.triedFallback) {
                  target.dataset.triedFallback = 'true';
                  target.src = `/api/students/${student.id}/photo`;
                } else {
                  target.onerror = null;
                  target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="24" fill="%232563eb"/><text x="50%" y="54%" font-family="sans-serif" font-size="16" font-weight="bold" fill="%23ffffff" dominant-baseline="middle" text-anchor="middle">${encodeURIComponent(student.name.slice(0, 2).toUpperCase())}</text></svg>`;
                }
              }}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-200"
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-900 truncate">{student.name}</h4>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 mt-0.5 font-mono">
                <span className="font-bold text-slate-700">Roll No: {student.rollNumber}</span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 font-medium">
                Class: <span className="font-mono font-bold text-slate-800">{student.className}</span>
              </p>
            </div>
            <div className="text-right">
              <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${
                isMarkingPresent ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                Current: {isMarkingPresent ? 'ABSENT' : 'PRESENT'}
              </span>
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                Target: {isMarkingPresent ? 'PRESENT' : 'ABSENT'}
              </p>
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Reason for Manual Override <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {selectedReason === 'Other administrative faculty override' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Custom Remarks / Reason Details
              </label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={2}
                placeholder="Enter specific justification for audit compliance..."
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Faculty Audit Identity Notice */}
          <div className="flex items-start gap-2.5 p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900">
            <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Instructor Verification Binding</p>
              <p className="text-[11px] text-blue-700 mt-0.5">
                Executing this action records your credentials (
                <span className="font-semibold">{currentTeacher?.name || 'Verified Faculty'}</span>, ID: {currentTeacher?.employeeId}) and current timestamp to the institutional audit log.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-sm transition-colors flex items-center gap-1.5 ${
              isMarkingPresent
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {isSubmitting ? 'Updating...' : isMarkingPresent ? 'Confirm & Mark as Present' : 'Confirm Status Reversal'}
          </button>
        </div>
      </div>
    </div>
  );
};
