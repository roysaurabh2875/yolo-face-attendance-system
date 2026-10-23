import React from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { LogOut, UserCheck, ShieldCheck, Menu } from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu, activeTab }) => {
  const { currentTeacher, logout, sessionStatus, backendConnected } = useAttendance();

  const getPageTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Faculty Dashboard';
      case 'present': return 'Present Students Directory';
      case 'absent': return 'Absent Students Roster';
      case 'scanner': return 'YOLO Face Scanner System';
      case 'posted_attendance':
      case 'reports': return 'Posted Attendance Records & Exports';
      case 'settings': return 'Faculty Profile & Preferences';
      default: return 'Faculty Portal';
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-8 py-3.5 bg-white border-b border-slate-200">
      {/* Zone 1: Brand Wordmark with College Emblem */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          aria-label="Open sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-wider shadow-sm">
            CV
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-slate-900 leading-tight whitespace-nowrap">
              CollegeVision Attendance
            </span>
            <span className="text-[11px] text-slate-500 font-medium leading-none">
              YOLO AI Face Recognition System
            </span>
          </div>
        </div>
      </div>

      {/* Zone 2: Breadcrumb / Active Context */}
      <div className="hidden md:flex items-center gap-3 text-xs text-slate-600 font-medium">
        <span>Academic Year 2026-27</span>
        <span aria-hidden="true" className="text-slate-300">/</span>
        <span className="text-slate-900 font-semibold">{getPageTitle(activeTab)}</span>
        <span aria-hidden="true" className="text-slate-300">/</span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700">
          <span className={`w-1.5 h-1.5 rounded-full ${sessionStatus === 'in_progress' ? 'bg-emerald-500' : sessionStatus === 'finalized' ? 'bg-slate-400' : 'bg-amber-400'}`} />
          {sessionStatus === 'in_progress' ? 'Scanner Live' : sessionStatus === 'finalized' ? 'Session Finalized' : 'Session Ready'}
        </span>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${backendConnected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${backendConnected ? 'bg-emerald-500' : 'bg-amber-400 animate-ping'}`} />
          {backendConnected ? 'Backend: Online (:8000)' : 'Backend: Connecting...'}
        </span>
      </div>

      {/* Zone 3: Authenticated Faculty & Logout */}
      <div className="flex items-center gap-3 shrink-0">
        {currentTeacher ? (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-900 leading-tight">
                {currentTeacher.name}
              </span>
              <span className="text-[11px] text-slate-500 flex items-center justify-end gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Verified Faculty
              </span>
            </div>

            <div className="relative group">
              {currentTeacher.avatarUrl ? (
                <img
                  src={currentTeacher.avatarUrl}
                  alt={currentTeacher.name}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-200"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs ring-2 ring-slate-200">
                  {currentTeacher.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
              )}
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              title="Logout from Faculty Portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-500 font-medium">Guest Mode</div>
        )}
      </div>
    </header>
  );
};
