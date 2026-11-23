import React, { useState, useMemo } from 'react';
import { useTimetable } from '../context/TimetableContext';
import { isValidEmailFormat, normalizeEmail } from '../lib/firebase';
import { ConfirmModal } from './Modals/ConfirmModal';
import { AddStaffLessonModal } from './Modals/AddStaffLessonModal';
import {
  UserCheck,
  UserPlus,
  Trash2,
  Pencil,
  Check,
  X,
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Users,
  BookOpen,
  Lock,
  KeyRound,
  GraduationCap,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { getStaffAssignedSlots, getStaffDesignation, sortStaffPool, DAYS, DAY_FULL } from '../utils/timetable';
import { StaffDesignation } from '../types';

export const StaffSection: React.FC = () => {
  const {
    store,
    role,
    isAutoAdmin,
    openAdminLogin,
    addStaff,
    updateStaffMember,
    updateStaffDesignation,
    removeStaff,
    addApprovedEmail,
    removeApprovedEmail,
    setCurrentSection,
    setTimetableView,
    setIndivType,
    setIndivName,
  } = useTimetable();

  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffDesignation, setNewStaffDesignation] = useState<StaffDesignation>('LSA');
  const [addError, setAddError] = useState<string | null>(null);
  const [staffToRemove, setStaffToRemove] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState<string | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffEmail, setEditStaffEmail] = useState('');
  const [editStaffDesignation, setEditStaffDesignation] = useState<StaffDesignation>('LSA');
  const [editError, setEditError] = useState<string | null>(null);
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);
  const [classModalStaff, setClassModalStaff] = useState<string | null>(null);

  const [newApprovedEmail, setNewApprovedEmail] = useState('');
  const [approvedEmailError, setApprovedEmailError] = useState<string | null>(null);

  const orderedStaffPool = useMemo(() => sortStaffPool(store.lsaPool), [store.lsaPool]);
  const lsaCount = useMemo(
    () => orderedStaffPool.filter((p) => getStaffDesignation(p) === 'LSA').length,
    [orderedStaffPool]
  );
  const sendCount = useMemo(
    () => orderedStaffPool.filter((p) => getStaffDesignation(p) === 'SEND').length,
    [orderedStaffPool]
  );

  // Compute accurate active assigned slots for each staff member across all timetable entries & support types
  const staffStatsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getStaffAssignedSlots>>();
    for (const p of store.lsaPool) {
      map.set(
        p.name,
        getStaffAssignedSlots(
          p.name,
          store.students,
          store.entries,
          store.lsaAssignments,
          store.primarySupport || [],
          store.schedule
        )
      );
    }
    return map;
  }, [store.lsaPool, store.students, store.entries, store.lsaAssignments, store.primarySupport, store.schedule]);

  // Department-wide support slot statistics
  const totalAssignedSlots = useMemo(() => {
    let total = 0;
    staffStatsMap.forEach((stats) => {
      total += stats.uniqueSlotsCount;
    });
    return total;
  }, [staffStatsMap]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    const trimmedName = newStaffName.trim();
    const trimmedEmail = newStaffEmail.trim();
    if (!trimmedName) return;
    if (trimmedEmail && !isValidEmailFormat(trimmedEmail)) {
      setAddError('Please enter a valid Google / Gmail email address.');
      return;
    }
    if (store.lsaPool.some((p) => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      setAddError(`Staff member "${trimmedName}" already exists.`);
      return;
    }
    addStaff(trimmedName, trimmedEmail || undefined, newStaffDesignation);
    setNewStaffName('');
    setNewStaffEmail('');
    setNewStaffDesignation('LSA');
  };

  const startEditing = (name: string, email?: string, designation?: StaffDesignation) => {
    setEditingStaff(name);
    setEditStaffName(name);
    setEditStaffEmail(email || '');
    setEditStaffDesignation(designation === 'SEND' ? 'SEND' : 'LSA');
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingStaff(null);
    setEditStaffName('');
    setEditStaffEmail('');
    setEditStaffDesignation('LSA');
    setEditError(null);
  };

  const handleSaveEdit = (originalName: string) => {
    const trimmed = editStaffName.trim();
    const trimmedEmail = editStaffEmail.trim();
    if (!trimmed) {
      setEditError('Staff name cannot be empty');
      return;
    }
    if (trimmedEmail && !isValidEmailFormat(trimmedEmail)) {
      setEditError('Please enter a valid Google / Gmail email address.');
      return;
    }
    if (
      trimmed.toLowerCase() !== originalName.toLowerCase() &&
      store.lsaPool.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setEditError(`Staff member "${trimmed}" already exists in pool`);
      return;
    }
    updateStaffMember(originalName, trimmed, trimmedEmail || undefined, editStaffDesignation);
    setEditingStaff(null);
    setEditStaffName('');
    setEditStaffEmail('');
    setEditStaffDesignation('LSA');
    setEditError(null);
  };

  const handleAddApprovedEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setApprovedEmailError(null);
    const cleaned = normalizeEmail(newApprovedEmail);
    if (!cleaned) return;
    if (!isValidEmailFormat(cleaned)) {
      setApprovedEmailError('Please enter a valid email address.');
      return;
    }
    addApprovedEmail(cleaned);
    setNewApprovedEmail('');
  };

  const handleOpenStaffTimetable = (name: string) => {
    setIndivType('staff');
    setIndivName(name);
    setTimetableView('individual');
    setCurrentSection('timetable');
  };

  const approvedEmails = store.settings?.approvedEmails || [];

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-[17px] font-bold text-[#1C2333] mb-1">Staff Roster</h2>
        <p className="text-[13px] text-[#4A5268] leading-relaxed">
          {role === 'admin'
            ? 'Manage Learning Support Assistants (LSAs), link their Google / Gmail addresses for timetable access, and view their live timetable deployment.'
            : 'Learning Support Assistants (LSAs) and their scheduled timetable support sessions across the week. Staff roster editing is locked in Staff Mode.'}
        </p>
      </div>

      {role !== 'admin' && (
        <div className="p-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md flex items-center justify-between text-xs text-[#334155] shadow-xs">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#64748B] shrink-0" />
            <div>
              <span className="font-semibold text-[#0F172A]">Staff Roster Locked</span>
              <p className="text-[11px] text-[#64748B]">Adding, renaming, and removing staff members is locked in Staff Mode.</p>
            </div>
          </div>
          {isAutoAdmin && (
            <button
              type="button"
              onClick={openAdminLogin}
              className="text-xs font-semibold px-2.5 py-1 rounded bg-[#2F6F4E] text-white hover:bg-[#255c40] flex items-center gap-1 cursor-pointer transition-colors shadow-xs shrink-0"
            >
              <KeyRound className="w-3 h-3" /> Return to Admin
            </button>
          )}
        </div>
      )}

      {/* Summary Stat Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-[#DCDFE4] p-3 rounded-md shadow-xs flex items-center justify-between">
          <span className="text-xs text-[#4A5268] font-medium">Total Staff</span>
          <span className="text-base font-bold text-[#1C2333]">{store.lsaPool.length}</span>
        </div>
        <div className="bg-white border border-[#DCDFE4] p-3 rounded-md shadow-xs flex items-center justify-between">
          <span className="text-xs text-[#2F6F4E] font-medium">LSA</span>
          <span className="text-base font-bold text-[#2F6F4E]">{lsaCount}</span>
        </div>
        <div className="bg-white border border-[#DCDFE4] p-3 rounded-md shadow-xs flex items-center justify-between">
          <span className="text-xs text-[#3730A3] font-medium">SEND</span>
          <span className="text-base font-bold text-[#3730A3]">{sendCount}</span>
        </div>
        <div className="bg-white border border-[#DCDFE4] p-3 rounded-md shadow-xs flex items-center justify-between">
          <span className="text-xs text-[#4A5268] font-medium">Assigned Slots</span>
          <span className="text-base font-bold text-[#1C2333]">{totalAssignedSlots}</span>
        </div>
      </div>

      <div className="bg-white border border-[#DCDFE4] rounded-md p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-bold text-[#1C2333] flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#2F6F4E]" />
            {role === 'admin' ? 'Add a staff member & link Gmail' : 'Available Staff Pool'}
          </h3>
          {role !== 'admin' && (
            <span className="text-[11px] font-semibold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded border border-[#E2E8F0] flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#94A3B8]" /> Locked (Staff Mode)
            </span>
          )}
        </div>

        {role === 'admin' && (
          <form onSubmit={handleAdd} className="space-y-2 mb-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="new-staff-name-input"
                type="text"
                value={newStaffName}
                onChange={(e) => {
                  setNewStaffName(e.target.value);
                  if (addError) setAddError(null);
                }}
                placeholder="Full name (e.g. Ms Jenkins)"
                className="flex-1 text-xs px-3 py-2 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
              />
              <select
                id="new-staff-designation-select"
                value={newStaffDesignation}
                onChange={(e) => setNewStaffDesignation(e.target.value as StaffDesignation)}
                className="text-xs font-semibold px-2.5 py-2 border border-[#DCDFE4] rounded bg-white text-[#1C2333] focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                aria-label="Staff designation"
              >
                <option value="LSA">LSA</option>
                <option value="SEND">SEND</option>
              </select>
              <input
                id="new-staff-email-input"
                type="email"
                value={newStaffEmail}
                onChange={(e) => {
                  setNewStaffEmail(e.target.value);
                  if (addError) setAddError(null);
                }}
                placeholder="Google / Gmail (e.g. staff@gemswis.com)"
                className="flex-1 text-xs px-3 py-2 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
              />
              <button
                type="submit"
                id="btn-add-staff"
                className="px-3.5 py-2 text-xs font-semibold rounded bg-[#2F6F4E] text-white hover:bg-[#255c40] flex items-center justify-center gap-1 cursor-pointer shadow-xs shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {addError && <div className="text-[11px] text-[#B23A31] font-medium">{addError}</div>}
          </form>
        )}

        <ul className="divide-y divide-[#EAECEF] border-t border-[#EAECEF] pt-1">
          {orderedStaffPool.length === 0 ? (
            <li className="py-4 text-center text-xs text-[#4A5268] italic">No staff added to the pool yet.</li>
          ) : (
            orderedStaffPool.map((p) => {
              const designation = getStaffDesignation(p);
              const stats = staffStatsMap.get(p.name) || {
                uniqueSlotsCount: 0,
                totalAllocationsCount: 0,
                assignments: [],
                byDay: { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [] },
              };

              const isEditing = role === 'admin' && editingStaff === p.name;
              const isExpanded = expandedStaff === p.name;

              return (
                <li key={p.id} className="py-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          id={`edit-staff-input-${p.id}`}
                          type="text"
                          value={editStaffName}
                          onChange={(e) => {
                            setEditStaffName(e.target.value);
                            if (editError) setEditError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(p.name);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          placeholder="Staff full name"
                          className="flex-1 text-xs px-3 py-1.5 border border-[#2F6F4E] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E] font-medium"
                          autoFocus
                        />
                        <select
                          id={`edit-staff-designation-${p.id}`}
                          value={editStaffDesignation}
                          onChange={(e) => setEditStaffDesignation(e.target.value as StaffDesignation)}
                          className="text-xs font-semibold px-2.5 py-1.5 border border-[#CBD5E1] rounded bg-white text-[#1C2333] focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                          aria-label="Staff designation"
                        >
                          <option value="LSA">LSA</option>
                          <option value="SEND">SEND</option>
                        </select>
                        <input
                          id={`edit-staff-email-${p.id}`}
                          type="email"
                          value={editStaffEmail}
                          onChange={(e) => {
                            setEditStaffEmail(e.target.value);
                            if (editError) setEditError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(p.name);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          placeholder="Google / Gmail address"
                          className="flex-1 text-xs px-3 py-1.5 border border-[#CBD5E1] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                        />
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            id={`btn-save-staff-${p.id}`}
                            onClick={() => handleSaveEdit(p.name)}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded bg-[#2F6F4E] text-white hover:bg-[#255c40] flex items-center gap-1 cursor-pointer shadow-xs"
                            title="Save changes (Enter)"
                          >
                            <Check className="w-3.5 h-3.5" /> Save
                          </button>
                          <button
                            id={`btn-cancel-staff-${p.id}`}
                            onClick={cancelEditing}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] text-[#4A5268] hover:bg-[#F5F6F8] flex items-center gap-1 cursor-pointer"
                            title="Cancel editing (Esc)"
                          >
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </div>
                      </div>
                      {editError && <div className="text-[11px] text-[#B23A31] font-medium pl-1">{editError}</div>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13.5px] font-semibold text-[#1C2333]">{p.name}</span>
                            {role === 'admin' ? (
                              <div className="inline-flex rounded border border-[#DCDFE4] bg-[#F8FAFC] p-0.5" role="group" aria-label={`Designation for ${p.name}`}>
                                {(['LSA', 'SEND'] as StaffDesignation[]).map((opt) => {
                                  const active = designation === opt;
                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => updateStaffDesignation(p.name, opt)}
                                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                                        active
                                          ? opt === 'SEND'
                                            ? 'bg-[#3730A3] text-white shadow-2xs'
                                            : 'bg-[#2F6F4E] text-white shadow-2xs'
                                          : 'text-[#64748B] hover:text-[#1C2333]'
                                      }`}
                                      title={`Set designation to ${opt}`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  designation === 'SEND'
                                    ? 'bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]'
                                    : 'bg-[#E4F0EA] text-[#2F6F4E] border-[#c4e0d2]'
                                }`}
                              >
                                {designation}
                              </span>
                            )}
                            <span className="text-xs text-[#4A5268]">
                              <strong className="font-semibold text-[#1C2333]">{stats.uniqueSlotsCount}</strong> assigned
                              {stats.totalAllocationsCount > stats.uniqueSlotsCount && (
                                <span
                                  className="text-[11px] text-[#58228C] ml-1.5 font-medium"
                                  title="Includes periods supporting multiple students"
                                >
                                  ({stats.totalAllocationsCount} sessions)
                                </span>
                              )}
                            </span>
                          </div>
                          {role === 'admin' && (
                            <div className="mt-0.5 flex items-center gap-1.5">
                              {p.email ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#2F6F4E] bg-[#E4F0EA]/70 px-2 py-0.5 rounded border border-[#c4e0d2]">
                                  <Mail className="w-3 h-3" />
                                  {p.email}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10.5px] text-[#92400E] bg-[#FFFBEB] px-2 py-0.5 rounded border border-[#FDE68A]">
                                  No Gmail linked — click Edit to grant access
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Expand Schedule / Allocations button */}
                          <button
                            id={`btn-toggle-schedule-${p.id}`}
                            onClick={() => setExpandedStaff(isExpanded ? null : p.name)}
                            className={`text-xs font-semibold px-2.5 py-1 rounded border flex items-center gap-1 cursor-pointer transition-colors ${
                              isExpanded
                                ? 'bg-[#2F6F4E] text-white border-[#2F6F4E]'
                                : 'bg-[#E4F0EA] text-[#2F6F4E] border-[#c4e0d2] hover:bg-[#d5e9df]'
                            }`}
                            title={`View timetable schedule for ${p.name}`}
                          >
                            <Calendar className="w-3 h-3" /> Schedule
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>

                          {role === 'admin' ? (
                            <>
                              <button
                                id={`btn-add-class-staff-${p.id}`}
                                onClick={() => setClassModalStaff(p.name)}
                                className="text-xs font-semibold px-2.5 py-1 rounded border border-[#F59E0B] bg-[#FFFBEB] text-[#92400E] hover:bg-[#FEF3C7] flex items-center gap-1 cursor-pointer transition-colors"
                                title={`Add a Class (multiple students) with ${p.name} as Teacher`}
                              >
                                <GraduationCap className="w-3 h-3" /> + Class
                              </button>

                              <button
                                id={`btn-edit-staff-${p.id}`}
                                onClick={() => startEditing(p.name, p.email, p.designation)}
                                className="text-xs font-semibold px-2.5 py-1 rounded border border-[#DCDFE4] text-[#1C2333] hover:bg-[#F5F6F8] flex items-center gap-1 cursor-pointer transition-colors"
                                title={`Edit ${p.name}'s name, designation, or Gmail`}
                              >
                                <Pencil className="w-3 h-3 text-[#4A5268]" /> Edit
                              </button>

                              <button
                                id={`btn-remove-staff-${p.id}`}
                                onClick={() => setStaffToRemove(p.name)}
                                className="text-xs font-semibold px-2.5 py-1 rounded border border-[#B23A31] text-[#B23A31] hover:bg-[#FBE6E4] flex items-center gap-1 cursor-pointer transition-colors"
                                title="Remove staff member and clear assigned schedule"
                              >
                                <Trash2 className="w-3 h-3" /> Remove
                              </button>
                            </>
                          ) : (
                            isAutoAdmin && (
                              <button
                                type="button"
                                onClick={openAdminLogin}
                                className="text-[11.5px] font-medium px-2 py-1 rounded bg-[#F8FAFC] text-[#64748B] hover:text-[#1C2333] border border-[#E2E8F0] hover:border-[#CBD5E1] flex items-center gap-1 transition-colors cursor-pointer"
                                title="Return to Admin Mode"
                              >
                                <Lock className="w-3 h-3 text-[#94A3B8]" /> Locked
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      {/* Expanded Schedule Breakdown Drawer */}
                      {isExpanded && (
                        <div className="mt-2.5 p-3.5 bg-[#F9FAFC] rounded-md border border-[#DCDFE4] space-y-3 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between border-b border-[#EAECEF] pb-2">
                            <span className="text-xs font-bold text-[#1C2333] flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[#2F6F4E]" />
                              Weekly Timetable Deployment ({stats.uniqueSlotsCount} active sessions)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenStaffTimetable(p.name)}
                              className="text-xs font-semibold text-[#2F6F4E] hover:text-[#255c40] flex items-center gap-1 cursor-pointer underline"
                              title="Open individual timetable grid for this staff member"
                            >
                              <ExternalLink className="w-3 h-3" /> Open Timetable Grid
                            </button>
                          </div>

                          {stats.uniqueSlotsCount === 0 ? (
                            <p className="text-xs text-[#4A5268] italic py-2">
                              No timetable sessions currently assigned to {p.name}. You can assign this staff member by
                              clicking on any lesson in the Timetable grid or via Student Support settings.
                            </p>
                          ) : (
                            <div className="space-y-2.5">
                              {DAYS.map((day) => {
                                const dayAssignments = stats.byDay[day];
                                if (!dayAssignments || dayAssignments.length === 0) return null;

                                return (
                                  <div key={day} className="text-xs space-y-1">
                                    <div className="font-semibold text-[#4A5268] uppercase text-[10.5px] tracking-wider">
                                      {DAY_FULL[day]} ({dayAssignments.length} allocation
                                      {dayAssignments.length !== 1 ? 's' : ''})
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                      {dayAssignments.map((a, idx) => (
                                        <div
                                          key={`${a.day}_${a.slotId}_${a.student}_${idx}`}
                                          className="p-2 bg-white rounded border border-[#DCDFE4] flex items-start justify-between gap-1 shadow-2xs"
                                        >
                                          <div className="min-w-0">
                                            <div className="font-semibold text-[#1C2333] flex items-center gap-1">
                                              <Users className="w-3 h-3 text-[#2F6F4E] shrink-0" />
                                              <span className="truncate">{a.student}</span>
                                            </div>
                                            <div className="text-[11px] text-[#4A5268] flex items-center gap-1 mt-0.5">
                                              <BookOpen className="w-3 h-3 text-[#4A5268] shrink-0" />
                                              <span className="truncate">{a.subject}</span>
                                              {a.room && (
                                                <span className="text-[#4A5268] font-mono shrink-0">
                                                  · Rm {a.room}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="text-right shrink-0">
                                            <div className="font-mono text-[10.5px] font-semibold text-[#1C2333]">
                                              {a.slotLabel}
                                            </div>
                                            <span
                                              className={`inline-block text-[9.5px] px-1.5 py-0.2 rounded font-medium mt-0.5 ${
                                                a.type === 'secondary'
                                                  ? 'bg-[#F3E8FF] text-[#58228C]'
                                                  : a.type === 'teacher'
                                                  ? 'bg-[#FEF3C7] text-[#92400E]'
                                                  : 'bg-[#E4F0EA] text-[#2F6F4E]'
                                              }`}
                                            >
                                              {a.type === 'secondary'
                                                ? 'Secondary'
                                                : a.type === 'teacher'
                                                ? 'Teacher'
                                                : 'Primary'}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* Additional Manually Approved Sign-In Emails (for non-@gemswis.com accounts before/without staff linking) */}
      {role === 'admin' && (
        <div className="bg-white border border-[#DCDFE4] rounded-md p-5 shadow-xs space-y-3">
          <div>
            <h3 className="text-[14px] font-bold text-[#1C2333] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2F6F4E]" />
              Manually Approved Sign-In Emails
            </h3>
            <p className="text-xs text-[#4A5268] leading-relaxed mt-1">
              Emails ending in <span className="font-mono font-semibold">@gemswis.com</span> and staff emails linked above can sign in automatically. Add any extra non-<span className="font-mono">@gemswis.com</span> Google accounts here to permit them to sign in (they will see the registration prompt until linked to a staff member above).
            </p>
          </div>

          <form onSubmit={handleAddApprovedEmail} className="space-y-1.5">
            <div className="flex gap-2">
              <input
                id="new-approved-email-input"
                type="email"
                value={newApprovedEmail}
                onChange={(e) => {
                  setNewApprovedEmail(e.target.value);
                  if (approvedEmailError) setApprovedEmailError(null);
                }}
                placeholder="e.g. external.staff@gmail.com"
                className="flex-1 text-xs px-3 py-2 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
              />
              <button
                type="submit"
                id="btn-add-approved-email"
                className="px-3.5 py-2 text-xs font-semibold rounded bg-[#2F6F4E] text-white hover:bg-[#255c40] flex items-center gap-1 cursor-pointer shadow-xs shrink-0"
              >
                <Mail className="w-3.5 h-3.5" /> Approve Email
              </button>
            </div>
            {approvedEmailError && <div className="text-[11px] text-[#B23A31] font-medium">{approvedEmailError}</div>}
          </form>

          {approvedEmails.length > 0 && (
            <ul className="divide-y divide-[#EAECEF] border-t border-[#EAECEF] pt-1">
              {approvedEmails.map((email) => (
                <li key={email} className="py-2 flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-[#1C2333] flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#64748B]" />
                    {email}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeApprovedEmail(email)}
                    className="px-2 py-1 text-xs font-semibold rounded border border-[#B23A31] text-[#B23A31] hover:bg-[#FBE6E4] cursor-pointer"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {staffToRemove && (
        <ConfirmModal
          isOpen={true}
          title="Remove staff member?"
          sub={staffToRemove}
          message={`This removes ${staffToRemove} from the staff pool and clears all of their assigned timetable support slots.`}
          confirmLabel="Remove Staff"
          isDanger={true}
          onConfirm={() => {
            removeStaff(staffToRemove);
            setStaffToRemove(null);
          }}
          onClose={() => setStaffToRemove(null)}
        />
      )}

      <AddStaffLessonModal
        isOpen={Boolean(classModalStaff)}
        onClose={() => setClassModalStaff(null)}
        initialStaffName={classModalStaff || undefined}
        initialMode="class"
      />
    </div>
  );
};
