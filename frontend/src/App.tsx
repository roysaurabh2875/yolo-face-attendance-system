import React, { useState } from 'react';
import { AttendanceProvider, useAttendance } from './context/AttendanceContext';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { ToastContainer } from './components/common/ToastContainer';
import { ConfirmationModal } from './components/common/ConfirmationModal';
import { StudentDetailsModal } from './components/common/StudentDetailsModal';
import { UnifiedLoginPage } from './components/auth/UnifiedLoginPage';
import { AdminDashboardLayout } from './components/admin/AdminDashboardLayout';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { PresentStudentsView } from './components/attendance/PresentStudentsView';
import { AbsentStudentsView } from './components/attendance/AbsentStudentsView';
import { YoloScannerView } from './components/session/YoloScannerView';
import { PostedAttendanceView } from './components/attendance/PostedAttendanceView';
import { TeacherSettingsView } from './components/settings/TeacherSettingsView';
import { Student } from './types/attendance';
import { ArrowLeft, Shield } from 'lucide-react';

const FacultyLayout: React.FC = () => {
  const { students } = useAttendance();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [confirmationModalData, setConfirmationModalData] = useState<{
    isOpen: boolean;
    student: Student | null;
    action: 'mark_present' | 'mark_absent';
  }>({
    isOpen: false,
    student: null,
    action: 'mark_present'
  });

  const [detailsModalStudent, setDetailsModalStudent] = useState<Student | null>(null);

  const handleOpenCorrection = (student: Student, action: 'mark_present' | 'mark_absent') => {
    setConfirmationModalData({
      isOpen: true,
      student,
      action
    });
  };

  const handleOpenStudentDetails = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (student) {
      setDetailsModalStudent(student);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      <Header
        activeTab={activeTab}
        onToggleMobileMenu={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      />

      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          {activeTab === 'dashboard' && (
            <DashboardOverview
              onNavigate={(tab) => setActiveTab(tab)}
              onOpenDetails={handleOpenStudentDetails}
            />
          )}

          {activeTab === 'present' && (
            <PresentStudentsView
              onOpenDetails={handleOpenStudentDetails}
              onOpenCorrectionModal={handleOpenCorrection}
            />
          )}

          {activeTab === 'absent' && (
            <AbsentStudentsView
              onOpenDetails={handleOpenStudentDetails}
              onOpenCorrectionModal={handleOpenCorrection}
            />
          )}

          {activeTab === 'scanner' && (
            <YoloScannerView
              onOpenDetails={handleOpenStudentDetails}
              onOpenCorrectionModal={handleOpenCorrection}
            />
          )}

          {(activeTab === 'posted_attendance' || activeTab === 'reports') && (
            <PostedAttendanceView onOpenDetails={handleOpenStudentDetails} />
          )}

          {activeTab === 'settings' && <TeacherSettingsView />}
        </main>
      </div>

      <ConfirmationModal
        isOpen={confirmationModalData.isOpen}
        student={confirmationModalData.student}
        targetAction={confirmationModalData.action}
        onClose={() => setConfirmationModalData((prev) => ({ ...prev, isOpen: false }))}
      />

      <StudentDetailsModal
        student={detailsModalStudent}
        onClose={() => setDetailsModalStudent(null)}
        onOpenCorrectionModal={handleOpenCorrection}
      />

      <ToastContainer />
    </div>
  );
};

const MainApp: React.FC = () => {
  const { currentUser, isAdmin } = useAttendance();
  const [adminViewingScanner, setAdminViewingScanner] = useState(false);

  // 1. Not Authenticated -> Show Unified Login Portal
  if (!currentUser) {
    return (
      <>
        <UnifiedLoginPage />
        <ToastContainer />
      </>
    );
  }

  // 2. Authenticated as ADMIN -> Administrator Control Center
  if (isAdmin || currentUser.role === 'ADMIN') {
    if (adminViewingScanner) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col text-slate-100">
          <div className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAdminViewingScanner(false)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Admin Console
              </button>
              <span className="text-slate-400 text-sm">|</span>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-white">Administrator Live Scanner Observation</span>
              </div>
            </div>
            <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full font-mono font-bold">
              ROLE: ADMIN
            </span>
          </div>
          <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
            <YoloScannerView />
          </main>
          <ToastContainer />
        </div>
      );
    }

    return (
      <>
        <AdminDashboardLayout onOpenLiveScanner={() => setAdminViewingScanner(true)} />
        <ToastContainer />
      </>
    );
  }

  // 3. Authenticated as TEACHER -> Faculty Portal strictly
  return <FacultyLayout />;
};

export default function App() {
  return (
    <AttendanceProvider>
      <MainApp />
    </AttendanceProvider>
  );
}
