import React, { useState, useEffect, useMemo } from 'react';
import { useTimetable } from '../../context/TimetableContext';
import { DayOfWeek } from '../../types';
import {
  DAY_FULL,
  slotsFor,
  getGroupSiblingId,
  entriesMatch,
  assignmentsForLsaSlot,
  filterActiveStaffNotes,
  normalizeTeacherKey,
} from '../../utils/timetable';
import {
  BookOpen,
  User,
  MapPin,
  Users,
  Scissors,
  Combine,
  Trash2,
  X,
  Plus,
  AlertTriangle,
  Shield,
} from 'lucide-react';

interface LessonModalProps {
  isOpen: boolean;
  student: string;
  day: DayOfWeek;
  slotId: string;
  onClose: () => void;
}

type TargetMode = 'slotA' | 'slotB' | 'both';

const WITHDRAWAL_SUGGESTIONS = [
  'Literacy Intervention',
  'Numeracy Support',
  'Speech & Language',
  'Sensory Support',
  '1:1 Intervention',
  'Social Skills',
];

export const LessonModal: React.FC<LessonModalProps> = ({ isOpen, student, day, slotId, onClose }) => {
  const {
    store,
    role,
    deleteEntry,
    splitEntry,
    mergeEntry,
    setSecondarySupport,
    saveLessonAndSupport,
    addStaff,
  } = useTimetable();

  const slots = slotsFor(day, store.schedule);
  const clickedSlot = slots.find((s) => s.id === slotId);
  const activeStaffNotes = useMemo(
    () => filterActiveStaffNotes(store.staffNotes || []),
    [store.staffNotes]
  );

  const siblingId = getGroupSiblingId(day, slotId, store.schedule);
  const siblingSlot = siblingId ? slots.find((s) => s.id === siblingId) : null;

  const isPaired = Boolean(siblingId && siblingSlot);

  let slotA = clickedSlot;
  let slotB = siblingSlot;
  if (isPaired && clickedSlot && siblingSlot) {
    const idxClicked = slots.findIndex((s) => s.id === clickedSlot.id);
    const idxSib = slots.findIndex((s) => s.id === siblingSlot.id);
    if (idxClicked < idxSib) {
      slotA = clickedSlot;
      slotB = siblingSlot;
    } else {
      slotA = siblingSlot;
      slotB = clickedSlot;
    }
  }

  const entryA = slotA ? store.entries.find((e) => e.student === student && e.day === day && e.slotId === slotA.id) : null;
  const entryB = slotB ? store.entries.find((e) => e.student === student && e.day === day && e.slotId === slotB.id) : null;

  const rawMatch = Boolean(entryA && entryB && entriesMatch(entryA, entryB));
  const areMerged = Boolean(isPaired && rawMatch && !entryA?.split && !entryB?.split);

  const [targetMode, setTargetMode] = useState<TargetMode>('slotA');
  const [originalSubject, setOriginalSubject] = useState('');
  const [subject, setSubject] = useState('');
  const [lessonType, setLessonType] = useState<'lesson' | 'withdrawal'>('lesson');
  const [teacher, setTeacher] = useState('');
  const [room, setRoom] = useState('');

  // Whole-week propagation checkboxes when editing an existing subject
  const [applySubjectToWeek, setApplySubjectToWeek] = useState(false);
  const [applyTeacherToWeek, setApplyTeacherToWeek] = useState(false);
  const [applyRoomToWeek, setApplyRoomToWeek] = useState(false);

  // Support Mode: only 'primary' or 'secondary'
  const [supportMode, setSupportMode] = useState<'primary' | 'secondary'>('primary');
  const [primaryStaff, setPrimaryStaff] = useState<string>('');
  const [secondaryStaff, setSecondaryStaff] = useState<string>('');

  // Quick staff add
  const [newStaffInput, setNewStaffInput] = useState('');
  const [showNewStaffForm, setShowNewStaffForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const teacherSuggestions = useMemo(() => {
    const set = new Set<string>();
    store.lsaPool.forEach((p) => {
      if (p.name.trim()) set.add(p.name.trim());
    });
    store.entries.forEach((e) => {
      if (e.teacher && e.teacher.trim()) set.add(e.teacher.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [store.lsaPool, store.entries]);

  const populateFieldsForMode = (mode: TargetMode) => {
    let targetEntry = null;
    let targetSid = slotId;

    if (!isPaired || !slotA || !slotB) {
      targetEntry = store.entries.find((e) => e.student === student && e.day === day && e.slotId === slotId);
      targetSid = slotId;
    } else if (mode === 'slotA') {
      targetEntry = entryA;
      targetSid = slotA.id;
    } else if (mode === 'slotB') {
      targetEntry = entryB;
      targetSid = slotB.id;
    } else {
      targetEntry = entryA || entryB;
      targetSid = slotA.id;
    }

    const curSlot = slots.find((s) => s.id === targetSid);
    const existingSub = targetEntry?.subject?.trim() || '';
    const initSub = existingSub || (curSlot?.type === 'fixed' ? curSlot.defaultLabel || '' : '');

    setOriginalSubject(existingSub);
    setSubject(initSub);
    setLessonType(targetEntry?.lessonType || 'lesson');
    setTeacher(targetEntry?.teacher || '');
    setRoom(targetEntry?.room || '');
    setApplySubjectToWeek(false);
    setApplyTeacherToWeek(false);
    setApplyRoomToWeek(false);

    const primary = (store.primarySupport || []).find(
      (p) => p.student === student && p.subject.trim().toLowerCase() === initSub.trim().toLowerCase()
    );
    const resolvedPrimary = primary?.lsa || '';
    setPrimaryStaff(resolvedPrimary);

    const assign = store.lsaAssignments.find((a) => a.student === student && a.day === day && a.slotId === targetSid);

    if (assign && assign.lsa) {
      setSupportMode('secondary');
      setSecondaryStaff(assign.lsa === '__NONE__' ? '' : assign.lsa);
    } else {
      setSupportMode('primary');
      setSecondaryStaff('');
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    let initialMode: TargetMode = 'slotA';
    if (isPaired && slotA && slotB) {
      const bothEmpty = !entryA?.subject && !entryB?.subject;
      if (areMerged || bothEmpty) {
        initialMode = 'both';
      } else if (clickedSlot?.id === slotB.id) {
        initialMode = 'slotB';
      } else {
        initialMode = 'slotA';
      }
    }

    setTargetMode(initialMode);
    populateFieldsForMode(initialMode);
    setFormError(null);
    setShowNewStaffForm(false);
    setNewStaffInput('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, student, day, slotId]);

  const handleSwitchTargetMode = (newMode: TargetMode) => {
    setTargetMode(newMode);
    setFormError(null);
    populateFieldsForMode(newMode);
  };

  const handleSubjectChange = (newSubject: string) => {
    setSubject(newSubject);
    setFormError(null);
    const match = (store.primarySupport || []).find(
      (p) => p.student === student && p.subject.trim().toLowerCase() === newSubject.trim().toLowerCase()
    );
    if (match?.lsa) {
      setPrimaryStaff(match.lsa);
    } else if (originalSubject) {
      const origMatch = (store.primarySupport || []).find(
        (p) => p.student === student && p.subject.trim().toLowerCase() === originalSubject.trim().toLowerCase()
      );
      setPrimaryStaff(origMatch?.lsa || '');
    } else {
      setPrimaryStaff('');
    }
  };

  const handleQuickAdd = (target: 'primary' | 'secondary') => {
    const trimmed = newStaffInput.trim();
    if (!trimmed) return;
    addStaff(trimmed);
    if (target === 'primary') {
      setSupportMode('primary');
      setPrimaryStaff(trimmed);
    } else {
      setSupportMode('secondary');
      setSecondaryStaff(trimmed);
    }
    setNewStaffInput('');
    setShowNewStaffForm(false);
  };

  const activeEffectiveSlotId = useMemo(() => {
    if (!isPaired || !slotA || !slotB) return slotId;
    if (targetMode === 'slotB') return slotB.id;
    return slotA.id;
  }, [isPaired, slotA, slotB, targetMode, slotId]);

  const effectiveSupport = useMemo(() => {
    if (supportMode === 'secondary') {
      const trimmed = secondaryStaff.trim();
      if (!trimmed || trimmed === '__NONE__') return null;
      return { lsa: trimmed, type: 'secondary' as const };
    }
    const trimmedPrimary = primaryStaff.trim();
    if (!trimmedPrimary) return null;
    return { lsa: trimmedPrimary, type: 'primary' as const };
  }, [supportMode, secondaryStaff, primaryStaff]);

  const matchingSubjectLessons = useMemo(() => {
    const lookupSub = (applySubjectToWeek && originalSubject.trim() ? originalSubject : subject).trim().toLowerCase();
    if (!lookupSub) return [];
    return store.entries.filter(
      (e) => e.student === student && e.subject.trim().toLowerCase() === lookupSub
    );
  }, [store.entries, student, subject, originalSubject, applySubjectToWeek]);

  // Helper to check if a given staff member is booked in the current target slot(s)
  const getStaffCurrentSlotBusyLabel = (staffName: string) => {
    const targetSlots = isPaired && targetMode === 'both' && slotB ? [slotA?.id || slotId, slotB.id] : [activeEffectiveSlotId];
    const bookedStudents = new Set<string>();
    const sharedStudents = new Set<string>();

    for (const sid of targetSlots) {
      const stuEntry = store.entries.find((e) => e.student === student && e.day === day && e.slotId === sid);
      const currentClassId = stuEntry?.classId;
      const currentSubject = (stuEntry?.subject || subject).trim().toLowerCase();
      const currentTeacher = (stuEntry?.teacher || teacher).replace(/\./g, '').trim().toLowerCase();

      assignmentsForLsaSlot(
        staffName,
        day,
        sid,
        store.students,
        store.entries,
        store.lsaAssignments,
        store.primarySupport || []
      )
        .forEach((a) => {
          if (a.student.trim().toLowerCase() === student.trim().toLowerCase()) return;
          if (currentClassId && a.classId === currentClassId) return;

          const normCurTeacher = normalizeTeacherKey(currentTeacher);
          const normATeacher = normalizeTeacherKey(a.teacher);

          if (normCurTeacher && normATeacher && normCurTeacher === normATeacher) {
            sharedStudents.add(a.student);
          } else {
            bookedStudents.add(a.student);
          }
        });
    }

    if (bookedStudents.size > 0) {
      return ` · Booked (${Array.from(bookedStudents).join(', ')})`;
    }
    if (sharedStudents.size > 0) {
      return ` · Shared (${Array.from(sharedStudents).join(', ')})`;
    }
    return '';
  };

  // Detect conflicts: check current target slot(s), and only check other week lessons of the same subject
  // if the user is actively changing Primary Support and those other slots don't have a Secondary Support override.
  const conflictsForStaff = useMemo(() => {
    if (!effectiveSupport?.lsa) return [];

    const checkSlotOverlaps = (d: DayOfWeek, sid: string) => {
      const stuEntry = store.entries.find((e) => e.student === student && e.day === d && e.slotId === sid);
      const fallbackClassId = d === day ? entryA?.classId || entryB?.classId : undefined;
      const currentClassId = stuEntry?.classId || fallbackClassId;
      const currentTeacher = (stuEntry?.teacher || teacher).replace(/\./g, '').trim().toLowerCase();

      const overlaps = assignmentsForLsaSlot(
        effectiveSupport.lsa,
        d,
        sid,
        store.students,
        store.entries,
        store.lsaAssignments,
        store.primarySupport || []
      ).filter((a) => {
        if (a.student.trim().toLowerCase() === student.trim().toLowerCase()) return false;
        if (currentClassId && a.classId === currentClassId) return false;

        const normCurTeacher = normalizeTeacherKey(currentTeacher);
        const normATeacher = normalizeTeacherKey(a.teacher);

        // Same lesson with same teacher: NOT a conflict!
        if (
          normCurTeacher &&
          normATeacher &&
          normCurTeacher === normATeacher
        ) {
          return false;
        }

        return true;
      });

      const covers = activeStaffNotes.filter(
        (n) =>
          n.coveredBy?.trim().toLowerCase() === effectiveSupport.lsa.trim().toLowerCase() &&
          n.day === d &&
          n.slotId === sid &&
          n.isCover
      );

      const names = overlaps.map((o) => o.student);
      covers.forEach((c) => names.push(`Covering ${c.staffName}`));
      return names;
    };

    const targetSlots =
      isPaired && targetMode === 'both' && slotB
        ? [slotA?.id || slotId, slotB.id]
        : [activeEffectiveSlotId];

    if (supportMode === 'secondary') {
      const conflicts: { day: DayOfWeek; slotLabel: string; conflictingWith: string[] }[] = [];

      for (const sid of targetSlots) {
        const curSlot = slotsFor(day, store.schedule).find((s) => s.id === sid);
        const slotLabel = curSlot ? curSlot.label : sid;
        const conflictingWith = checkSlotOverlaps(day, sid);
        if (conflictingWith.length > 0) {
          conflicts.push({ day, slotLabel, conflictingWith });
        }
      }
      return conflicts;
    }

    // Primary Support mode: always check current targetSlots; only check other week slots of this subject
    // if the user changed the primary staff member AND those slots don't have a Secondary Support override.
    const conflicts: { day: DayOfWeek; slotLabel: string; conflictingWith: string[] }[] = [];
    const savedPrimaryForSubject = (store.primarySupport || []).find(
      (p) => p.student === student && p.subject.trim().toLowerCase() === subject.trim().toLowerCase()
    )?.lsa;
    const isChangingPrimaryStaff =
      !savedPrimaryForSubject ||
      savedPrimaryForSubject.trim().toLowerCase() !== effectiveSupport.lsa.trim().toLowerCase();

    const slotsToCheck: { day: DayOfWeek; slotId: string }[] = [];
    targetSlots.forEach((sid) => slotsToCheck.push({ day, slotId: sid }));

    if (isChangingPrimaryStaff) {
      matchingSubjectLessons.forEach((e) => {
        if (!slotsToCheck.some((s) => s.day === e.day && s.slotId === e.slotId)) {
          const hasSecondaryOverride = store.lsaAssignments.some(
            (a) =>
              a.student === student &&
              a.day === e.day &&
              a.slotId === e.slotId &&
              Boolean(a.lsa)
          );
          if (!hasSecondaryOverride) {
            slotsToCheck.push({ day: e.day, slotId: e.slotId });
          }
        }
      });
    }

    for (const item of slotsToCheck) {
      const curSlot = slotsFor(item.day, store.schedule).find((s) => s.id === item.slotId);
      const slotLabel = curSlot ? curSlot.label : item.slotId;
      const conflictingWith = checkSlotOverlaps(item.day, item.slotId);
      if (conflictingWith.length > 0) {
        conflicts.push({
          day: item.day,
          slotLabel,
          conflictingWith,
        });
      }
    }

    return conflicts;
  }, [
    effectiveSupport,
    supportMode,
    day,
    activeEffectiveSlotId,
    store.students,
    store.entries,
    store.lsaAssignments,
    store.primarySupport,
    student,
    subject,
    entryA,
    entryB,
    isPaired,
    targetMode,
    slotA,
    slotB,
    slotId,
    matchingSubjectLessons,
    store.schedule,
    activeStaffNotes,
  ]);

  const activeEntryHasContent = useMemo(() => {
    if (!isPaired || !slotA || !slotB) {
      return Boolean(store.entries.find((e) => e.student === student && e.day === day && e.slotId === slotId)?.subject);
    }
    if (targetMode === 'slotA') return Boolean(entryA?.subject);
    if (targetMode === 'slotB') return Boolean(entryB?.subject);
    return Boolean(entryA?.subject || entryB?.subject);
  }, [isPaired, slotA, slotB, targetMode, entryA, entryB, store.entries, student, day, slotId]);

  if (!isOpen || !clickedSlot) return null;

  let headerLabel = clickedSlot.label;
  let headerTime = `${clickedSlot.start}–${clickedSlot.end}`;

  if (isPaired && slotA && slotB) {
    if (targetMode === 'slotA') {
      headerLabel = `${slotA.label} (40m)`;
      headerTime = `${slotA.start}–${slotA.end}`;
    } else if (targetMode === 'slotB') {
      headerLabel = `${slotB.label} (40m)`;
      headerTime = `${slotB.start}–${slotB.end}`;
    } else {
      headerLabel = `${slotA.label} & ${slotB.label} (80m)`;
      headerTime = `${slotA.start}–${slotB.end}`;
    }
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    let trimmedSubject = subject.trim();

    if (!trimmedSubject) {
      if (lessonType === 'withdrawal') {
        trimmedSubject = 'Withdrawal Support';
      } else if (effectiveSupport?.lsa) {
        trimmedSubject = 'Support';
      } else {
        setFormError('Please enter a subject name.');
        return;
      }
    }

    const secVal =
      supportMode === 'primary'
        ? ''
        : secondaryStaff.trim()
        ? secondaryStaff.trim()
        : primaryStaff.trim()
        ? '__NONE__'
        : '';

    const staffPayload = {
      primaryStaff: primaryStaff.trim(),
      secondaryStaff: secVal,
      applyToSubject: supportMode === 'primary',
      originalSubject: originalSubject.trim(),
      applySubjectToWeek: Boolean(originalSubject.trim() && applySubjectToWeek),
      applyTeacherToWeek: Boolean(originalSubject.trim() && applyTeacherToWeek),
      applyRoomToWeek: Boolean(originalSubject.trim() && applyRoomToWeek),
      ...(lessonType === 'withdrawal' ? { classId: undefined, className: undefined } : {}),
    };

    if (isPaired && slotA && slotB) {
      if (targetMode === 'slotA') {
        saveLessonAndSupport(student, day, slotA.id, {
          subject: trimmedSubject,
          teacher: teacher.trim(),
          room: room.trim(),
          lessonType,
          split: true,
          applyToDoublePeriod: false,
          ...staffPayload,
        });
      } else if (targetMode === 'slotB') {
        saveLessonAndSupport(student, day, slotB.id, {
          subject: trimmedSubject,
          teacher: teacher.trim(),
          room: room.trim(),
          lessonType,
          split: true,
          applyToDoublePeriod: false,
          ...staffPayload,
        });
      } else {
        saveLessonAndSupport(student, day, slotA.id, {
          subject: trimmedSubject,
          teacher: teacher.trim(),
          room: room.trim(),
          lessonType,
          split: false,
          applyToDoublePeriod: true,
          ...staffPayload,
        });
      }
    } else {
      saveLessonAndSupport(student, day, slotId, {
        subject: trimmedSubject,
        teacher: teacher.trim(),
        room: room.trim(),
        lessonType,
        split: false,
        applyToDoublePeriod: false,
        ...staffPayload,
      });
    }

    onClose();
  };

  const handleDelete = () => {
    if (isPaired && slotA && slotB) {
      if (targetMode === 'slotA') {
        deleteEntry(student, day, slotA.id, false);
        setSecondarySupport(student, day, slotA.id, '');
      } else if (targetMode === 'slotB') {
        deleteEntry(student, day, slotB.id, false);
        setSecondarySupport(student, day, slotB.id, '');
      } else {
        deleteEntry(student, day, slotA.id, true);
        setSecondarySupport(student, day, slotA.id, '');
        setSecondarySupport(student, day, slotB.id, '');
      }
    } else {
      deleteEntry(student, day, slotId, false);
      setSecondarySupport(student, day, slotId, '');
    }
    onClose();
  };

  const handleSplit = () => {
    if (isPaired && slotA) {
      splitEntry(student, day, slotA.id);
      setTargetMode('slotA');
    } else {
      splitEntry(student, day, slotId);
    }
    onClose();
  };

  const handleMerge = () => {
    if (isPaired && slotA) {
      mergeEntry(student, day, slotA.id);
      setTargetMode('both');
    } else {
      mergeEntry(student, day, slotId);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-[#141620]/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg w-full max-w-md p-5 shadow-xl border border-[#DCDFE4] max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#EAECEF] mb-3.5">
          <div>
            <h3 className="text-[16px] font-bold text-[#1C2333]">{student}</h3>
            <div className="text-xs text-[#4A5268] font-mono mt-0.5">
              {DAY_FULL[day]} · {headerLabel} · {headerTime}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#4A5268] hover:text-[#1C2333] p-1 rounded hover:bg-[#F5F6F8] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {formError && (
          <div className="mb-3 p-2 bg-[#FBE6E4] text-[#B23A31] text-xs rounded border border-[#f5c6cb]">
            {formError}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3.5">
          {/* Compact Slot Selector for Paired Slots */}
          {isPaired && slotA && slotB && (
            <div className="grid grid-cols-3 gap-1.5 bg-[#F5F6F8] p-1 rounded-md border border-[#DCDFE4]">
              <button
                type="button"
                id="btn-choose-slot-a"
                onClick={() => handleSwitchTargetMode('slotA')}
                className={`py-1.5 px-2 rounded text-xs font-semibold cursor-pointer transition-all ${
                  targetMode === 'slotA'
                    ? 'bg-[#2F6F4E] text-white shadow-xs'
                    : 'text-[#4A5268] hover:text-[#1C2333]'
                }`}
              >
                {slotA.label} (40m)
              </button>
              <button
                type="button"
                id="btn-choose-slot-b"
                onClick={() => handleSwitchTargetMode('slotB')}
                className={`py-1.5 px-2 rounded text-xs font-semibold cursor-pointer transition-all ${
                  targetMode === 'slotB'
                    ? 'bg-[#2F6F4E] text-white shadow-xs'
                    : 'text-[#4A5268] hover:text-[#1C2333]'
                }`}
              >
                {slotB.label} (40m)
              </button>
              <button
                type="button"
                id="btn-choose-slot-both"
                onClick={() => handleSwitchTargetMode('both')}
                className={`py-1.5 px-2 rounded text-xs font-semibold cursor-pointer transition-all ${
                  targetMode === 'both'
                    ? 'bg-[#2F6F4E] text-white shadow-xs'
                    : 'text-[#4A5268] hover:text-[#1C2333]'
                }`}
              >
                Both (80m)
              </button>
            </div>
          )}

          {/* Lesson Type */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              id="btn-lesson-type-standard"
              onClick={() => setLessonType('lesson')}
              className={`py-2 px-2.5 rounded border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                lessonType === 'lesson'
                  ? 'bg-[#E4F0EA] border-[#2F6F4E] ring-1 ring-[#2F6F4E] text-[#2F6F4E]'
                  : 'bg-white border-[#DCDFE4] text-[#4A5268] hover:bg-[#F5F6F8]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>In-Class Lesson</span>
            </button>

            <button
              type="button"
              id="btn-lesson-type-withdrawal"
              onClick={() => {
                setLessonType('withdrawal');
                if (!subject) setSubject('Withdrawal Support');
              }}
              className={`py-2 px-2.5 rounded border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                lessonType === 'withdrawal'
                  ? 'bg-[#DCEEFB] border-[#2A6FA8] ring-1 ring-[#2A6FA8] text-[#2A6FA8]'
                  : 'bg-white border-[#DCDFE4] text-[#4A5268] hover:bg-[#F5F6F8]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#2A6FA8]" />
              <span>Withdrawal Lesson</span>
            </button>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-[#1C2333] mb-1">Subject</label>
            <input
              id="lesson-modal-subject"
              type="text"
              autoFocus
              value={subject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              placeholder={
                lessonType === 'withdrawal'
                  ? 'e.g. Literacy Intervention'
                  : clickedSlot.type === 'fixed'
                  ? 'e.g. Registration, Break'
                  : 'e.g. Mathematics, English'
              }
              className="w-full text-xs px-3 py-2 border border-[#DCDFE4] rounded focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
            />

            {lessonType === 'withdrawal' && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {WITHDRAWAL_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => handleSubjectChange(sug)}
                    className={`text-[10px] px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                      subject.trim().toLowerCase() === sug.toLowerCase()
                        ? 'bg-[#2A6FA8] text-white border-[#2A6FA8]'
                        : 'bg-[#F0F4F8] text-[#2A6FA8] border-[#cbe0f2] hover:bg-[#DCEEFB]'
                    }`}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}

            {originalSubject && (
              <label
                htmlFor="chk-apply-subject-week"
                className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-[#334155] cursor-pointer select-none"
              >
                <input
                  id="chk-apply-subject-week"
                  type="checkbox"
                  checked={applySubjectToWeek}
                  onChange={(e) => setApplySubjectToWeek(e.target.checked)}
                  className="rounded border-[#CBD5E1] text-[#2F6F4E] focus:ring-[#2F6F4E] cursor-pointer"
                />
                <span>Change same subject ({originalSubject}) for the whole week</span>
              </label>
            )}
          </div>

          {/* Teacher & Room */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-[#1C2333] mb-1">
                Teacher <span className="font-normal text-[#64748B]">(optional)</span>
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  id="lesson-modal-teacher"
                  type="text"
                  list="lesson-modal-teacher-list"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                  placeholder="e.g. Mr Owens"
                  className="w-full text-xs pl-8 pr-2.5 py-2 border border-[#DCDFE4] rounded focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                />
                <datalist id="lesson-modal-teacher-list">
                  {teacherSuggestions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              {originalSubject && (
                <label
                  htmlFor="chk-apply-teacher-week"
                  className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#334155] cursor-pointer select-none"
                >
                  <input
                    id="chk-apply-teacher-week"
                    type="checkbox"
                    checked={applyTeacherToWeek}
                    onChange={(e) => setApplyTeacherToWeek(e.target.checked)}
                    className="rounded border-[#CBD5E1] text-[#2F6F4E] focus:ring-[#2F6F4E] cursor-pointer"
                  />
                  <span>Change for whole week</span>
                </label>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C2333] mb-1">
                Room <span className="font-normal text-[#64748B]">(optional)</span>
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  id="lesson-modal-room"
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="e.g. Rm 12"
                  className="w-full text-xs pl-8 pr-2.5 py-2 border border-[#DCDFE4] rounded focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                />
              </div>
              {originalSubject && (
                <label
                  htmlFor="chk-apply-room-week"
                  className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#334155] cursor-pointer select-none"
                >
                  <input
                    id="chk-apply-room-week"
                    type="checkbox"
                    checked={applyRoomToWeek}
                    onChange={(e) => setApplyRoomToWeek(e.target.checked)}
                    className="rounded border-[#CBD5E1] text-[#2F6F4E] focus:ring-[#2F6F4E] cursor-pointer"
                  />
                  <span>Change for whole week</span>
                </label>
              )}
            </div>
          </div>

          {/* Support Staff Allocation (Only Primary or Secondary) */}
          <div className="p-3 bg-[#F8FAFC] border border-[#DCDFE4] rounded-md space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1C2333] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#2F6F4E]" />
                <span>Support Staff</span>
              </span>
              {role === 'admin' && !showNewStaffForm && (
                <button
                  type="button"
                  id="btn-open-quick-add-staff"
                  onClick={() => setShowNewStaffForm(true)}
                  className="text-[11px] font-semibold text-[#2F6F4E] hover:text-[#255c40] flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> New staff
                </button>
              )}
            </div>

            {showNewStaffForm && (
              <div className="p-2 bg-white border border-[#c4e0d2] rounded flex gap-1.5">
                <input
                  id="quick-add-staff-input"
                  type="text"
                  value={newStaffInput}
                  onChange={(e) => setNewStaffInput(e.target.value)}
                  placeholder="Staff name"
                  className="flex-1 text-xs px-2 py-1 border border-[#DCDFE4] rounded focus:outline-none focus:ring-1 focus:ring-[#2F6F4E]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => handleQuickAdd('primary')}
                  className="px-2 py-1 text-[11px] font-semibold rounded bg-[#2F6F4E] text-white hover:bg-[#255c40] cursor-pointer shrink-0"
                >
                  Primary
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd('secondary')}
                  className="px-2 py-1 text-[11px] font-semibold rounded bg-[#58228C] text-white hover:bg-[#461972] cursor-pointer shrink-0"
                >
                  Secondary
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewStaffForm(false)}
                  className="px-2 py-1 text-xs text-[#4A5268] hover:bg-[#F5F6F8] rounded cursor-pointer shrink-0"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* 2-Option Selector: Primary vs Secondary */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                id="btn-support-mode-primary"
                onClick={() => setSupportMode('primary')}
                className={`py-1.5 px-2.5 rounded text-xs font-semibold border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  supportMode === 'primary'
                    ? 'bg-[#E4F0EA] border-[#2F6F4E] text-[#2F6F4E] ring-1 ring-[#2F6F4E]'
                    : 'bg-white border-[#E2E8F0] text-[#4A5268] hover:bg-[#F1F5F9]'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-[#2F6F4E]" />
                <span>Primary Support</span>
              </button>

              <button
                type="button"
                id="btn-support-mode-secondary"
                onClick={() => setSupportMode('secondary')}
                className={`py-1.5 px-2.5 rounded text-xs font-semibold border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  supportMode === 'secondary'
                    ? 'bg-[#FAF5FF] border-[#58228C] text-[#58228C] ring-1 ring-[#58228C]'
                    : 'bg-white border-[#E2E8F0] text-[#4A5268] hover:bg-[#F1F5F9]'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-[#58228C]" />
                <span>Secondary Support</span>
              </button>
            </div>

            {supportMode === 'primary' ? (
              <div>
                <select
                  id="lesson-modal-primary-staff"
                  value={primaryStaff}
                  onChange={(e) => setPrimaryStaff(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E] font-medium text-[#1C2333]"
                >
                  <option value="">None (Independent)</option>
                  {store.lsaPool.map((p) => (
                    <option key={`p-${p.id}`} value={p.name}>
                      {p.name}{getStaffCurrentSlotBusyLabel(p.name)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <select
                  id="lesson-modal-secondary-staff"
                  value={secondaryStaff}
                  onChange={(e) => setSecondaryStaff(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-[#58228C] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#58228C] font-medium text-[#1C2333]"
                >
                  <option value="">None (Independent)</option>
                  {store.lsaPool.map((p) => (
                    <option key={`sec-${p.id}`} value={p.name}>
                      {p.name}{getStaffCurrentSlotBusyLabel(p.name)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Conflict Warning */}
            {conflictsForStaff.length > 0 && effectiveSupport?.lsa && (
              <div className="p-2.5 bg-[#FBE6E4] text-[#B23A31] text-xs rounded border border-[#f5c6cb] space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-[#B23A31] shrink-0" />
                  <span>Double-Booking Warning for {effectiveSupport.lsa}</span>
                </div>
                <div className="space-y-0.5 text-[11px]">
                  {conflictsForStaff.map((c, idx) => (
                    <div key={idx}>
                      • {DAY_FULL[c.day]} ({c.slotLabel}): booked with <strong>{c.conflictingWith.join(', ')}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Split / Merge Actions & 80-Min Checkbox */}
          {isPaired && slotA && slotB && (
            <label className="flex items-center gap-2 p-2.5 rounded-md bg-[#F0F7F4] border border-[#C3DFD1] text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                id="chk-merge-80min-lesson"
                checked={targetMode === 'both'}
                onChange={(e) =>
                  handleSwitchTargetMode(
                    e.target.checked ? 'both' : clickedSlot?.id === slotB.id ? 'slotB' : 'slotA'
                  )
                }
                className="rounded border-[#2F6F4E] text-[#2F6F4E] focus:ring-[#2F6F4E] w-3.5 h-3.5 cursor-pointer"
              />
              <span className="font-semibold text-[#1C2333]">
                80-minute lesson — merge {slotA.label} &amp; {slotB.label} ({slotA.start}–{slotB.end})
              </span>
            </label>
          )}

          {areMerged && (
            <button
              type="button"
              id="lesson-modal-split-btn"
              onClick={handleSplit}
              className="w-full py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] text-[#1C2333] hover:bg-[#F5F6F8] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Scissors className="w-3.5 h-3.5 text-[#2A6FA8]" /> Split into two 40-min lessons
            </button>
          )}

          {rawMatch && !areMerged && (
            <button
              type="button"
              id="lesson-modal-merge-btn"
              onClick={handleMerge}
              className="w-full py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] text-[#1C2333] hover:bg-[#F5F6F8] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Combine className="w-3.5 h-3.5 text-[#2F6F4E]" /> Merge into 80-min double lesson
            </button>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-[#EAECEF]">
            <div className="flex gap-2">
              <button
                type="button"
                id="lesson-modal-cancel-btn"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] text-[#1C2333] hover:bg-[#F5F6F8] cursor-pointer"
              >
                Cancel
              </button>
              {activeEntryHasContent && (
                <button
                  type="button"
                  id="lesson-modal-delete-btn"
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-[#B23A31] text-[#B23A31] hover:bg-[#FBE6E4] flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              id="lesson-modal-save-btn"
              className="px-4 py-1.5 text-xs font-semibold rounded bg-[#2F6F4E] text-white hover:bg-[#255c40] cursor-pointer shadow-xs"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
