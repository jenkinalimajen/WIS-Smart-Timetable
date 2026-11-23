import React, { useState, useEffect, useMemo } from 'react';
import { useTimetable } from '../context/TimetableContext';
import { MainSection, StaffAssignmentDetail } from '../types';
import { getAllWeekConflicts, activeSupportForDay, DAYS } from '../utils/timetable';
import { Shield, Clock, AlertTriangle, LogIn, LogOut, Cloud } from 'lucide-react';

interface HeaderProps {
  onOpenAdminLogin: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAdminLogin }) => {
  const {
    user,
    isAutoAdmin,
    logout,
    role,
    setRole,
    currentSection,
    setCurrentSection,
    syncStatus,
    forceSyncToCloud,
    store,
    setTimetableView,
    setStaffFilter,
    setCurrentDay,
  } = useTimetable();

  const [timeString, setTimeString] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTimeString(`${dateStr} · ${timeStr}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeWeekAssignments = useMemo(() => {
    const list: StaffAssignmentDetail[] = [];
    DAYS.forEach((d) => {
      list.push(
        ...activeSupportForDay(
          d,
          store.students,
          store.entries,
          store.lsaAssignments,
          store.primarySupport || [],
          store.schedule
        )
      );
    });
    return list;
  }, [store.students, store.entries, store.lsaAssignments, store.primarySupport, store.schedule]);

  const weekConflicts = useMemo(() => {
    return getAllWeekConflicts(activeWeekAssignments, store.schedule, store.entries);
  }, [activeWeekAssignments, store.schedule, store.entries]);

  const handleConflictClick = () => {
    if (weekConflicts.length > 0) {
      setCurrentSection('timetable');
      setTimetableView('staff');
      setStaffFilter('conflict');
      setCurrentDay(weekConflicts[0].day);
    }
  };

  const navItems: { id: MainSection; label: string; adminOnly?: boolean }[] = [
    { id: 'import', label: 'Import data', adminOnly: true },
    { id: 'timetable', label: 'Timetable' },
    { id: 'staff', label: 'Staff List' },
    { id: 'students', label: 'Student List' },
    { id: 'settings', label: 'Settings', adminOnly: true },
  ];

  return (
    <header className="bg-[#1C2333] text-white pt-4 px-3 sm:px-5 lg:px-6 pb-0 shrink-0 border-b border-[#2b3348] shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3.5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[19px] font-bold tracking-[0.2px] m-0 text-white flex items-center gap-2.5">
            <img
              src="/assets/aistudio/wistt-favicon.png_58b6a382.png"
              alt="WIS Smart Timetable Logo"
              className="w-7 h-7 rounded-full bg-white p-0.5 object-contain shrink-0 shadow-xs"
            />
            <span>WIS Smart Timetable</span>
          </h1>
          <span className="font-mono text-[11px] text-[#A9B0C3] bg-[#2A3449] px-2 py-0.5 rounded">
            Staff & Student scheduling
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="syncNote"
            onClick={() => forceSyncToCloud()}
            title={
              syncStatus === 'synced with cloud'
                ? 'Cloud synced — all staff links receive this live timetable. Click to re-sync.'
                : 'Click to upload and sync current timetable to Cloud for staff'
            }
            className={`text-[11px] font-mono flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors cursor-pointer ${
              syncStatus === 'synced with cloud'
                ? 'bg-[#263044]/60 hover:bg-[#263044] text-[#A9B0C3] border-[#374460]'
                : syncStatus === 'saving…'
                ? 'bg-amber-950/40 text-amber-300 border-amber-800 animate-pulse'
                : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-700'
            }`}
          >
            <Cloud
              className={`w-3.5 h-3.5 ${
                syncStatus === 'synced with cloud'
                  ? 'text-emerald-400'
                  : syncStatus === 'saving…'
                  ? 'text-amber-400 animate-bounce'
                  : 'text-emerald-300'
              }`}
            />
            <span
              className={`w-1.5 h-1.5 rounded-full inline-block ${
                syncStatus === 'synced with cloud'
                  ? 'bg-emerald-400 animate-pulse'
                  : syncStatus === 'saving…'
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
            ></span>
            <span>{syncStatus}</span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <nav className="flex gap-0.5 flex-wrap" id="mainTabs">
          {navItems
            .filter((item) => !item.adminOnly || role === 'admin')
            .map((item) => {
              const active = currentSection === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => setCurrentSection(item.id)}
                  className={`border-b-2 font-medium text-[13.5px] px-4 py-2.5 transition-colors cursor-pointer ${
                    active
                      ? 'text-white border-[#2F6F4E] font-semibold bg-[#263044]/50 rounded-t'
                      : 'text-[#B7BDCC] border-transparent hover:text-white hover:bg-[#263044]/30'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
        </nav>

        <div className="flex items-center gap-3 pb-2 flex-wrap">
          <span className="text-[12px] text-white font-mono font-medium tracking-[0.2px] flex items-center gap-1.5 bg-[#263044] px-2.5 py-1 rounded border border-[#374460]">
            <Clock className="w-3.5 h-3.5 text-[#A9B0C3]" />
            {timeString}
          </span>

          {weekConflicts.length > 0 && (
            <button
              id="header-conflict-badge"
              onClick={handleConflictClick}
              title="Click to view conflicting schedule slots"
              className="text-[11px] font-bold px-2.5 py-1 rounded-full tracking-[0.2px] bg-[#B23A31] text-white cursor-pointer hover:bg-[#c94339] transition-colors flex items-center gap-1 shadow-sm animate-pulse"
            >
              <AlertTriangle className="w-3 h-3" />
              {weekConflicts.length} conflict{weekConflicts.length > 1 ? 's' : ''}
            </button>
          )}

          <div className="flex items-center gap-2">
            {role === 'admin' ? (
              <div className="flex items-center gap-2">
                <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full uppercase tracking-[0.3px] bg-[#2F6F4E] text-white flex items-center gap-1 shadow-xs">
                  <Shield className="w-3 h-3" /> Admin mode
                </span>
                <button
                  id="header-logout-btn"
                  onClick={() => setRole('staff')}
                  className="text-xs font-semibold text-[#8FD8B0] hover:text-white underline cursor-pointer flex items-center gap-1"
                  title="Preview Staff Mode (View-only)"
                >
                  Staff preview
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full uppercase tracking-[0.3px] bg-white/10 text-[#cfd3de]">
                  Staff Mode (View-only)
                </span>
                {isAutoAdmin && (
                  <button
                    id="header-login-btn"
                    onClick={onOpenAdminLogin}
                    className="text-xs font-semibold text-[#8FD8B0] hover:text-white underline cursor-pointer flex items-center gap-1"
                  >
                    <LogIn className="w-3 h-3" /> Return to Admin
                  </button>
                )}
              </div>
            )}

            {user?.email && (
              <div className="flex items-center gap-2 pl-2 border-l border-[#374460]">
                <span className="hidden md:inline text-[11px] font-mono text-[#A9B0C3] max-w-[180px] truncate" title={user.email}>
                  {user.email}
                </span>
                <button
                  id="header-signout-btn"
                  type="button"
                  onClick={logout}
                  title={`Sign out (${user.email})`}
                  className="text-xs font-semibold px-2 py-1 rounded bg-[#263044] hover:bg-[#323e57] text-[#cfd3de] hover:text-white border border-[#374460] cursor-pointer flex items-center gap-1 transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </header>
  );
};
