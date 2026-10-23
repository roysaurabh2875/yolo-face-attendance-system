import React from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import {
  LayoutDashboard,
  UserCheck,
  UserX,
  ScanFace,
  ClipboardCheck,
  Settings,
  ShieldAlert,
  GraduationCap,
  X
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  onClose
}) => {
  const { presentCount, absentCount, sessionStatus } = useAttendance();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard Overview',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'present',
      label: 'Present Students',
      icon: UserCheck,
      badge: `${presentCount}`,
      badgeColor: 'bg-emerald-100 text-emerald-800'
    },
    {
      id: 'absent',
      label: 'Absent Students',
      icon: UserX,
      badge: `${absentCount}`,
      badgeColor: 'bg-rose-100 text-rose-800'
    },
    {
      id: 'scanner',
      label: 'YOLO Face Scanner',
      icon: ScanFace,
      badge: sessionStatus === 'in_progress' ? 'Active' : null,
      badgeColor: 'bg-blue-100 text-blue-800 animate-pulse'
    },
    {
      id: 'posted_attendance',
      label: 'Posted Attendance Records',
      icon: ClipboardCheck,
      badge: null
    },
    {
      id: 'settings',
      label: 'Profile & Preferences',
      icon: Settings,
      badge: null
    }
  ];

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed lg:sticky top-0 lg:top-[61px] left-0 z-40 lg:z-10 w-64 h-full lg:h-[calc(100vh-61px)] bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Mobile Header in Drawer */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 lg:hidden">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-white text-sm">Faculty Portal</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Faculty Portal Sub-header */}
        <div className="hidden lg:block px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <GraduationCap className="w-4 h-4 text-blue-400" />
            <span>Faculty Attendance Console</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Access strictly restricted to verified instructors
          </p>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums font-semibold ${
                      isActive ? 'bg-white/20 text-white' : item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Access Control Notice Footer */}
        <div className="p-4 m-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs">
          <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>Protected Route</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Attendance edits are cryptographically timestamped and logged with teacher credentials.
          </p>
        </div>
      </aside>
    </>
  );
};
