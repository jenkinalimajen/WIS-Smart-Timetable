import React from 'react';
import { TimetableProvider, useTimetable } from './context/TimetableContext';
import { Header } from './components/Header';
import { AnnouncementsBanner } from './components/AnnouncementsBanner';
import { TimetableGrid } from './components/TimetableGrid';
import { ImportSection } from './components/ImportSection';
import { StaffSection } from './components/StaffSection';
import { StudentsSection } from './components/StudentsSection';
import { SettingsSection } from './components/SettingsSection';
import { AdminLoginModal } from './components/Modals/AdminLoginModal';
import { AuthGate } from './components/AuthGate';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  declare state: ErrorBoundaryState;
  declare props: { children: React.ReactNode };

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] p-4 text-[#1C2333]">
          <div className="bg-white border border-[#DCDFE4] rounded-lg max-w-md w-full p-6 shadow-md space-y-3 text-center">
            <h2 className="text-base font-bold text-[#B23A31]">Something went wrong</h2>
            <p className="text-xs text-[#4A5268] break-words">{this.state.errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold rounded bg-[#2F6F4E] text-white hover:bg-[#255c40] cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  const { accessStatus, currentSection, role, isAdminLoginOpen, setIsAdminLoginOpen, openAdminLogin } = useTimetable();

  if (accessStatus !== 'authorized') {
    return <AuthGate />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F6F8] text-[#1C2333]">
      <Header onOpenAdminLogin={openAdminLogin} />

      <main className={`flex-1 ${currentSection === 'timetable' ? 'px-1.5 sm:px-3 py-2.5' : 'px-3 sm:px-5 lg:px-6 py-4'} w-full`}>
        <AnnouncementsBanner />

        {currentSection === 'import' && role === 'admin' && <ImportSection />}
        {currentSection === 'timetable' && <TimetableGrid />}
        {currentSection === 'staff' && <StaffSection />}
        {currentSection === 'students' && <StudentsSection />}
        {currentSection === 'settings' && role === 'admin' && <SettingsSection />}
      </main>

      <AdminLoginModal isOpen={isAdminLoginOpen} onClose={() => setIsAdminLoginOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <AppErrorBoundary>
      <TimetableProvider>
        <AppContent />
      </TimetableProvider>
    </AppErrorBoundary>
  );
}
