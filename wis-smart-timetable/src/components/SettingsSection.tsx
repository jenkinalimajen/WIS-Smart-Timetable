import React, { useState, useMemo, useEffect } from 'react';
import { useTimetable } from '../context/TimetableContext';
import {
  slotsFor,
  getTotalActiveSupportSlotsCount,
  DEFAULT_SLOTS_WEEKDAY,
  DEFAULT_SLOTS_FRIDAY,
} from '../utils/timetable';
import { ScheduleOverrides, TimeSlot } from '../types';
import { ConfirmModal } from './Modals/ConfirmModal';
import {
  Settings,
  KeyRound,
  Bell,
  Clock,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Cloud,
  RefreshCw,
  Plus,
  ShieldCheck,
  BookmarkCheck,
  Download,
  History,
  UploadCloud,
  ExternalLink,
} from 'lucide-react';

export const SettingsSection: React.FC = () => {
  const {
    store,
    syncStatus,
    forceSyncToCloud,
    setAdminPasscode,
    postAnnouncement,
    removeAnnouncement,
    saveScheduleOverrides,
    clearAllEntries,
    resetToSampleData,
    milestoneInfo,
    saveMilestoneCheckpoint,
    restoreMilestoneCheckpoint,
    downloadCheckpointJSON,
  } = useTimetable();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeSaved, setPasscodeSaved] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');

  // Milestone Checkpoint States
  const [isSavingCheckpoint, setIsSavingCheckpoint] = useState(false);
  const [checkpointFeedback, setCheckpointFeedback] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [isRestoringCheckpoint, setIsRestoringCheckpoint] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [checkpointNameInput, setCheckpointNameInput] = useState('');

  const [weekdayList, setWeekdayList] = useState<TimeSlot[]>(() =>
    slotsFor('Mon', store.schedule)
  );
  const [fridayList, setFridayList] = useState<TimeSlot[]>(() =>
    slotsFor('Fri', store.schedule)
  );

  useEffect(() => {
    setWeekdayList(slotsFor('Mon', store.schedule));
    setFridayList(slotsFor('Fri', store.schedule));
  }, [store.schedule]);

  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const hasPasscode = Boolean(store.settings?.adminPasscode);

  const handleSetPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim() || passcode.trim().length < 4) return;
    setAdminPasscode(passcode.trim());
    setPasscode('');
    setPasscodeSaved(true);
    setTimeout(() => setPasscodeSaved(false), 3000);
  };

  const handlePostAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim()) return;
    postAnnouncement(announcementText);
    setAnnouncementText('');
  };

  const handleUpdateSlot = (
    dayKey: 'weekday' | 'friday',
    slotId: string,
    field: 'label' | 'start' | 'end' | 'type',
    value: string
  ) => {
    const updater = (prev: TimeSlot[]) =>
      prev.map((s) => {
        if (s.id !== slotId) return s;
        if (field === 'type') {
          const nextType = value as 'lesson' | 'fixed';
          return {
            ...s,
            type: nextType,
            defaultLabel: nextType === 'fixed' ? s.label : s.defaultLabel,
          };
        }
        if (field === 'label') {
          return {
            ...s,
            label: value,
            defaultLabel: s.type === 'fixed' ? value : s.defaultLabel,
          };
        }
        return {
          ...s,
          [field]: value,
        };
      });

    if (dayKey === 'weekday') {
      setWeekdayList(updater);
    } else {
      setFridayList(updater);
    }
  };

  const handleDeleteSlot = (dayKey: 'weekday' | 'friday', slotId: string) => {
    if (dayKey === 'weekday') {
      setWeekdayList((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== slotId) : prev));
    } else {
      setFridayList((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== slotId) : prev));
    }
  };

  const handleAddSlot = (dayKey: 'weekday' | 'friday') => {
    const current = dayKey === 'weekday' ? weekdayList : fridayList;
    const lastSlot = current[current.length - 1];
    const uniqueSuffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    const newId = `slot_${uniqueSuffix}`;
    const lessonNumber = current.filter((s) => s.type === 'lesson').length + 1;
    const newSlot: TimeSlot = {
      id: newId,
      label: `Lesson ${lessonNumber}`,
      start: lastSlot?.end || '3:10',
      end: '3:50',
      type: 'lesson',
    };

    if (dayKey === 'weekday') {
      setWeekdayList((prev) => [...prev, newSlot]);
    } else {
      setFridayList((prev) => [...prev, newSlot]);
    }
  };

  const handleResetDefaultSlots = () => {
    setWeekdayList(DEFAULT_SLOTS_WEEKDAY.map((s) => ({ ...s })));
    setFridayList(DEFAULT_SLOTS_FRIDAY.map((s) => ({ ...s })));
  };

  const handleSaveSchedule = () => {
    const cleanSlot = (s: TimeSlot): TimeSlot => {
      const cleanLabel = s.label.trim() || 'Lesson';
      const cleaned: TimeSlot = {
        id: s.id,
        label: cleanLabel,
        start: s.start.trim() || '8:00',
        end: s.end.trim() || '8:40',
        type: s.type,
      };
      if (s.group) cleaned.group = s.group;
      if (s.type === 'fixed') {
        cleaned.defaultLabel = cleanLabel;
      } else if (s.defaultLabel) {
        cleaned.defaultLabel = s.defaultLabel;
      }
      return cleaned;
    };

    const nextWeekdaySlots = weekdayList.map(cleanSlot);
    const nextFridaySlots = fridayList.map(cleanSlot);

    const weekdayMap: Record<string, Partial<TimeSlot>> = {};
    nextWeekdaySlots.forEach((s) => {
      weekdayMap[s.id] = {
        label: s.label,
        start: s.start,
        end: s.end,
        type: s.type,
        ...(s.defaultLabel ? { defaultLabel: s.defaultLabel } : {}),
      };
    });

    const fridayMap: Record<string, Partial<TimeSlot>> = {};
    nextFridaySlots.forEach((s) => {
      fridayMap[s.id] = {
        label: s.label,
        start: s.start,
        end: s.end,
        type: s.type,
        ...(s.defaultLabel ? { defaultLabel: s.defaultLabel } : {}),
      };
    });

    const overrides: ScheduleOverrides = {
      weekday: weekdayMap,
      friday: fridayMap,
      weekdaySlots: nextWeekdaySlots,
      fridaySlots: nextFridaySlots,
    };

    saveScheduleOverrides(overrides);
    setScheduleSaved(true);
    setTimeout(() => setScheduleSaved(false), 3000);
  };

  const supportStats = useMemo(() => {
    return getTotalActiveSupportSlotsCount(
      store.students,
      store.entries,
      store.lsaAssignments,
      store.primarySupport || [],
      store.schedule
    );
  }, [store.students, store.entries, store.lsaAssignments, store.primarySupport, store.schedule]);

  const renderSlotEditorColumn = (
    title: string,
    dayKey: 'weekday' | 'friday',
    slots: TimeSlot[]
  ) => (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between border-b border-[#EAECEF] pb-1.5">
        <h4 className="text-xs font-bold text-[#1C2333]">{title}</h4>
        <span className="text-[11px] text-[#64748B]">{slots.length} slots</span>
      </div>

      <div className="space-y-2">
        {slots.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-1.5 p-1.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-xs"
          >
            {/* Editable Lesson / Slot Name (e.g. Lesson 1a) */}
            <input
              type="text"
              value={s.label}
              onChange={(e) => handleUpdateSlot(dayKey, s.id, 'label', e.target.value)}
              placeholder="Slot name (e.g. Lesson 1a)"
              className="flex-1 min-w-[105px] px-2 py-1 border border-[#DCDFE4] rounded bg-white text-[#1C2333] font-medium text-xs focus:outline-none focus:ring-1 focus:ring-[#2F6F4E]"
              title="Edit slot name"
            />

            {/* Start Time */}
            <input
              type="text"
              value={s.start}
              onChange={(e) => handleUpdateSlot(dayKey, s.id, 'start', e.target.value)}
              placeholder="Start"
              className="w-14 px-1.5 py-1 border border-[#DCDFE4] rounded bg-white text-center font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#2F6F4E]"
              title="Start time"
            />
            <span className="text-[#4A5268]">–</span>

            {/* End Time */}
            <input
              type="text"
              value={s.end}
              onChange={(e) => handleUpdateSlot(dayKey, s.id, 'end', e.target.value)}
              placeholder="End"
              className="w-14 px-1.5 py-1 border border-[#DCDFE4] rounded bg-white text-center font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#2F6F4E]"
              title="End time"
            />

            {/* Type Selector: Lesson vs Fixed (Break/Reg) */}
            <select
              value={s.type}
              onChange={(e) => handleUpdateSlot(dayKey, s.id, 'type', e.target.value)}
              className="px-1.5 py-1 border border-[#DCDFE4] rounded bg-white text-[11px] text-[#4A5268] focus:outline-none focus:ring-1 focus:ring-[#2F6F4E] cursor-pointer"
              title="Slot type"
            >
              <option value="lesson">Lesson</option>
              <option value="fixed">Break / Reg</option>
            </select>

            {/* Delete Slot Button */}
            <button
              type="button"
              onClick={() => handleDeleteSlot(dayKey, s.id)}
              disabled={slots.length <= 1}
              className="p-1.5 rounded text-[#B23A31] hover:bg-[#FBE6E4] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title={`Delete ${s.label}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        id={`btn-add-slot-${dayKey}`}
        onClick={() => handleAddSlot(dayKey)}
        className="w-full py-1.5 px-3 text-xs font-semibold rounded border border-dashed border-[#2F6F4E] text-[#2F6F4E] hover:bg-[#E4F0EA]/60 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add Slot</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="text-[17px] font-bold text-[#1C2333] mb-1">Department Settings</h2>
        <p className="text-[13px] text-[#4A5268] leading-relaxed">
          Admin-only controls. Changes made here update the shared data and timings shown to all staff.
        </p>
      </div>

      {/* Summary Overview */}
      <div className="bg-white border border-[#DCDFE4] rounded-md p-5 shadow-xs">
        <h3 className="text-[14px] font-bold text-[#1C2333] mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4 text-[#2F6F4E]" />
          Overview
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-[#F5F6F8] p-3 rounded border border-[#EAECEF]">
            <span className="text-[#4A5268] block">Students</span>
            <span className="text-lg font-bold text-[#1C2333]">{store.students.length}</span>
          </div>
          <div className="bg-[#F5F6F8] p-3 rounded border border-[#EAECEF]">
            <span className="text-[#4A5268] block">Timetable Entries</span>
            <span className="text-lg font-bold text-[#1C2333]">{store.entries.length}</span>
          </div>
          <div className="bg-[#F5F6F8] p-3 rounded border border-[#EAECEF]">
            <span className="text-[#4A5268] block">Staff in Pool</span>
            <span className="text-lg font-bold text-[#1C2333]">{store.lsaPool.length}</span>
          </div>
          <div className="bg-[#F5F6F8] p-3 rounded border border-[#EAECEF]">
            <span className="text-[#4A5268] block">Support Sessions Assigned</span>
            <span className="text-lg font-bold text-[#1C2333]">{supportStats.uniqueSlotSessions}</span>
          </div>
        </div>
      </div>

      {/* Cloud Database & Staff Link Sync */}
      <div className="bg-white border border-[#DCDFE4] rounded-md p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-[#1C2333] flex items-center gap-2">
            <Cloud className="w-4 h-4 text-[#2F6F4E]" />
            Cloud Database & Staff Link Synchronization
          </h3>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 border ${
              syncStatus === 'synced with cloud'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : syncStatus === 'saving…'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === 'synced with cloud'
                  ? 'bg-emerald-500 animate-pulse'
                  : syncStatus === 'saving…'
                  ? 'bg-amber-500'
                  : 'bg-slate-400'
              }`}
            />
            {syncStatus === 'synced with cloud' ? 'Live Cloud Synced' : syncStatus}
          </span>
        </div>

        <p className="text-xs text-[#4A5268] leading-relaxed">
          The <strong>Staff Share Link</strong> loads this live Cloud Database. When you import or edit schedules,
          all staff members opening the share link on their devices automatically receive this synchronized data.
        </p>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            id="btn-force-cloud-sync"
            disabled={isSyncing}
            onClick={async () => {
              setIsSyncing(true);
              setSyncSuccess(false);
              const ok = await forceSyncToCloud();
              setIsSyncing(false);
              if (ok) {
                setSyncSuccess(true);
                setTimeout(() => setSyncSuccess(false), 4000);
              }
            }}
            className="px-3.5 py-1.5 text-xs font-semibold rounded bg-[#2F6F4E] hover:bg-[#255c40] text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Uploading to Cloud…' : 'Push Current Timetable to Cloud'}
          </button>
          {syncSuccess && (
            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> All timetable data uploaded to Cloud!
            </span>
          )}
        </div>
      </div>

      {/* Admin Passcode */}
      <div className="bg-white border border-[#DCDFE4] rounded-md p-5 shadow-xs">
        <h3 className="text-[14px] font-bold text-[#1C2333] mb-2 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#2F6F4E]" />
          Admin Passcode
        </h3>
        <p className="text-xs text-[#4A5268] leading-relaxed mb-3">
          Anyone with this passcode can unlock editing on their own device. This is a shared convenience lock for a trusted department team — share it only with staff who should be able to edit.
        </p>

        <form onSubmit={handleSetPasscode} className="flex gap-2 max-w-md">
          <input
            id="settings-passcode-input"
            type="text"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder={hasPasscode ? 'Update passcode (min 4 characters)' : 'Set a passcode (min 4 characters)'}
            className="flex-1 text-xs px-3 py-2 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
          />
          <button
            type="submit"
            id="btn-save-passcode"
            disabled={!passcode || passcode.trim().length < 4}
            className="px-3.5 py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] bg-white text-[#1C2333] hover:bg-[#F5F6F8] cursor-pointer disabled:opacity-40"
          >
            {hasPasscode ? 'Update Passcode' : 'Set Passcode'}
          </button>
        </form>
        {passcodeSaved && (
          <p className="text-xs text-[#2F6F4E] font-medium mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Passcode saved successfully!
          </p>
        )}
      </div>

      {/* Staff Announcements */}
      <div className="bg-white border border-[#DCDFE4] rounded-md p-5 shadow-xs">
        <h3 className="text-[14px] font-bold text-[#1C2333] mb-2 flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#2F6F4E]" />
          Announcements for Staff
        </h3>
        <p className="text-xs text-[#4A5268] leading-relaxed mb-3">
          Shows as a prominent banner for everyone using the app — useful for room changes, reminders, or timetable updates. Announcements clear themselves automatically at the end of each school day (3:10pm Monday–Thursday, 12:00 noon Friday) so they never become stale.
        </p>

        <form onSubmit={handlePostAnnouncement} className="flex gap-2 mb-4">
          <input
            id="settings-announcement-input"
            type="text"
            value={announcementText}
            onChange={(e) => setAnnouncementText(e.target.value)}
            placeholder="e.g. Room changes updated for Thursday interventions"
            className="flex-1 text-xs px-3 py-2 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
          />
          <button
            type="submit"
            id="btn-post-announcement"
            className="px-3.5 py-1.5 text-xs font-semibold rounded bg-[#2F6F4E] text-white hover:bg-[#255c40] cursor-pointer shadow-xs"
          >
            Post Update
          </button>
        </form>

        <ul className="divide-y divide-[#EAECEF] border-t border-[#EAECEF] pt-1">
          {(store.announcements || []).length === 0 ? (
            <li className="py-3 text-center text-xs text-[#4A5268] italic">No active announcements.</li>
          ) : (
            (store.announcements || []).map((ann) => (
              <li key={ann.id} className="py-2.5 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-mono text-[#4A5268] mb-0.5">
                    {new Date(ann.date).toLocaleString()}
                  </div>
                  <div className="text-[13px] text-[#1C2333]">{ann.text}</div>
                </div>
                <button
                  onClick={() => removeAnnouncement(ann.id)}
                  className="text-xs font-semibold px-2 py-1 rounded border border-[#B23A31] text-[#B23A31] hover:bg-[#FBE6E4] shrink-0 cursor-pointer"
                  title="Remove this announcement"
                >
                  Remove
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Period Names, Slots & Times Editor */}
      <div className="bg-white border border-[#DCDFE4] rounded-md p-5 shadow-xs">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
          <div>
            <h3 className="text-[14px] font-bold text-[#1C2333] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#2F6F4E]" />
              Lesson Slots & Period Times
            </h3>
            <p className="text-xs text-[#4A5268] leading-relaxed mt-1">
              Edit lesson names (e.g. Lesson 1a), adjust start and end times, or add and delete slots.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetDefaultSlots}
            className="px-2.5 py-1 text-xs font-semibold rounded border border-[#DCDFE4] text-[#4A5268] hover:text-[#1C2333] hover:bg-[#F5F6F8] flex items-center gap-1 cursor-pointer"
            title="Restore default slots and timings"
          >
            <RotateCcw className="w-3 h-3" /> Reset Default Slots
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {renderSlotEditorColumn('Monday – Thursday', 'weekday', weekdayList)}
          {renderSlotEditorColumn('Friday', 'friday', fridayList)}
        </div>

        <div className="mt-5 pt-3 border-t border-[#EAECEF] flex items-center gap-3">
          <button
            id="btn-save-period-times"
            onClick={handleSaveSchedule}
            className="px-4 py-2 text-xs font-semibold rounded bg-[#2F6F4E] text-white hover:bg-[#255c40] cursor-pointer shadow-xs"
          >
            Save Slots & Period Times
          </button>
          {scheduleSaved && (
            <span className="text-xs text-[#2F6F4E] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Slots and times saved!
            </span>
          )}
        </div>
      </div>

      {/* Milestone Checkpoints & Anti-Wipe Protection */}
      <div className="bg-white border-2 border-[#2F6F4E]/30 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EAECEF]">
          <div>
            <div className="flex items-center gap-2">
              <BookmarkCheck className="w-5 h-5 text-[#2F6F4E]" />
              <h3 className="text-base font-bold text-[#1C2333]">Milestone Checkpoints & Anti-Wipe Shield</h3>
            </div>
            <p className="text-xs text-[#4A5268] mt-0.5">
              Dual-layer cloud & local persistent milestone backups. Protected against accidental wipes and decimation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              Anti-Wipe Shield: ACTIVE
            </span>
          </div>
        </div>

        {/* Milestone Status Banner */}
        <div className="bg-[#F6FBF8] border border-[#2F6F4E]/25 rounded-md p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2F6F4E]">Current Milestone Status</span>
              {milestoneInfo?.exists && (
                <span className="px-2 py-0.5 text-[11px] font-medium bg-[#2F6F4E]/15 text-[#2F6F4E] rounded">
                  {milestoneInfo.label || 'Saved Milestone'}
                </span>
              )}
            </div>
            <p className="text-xs text-[#333C4D]">
              {milestoneInfo?.exists ? (
                <>
                  Last checkpoint saved on <strong className="font-semibold text-[#1C2333]">{new Date(milestoneInfo.savedAt || '').toLocaleString()}</strong>.
                </>
              ) : (
                'Master milestone dataset loaded and verified (25 Students, 879 Lessons, 24 Staff).'
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[#4A5268]">
              <span className="bg-white px-2.5 py-1 rounded border border-[#DCDFE4] font-medium text-[#1C2333]">
                {milestoneInfo?.studentCount ?? store.students.length} Students
              </span>
              <span className="bg-white px-2.5 py-1 rounded border border-[#DCDFE4] font-medium text-[#1C2333]">
                {milestoneInfo?.entryCount ?? store.entries.length} Timetable Lessons
              </span>
              <span className="bg-white px-2.5 py-1 rounded border border-[#DCDFE4] font-medium text-[#1C2333]">
                {milestoneInfo?.staffCount ?? store.lsaPool.length} Staff in LSA Pool
              </span>
              <span className="bg-white px-2.5 py-1 rounded border border-[#DCDFE4] font-medium text-[#1C2333]">
                {milestoneInfo?.noteCount ?? (store.staffNotes?.length || 0)} Active Notes & Covers
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-save-milestone"
              onClick={() => {
                setCheckpointNameInput(`Milestone - ${new Date().toLocaleDateString('en-GB')}`);
                setShowSaveModal(true);
              }}
              disabled={isSavingCheckpoint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded bg-[#2F6F4E] text-white hover:bg-[#255c40] cursor-pointer shadow-xs disabled:opacity-50"
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              {isSavingCheckpoint ? 'Saving Checkpoint…' : 'Save Milestone Checkpoint'}
            </button>

            <button
              id="btn-restore-milestone"
              onClick={() => setShowRestoreConfirm(true)}
              disabled={isRestoringCheckpoint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded border border-[#2F6F4E] text-[#2F6F4E] bg-white hover:bg-[#F0F7F3] cursor-pointer shadow-xs disabled:opacity-50"
            >
              <History className="w-3.5 h-3.5" />
              {isRestoringCheckpoint ? 'Restoring…' : 'Restore from Milestone'}
            </button>

            <button
              id="btn-download-json-backup"
              onClick={downloadCheckpointJSON}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded border border-[#DCDFE4] text-[#1C2333] bg-white hover:bg-[#F5F6F8] cursor-pointer shadow-xs"
              title="Download standalone JSON backup file to your computer"
            >
              <Download className="w-3.5 h-3.5 text-[#4A5268]" />
              Download JSON Backup
            </button>
          </div>
        </div>

        {checkpointFeedback && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {checkpointFeedback}
            </span>
            <button
              onClick={() => setCheckpointFeedback(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 cursor-pointer"
            >
              &times;
            </button>
          </div>
        )}

        <div className="text-[11px] text-[#555E6D] bg-[#F9FAFB] p-3 rounded border border-[#EAECEF] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            <strong>Anti-Wipe Guard Protection:</strong> Empty snapshots and unconfirmed drops in entries (&lt; 50) are blocked from overwriting data in local storage and Firestore.
          </span>
          <span className="text-[#2F6F4E] font-medium whitespace-nowrap">
            Multi-tier Redundancy: Firestore + Local + Memory Master
          </span>
        </div>
      </div>

      {/* Firebase Hosting Deployment Package */}
      <div className="bg-white border border-[#DCDFE4] rounded-md p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-[#1C2333] flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-[#2F6F4E]" />
            Firebase Hosting Deployment Package
          </h3>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Drag & Drop Ready
          </span>
        </div>

        <p className="text-xs text-[#4A5268] leading-relaxed">
          Firebase Hosting allows deploying by dragging and dropping a single <strong>.zip package</strong> directly into the Firebase Console. You do not need to combine everything into a single HTML file—Firebase unpacks and serves all bundled assets automatically.
        </p>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-3.5 space-y-2 text-xs text-[#334155]">
          <div className="font-semibold text-[#0F172A]">How to deploy using Firebase Console:</div>
          <ol className="list-decimal list-inside space-y-1 text-[#475569]">
            <li>Click <strong>Download Firebase Hosting ZIP (dist.zip)</strong> below.</li>
            <li>Open the <a href="https://console.firebase.google.com/project/gen-lang-client-0443823292/hosting" target="_blank" rel="noopener noreferrer" className="text-[#2563EB] hover:underline font-medium inline-flex items-center gap-0.5">Firebase Hosting Console <ExternalLink className="w-3 h-3" /></a>.</li>
            <li>Drag and drop the downloaded <code>dist.zip</code> file onto the <strong>Drag and drop</strong> area. Firebase will immediately publish the site.</li>
          </ol>
        </div>

        <div className="pt-1">
          <a
            href="/dist.zip"
            download="dist.zip"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded bg-[#2F6F4E] hover:bg-[#255c40] text-white shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download Firebase Hosting ZIP (dist.zip)
          </a>
        </div>
      </div>

      {/* Danger & Reset Zone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-[#DCDFE4] rounded-md p-5 shadow-xs">
          <h3 className="text-[14px] font-bold text-[#1C2333] mb-1 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-[#2F6F4E]" />
            Reset Sample Data
          </h3>
          <p className="text-xs text-[#4A5268] leading-relaxed mb-3">
            Load the initial demo schedule with example SEN interventions, staff allocations, and sample students.
          </p>
          <button
            id="btn-reset-sample-data"
            onClick={() => setShowResetConfirm(true)}
            className="px-3.5 py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] text-[#1C2333] hover:bg-[#F5F6F8] cursor-pointer"
          >
            Reset to Sample Schedule
          </button>
        </div>

        <div className="bg-white border border-[#B23A31]/30 rounded-md p-5 shadow-xs">
          <h3 className="text-[14px] font-bold text-[#B23A31] mb-1 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-[#B23A31]" />
            Clear All Timetable Data
          </h3>
          <p className="text-xs text-[#4A5268] leading-relaxed mb-3">
            Wipes out all student lessons, notes, withdrawals, covers, and student roster. Staff roster is preserved.
          </p>
          <button
            id="btn-clear-all-entries"
            onClick={() => setShowClearConfirm(true)}
            className="px-3.5 py-1.5 text-xs font-semibold rounded border border-[#B23A31] text-[#B23A31] hover:bg-[#FBE6E4] cursor-pointer"
          >
            Clear Timetable & Students
          </button>
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-lg shadow-xl border border-[#DCDFE4] max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 mb-2">
              <BookmarkCheck className="w-5 h-5 text-[#2F6F4E]" />
              <h3 className="text-base font-bold text-[#1C2333]">Save Milestone Checkpoint</h3>
            </div>
            <p className="text-xs text-[#4A5268] mb-4">
              Create a permanent milestone snapshot of all {store.students.length} students, {store.entries.length} timetable entries, and {store.lsaPool.length} staff members to both Firestore and local storage.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#1C2333] mb-1">
                Milestone Label / Description
              </label>
              <input
                type="text"
                value={checkpointNameInput}
                onChange={(e) => setCheckpointNameInput(e.target.value)}
                placeholder="e.g. Master Schedule Milestone"
                className="w-full text-xs px-3 py-2 border border-[#DCDFE4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#2F6F4E]"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EAECEF]">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] text-[#4A5268] hover:bg-[#F5F6F8] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setIsSavingCheckpoint(true);
                  const res = await saveMilestoneCheckpoint(checkpointNameInput);
                  setIsSavingCheckpoint(false);
                  setShowSaveModal(false);
                  setCheckpointFeedback(res.message);
                  setTimeout(() => setCheckpointFeedback(null), 5000);
                }}
                disabled={isSavingCheckpoint}
                className="px-4 py-1.5 text-xs font-semibold rounded bg-[#2F6F4E] text-white hover:bg-[#255c40] cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSavingCheckpoint ? 'Saving Checkpoint…' : 'Save Checkpoint'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRestoreConfirm && (
        <ConfirmModal
          isOpen={true}
          title="Restore from milestone checkpoint?"
          sub="Restores complete master schedule"
          message={`This will restore your complete timetable milestone with ${milestoneInfo?.studentCount ?? store.students.length} students, ${milestoneInfo?.entryCount ?? store.entries.length} timetable lessons, and ${milestoneInfo?.staffCount ?? store.lsaPool.length} staff members across all browsers.`}
          confirmLabel="Restore Milestone"
          isDanger={false}
          onConfirm={async () => {
            setIsRestoringCheckpoint(true);
            const res = await restoreMilestoneCheckpoint();
            setIsRestoringCheckpoint(false);
            setShowRestoreConfirm(false);
            setCheckpointFeedback(res.message);
            setTimeout(() => setCheckpointFeedback(null), 6000);
          }}
          onClose={() => setShowRestoreConfirm(false)}
        />
      )}

      {showClearConfirm && (
        <ConfirmModal
          isOpen={true}
          title="Clear all timetable data?"
          sub="This action cannot be undone"
          message="Every student's lesson, note, withdrawal, cover, and the student roster will be permanently wiped out. The staff roster will be kept intact."
          confirmLabel="Wipe Timetable Data"
          isDanger={true}
          onConfirm={() => {
            clearAllEntries();
            setShowClearConfirm(false);
          }}
          onClose={() => setShowClearConfirm(false)}
        />
      )}

      {showResetConfirm && (
        <ConfirmModal
          isOpen={true}
          title="Reset to sample timetable data?"
          sub="Replaces current timetable"
          message="This will reload the initial demo data with students, teachers, subjects, and LSA allocations."
          confirmLabel="Reset to Sample"
          isDanger={false}
          onConfirm={() => {
            resetToSampleData();
            setShowResetConfirm(false);
          }}
          onClose={() => setShowResetConfirm(false)}
        />
      )}
    </div>
  );
};
