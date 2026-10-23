import React, { useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { 
  Settings, 
  ShieldCheck, 
  CheckCircle2, 
  Lock,
  Sliders,
  FileCheck,
  Save,
  GraduationCap,
  Building,
  Mail,
  Phone,
  BadgeCheck
} from 'lucide-react';

export const TeacherSettingsView: React.FC = () => {
  const { currentTeacher, addToast } = useAttendance();
  const [minimumThreshold, setMinimumThreshold] = useState(75);
  const [confirmManualCorrections, setConfirmManualCorrections] = useState(true);
  const [highlightAtRisk, setHighlightAtRisk] = useState(true);
  const [showConfidenceScores, setShowConfidenceScores] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    addToast('success', 'Preferences Updated', 'Your faculty attendance and threshold preferences have been saved.');
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">
              Faculty Profile & Preferences
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage your faculty credentials, academic profile, and attendance monitoring rules
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Faculty Profile Card (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
              {currentTeacher?.avatarUrl ? (
                <img
                  src={currentTeacher.avatarUrl}
                  alt={currentTeacher.name}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-full object-cover ring-4 ring-blue-50"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-900 text-white font-bold text-xl flex items-center justify-center">
                  {currentTeacher?.name ? currentTeacher.name.slice(0, 2).toUpperCase() : 'TC'}
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-slate-900">{currentTeacher?.name || 'Faculty Member'}</h3>
                <p className="text-xs text-blue-700 font-semibold">{currentTeacher?.designation || 'Assistant Professor'}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{currentTeacher?.department || 'Computer Science & Engineering'}</p>
              </div>
            </div>

            <div className="pt-4 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <BadgeCheck className="w-3.5 h-3.5 text-slate-400" /> Employee ID:
                </span>
                <span className="font-mono font-semibold text-slate-800">{currentTeacher?.employeeId || 'EMP-2026-089'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> Official Email:
                </span>
                <span className="font-mono text-slate-800 text-[11px]">{currentTeacher?.email || 'faculty@collegevision.edu'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" /> Faculty Office:
                </span>
                <span className="text-slate-800 font-medium">{currentTeacher?.office || 'Block B, Room 304, CS Wing'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone:
                </span>
                <span className="font-mono text-slate-800">{currentTeacher?.phone || '+91 98765 43210'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> Security Clearance:
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  FACULTY_TEACHER
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" /> Account Status:
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                </span>
              </div>
            </div>
          </div>

          {/* Access Policy Box */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-600" />
              Institutional Security Guarantee
            </p>
            <p className="text-slate-500 leading-relaxed">
              Student accounts are completely barred from accessing faculty routes. Biometric embeddings and passwords are encrypted and never exposed in client bundles.
            </p>
          </div>
        </div>

        {/* Right Columns: Faculty Attendance & Monitoring Preferences (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Attendance Threshold Setting */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Sliders className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Attendance Monitoring & Threshold Rules
              </h3>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="block text-xs font-bold text-slate-800">
                    Examination Eligibility Attendance Threshold
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Students below this percentage are automatically flagged on the absent roster and risk watchlist.
                  </p>
                </div>
                <div className="flex items-center gap-1 font-mono text-sm">
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={minimumThreshold}
                    onChange={(e) => setMinimumThreshold(Math.max(50, Math.min(100, Number(e.target.value))))}
                    className="w-16 py-1 px-2 border border-slate-300 rounded-lg text-center font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="font-bold text-slate-600">%</span>
                </div>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                value={minimumThreshold}
                onChange={(e) => setMinimumThreshold(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>50% (Minimum)</span>
                <span className="font-semibold text-blue-600">75% (University Standard)</span>
                <span>100%</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-800">Operational Preferences</h4>

              <label className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-slate-100/70 rounded-lg border border-slate-200/80 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={confirmManualCorrections}
                  onChange={(e) => setConfirmManualCorrections(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">
                    Confirm manual attendance overrides
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Prompt for verification dialog before toggling student attendance status.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-slate-100/70 rounded-lg border border-slate-200/80 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={highlightAtRisk}
                  onChange={(e) => setHighlightAtRisk(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">
                    Highlight at-risk students in absent & present rosters
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Display visual warning badges on students whose cumulative attendance is under {minimumThreshold}%.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-slate-100/70 rounded-lg border border-slate-200/80 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={showConfidenceScores}
                  onChange={(e) => setShowConfidenceScores(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">
                    Show real-time biometric confidence overlay
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Display YOLO match probability percentages on live detected face bounding boxes.
                  </span>
                </div>
              </label>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSavePreferences}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaved ? 'Preferences Saved' : 'Save Preferences'}</span>
              </button>
            </div>
          </div>

          {/* Teacher Academic Responsibilities Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Faculty Academic Responsibilities
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 space-y-1">
                <span className="font-bold text-blue-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  1. Launch Camera
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Start scheduled YOLO sessions for your assigned subject and classroom.
                </p>
              </div>

              <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 space-y-1">
                <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                  2. Verify & Correct
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Inspect absent/present rosters in real-time and make authorized manual corrections if needed.
                </p>
              </div>

              <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100 space-y-1">
                <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  3. Finalize & Post
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Finalize and lock the attendance record to post it to university records and generate reports.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
