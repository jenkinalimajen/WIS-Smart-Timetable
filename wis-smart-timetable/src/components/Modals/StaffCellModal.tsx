import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTimetable } from '../../context/TimetableContext';
import { DayOfWeek, StaffSlotNote, NoteHighlightColor } from '../../types';
import {
  DAY_FULL,
  slotsFor,
  assignmentsForLsaSlot,
  getGroupSiblingId,
  canStaffSlotsMerge as canStaffSlotsMergeUtil,
  filterActiveStaffNotes,
  hasSlotConflict,
  normalizeTeacherKey,
  extractMentionedStaff,
  isStaffMentionedInNote,
  consolidateStaffSlotAssignments,
} from '../../utils/timetable';
import { FormattedNoteText } from '../FormattedNoteText';
import {
  AlertTriangle,
  UserMinus,
  UserPlus,
  X,
  StickyNote,
  Check,
  ChevronDown,
  Trash2,
  CheckCircle2,
  Users,
  BookOpen,
  ArrowRightLeft,
  BookmarkCheck,
  GraduationCap,
  Bold,
  Edit2,
  Pencil,
  Plus,
  Pin,
  Clock,
  AtSign,
  ArrowUpToLine,
} from 'lucide-react';

export type CoverTargetMode = 'both' | 'slotA' | 'slotB';

interface StaffCellModalProps {
  isOpen: boolean;
  staffName: string;
  day: DayOfWeek;
  slotId: string;
  onClose: () => void;
}

export const StaffCellModal: React.FC<StaffCellModalProps> = ({
  isOpen,
  staffName,
  day,
  slotId,
  onClose,
}) => {
  const {
    store,
    role,
    assignSupportDirectly,
    saveLessonAndSupport,
    saveStaffClass,
    saveStaffNote,
    saveStaffNotesBatch,
    deleteStaffNote,
    deleteStaffNoteById,
    deleteStaffNotesBatch,
    upsertEntry,
  } = useTimetable();

  const targetDay = day;

  const activeStaffNotes = useMemo(
    () => filterActiveStaffNotes(store.staffNotes || []),
    [store.staffNotes]
  );

  const slots = useMemo(() => slotsFor(targetDay, store.schedule), [targetDay, store.schedule]);
  const clickedSlot = useMemo(() => slots.find((s) => s.id === slotId) || slots[0], [slots, slotId]);

  const siblingId = useMemo(
    () => getGroupSiblingId(targetDay, clickedSlot?.id || slotId, store.schedule),
    [targetDay, clickedSlot, slotId, store.schedule]
  );
  const siblingSlot = useMemo(
    () => (siblingId ? slots.find((s) => s.id === siblingId) : null),
    [siblingId, slots]
  );
  const isPaired = Boolean(siblingId && siblingSlot);

  const { slotA, slotB } = useMemo(() => {
    if (!isPaired || !clickedSlot || !siblingSlot) {
      return { slotA: clickedSlot, slotB: null };
    }
    const idxA = slots.findIndex((s) => s.id === clickedSlot.id);
    const idxB = slots.findIndex((s) => s.id === siblingSlot.id);
    if (idxA <= idxB) {
      return { slotA: clickedSlot, slotB: siblingSlot };
    }
    return { slotA: siblingSlot, slotB: clickedSlot };
  }, [isPaired, clickedSlot, siblingSlot, slots]);

  const noteA = useMemo(() => {
    if (!slotA) return null;
    return activeStaffNotes.find(
      (n) => n.staffName === staffName && n.day === targetDay && n.slotId === slotA.id
    );
  }, [activeStaffNotes, staffName, targetDay, slotA]);

  const noteB = useMemo(() => {
    if (!slotB) return null;
    return activeStaffNotes.find(
      (n) => n.staffName === staffName && n.day === targetDay && n.slotId === slotB.id
    );
  }, [activeStaffNotes, staffName, targetDay, slotB]);

  const notesA = useMemo(() => {
    if (!slotA) return [];
    return activeStaffNotes.filter(
      (n) => (n.staffName.toLowerCase() === staffName.toLowerCase() || isStaffMentionedInNote(n, staffName)) && n.day === targetDay && n.slotId === slotA.id
    );
  }, [activeStaffNotes, staffName, targetDay, slotA]);

  const notesB = useMemo(() => {
    if (!slotB) return [];
    return activeStaffNotes.filter(
      (n) => (n.staffName.toLowerCase() === staffName.toLowerCase() || isStaffMentionedInNote(n, staffName)) && n.day === targetDay && n.slotId === slotB.id
    );
  }, [activeStaffNotes, staffName, targetDay, slotB]);

  const existingSingleNote = useMemo(() => {
    return activeStaffNotes.find(
      (n) => n.staffName === staffName && n.day === targetDay && n.slotId === (clickedSlot?.id || slotId)
    );
  }, [activeStaffNotes, staffName, targetDay, clickedSlot, slotId]);

  const coveringNotes = useMemo(() => {
    return activeStaffNotes.filter(
      (n) =>
        n.coveredBy?.toLowerCase() === staffName.toLowerCase() &&
        n.day === targetDay &&
        (n.slotId === slotId || (slotA && n.slotId === slotA.id) || (slotB && n.slotId === slotB.id)) &&
        n.isCover
    );
  }, [activeStaffNotes, staffName, targetDay, slotId, slotA, slotB]);
  const hasCoveringDuty = coveringNotes.length > 0;

  const handleRelieveCover = (targetCover: StaffSlotNote) => {
    deleteStaffNote(targetCover.staffName, targetCover.day, targetCover.slotId);
  };

  const assignsA = useMemo(() => {
    if (!slotA) return [];
    return assignmentsForLsaSlot(
      staffName,
      targetDay,
      slotA.id,
      store.students,
      store.entries,
      store.lsaAssignments,
      store.primarySupport || []
    );
  }, [slotA, staffName, targetDay, store.students, store.entries, store.lsaAssignments, store.primarySupport]);

  const assignsB = useMemo(() => {
    if (!slotB) return [];
    return assignmentsForLsaSlot(
      staffName,
      targetDay,
      slotB.id,
      store.students,
      store.entries,
      store.lsaAssignments,
      store.primarySupport || []
    );
  }, [slotB, staffName, targetDay, store.students, store.entries, store.lsaAssignments, store.primarySupport]);

  const is80MinLesson = useMemo(() => {
    if (!isPaired || !slotA || !slotB) return false;
    const canMergeLesson = canStaffSlotsMergeUtil(
      staffName,
      targetDay,
      slotA,
      slotB,
      store.students,
      store.entries,
      store.lsaAssignments,
      store.primarySupport || [],
      activeStaffNotes
    );
    const has80mCover = Boolean(
      noteA?.isCover && noteB?.isCover && noteA.coveredBy && noteA.coveredBy === noteB.coveredBy
    );
    return canMergeLesson || has80mCover;
  }, [isPaired, slotA, slotB, staffName, targetDay, store.students, store.entries, store.lsaAssignments, store.primarySupport, activeStaffNotes, noteA, noteB]);

  const isCoverSplit = useMemo(() => {
    if (!isPaired || !slotA || !slotB) return false;
    const hasAnyCover = Boolean(noteA?.isCover || noteB?.isCover);
    const hasBothIdentical = Boolean(
      noteA?.isCover && noteB?.isCover && noteA.coveredBy && noteA.coveredBy === noteB.coveredBy
    );
    return hasAnyCover && !hasBothIdentical;
  }, [isPaired, slotA, slotB, noteA, noteB]);

  const [targetMode, setTargetMode] = useState<CoverTargetMode>('both');
  const [noteText, setNoteText] = useState<string>('');
  const [noteBold, setNoteBold] = useState<boolean>(false);
  const [positionTop, setPositionTop] = useState<boolean>(false);
  const [highlight, setHighlight] = useState<boolean>(true);
  const [highlightColor, setHighlightColor] = useState<NoteHighlightColor>('yellow');
  const [keepIndefinitely, setKeepIndefinitely] = useState<boolean>(false);
  const [isCover, setIsCover] = useState<boolean>(false);
  const [coveredBy, setCoveredBy] = useState<string>('');
  const [confirmedConflict, setConfirmedConflict] = useState<boolean>(false);
  const [pendingConflictStaff, setPendingConflictStaff] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [coverSearchTerm, setCoverSearchTerm] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteSuccessMsg, setNoteSuccessMsg] = useState<string | null>(null);

  // Compute all active notes for current slot selection
  const currentSlotNotes = useMemo(() => {
    if (!isPaired || !slotA || !slotB) {
      return activeStaffNotes.filter(
        (n) =>
          (n.staffName.toLowerCase() === staffName.toLowerCase() || isStaffMentionedInNote(n, staffName)) &&
          n.day === targetDay &&
          n.slotId === (clickedSlot?.id || slotId)
      );
    }
    if (targetMode === 'slotA') return notesA;
    if (targetMode === 'slotB') return notesB;
    // targetMode === 'both': combine notes from slotA and slotB, deduplicating matching paired notes
    const seen = new Set<string>();
    const list: StaffSlotNote[] = [];
    [...notesA, ...notesB].forEach((n) => {
      const k = `${n.text}|${Boolean(n.isCover)}|${n.coveredBy || ''}|${Boolean(n.bold)}|${Boolean(n.highlight)}|${n.highlightColor || 'yellow'}|${Boolean(n.keepIndefinitely)}`;
      if (!seen.has(k)) {
        seen.add(k);
        list.push(n);
      }
    });
    return list;
  }, [isPaired, slotA, slotB, targetMode, clickedSlot, slotId, activeStaffNotes, staffName, targetDay, notesA, notesB]);

  const [adminTab, setAdminTab] = useState<'add_lesson' | 'add_class' | 'note_cover' | 'quick_assign'>('add_lesson');
  const [newLessonType, setNewLessonType] = useState<'withdrawal' | 'lesson'>('withdrawal');
  const [studentInputMode, setStudentInputMode] = useState<'existing' | 'new'>('existing');
  const [lessonStudent, setLessonStudent] = useState<string>('');
  const [newStudentName, setNewStudentName] = useState<string>('');
  const [lessonSubject, setLessonSubject] = useState<string>('Literacy Intervention');
  const [lessonTeacher, setLessonTeacher] = useState<string>('');
  const [lessonRoom, setLessonRoom] = useState<string>('SEN 1');
  const [lessonSuccessMsg, setLessonSuccessMsg] = useState<string | null>(null);

  // Class (Multiple Students — Staff as Teacher) state
  const [classStudents, setClassStudents] = useState<string[]>([]);
  const [classNewStudentInput, setClassNewStudentInput] = useState<string>('');
  const [classSupportStaff, setClassSupportStaff] = useState<string>('');
  const [classTeacherName, setClassTeacherName] = useState<string>('');
  const [existingClassId, setExistingClassId] = useState<string | undefined>(undefined);
  const [classSuccessMsg, setClassSuccessMsg] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionPickerRef = useRef<HTMLDivElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionCursorPos, setMentionCursorPos] = useState<number>(0);
  const [isMentionPickerOpen, setIsMentionPickerOpen] = useState<boolean>(false);

  const handleNoteTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setNoteText(val);
    setMentionCursorPos(pos);

    // Look back from cursor to see if there is an active '@' query
    const textBefore = val.slice(0, pos);
    const lastAt = textBefore.lastIndexOf('@');
    if (lastAt !== -1 && (lastAt === 0 || /\s/.test(textBefore[lastAt - 1]))) {
      const query = textBefore.slice(lastAt + 1);
      if (!/[\n\r]/.test(query) && query.length <= 25) {
        setMentionQuery(query);
        return;
      }
    }
    setMentionQuery(null);
  };

  const handleInsertMention = (staffNameToInsert: string) => {
    const pos = mentionCursorPos || noteText.length;
    const textBefore = noteText.slice(0, pos);
    const textAfter = noteText.slice(pos);
    const lastAt = textBefore.lastIndexOf('@');

    let newText = '';
    let newCursor = pos;
    if (lastAt !== -1 && (lastAt === 0 || /\s/.test(textBefore[lastAt - 1]))) {
      newText = textBefore.slice(0, lastAt) + `@${staffNameToInsert} ` + textAfter;
      newCursor = lastAt + staffNameToInsert.length + 2;
    } else {
      const needsSpace = noteText.length > 0 && !noteText.endsWith(' ');
      newText = noteText + (needsSpace ? ' ' : '') + `@${staffNameToInsert} `;
      newCursor = newText.length;
    }
    setNoteText(newText);
    setMentionQuery(null);
    setIsMentionPickerOpen(false);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 10);
  };

  const handleStartEditNote = (n: StaffSlotNote) => {
    setEditingNoteId(n.id);
    setNoteText(n.text || '');
    setNoteBold(Boolean(n.bold));
    setPositionTop(n.position === 'top' || Boolean(n.pinToTop));
    setHighlight(n.highlight ?? true);
    setHighlightColor(n.highlightColor || 'yellow');
    setKeepIndefinitely(Boolean(n.keepIndefinitely));
    setIsCover(Boolean(n.isCover));
    setCoveredBy(n.coveredBy || '');
    setConfirmedConflict(Boolean(n.confirmedConflict));
    setPendingConflictStaff(null);
  };

  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setNoteText('');
    setNoteBold(false);
    setPositionTop(false);
    setHighlight(true);
    setHighlightColor('yellow');
    setKeepIndefinitely(false);
    setIsCover(false);
    setCoveredBy('');
    setConfirmedConflict(false);
    setPendingConflictStaff(null);
    setCoverSearchTerm('');
    setIsDropdownOpen(false);
  };

  const populateLessonFieldsForMode = (mode: CoverTargetMode) => {
    const activeSid =
      isPaired && slotA && slotB && mode === 'slotB' ? slotB.id : slotA?.id || slotId;
    const modeAssigns =
      !isPaired || !slotA || !slotB || mode === 'slotA'
        ? assignsA
        : mode === 'slotB'
        ? assignsB
        : assignsA.length > 0
        ? assignsA
        : assignsB;

    const distinctStudents = Array.from(new Set(modeAssigns.map((a) => a.student)));
    const hasClassInMode = modeAssigns.some((a) => Boolean(a.classId));

    if (distinctStudents.length === 1 && !hasClassInMode) {
      const stu = distinctStudents[0];
      const ent = store.entries.find(
        (e) => e.student === stu && e.day === targetDay && e.slotId === activeSid
      );
      setLessonStudent(stu);
      setStudentInputMode('existing');
      setNewStudentName('');
      if (ent) {
        setLessonSubject(ent.subject || 'Literacy Intervention');
        setLessonRoom(ent.room || '');
        setLessonTeacher(ent.teacher || '');
        setNewLessonType(ent.lessonType || 'lesson');
      }
    } else if (distinctStudents.length > 1 && !hasClassInMode) {
      const firstStu = distinctStudents[0];
      const ent = store.entries.find(
        (e) => e.student === firstStu && e.day === targetDay && e.slotId === activeSid
      );
      setLessonStudent('');
      setStudentInputMode('existing');
      setNewStudentName('');
      if (ent) {
        setLessonSubject(ent.subject || 'Literacy Intervention');
        setLessonRoom(ent.room || '');
        setLessonTeacher(ent.teacher || '');
        setNewLessonType(ent.lessonType || 'lesson');
      }
    } else {
      setLessonStudent('');
      setStudentInputMode('existing');
      setNewStudentName('');
    }
    setLessonSuccessMsg(null);
  };

  const populateFieldsForMode = (_mode: CoverTargetMode) => {
    handleCancelEditNote();
    setIsDropdownOpen(false);
    setSavedSuccess(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    let initialMode: CoverTargetMode = 'both';
    if (isPaired && slotA && slotB) {
      if (is80MinLesson) {
        if (isCoverSplit) {
          initialMode = clickedSlot?.id === slotB.id ? 'slotB' : 'slotA';
        } else {
          initialMode = 'both';
        }
      } else {
        initialMode = clickedSlot?.id === slotB.id ? 'slotB' : 'slotA';
      }
    } else {
      initialMode = 'both';
    }

    setTargetMode(initialMode);
    populateFieldsForMode(initialMode);
    populateLessonFieldsForMode(initialMode);
    setSelectedStudent('');

    const activeSid =
      isPaired && slotA && slotB && initialMode === 'slotB' ? slotB.id : slotA?.id || slotId;
    const modeAssigns =
      !isPaired || !slotA || !slotB || initialMode === 'slotA'
        ? assignsA
        : initialMode === 'slotB'
        ? assignsB
        : [...assignsA, ...assignsB];
    const hasExistingClass = store.entries.some((e) => {
      if (!e.classId || e.day !== targetDay || e.slotId !== activeSid) return false;
      const isThisStaff =
        e.teacher?.trim().toLowerCase() === staffName.trim().toLowerCase() ||
        modeAssigns.some((a) => a.classId === e.classId);
      if (!isThisStaff) return false;
      const count = store.entries.filter(
        (x) => x.day === targetDay && x.slotId === activeSid && x.classId === e.classId
      ).length;
      return count > 1;
    });
    setAdminTab(hasExistingClass ? 'add_class' : 'add_lesson');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, staffName, targetDay, slotId]);

  const handleSwitchTargetMode = (newMode: CoverTargetMode) => {
    setTargetMode(newMode);
    populateFieldsForMode(newMode);
    populateLessonFieldsForMode(newMode);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (mentionPickerRef.current && !mentionPickerRef.current.contains(e.target as Node)) {
        setIsMentionPickerOpen(false);
      }
    };
    if (isDropdownOpen || isMentionPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen, isMentionPickerOpen]);

  // Deduplicated assignments for display in the active target mode
  const displayedAssignments = useMemo(() => {
    if (!isPaired || !slotA || !slotB || targetMode === 'slotA') {
      return assignsA.map((a) => ({
        ...a,
        slotIds: [slotA?.id || slotId],
        slotBadge: isPaired && slotA ? slotA.label : undefined,
      }));
    }
    if (targetMode === 'slotB') {
      return assignsB.map((a) => ({
        ...a,
        slotIds: [slotB.id],
        slotBadge: slotB.label,
      }));
    }
    // targetMode === 'both': merge students appearing in both slotA and slotB
    const map = new Map<
      string,
      {
        student: string;
        day: DayOfWeek;
        slotId: string;
        lsa: string;
        type: 'primary' | 'secondary' | 'cover' | 'relieved' | 'teacher';
        classId?: string;
        className?: string;
        slotIds: string[];
        slotBadge?: string;
      }
    >();
    assignsA.forEach((a) => {
      map.set(a.student, {
        ...a,
        slotIds: [slotA.id],
        slotBadge: slotA.label,
      });
    });
    assignsB.forEach((b) => {
      const existing = map.get(b.student);
      if (existing) {
        existing.slotIds.push(slotB.id);
        existing.slotBadge = '80 min';
      } else {
        map.set(b.student, {
          ...b,
          slotIds: [slotB.id],
          slotBadge: slotB.label,
        });
      }
    });
    return Array.from(map.values());
  }, [isPaired, slotA, slotB, targetMode, assignsA, assignsB, slotId]);

  const sharedTeacherInfo = useMemo(() => {
    if (displayedAssignments.length <= 1) return null;
    const teachers = displayedAssignments
      .map((a) => normalizeTeacherKey(a.teacher))
      .filter(Boolean);
    if (teachers.length === displayedAssignments.length && new Set(teachers).size === 1) {
      return displayedAssignments[0].teacher || teachers[0];
    }
    return null;
  }, [displayedAssignments]);

  // Pre-populate Class state if a class already exists in the current slot for this staff member
  useEffect(() => {
    if (!isOpen) return;
    const activeSid = isPaired && slotA && slotB && targetMode === 'slotB' ? slotB.id : slotA?.id || slotId;
    const modeAssigns =
      !isPaired || !slotA || !slotB || targetMode === 'slotA'
        ? assignsA
        : targetMode === 'slotB'
        ? assignsB
        : [...assignsA, ...assignsB];
    const assignedClassId = modeAssigns.find((a) => Boolean(a.classId))?.classId;

    const classEntriesInSlot = store.entries.filter(
      (e) =>
        e.day === targetDay &&
        e.slotId === activeSid &&
        e.classId &&
        (e.teacher?.trim().toLowerCase() === staffName.trim().toLowerCase() ||
          (assignedClassId && e.classId === assignedClassId))
    );
    const distinctClassStudents = Array.from(new Set(classEntriesInSlot.map((e) => e.student)));
    if (distinctClassStudents.length > 1) {
      const first = classEntriesInSlot[0];
      setExistingClassId(first.classId);
      setClassTeacherName(first.teacher?.trim() || staffName);
      setLessonSubject(first.subject);
      setLessonRoom(first.room || '');
      setNewLessonType(first.lessonType || 'lesson');
      setClassStudents(distinctClassStudents);
      const sup = store.lsaAssignments.find(
        (a) =>
          a.day === targetDay &&
          a.slotId === activeSid &&
          classEntriesInSlot.some((e) => e.student === a.student) &&
          a.lsa &&
          a.lsa !== '__NONE__'
      );
      setClassSupportStaff(sup?.lsa || '');
    } else {
      setExistingClassId(undefined);
      setClassTeacherName(staffName);
      setClassStudents([]);
      setClassSupportStaff('');
    }
    setClassNewStudentInput('');
    setClassSuccessMsg(null);
  }, [isOpen, isPaired, slotA, slotB, targetMode, slotId, targetDay, staffName, assignsA, assignsB, store.entries, store.lsaAssignments]);

  // Accurate per-slot conflict check (never false-triggers on a single student's 80-min double period, within a single Class, or when students share the same teacher)
  const conflictDetails = useMemo(() => {
    const conflicts: { slotLabel: string; students: string[] }[] = [];
    const distinctA: string[] = Array.from(new Set<string>(assignsA.map((a) => a.student)));
    const distinctB: string[] = Array.from(new Set<string>(assignsB.map((a) => a.student)));
    const conflictA = hasSlotConflict(assignsA, store.entries);
    const conflictB = hasSlotConflict(assignsB, store.entries);

    if (!isPaired || !slotA || !slotB) {
      if (conflictA) {
        conflicts.push({ slotLabel: clickedSlot?.label || slotId, students: distinctA });
      }
    } else if (targetMode === 'slotA') {
      if (conflictA) {
        conflicts.push({ slotLabel: slotA.label, students: distinctA });
      }
    } else if (targetMode === 'slotB') {
      if (conflictB) {
        conflicts.push({ slotLabel: slotB.label, students: distinctB });
      }
    } else {
      if (conflictA && conflictB && distinctA.join(',') === distinctB.join(',')) {
        conflicts.push({ slotLabel: `${slotA.label} & ${slotB.label}`, students: distinctA });
      } else {
        if (conflictA) conflicts.push({ slotLabel: slotA.label, students: distinctA });
        if (conflictB) conflicts.push({ slotLabel: slotB.label, students: distinctB });
      }
    }
    return conflicts;
  }, [isPaired, slotA, slotB, targetMode, assignsA, assignsB, clickedSlot, slotId, store.entries]);

  const isConflict = conflictDetails.length > 0;

  // Live warning ONLY if adding a NEW student in this slot will double-book this staff member.
  // Never warns when no student is selected, when editing the student already assigned in this slot,
  // or when students share the same lesson with the same teacher.
  const getProposedStudentConflictWarning = (proposedStudent: string, customTeacher?: string) => {
    const cleanStu = proposedStudent.trim().toLowerCase();
    if (!cleanStu) return { overlaps: [], sharedNotes: [] };

    const targetSlots =
      isPaired && slotA && slotB
        ? targetMode === 'both'
          ? [slotA, slotB]
          : targetMode === 'slotB'
          ? [slotB]
          : [slotA]
        : clickedSlot
        ? [clickedSlot]
        : [];

    const overlaps: string[] = [];
    const sharedNotes: string[] = [];

    targetSlots.forEach((sObj) => {
      const slotAssigns = sObj.id === slotB?.id ? assignsB : assignsA;
      const isAlreadyAssignedInSlot = slotAssigns.some(
        (a) => a.student.trim().toLowerCase() === cleanStu
      );
      // If this student is already assigned to this staff member in this slot, editing their lesson does not add a conflict
      if (isAlreadyAssignedInSlot) return;

      // Determine the teacher for the proposed student
      let effectiveProposedTeacher = customTeacher ? normalizeTeacherKey(customTeacher) : '';
      if (!effectiveProposedTeacher) {
        const ent = store.entries.find(
          (e) => e.student.trim().toLowerCase() === cleanStu && e.day === targetDay && e.slotId === sObj.id
        );
        effectiveProposedTeacher = normalizeTeacherKey(ent?.teacher);
      }

      const otherBookedStudents: string[] = [];
      const sameLessonStudents: string[] = [];

      slotAssigns.forEach((a) => {
        if (a.student.trim().toLowerCase() === cleanStu) return;
        if (existingClassId && a.classId === existingClassId) {
          sameLessonStudents.push(a.student);
          return;
        }

        const aTeacherNorm = normalizeTeacherKey(a.teacher);
        if (effectiveProposedTeacher && aTeacherNorm && effectiveProposedTeacher === aTeacherNorm) {
          sameLessonStudents.push(a.student);
        } else {
          otherBookedStudents.push(a.student);
        }
      });

      if (otherBookedStudents.length > 0) {
        overlaps.push(`${sObj.label}: booked with ${otherBookedStudents.join(', ')}`);
      }
      if (sameLessonStudents.length > 0) {
        sharedNotes.push(`${sObj.label}: co-supporting with ${sameLessonStudents.join(', ')}`);
      }

      const slotCovers = activeStaffNotes.filter(
        (n) =>
          n.coveredBy?.trim().toLowerCase() === staffName.trim().toLowerCase() &&
          n.day === targetDay &&
          n.slotId === sObj.id &&
          n.isCover
      );
      slotCovers.forEach((c) => {
        overlaps.push(`${sObj.label}: covering ${c.staffName}`);
      });
    });

    return { overlaps, sharedNotes };
  };

  const activeAddStudentName =
    studentInputMode === 'new' ? newStudentName.trim() : lessonStudent.trim();
  const { overlaps: addLessonOverlaps, sharedNotes: addLessonShared } =
    getProposedStudentConflictWarning(activeAddStudentName, lessonTeacher);
  const { overlaps: quickAssignOverlaps, sharedNotes: quickAssignShared } =
    getProposedStudentConflictWarning(selectedStudent);

  const headerTime = useMemo(() => {
    if (!isPaired || !slotA || !slotB || targetMode === 'slotA') {
      return `${slotA?.start || ''}–${slotA?.end || ''}`;
    }
    if (targetMode === 'slotB') {
      return `${slotB?.start || ''}–${slotB?.end || ''}`;
    }
    return `${slotA?.start || ''}–${slotB?.end || ''} (80 min)`;
  }, [isPaired, slotA, slotB, targetMode]);

  const headerLabel = useMemo(() => {
    if (!isPaired || !slotA || !slotB) {
      return clickedSlot?.label || '';
    }
    if (targetMode === 'slotA') return `${slotA?.label} (40m)`;
    if (targetMode === 'slotB') return `${slotB?.label} (40m)`;
    return `${slotA?.label} & ${slotB?.label} (80m)`;
  }, [isPaired, slotA, slotB, clickedSlot, targetMode]);

  if (!isOpen) return null;

  const canEdit = role === 'admin';
  // Complete staff roster (supporting staff + teachers)
  const allSchoolStaff = useMemo(() => {
    const map = new Map<string, { id: string; name: string; roleType: 'support' | 'teacher' }>();
    (store.lsaPool || []).forEach((p) => {
      const trimmed = (p.name || '').trim();
      if (trimmed) map.set(trimmed.toLowerCase(), { id: p.id, name: trimmed, roleType: 'support' });
    });
    (store.lsaAssignments || []).forEach((a) => {
      const trimmed = (a.lsa || '').trim();
      if (trimmed && !map.has(trimmed.toLowerCase())) {
        map.set(trimmed.toLowerCase(), { id: `asg_${trimmed}`, name: trimmed, roleType: 'support' });
      }
    });
    (store.primarySupport || []).forEach((ps) => {
      const trimmed = (ps.lsa || '').trim();
      if (trimmed && !map.has(trimmed.toLowerCase())) {
        map.set(trimmed.toLowerCase(), { id: `ps_${trimmed}`, name: trimmed, roleType: 'support' });
      }
    });
    (store.entries || []).forEach((e) => {
      const trimmed = (e.teacher || '').trim();
      if (trimmed && !map.has(trimmed.toLowerCase())) {
        map.set(trimmed.toLowerCase(), { id: `tch_${trimmed}`, name: trimmed, roleType: 'teacher' });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [store.lsaPool, store.lsaAssignments, store.primarySupport, store.entries]);

  const allSchoolStaffNames = useMemo(() => allSchoolStaff.map((s) => s.name), [allSchoolStaff]);

  const candidateStaffList = useMemo(() => {
    const currentNorm = (staffName || '').trim().toLowerCase();
    return allSchoolStaff.filter((s) => s.name.toLowerCase() !== currentNorm);
  }, [allSchoolStaff, staffName]);

  const filteredCandidateStaffList = useMemo(() => {
    if (!coverSearchTerm.trim()) return candidateStaffList;
    const term = coverSearchTerm.trim().toLowerCase();
    return candidateStaffList.filter((s) => s.name.toLowerCase().includes(term));
  }, [candidateStaffList, coverSearchTerm]);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return allSchoolStaff.filter((s) => s.name.toLowerCase().includes(q));
  }, [mentionQuery, allSchoolStaff]);

  const candidateSupportingStaff = useMemo(() => {
    return filteredCandidateStaffList.filter((s) => s.roleType === 'support');
  }, [filteredCandidateStaffList]);

  const candidateTeachers = useMemo(() => {
    return filteredCandidateStaffList.filter((s) => s.roleType === 'teacher');
  }, [filteredCandidateStaffList]);

  // Check candidate staff availability (including regular assignments, teaching lessons, AND cover duties)
  const getStaffSlotStatus = (candidateName: string) => {
    const checkSingleSlot = (sObj: { id: string; label: string }) => {
      const assigns = assignmentsForLsaSlot(
        candidateName,
        targetDay,
        sObj.id,
        store.students,
        store.entries,
        store.lsaAssignments,
        store.primarySupport || []
      );
      const teachingLessons = store.entries.filter(
        (e) =>
          e.teacher &&
          e.teacher.trim().toLowerCase() === candidateName.trim().toLowerCase() &&
          e.day === targetDay &&
          e.slotId === sObj.id
      );
      const covers = activeStaffNotes.filter(
        (n) =>
          n.coveredBy?.trim().toLowerCase() === candidateName.trim().toLowerCase() &&
          n.day === targetDay &&
          n.slotId === sObj.id &&
          n.isCover &&
          n.staffName.trim().toLowerCase() !== staffName.trim().toLowerCase()
      );
      const details: string[] = [];
      assigns.forEach((a) => {
        const ent = store.entries.find(
          (e) => e.student === a.student && e.day === targetDay && e.slotId === sObj.id
        );
        details.push(`${a.student}${ent?.subject ? ` (${ent.subject})` : ''}`);
      });
      teachingLessons.forEach((tl) => {
        details.push(`Teaching ${tl.subject} (${tl.student})`);
      });
      covers.forEach((c) => {
        details.push(`Covering ${c.staffName}`);
      });
      return { assigns, covers, details };
    };

    if (!isPaired || !slotA || !slotB || targetMode === 'slotA') {
      const targetSlot = isPaired && slotA ? slotA : clickedSlot!;
      const res = checkSingleSlot(targetSlot);
      return {
        isFree: res.details.length === 0,
        assignments: res.assigns,
        details: res.details,
        slotLabel: targetSlot.label,
        duration: '40m',
      };
    }
    if (targetMode === 'slotB') {
      const res = checkSingleSlot(slotB);
      return {
        isFree: res.details.length === 0,
        assignments: res.assigns,
        details: res.details,
        slotLabel: slotB.label,
        duration: '40m',
      };
    }

    const r1 = checkSingleSlot(slotA);
    const r2 = checkSingleSlot(slotB);
    const combinedDetails = Array.from(new Set([...r1.details, ...r2.details]));
    return {
      isFree: combinedDetails.length === 0,
      assignments: [...r1.assigns, ...r2.assigns],
      details: combinedDetails,
      slotLabel: `${slotA.label} & ${slotB.label}`,
      duration: '80m',
    };
  };

  const handleCoverToggle = (checked: boolean) => {
    setIsCover(checked);
    if (checked) {
      setHighlight(true);
    } else {
      setCoveredBy('');
      setConfirmedConflict(false);
      setPendingConflictStaff(null);
    }
  };

  const handleSelectStaffCandidate = (candidateName: string) => {
    if (!candidateName) {
      setCoveredBy('');
      setConfirmedConflict(false);
      setPendingConflictStaff(null);
      setIsDropdownOpen(false);
      return;
    }
    const status = getStaffSlotStatus(candidateName);
    setCoveredBy(candidateName);
    if (status.isFree) {
      setConfirmedConflict(false);
      setPendingConflictStaff(null);
    } else {
      setConfirmedConflict(true);
      setPendingConflictStaff(candidateName);
    }
    setIsDropdownOpen(false);
  };

  const handleConfirmConflict = () => {
    if (!pendingConflictStaff) return;
    setCoveredBy(pendingConflictStaff);
    setConfirmedConflict(true);
  };

  const handleCancelConflict = () => {
    setCoveredBy('');
    setConfirmedConflict(false);
    setPendingConflictStaff(null);
  };

  const handleSaveNote = () => {
    const textClean = noteText.trim();
    if (!textClean && !isCover) {
      return;
    }
    const isHighlighted = isCover ? true : highlight;
    const noteHighlightColor: NoteHighlightColor = isCover ? 'yellow' : highlightColor;

    const mentionedList = extractMentionedStaff(textClean, allSchoolStaffNames);
    const noteMentions = mentionedList.length > 0 ? mentionedList : undefined;

    if (isPaired && slotA && slotB && targetMode === 'both') {
      const primaryA = assignsA[0];
      const primaryB = assignsB[0];
      const studentA = primaryA?.student || selectedStudent || undefined;
      const studentB = primaryB?.student || selectedStudent || undefined;
      const entryA = studentA
        ? store.entries.find((e) => e.student === studentA && e.day === targetDay && e.slotId === slotA.id)
        : undefined;
      const entryB = studentB
        ? store.entries.find((e) => e.student === studentB && e.day === targetDay && e.slotId === slotB.id)
        : undefined;

      if (editingNoteId) {
        const orig = activeStaffNotes.find((n) => n.id === editingNoteId);
        const sibling = orig
          ? activeStaffNotes.find(
              (n) =>
                n.staffName.toLowerCase() === staffName.toLowerCase() &&
                n.day === targetDay &&
                n.slotId === (orig.slotId === slotA.id ? slotB.id : slotA.id) &&
                n.text === orig.text
            )
          : null;

        const idA = orig?.slotId === slotA.id ? editingNoteId : sibling?.id || ('id_' + Math.random().toString(36).substring(2, 9));
        const idB = orig?.slotId === slotB.id ? editingNoteId : sibling?.id || ('id_' + Math.random().toString(36).substring(2, 9));

        saveStaffNotesBatch([
          {
            id: idA,
            staffName,
            day: targetDay,
            slotId: slotA.id,
            text: textClean,
            bold: noteBold,
            position: positionTop ? 'top' : 'bottom',
            pinToTop: positionTop,
            highlight: isHighlighted,
            highlightColor: isHighlighted ? noteHighlightColor : undefined,
            keepIndefinitely: Boolean(keepIndefinitely),
            mentionedStaff: noteMentions,
            isCover,
            coveredBy: isCover && coveredBy ? coveredBy : undefined,
            confirmedConflict: isCover && confirmedConflict ? confirmedConflict : undefined,
            student: studentA,
            subject: entryA?.subject,
            teacher: entryA?.teacher,
            room: entryA?.room,
          },
          {
            id: idB,
            staffName,
            day: targetDay,
            slotId: slotB.id,
            text: textClean,
            bold: noteBold,
            position: positionTop ? 'top' : 'bottom',
            pinToTop: positionTop,
            highlight: isHighlighted,
            highlightColor: isHighlighted ? noteHighlightColor : undefined,
            keepIndefinitely: Boolean(keepIndefinitely),
            mentionedStaff: noteMentions,
            isCover,
            coveredBy: isCover && coveredBy ? coveredBy : undefined,
            confirmedConflict: isCover && confirmedConflict ? confirmedConflict : undefined,
            student: studentB,
            subject: entryB?.subject,
            teacher: entryB?.teacher,
            room: entryB?.room,
          },
        ]);
      } else {
        const idA = 'id_' + Math.random().toString(36).substring(2, 9);
        const idB = 'id_' + Math.random().toString(36).substring(2, 9);
        saveStaffNotesBatch([
          {
            id: idA,
            staffName,
            day: targetDay,
            slotId: slotA.id,
            text: textClean,
            bold: noteBold,
            position: positionTop ? 'top' : 'bottom',
            pinToTop: positionTop,
            highlight: isHighlighted,
            highlightColor: isHighlighted ? noteHighlightColor : undefined,
            keepIndefinitely: Boolean(keepIndefinitely),
            mentionedStaff: noteMentions,
            isCover,
            coveredBy: isCover && coveredBy ? coveredBy : undefined,
            confirmedConflict: isCover && confirmedConflict ? confirmedConflict : undefined,
            student: studentA,
            subject: entryA?.subject,
            teacher: entryA?.teacher,
            room: entryA?.room,
          },
          {
            id: idB,
            staffName,
            day: targetDay,
            slotId: slotB.id,
            text: textClean,
            bold: noteBold,
            position: positionTop ? 'top' : 'bottom',
            pinToTop: positionTop,
            highlight: isHighlighted,
            highlightColor: isHighlighted ? noteHighlightColor : undefined,
            keepIndefinitely: Boolean(keepIndefinitely),
            mentionedStaff: noteMentions,
            isCover,
            coveredBy: isCover && coveredBy ? coveredBy : undefined,
            confirmedConflict: isCover && confirmedConflict ? confirmedConflict : undefined,
            student: studentB,
            subject: entryB?.subject,
            teacher: entryB?.teacher,
            room: entryB?.room,
          },
        ]);
      }
    } else {
      const activeSlot = isPaired && slotA && slotB
        ? targetMode === 'slotB'
          ? slotB
          : slotA
        : clickedSlot!;
      const currentAssigns = targetMode === 'slotB' ? assignsB : assignsA;
      const primary = currentAssigns[0];
      const activeStudent = primary?.student || selectedStudent || undefined;
      const entry = activeStudent
        ? store.entries.find((e) => e.student === activeStudent && e.day === targetDay && e.slotId === activeSlot.id)
        : undefined;

      saveStaffNote({
        id: editingNoteId || ('id_' + Math.random().toString(36).substring(2, 9)),
        staffName,
        day: targetDay,
        slotId: activeSlot.id,
        text: textClean,
        bold: noteBold,
        position: positionTop ? 'top' : 'bottom',
        pinToTop: positionTop,
        highlight: isHighlighted,
        highlightColor: isHighlighted ? noteHighlightColor : undefined,
        keepIndefinitely: Boolean(keepIndefinitely),
        mentionedStaff: noteMentions,
        isCover,
        coveredBy: isCover && coveredBy ? coveredBy : undefined,
        confirmedConflict: isCover && confirmedConflict ? confirmedConflict : undefined,
        student: activeStudent,
        subject: entry?.subject,
        teacher: entry?.teacher,
        room: entry?.room,
      });
    }

    setSavedSuccess(true);
    setNoteSuccessMsg(editingNoteId ? 'Note updated' : 'Note added');
    handleCancelEditNote();
    setTimeout(() => {
      setSavedSuccess(false);
      setNoteSuccessMsg(null);
    }, 2000);
  };

  const handleDeleteSingleNote = (targetNote: StaffSlotNote) => {
    if (isPaired && slotA && slotB && targetMode === 'both') {
      const matchingNotes = activeStaffNotes.filter(
        (x) =>
          x.staffName.toLowerCase() === staffName.toLowerCase() &&
          x.day === targetDay &&
          (x.slotId === slotA.id || x.slotId === slotB.id) &&
          (x.id === targetNote.id || (x.text === targetNote.text && Boolean(x.isCover) === Boolean(targetNote.isCover)))
      );
      matchingNotes.forEach((m) => deleteStaffNoteById(m.id));
    } else {
      deleteStaffNoteById(targetNote.id);
    }
    if (editingNoteId === targetNote.id) {
      handleCancelEditNote();
    }
  };

  const handleClearAllNotes = () => {
    if (isPaired && slotA && slotB && targetMode === 'both') {
      deleteStaffNotesBatch([
        { staffName, day: targetDay, slotId: slotA.id },
        { staffName, day: targetDay, slotId: slotB.id },
      ]);
    } else if (isPaired && slotA && slotB && targetMode === 'slotB') {
      deleteStaffNote(staffName, targetDay, slotB.id);
    } else if (isPaired && slotA && slotB && targetMode === 'slotA') {
      deleteStaffNote(staffName, targetDay, slotA.id);
    } else {
      deleteStaffNote(staffName, targetDay, clickedSlot?.id || slotId);
    }
    handleCancelEditNote();
  };

  const handleUnassign = (student: string, slotIdsToClear: string[]) => {
    slotIdsToClear.forEach((sid) => {
      assignSupportDirectly(student, targetDay, sid, '');
      const existingEntry = store.entries.find(
        (e) => e.student === student && e.day === targetDay && e.slotId === sid
      );
      if (
        existingEntry &&
        existingEntry.teacher &&
        existingEntry.teacher.trim().toLowerCase() === staffName.trim().toLowerCase()
      ) {
        upsertEntry(
          student,
          targetDay,
          sid,
          existingEntry.subject,
          '',
          existingEntry.room || '',
          existingEntry.lessonType || 'lesson',
          existingEntry.split
        );
      }
    });
  };

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    const activeSlotId = isPaired && slotA && slotB
      ? targetMode === 'slotB'
        ? slotB.id
        : slotA.id
      : clickedSlot?.id || slotId;

    if (isPaired && slotA && slotB && targetMode === 'both') {
      assignSupportDirectly(selectedStudent, targetDay, slotA.id, staffName, true);
    } else {
      assignSupportDirectly(selectedStudent, targetDay, activeSlotId, staffName, false);
    }

    setSelectedStudent('');
  };

  const handleAddLesson = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveStudent =
      studentInputMode === 'new' ? newStudentName.trim() : lessonStudent.trim();
    if (!effectiveStudent) return;

    const effectiveSubject =
      lessonSubject.trim() ||
      (newLessonType === 'withdrawal' ? 'Withdrawal Support' : 'In-Class Support');
    const targetSlotId =
      isPaired && slotA && slotB
        ? targetMode === 'slotB'
          ? slotB.id
          : slotA.id
        : clickedSlot?.id || slotId;
    const applyDouble = Boolean(isPaired && targetMode === 'both');

    saveLessonAndSupport(effectiveStudent, targetDay, targetSlotId, {
      subject: effectiveSubject,
      teacher: lessonTeacher.trim(),
      room: lessonRoom.trim(),
      lessonType: newLessonType,
      assignedStaff: staffName,
      applyToDoublePeriod: applyDouble,
      applyToSubject: false,
      classId: undefined,
      className: undefined,
    });

    setLessonSuccessMsg(`Added lesson for ${effectiveStudent}`);
    if (studentInputMode === 'new') {
      setNewStudentName('');
      setStudentInputMode('existing');
    }
    setLessonStudent('');
    setTimeout(() => setLessonSuccessMsg(null), 2500);
  };

  const toggleClassStudent = (stu: string) => {
    setClassStudents((prev) =>
      prev.includes(stu) ? prev.filter((s) => s !== stu) : [...prev, stu]
    );
  };

  const handleAddNewStudentToClass = () => {
    const trimmed = classNewStudentInput.trim();
    if (!trimmed) return;
    if (!classStudents.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setClassStudents((prev) => [...prev, trimmed]);
    }
    setClassNewStudentInput('');
  };

  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (classStudents.length === 0) return;

    const effectiveSubject =
      lessonSubject.trim() ||
      (newLessonType === 'withdrawal' ? 'Withdrawal Class' : 'Class Lesson');
    const targetSlotId =
      isPaired && slotA && slotB
        ? targetMode === 'slotB'
          ? slotB.id
          : slotA.id
        : clickedSlot?.id || slotId;
    const applyDouble = Boolean(isPaired && targetMode === 'both');
    const effectiveTeacher = existingClassId && classTeacherName ? classTeacherName : staffName;

    // A withdrawal class only applies to more than one student!
    if (classStudents.length === 1 && newLessonType === 'withdrawal') {
      const singleStudent = classStudents[0];
      saveLessonAndSupport(singleStudent, targetDay, targetSlotId, {
        subject: effectiveSubject,
        teacher: effectiveTeacher,
        room: lessonRoom.trim(),
        lessonType: 'withdrawal',
        assignedStaff: classSupportStaff.trim() || undefined,
        applyToDoublePeriod: applyDouble,
        applyToSubject: false,
        classId: undefined,
        className: undefined,
      });

      setClassSuccessMsg(`Saved 1:1 Withdrawal lesson for ${singleStudent}`);
      setTimeout(() => setClassSuccessMsg(null), 2500);
      return;
    }

    saveStaffClass({
      teacherStaff: effectiveTeacher,
      day: targetDay,
      slotId: targetSlotId,
      students: classStudents,
      subject: effectiveSubject,
      room: lessonRoom.trim(),
      lessonType: newLessonType,
      supportStaff: classSupportStaff.trim(),
      applyToDoublePeriod: applyDouble,
      classId: existingClassId,
    });

    setClassSuccessMsg(
      `Saved class "${effectiveSubject}" with ${effectiveTeacher} as Teacher (${classStudents.length} student${
        classStudents.length > 1 ? 's' : ''
      })`
    );
    setTimeout(() => setClassSuccessMsg(null), 2500);
  };

  const allAvailableClassStudents = useMemo(() => {
    const set = new Set([...store.students, ...classStudents]);
    return Array.from(set).sort();
  }, [store.students, classStudents]);

  const handleToggleLessonType = (
    studentName: string,
    slotIdTarget: string,
    currentType: 'lesson' | 'withdrawal'
  ) => {
    const newType = currentType === 'withdrawal' ? 'lesson' : 'withdrawal';
    const entry = store.entries.find(
      (e) => e.student === studentName && e.day === targetDay && e.slotId === slotIdTarget
    );
    if (entry?.classId && newType !== 'withdrawal') {
      const classEntries = store.entries.filter(
        (e) => e.day === targetDay && e.slotId === slotIdTarget && e.classId === entry.classId
      );
      const classStuList = Array.from(new Set(classEntries.map((e) => e.student)));
      if (classStuList.length > 1) {
        const sup = store.lsaAssignments.find(
          (a) =>
            a.day === targetDay &&
            a.slotId === slotIdTarget &&
            classStuList.includes(a.student) &&
            a.lsa &&
            a.lsa !== '__NONE__'
        );
        saveStaffClass({
          teacherStaff: entry.teacher || staffName,
          day: targetDay,
          slotId: slotIdTarget,
          students: classStuList,
          subject: entry.subject || 'Class Lesson',
          room: entry.room || '',
          lessonType: newType,
          supportStaff: sup?.lsa || '',
          applyToDoublePeriod: Boolean(isPaired && targetMode === 'both'),
          classId: entry.classId,
        });
        return;
      }
    }
    // Individual student toggle or switching to withdrawal: strictly individual 1:1
    saveLessonAndSupport(studentName, targetDay, slotIdTarget, {
      subject: entry?.subject || 'Support',
      teacher: entry?.teacher || '',
      room: entry?.room || '',
      lessonType: newType,
      assignedStaff: staffName,
      applyToDoublePeriod: Boolean(isPaired && targetMode === 'both'),
      applyToSubject: false,
    });
  };

  const assignedStudentNames = new Set(displayedAssignments.map((a) => a.student));
  const availableStudents = store.students.filter((s) => !assignedStudentNames.has(s));

  const hasExistingActiveNote = useMemo(() => {
    if (!isPaired || !slotA || !slotB) return Boolean(existingSingleNote);
    if (targetMode === 'slotA') return Boolean(noteA);
    if (targetMode === 'slotB') return Boolean(noteB);
    return Boolean(noteA || noteB);
  }, [isPaired, slotA, slotB, targetMode, noteA, noteB, existingSingleNote]);

  // -------------------------------------------------------------
  // STAFF MODE (READ ONLY)
  // -------------------------------------------------------------
  if (!canEdit) {
    const relevantNotes = currentSlotNotes;

    return (
      <div
        className="fixed inset-0 bg-[#141620]/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-white rounded-lg w-full max-w-md p-5 shadow-xl border border-[#DCDFE4]">
          <div className="flex items-start justify-between pb-3 border-b border-[#EAECEF] mb-3.5">
            <div>
              <h3 className="text-[16px] font-bold text-[#1C2333]">{staffName}</h3>
              <div className="text-xs text-[#4A5268] font-mono mt-0.5">
                {DAY_FULL[targetDay]} · {headerLabel} · {headerTime}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[#94A3B8] hover:text-[#1C2333] p-1 rounded-md hover:bg-[#F5F6F8] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            {isConflict && (
              <div className="bg-[#FBE6E4] text-[#B23A31] text-xs p-2.5 rounded border border-[#f5c6cb] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Double-booked:</strong>{' '}
                  {conflictDetails.map((c) => `${c.slotLabel} (${c.students.join(', ')})`).join('; ')}
                </span>
              </div>
            )}

            {hasCoveringDuty && (
              <div className="bg-[#FEF9C3] border border-[#EAB308] p-3 rounded-lg text-xs">
                <div className="font-bold text-[#854D0E] mb-1.5">Active Cover Duty</div>
                <div className="space-y-1.5">
                  {coveringNotes.map((cn) => (
                    <div key={cn.id} className="p-2 bg-white rounded border border-[#FDE047]">
                      <div className="font-bold text-[#0F172A]">
                        Covering for: <span className="text-[#DC2626]">{cn.staffName}</span>
                      </div>
                      {cn.student && (
                        <div className="text-[#1E293B]">
                          {cn.student} {cn.subject ? `· ${cn.subject}` : ''} {cn.room ? `(Rm ${cn.room})` : ''}
                        </div>
                      )}
                      {cn.text && <div className="text-[11px] text-[#DC2626] italic mt-0.5 font-medium">"{cn.text}"</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {displayedAssignments.length === 0 && !hasCoveringDuty ? (
              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-center text-xs text-[#64748B]">
                Free Period
              </div>
            ) : (
              <div className="space-y-2">
                {consolidateStaffSlotAssignments(displayedAssignments, targetDay, clickedSlot.id, store.entries).map((item) => {
                  const isW = item.lessonType === 'withdrawal';

                  if (item.isClass) {
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border ${
                          hasCoveringDuty
                            ? 'bg-[#FEF2F2] border-[#FECACA]'
                            : isW
                            ? 'bg-[#F0F7FD] border-[#BAE0FD]'
                            : 'bg-white border-[#E2E8F0]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                          <span
                            className={`text-xs font-bold ${
                              hasCoveringDuty ? 'line-through text-[#64748B]' : 'text-[#0F172A]'
                            }`}
                          >
                            {item.subject}
                          </span>
                          <div className="flex items-center gap-1">
                            {hasCoveringDuty && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase bg-red-100 text-red-800 border border-red-200">
                                Relieved
                              </span>
                            )}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Class ({item.students.length})
                            </span>
                            {item.type === 'teacher' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-[#FEF3C7] text-[#92400E]">
                                Teacher
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                isW
                                  ? 'bg-[#DCEEFB] text-[#2A6FA8]'
                                  : 'bg-[#E4F0EA] text-[#2F6F4E]'
                              }`}
                            >
                              {isW ? 'Withdrawal' : 'In-Class'}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-[#334155] space-y-0.5">
                          <div>
                            {item.teacher ? `Teacher: ${item.teacher}` : ''}
                            {item.room ? `${item.teacher ? ' · ' : ''}Rm ${item.room}` : ''}
                          </div>
                          <div className="text-[11px] font-medium text-[#1E293B]">
                            <span className="font-semibold text-[#0F172A]">Students:</span> {item.students.join(', ')}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const singleStu = item.students[0];
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border ${
                        hasCoveringDuty
                          ? 'bg-[#FEF2F2] border-[#FECACA]'
                          : isW
                          ? 'bg-[#F0F7FD] border-[#BAE0FD]'
                          : 'bg-white border-[#E2E8F0]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`text-xs font-bold ${
                            hasCoveringDuty ? 'line-through text-[#64748B]' : 'text-[#0F172A]'
                          }`}
                        >
                          {singleStu}
                        </span>
                        <div className="flex items-center gap-1">
                          {hasCoveringDuty && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase bg-red-100 text-red-800 border border-red-200">
                              Relieved
                            </span>
                          )}
                          {item.type === 'teacher' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-[#FEF3C7] text-[#92400E]">
                              Teacher
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              isW
                                ? 'bg-[#DCEEFB] text-[#2A6FA8]'
                                : 'bg-[#E4F0EA] text-[#2F6F4E]'
                            }`}
                          >
                            {isW ? 'Withdrawal' : 'In-Class'}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-[#334155]">
                        <strong>{item.subject}</strong>
                        {item.teacher ? ` · Teacher: ${item.teacher}` : ''}
                        {item.room ? ` · Rm ${item.room}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {relevantNotes.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-[#4A5268] uppercase tracking-wider">
                  Slot Notes ({relevantNotes.length})
                </div>
                {relevantNotes.map((rn, idx) => {
                  const isGreen = rn.highlight && rn.highlightColor === 'green';
                  const isBlue = rn.highlight && rn.highlightColor === 'blue';
                  const cardBg = rn.isCover
                    ? 'bg-[#FEF9C3]/60 border-[#FACC15]'
                    : isGreen
                    ? 'bg-[#DCFCE7] border-[#86EFAC]'
                    : isBlue
                    ? 'bg-[#E0F2FE] border-[#7DD3FC]'
                    : rn.highlight
                    ? 'bg-[#FEF08A]/60 border-[#FACC15]'
                    : 'bg-slate-50 border-slate-200';
                  return (
                    <div
                      key={rn.id || `rn-${idx}`}
                      className={`p-2.5 rounded text-xs border ${cardBg}`}
                    >
                      {rn.isCover && (
                        <div className="font-semibold text-[#B91C1C] mb-0.5">
                          Covered by: <strong>{rn.coveredBy || 'Cover Staff'}</strong>
                        </div>
                      )}
                    {rn.text && (
                      <div className={`text-[#DC2626] flex items-center justify-between gap-1.5 ${rn.bold ? 'font-bold' : 'italic text-[#DC2626]'}`}>
                        <span>"<FormattedNoteText text={rn.text} />"</span>
                        {rn.keepIndefinitely && (
                          <span className="not-italic text-[9.5px] font-semibold text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-300 flex items-center gap-0.5 shrink-0" title="Kept indefinitely">
                            <Pin className="w-2.5 h-2.5 text-emerald-700" /> Kept
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-[#EAECEF] flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold rounded bg-[#1C2333] text-white hover:bg-[#2D3748] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // ADMIN MODE (SIMPLE & CONCISE)
  // -------------------------------------------------------------
  const withdrawalSuggestions = [
    'Literacy Intervention',
    'Numeracy Support',
    'Speech & Language',
    'Sensory Support',
    'Reading',
    'Social Skills',
  ];

  const inclassSuggestions = [
    'Mathematics',
    'English',
    'Science',
    'History',
    'Art & Design',
    'Geography',
    'PE',
  ];

  const pendingCandidateStatus = pendingConflictStaff
    ? getStaffSlotStatus(pendingConflictStaff)
    : null;

  return (
    <div
      className="fixed inset-0 bg-[#141620]/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg w-full max-w-lg p-5 shadow-xl border border-[#DCDFE4] my-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#EAECEF] mb-3">
          <div>
            <h3 className="text-[16px] font-bold text-[#1C2333]">{staffName}</h3>
            <div className="text-xs text-[#4A5268] font-mono mt-0.5">
              {DAY_FULL[targetDay]} · {headerLabel} · {headerTime}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#4A5268] hover:text-[#1C2333] p-1 rounded hover:bg-[#F5F6F8] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compact Slot Selector for Paired Double Periods */}
        {isPaired && slotA && slotB && (
          <div className="grid grid-cols-3 gap-1.5 mb-3 bg-[#F5F6F8] p-1 rounded-md border border-[#DCDFE4]">
            <button
              type="button"
              id="btn-cover-both-slots"
              onClick={() => handleSwitchTargetMode('both')}
              className={`py-1.5 px-2 rounded text-xs font-semibold cursor-pointer transition-all ${
                targetMode === 'both'
                  ? 'bg-[#2F6F4E] text-white shadow-xs'
                  : 'text-[#4A5268] hover:text-[#1C2333]'
              }`}
            >
              Both (80m)
            </button>
            <button
              type="button"
              id="btn-cover-slot-a"
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
              id="btn-cover-slot-b"
              onClick={() => handleSwitchTargetMode('slotB')}
              className={`py-1.5 px-2 rounded text-xs font-semibold cursor-pointer transition-all ${
                targetMode === 'slotB'
                  ? 'bg-[#2F6F4E] text-white shadow-xs'
                  : 'text-[#4A5268] hover:text-[#1C2333]'
              }`}
            >
              {slotB.label} (40m)
            </button>
          </div>
        )}

        {/* Double-booked Warning Banner */}
        {isConflict && (
          <div className="bg-[#FBE6E4] text-[#B23A31] text-xs p-2.5 rounded mb-3 border border-[#f5c6cb] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>Double-booked:</strong> {staffName} is assigned to multiple students in the same slot (
              {conflictDetails.map((c) => `${c.slotLabel}: ${c.students.join(', ')}`).join('; ')}).
            </div>
          </div>
        )}

        {/* Active Cover Duty Banner */}
        {hasCoveringDuty && (
          <div className="bg-[#FEF9C3] border border-[#EAB308] p-2.5 rounded-md text-xs mb-3 space-y-1.5">
            {coveringNotes.map((cn) => (
              <div key={cn.id} className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-[#991C1C]">Covering {cn.staffName}</span>
                  {cn.student ? <span className="text-[#1E293B]"> · {cn.student}</span> : null}
                  {cn.subject ? <span className="text-[#4A5268]"> ({cn.subject})</span> : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleRelieveCover(cn)}
                  className="px-2 py-0.5 text-[11px] font-semibold text-[#DC2626] bg-white hover:bg-[#FEE2E2] rounded border border-[#FCA5A5] cursor-pointer shrink-0"
                >
                  Cancel Cover
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Currently Assigned Students in Slot */}
        {displayedAssignments.length > 0 && (
          <div className="mb-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#4A5268]">
                Assigned in this slot ({displayedAssignments.length})
              </div>
              {existingClassId && (
                <button
                  type="button"
                  onClick={() => setAdminTab('add_class')}
                  className="text-[11px] font-bold text-[#92400E] bg-[#FEF3C7] hover:bg-[#FDE68A] px-2 py-0.5 rounded border border-[#F59E0B] flex items-center gap-1 cursor-pointer"
                >
                  <GraduationCap className="w-3 h-3" />
                  <span>Edit Class ({classStudents.length})</span>
                </button>
              )}
            </div>

            {sharedTeacherInfo && (
              <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Shared Lesson Support: Supporting {displayedAssignments.length} students with teacher {sharedTeacherInfo} (No conflict)</span>
              </div>
            )}

            {displayedAssignments.map((a) => {
              const entry = store.entries.find(
                (e) => e.student === a.student && e.day === targetDay && e.slotId === a.slotId
              );
              const isW = entry?.lessonType === 'withdrawal';
              return (
                <div
                  key={`${a.student}_${a.slotId}`}
                  className={`flex items-center justify-between p-2 rounded border ${
                    isW ? 'border-[#BAE0FD] bg-[#F0F7FD]' : 'border-[#DCDFE4] bg-[#F8FAFC]'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-[#1C2333]">{a.student}</span>
                      {a.classId &&
                        store.entries.filter(
                          (e) => e.day === targetDay && e.slotId === a.slotId && e.classId === a.classId
                        ).length > 1 && (
                        <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Class
                        </span>
                      )}
                      {sharedTeacherInfo && !a.classId && (
                        <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Shared
                        </span>
                      )}
                      {a.type === 'teacher' && (
                        <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full uppercase bg-[#FEF3C7] text-[#92400E]">
                          Teacher
                        </span>
                      )}
                      <span
                        className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                          isW ? 'bg-[#DCEEFB] text-[#2A6FA8]' : 'bg-[#E4F0EA] text-[#2F6F4E]'
                        }`}
                      >
                        {isW ? 'Withdrawal' : 'In-Class'}
                      </span>
                      {a.slotBadge && (
                        <span className="text-[9.5px] font-mono text-[#64748B] bg-white px-1.5 py-0.2 rounded border border-[#E2E8F0]">
                          {a.slotBadge}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#4A5268] truncate">
                      {entry?.subject || 'Support'}
                      {entry?.teacher ? ` · Teacher: ${entry.teacher}` : ''}
                      {entry?.room ? ` · Rm ${entry.room}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleLessonType(a.student, a.slotId, isW ? 'withdrawal' : 'lesson')}
                      className="text-[10.5px] font-semibold px-2 py-1 rounded border border-[#CBD5E1] bg-white text-[#1C2333] hover:bg-[#F1F5F9] flex items-center gap-1 cursor-pointer"
                      title="Switch lesson type"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      <span>{isW ? 'In-Class' : 'Withdrawal'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUnassign(a.student, a.slotIds)}
                      className="text-[10.5px] font-semibold px-2 py-1 rounded border border-[#B23A31] text-[#B23A31] hover:bg-[#FBE6E4] cursor-pointer flex items-center gap-1"
                    >
                      <UserMinus className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Simple 4-Tab Action Box */}
        <div className="border border-[#DCDFE4] rounded-lg overflow-hidden bg-white">
          <div className="flex border-b border-[#DCDFE4] bg-[#F8FAFC]">
            <button
              type="button"
              onClick={() => setAdminTab('add_lesson')}
              className={`flex-1 py-2 px-1.5 text-xs font-bold flex items-center justify-center gap-1 border-b-2 cursor-pointer ${
                adminTab === 'add_lesson'
                  ? 'border-[#2F6F4E] text-[#2F6F4E] bg-white'
                  : 'border-transparent text-[#4A5268] hover:text-[#1C2333]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>Add Lesson</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('add_class')}
              className={`flex-1 py-2 px-1.5 text-xs font-bold flex items-center justify-center gap-1 border-b-2 cursor-pointer ${
                adminTab === 'add_class'
                  ? 'border-[#B45309] text-[#92400E] bg-[#FFFBEB]'
                  : 'border-transparent text-[#4A5268] hover:text-[#1C2333]'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 shrink-0" />
              <span>{existingClassId ? 'Edit Class' : 'Add Class'}</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('note_cover')}
              className={`flex-1 py-2 px-1.5 text-xs font-bold flex items-center justify-center gap-1 border-b-2 cursor-pointer ${
                adminTab === 'note_cover'
                  ? 'border-[#2F6F4E] text-[#2F6F4E] bg-white'
                  : 'border-transparent text-[#4A5268] hover:text-[#1C2333]'
              }`}
            >
              <StickyNote className="w-3.5 h-3.5 shrink-0" />
              <span>Notes & Cover{currentSlotNotes.length > 0 ? ` (${currentSlotNotes.length})` : ''}</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('quick_assign')}
              className={`flex-1 py-2 px-1.5 text-xs font-bold flex items-center justify-center gap-1 border-b-2 cursor-pointer ${
                adminTab === 'quick_assign'
                  ? 'border-[#2F6F4E] text-[#2F6F4E] bg-white'
                  : 'border-transparent text-[#4A5268] hover:text-[#1C2333]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span>Quick Assign</span>
            </button>
          </div>

          <div className="p-3.5">
            {/* TAB 1: ADD LESSON */}
            {adminTab === 'add_lesson' && (
              <form onSubmit={handleAddLesson} className="space-y-3">
                {/* Lesson Type Toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewLessonType('withdrawal');
                      if (!lessonSubject || inclassSuggestions.includes(lessonSubject)) {
                        setLessonSubject('Literacy Intervention');
                      }
                      if (!lessonRoom) setLessonRoom('SEN 1');
                    }}
                    className={`py-2 px-2.5 rounded border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      newLessonType === 'withdrawal'
                        ? 'bg-[#EBF5FB] border-[#2A6FA8] text-[#2A6FA8] ring-1 ring-[#2A6FA8]'
                        : 'bg-white border-[#DCDFE4] text-[#4A5268] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>Withdrawal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewLessonType('lesson');
                      if (!lessonSubject || withdrawalSuggestions.includes(lessonSubject)) {
                        setLessonSubject('Mathematics');
                      }
                    }}
                    className={`py-2 px-2.5 rounded border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      newLessonType === 'lesson'
                        ? 'bg-[#E4F0EA] border-[#2F6F4E] text-[#2F6F4E] ring-1 ring-[#2F6F4E]'
                        : 'bg-white border-[#DCDFE4] text-[#4A5268] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>In-Class</span>
                  </button>
                </div>

                {/* Student */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#1C2333]">Student</label>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setStudentInputMode('existing')}
                        className={`text-[11px] font-semibold cursor-pointer ${
                          studentInputMode === 'existing' ? 'text-[#2F6F4E] underline' : 'text-[#64748B]'
                        }`}
                      >
                        Existing
                      </button>
                      <span className="text-[#CBD5E1]">|</span>
                      <button
                        type="button"
                        onClick={() => setStudentInputMode('new')}
                        className={`text-[11px] font-semibold cursor-pointer ${
                          studentInputMode === 'new' ? 'text-[#2F6F4E] underline' : 'text-[#64748B]'
                        }`}
                      >
                        + New Student
                      </button>
                    </div>
                  </div>

                  {studentInputMode === 'existing' ? (
                    <select
                      value={lessonStudent}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLessonStudent(val);
                        if (val) {
                          const activeSid =
                            isPaired && slotA && slotB && targetMode === 'slotB'
                              ? slotB.id
                              : slotA?.id || slotId;
                          const existingEnt = store.entries.find(
                            (ent) =>
                              ent.student === val &&
                              ent.day === targetDay &&
                              ent.slotId === activeSid
                          );
                          if (existingEnt?.subject) {
                            setLessonSubject(existingEnt.subject);
                            setLessonRoom(existingEnt.room || '');
                            setLessonTeacher(existingEnt.teacher || '');
                            setNewLessonType(existingEnt.lessonType || 'lesson');
                          }
                        }
                      }}
                      className="w-full text-xs px-2.5 py-2 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                    >
                      <option value="">-- Select student --</option>
                      {store.students.map((stu) => (
                        <option key={stu} value={stu}>
                          {stu}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      placeholder="Student full name"
                      className="w-full text-xs px-2.5 py-2 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                    />
                  )}
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-[#1C2333] mb-1">Subject</label>
                  <input
                    type="text"
                    value={lessonSubject}
                    onChange={(e) => setLessonSubject(e.target.value)}
                    placeholder={newLessonType === 'withdrawal' ? 'e.g. Literacy Intervention' : 'e.g. Mathematics'}
                    className="w-full text-xs px-2.5 py-2 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E] mb-1.5"
                  />
                  <div className="flex flex-wrap gap-1">
                    {(newLessonType === 'withdrawal' ? withdrawalSuggestions : inclassSuggestions).map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setLessonSubject(sug)}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded cursor-pointer border ${
                          lessonSubject === sug
                            ? 'bg-[#1C2333] text-white border-[#1C2333]'
                            : 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0] hover:bg-[#E2E8F0]'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Room & Teacher */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#1C2333] mb-1">
                      Room <span className="font-normal text-[#64748B]">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={lessonRoom}
                      onChange={(e) => setLessonRoom(e.target.value)}
                      placeholder="e.g. SEN 1"
                      className="w-full text-xs px-2.5 py-1.5 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1C2333] mb-1">
                      Teacher <span className="font-normal text-[#64748B]">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={lessonTeacher}
                      onChange={(e) => setLessonTeacher(e.target.value)}
                      placeholder="e.g. Class teacher"
                      className="w-full text-xs px-2.5 py-1.5 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                    />
                  </div>
                </div>

                {/* 80-Minute Merge Toggle */}
                {isPaired && slotA && slotB && (
                  <label className="flex items-center gap-2 p-2 rounded bg-[#F0F7F4] border border-[#C3DFD1] text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
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

                {/* Live Double-Booking Warning */}
                {Boolean(activeAddStudentName) && addLessonOverlaps.length > 0 && (
                  <div className="p-2.5 rounded bg-[#FBE6E4] border border-[#f5c6cb] text-[#B23A31] text-xs space-y-0.5">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Conflict Warning: {staffName} is already scheduled</span>
                    </div>
                    {addLessonOverlaps.map((item, idx) => (
                      <div key={idx} className="text-[11px]">
                        • {item}
                      </div>
                    ))}
                  </div>
                )}

                {/* Shared Lesson Info Notice */}
                {Boolean(activeAddStudentName) && addLessonShared.length > 0 && addLessonOverlaps.length === 0 && (
                  <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-0.5">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Shared Lesson Support (No Conflict)</span>
                    </div>
                    {addLessonShared.map((item, idx) => (
                      <div key={idx} className="text-[11px] text-emerald-700">
                        • {item}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!activeAddStudentName}
                  className={`w-full py-2 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    activeAddStudentName
                      ? newLessonType === 'withdrawal'
                        ? 'bg-[#2A6FA8] hover:bg-[#205785] text-white'
                        : 'bg-[#2F6F4E] hover:bg-[#255c40] text-white'
                      : 'bg-[#EAECEF] text-[#4A5268] cursor-not-allowed'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>
                    Add {newLessonType === 'withdrawal' ? 'Withdrawal' : 'In-Class'} Lesson
                    {isPaired && targetMode === 'both' ? ' (80m)' : ''}
                  </span>
                </button>

                {lessonSuccessMsg && (
                  <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{lessonSuccessMsg}</span>
                  </div>
                )}
              </form>
            )}

            {/* TAB 2: ADD / EDIT CLASS (MULTIPLE STUDENTS — STAFF AS TEACHER) */}
            {adminTab === 'add_class' && (
              <form onSubmit={handleSaveClass} className="space-y-3">
                <div className="p-2 rounded bg-[#FFFBEB] border border-[#FDE68A] text-[11px] text-[#78350F] space-y-1">
                  <div>
                    <strong>{staffName}</strong> is assigned as <strong>Teacher</strong> for this class. No conflict is triggered for the teacher or support staff within this class.
                  </div>
                  {newLessonType === 'withdrawal' && (
                    <div className="text-[10.5px] text-[#92400E]">
                      Note: A <strong>Withdrawal Class</strong> applies to 2 or more students. 1 student will be saved as an individual 1:1 withdrawal lesson.
                    </div>
                  )}
                </div>

                {/* Lesson Type Toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewLessonType('withdrawal');
                      if (!lessonSubject || inclassSuggestions.includes(lessonSubject)) {
                        setLessonSubject('Literacy Intervention');
                      }
                      if (!lessonRoom) setLessonRoom('SEN 1');
                    }}
                    className={`py-2 px-2.5 rounded border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      newLessonType === 'withdrawal'
                        ? 'bg-[#EBF5FB] border-[#2A6FA8] text-[#2A6FA8] ring-1 ring-[#2A6FA8]'
                        : 'bg-white border-[#DCDFE4] text-[#4A5268] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>Withdrawal Class</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewLessonType('lesson');
                      if (!lessonSubject || withdrawalSuggestions.includes(lessonSubject)) {
                        setLessonSubject('Mathematics');
                      }
                    }}
                    className={`py-2 px-2.5 rounded border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      newLessonType === 'lesson'
                        ? 'bg-[#E4F0EA] border-[#2F6F4E] text-[#2F6F4E] ring-1 ring-[#2F6F4E]'
                        : 'bg-white border-[#DCDFE4] text-[#4A5268] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>In-Class Group</span>
                  </button>
                </div>

                {/* Students in Class Multi-Select */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#1C2333] flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#B45309]" />
                      <span>Students in Class ({classStudents.length} selected)</span>
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setClassStudents([...allAvailableClassStudents])}
                        className="font-semibold text-[#92400E] hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-[#CBD5E1]">|</span>
                      <button
                        type="button"
                        onClick={() => setClassStudents([])}
                        className="font-semibold text-[#64748B] hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {allAvailableClassStudents.length === 0 ? (
                    <p className="text-[11px] text-[#64748B] italic">
                      No students in roster yet. Add a student below.
                    </p>
                  ) : (
                    <div className="max-h-32 overflow-y-auto grid grid-cols-2 gap-1.5 p-1.5 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                      {allAvailableClassStudents.map((stu) => {
                        const checked = classStudents.includes(stu);
                        return (
                          <button
                            key={stu}
                            type="button"
                            onClick={() => toggleClassStudent(stu)}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-left text-xs font-medium border transition-all cursor-pointer truncate ${
                              checked
                                ? 'bg-[#FEF3C7] border-[#F59E0B] text-[#78350F] font-semibold'
                                : 'bg-white border-[#E2E8F0] text-[#334155] hover:bg-white'
                            }`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded-xs flex items-center justify-center shrink-0 border ${
                                checked
                                  ? 'bg-[#D97706] border-[#D97706] text-white'
                                  : 'border-[#CBD5E1] bg-white'
                              }`}
                            >
                              {checked && <Check className="w-2.5 h-2.5" />}
                            </span>
                            <span className="truncate">{stu}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Quick add new student to class */}
                  <div className="flex gap-1.5 pt-0.5">
                    <input
                      type="text"
                      value={classNewStudentInput}
                      onChange={(e) => setClassNewStudentInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewStudentToClass();
                        }
                      }}
                      placeholder="Add new student name to class..."
                      className="flex-1 text-xs px-2.5 py-1.5 border border-[#DCDFE4] rounded bg-white text-[#1C2333] focus:outline-none focus:ring-1 focus:ring-[#D97706]"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewStudentToClass}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded bg-[#92400E] text-white hover:bg-[#78350F] cursor-pointer shrink-0"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {/* Class / Subject Name */}
                <div>
                  <label className="block text-xs font-semibold text-[#1C2333] mb-1">
                    Class / Subject Name
                  </label>
                  <input
                    type="text"
                    value={lessonSubject}
                    onChange={(e) => setLessonSubject(e.target.value)}
                    placeholder={newLessonType === 'withdrawal' ? 'e.g. Literacy Intervention' : 'e.g. Mathematics'}
                    className="w-full text-xs px-2.5 py-2 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E] mb-1.5"
                  />
                  <div className="flex flex-wrap gap-1">
                    {(newLessonType === 'withdrawal' ? withdrawalSuggestions : inclassSuggestions).map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setLessonSubject(sug)}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded cursor-pointer border ${
                          lessonSubject === sug
                            ? 'bg-[#1C2333] text-white border-[#1C2333]'
                            : 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0] hover:bg-[#E2E8F0]'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Room & Support Staff for Class */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#1C2333] mb-1">
                      Room <span className="font-normal text-[#64748B]">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={lessonRoom}
                      onChange={(e) => setLessonRoom(e.target.value)}
                      placeholder="e.g. SEN 1"
                      className="w-full text-xs px-2.5 py-1.5 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1C2333] mb-1">
                      Support Staff <span className="font-normal text-[#64748B]">(optional)</span>
                    </label>
                    <select
                      value={classSupportStaff}
                      onChange={(e) => setClassSupportStaff(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                    >
                      <option value="">-- Teacher only --</option>
                      {store.lsaPool
                        .filter((p) => p.name !== staffName)
                        .map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* 80-Minute Merge Toggle for Class */}
                {isPaired && slotA && slotB && (
                  <label className="flex items-center gap-2 p-2 rounded bg-[#FFFBEB] border border-[#FDE68A] text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={targetMode === 'both'}
                      onChange={(e) =>
                        handleSwitchTargetMode(
                          e.target.checked ? 'both' : clickedSlot?.id === slotB.id ? 'slotB' : 'slotA'
                        )
                      }
                      className="rounded border-[#D97706] text-[#B45309] focus:ring-[#D97706] w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="font-semibold text-[#78350F]">
                      80-minute class — merge {slotA.label} &amp; {slotB.label} ({slotA.start}–{slotB.end})
                    </span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={classStudents.length === 0}
                  className={`w-full py-2 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    classStudents.length > 0
                      ? 'bg-[#B45309] hover:bg-[#92400E] text-white'
                      : 'bg-[#EAECEF] text-[#4A5268] cursor-not-allowed'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>
                    {existingClassId ? 'Update Class' : 'Add Class'} ({classStudents.length} student{classStudents.length !== 1 ? 's' : ''})
                    {isPaired && targetMode === 'both' ? ' · 80m' : ''}
                  </span>
                </button>

                {classSuccessMsg && (
                  <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{classSuccessMsg}</span>
                  </div>
                )}
              </form>
            )}

            {/* TAB 2: NOTES & COVER */}
            {adminTab === 'note_cover' && (
              <div className="space-y-3.5">
                {/* 1. Existing Notes for this slot */}
                {currentSlotNotes.length > 0 && (
                  <div className="space-y-2 pb-3 border-b border-[#EAECEF]">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#4A5268] flex items-center gap-1.5">
                        <StickyNote className="w-3.5 h-3.5 text-[#D97706]" />
                        <span>Existing Notes ({currentSlotNotes.length})</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearAllNotes}
                        className="text-[11px] text-[#DC2626] hover:text-[#991B1B] flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <Trash2 className="w-3 h-3" /> Clear All
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                      {currentSlotNotes.map((n, idx) => {
                        const isBeingEdited = editingNoteId === n.id;
                        const isGreen = n.highlight && n.highlightColor === 'green';
                        const isBlue = n.highlight && n.highlightColor === 'blue';
                        const isYellow = n.highlight && (!n.highlightColor || n.highlightColor === 'yellow');

                        const cardBorderBg = isBeingEdited
                          ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400'
                          : n.isCover
                          ? 'bg-[#FEF9C3]/70 border-[#FDE047]'
                          : isGreen
                          ? 'bg-[#DCFCE7] border-[#86EFAC]'
                          : isBlue
                          ? 'bg-[#E0F2FE] border-[#7DD3FC]'
                          : isYellow
                          ? 'bg-[#FEF9C3]/70 border-[#FDE047]'
                          : 'bg-[#F8FAFC] border-[#E2E8F0]';

                        return (
                          <div
                            key={n.id || `cn-${idx}`}
                            className={`p-2.5 rounded border transition-all text-xs flex items-start justify-between gap-2 ${cardBorderBg}`}
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isStaffMentionedInNote(n, staffName) && (
                                  <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded uppercase bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-0.5">
                                    <AtSign className="w-2.5 h-2.5 text-purple-700" /> Mention from {n.staffName}
                                  </span>
                                )}
                                {n.mentionedStaff && n.mentionedStaff.length > 0 && (
                                  <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded uppercase bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-0.5" title={`Mentions: ${n.mentionedStaff.join(', ')}`}>
                                    <AtSign className="w-2.5 h-2.5 text-purple-600" /> @{n.mentionedStaff.join(', @')}
                                  </span>
                                )}
                                {n.isCover && (
                                  <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded uppercase bg-[#FEE2E2] text-[#991C1C] border border-[#FECACA]">
                                    Cover: {n.coveredBy || 'Pending'}
                                  </span>
                                )}
                                {n.highlight && (
                                  <span
                                    className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded uppercase border ${
                                      isGreen
                                        ? 'bg-[#86EFAC] text-[#14532D] border-[#22C55E]'
                                        : isBlue
                                        ? 'bg-[#7DD3FC] text-[#0C4A6E] border-[#0284C7]'
                                        : 'bg-[#FEF08A] text-[#854D0E] border-[#FACC15]'
                                    }`}
                                  >
                                    {isGreen ? 'Bright Green' : isBlue ? 'Sky Blue' : 'Yellow'} Highlight
                                  </span>
                                )}
                                {n.bold && (
                                  <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded uppercase bg-slate-200 text-slate-800">
                                    Bold
                                  </span>
                                )}
                                {(n.position === 'top' || n.pinToTop) && (
                                  <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded uppercase bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-0.5">
                                    <ArrowUpToLine className="w-2.5 h-2.5 text-blue-700" /> Top
                                  </span>
                                )}
                                {n.keepIndefinitely ? (
                                  <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5">
                                    <Pin className="w-2.5 h-2.5 text-emerald-700" /> Keep Indefinitely
                                  </span>
                                ) : (
                                  <span className="text-[9.5px] font-semibold px-1.5 py-0.2 rounded uppercase bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5 text-amber-600" /> Auto-deletes today
                                  </span>
                                )}
                                {isBeingEdited && (
                                  <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded uppercase bg-amber-200 text-amber-900 animate-pulse">
                                    Editing
                                  </span>
                                )}
                              </div>
                              <div className={`text-[#DC2626] ${n.bold ? 'font-bold' : ''}`}>
                                {n.text ? <FormattedNoteText text={n.text} /> : <span className="italic text-[#EF4444]/60">(No text)</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleStartEditNote(n)}
                                className={`p-1 rounded cursor-pointer transition-colors ${
                                  isBeingEdited
                                    ? 'bg-amber-300 text-amber-950 font-bold'
                                    : 'text-[#4A5268] hover:text-[#1C2333] hover:bg-slate-200'
                                }`}
                                title="Edit this note"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSingleNote(n)}
                                className="p-1 rounded text-[#DC2626] hover:text-[#991B1B] hover:bg-red-50 cursor-pointer transition-colors"
                                title="Delete this note"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Add / Edit Note Form */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1C2333] flex items-center gap-1.5">
                      {editingNoteId ? (
                        <>
                          <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                          <span>Edit Note</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 text-[#2F6F4E]" />
                          <span>Add New Note</span>
                        </>
                      )}
                    </span>
                    {editingNoteId && (
                      <button
                        type="button"
                        onClick={handleCancelEditNote}
                        className="text-[11px] font-semibold text-[#64748B] hover:text-[#1C2333] cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  {/* Note textarea with @ Mention capability */}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-[#4A5268] flex items-center gap-1">
                        Note Text <span className="font-normal text-[#64748B]">(Type @ to mention staff)</span>
                      </label>
                      <div className="relative" ref={mentionPickerRef}>
                        <button
                          type="button"
                          onClick={() => setIsMentionPickerOpen(!isMentionPickerOpen)}
                          className="text-[11px] font-medium text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1 cursor-pointer transition-colors"
                          title="Mention a staff member to display this note on their schedule"
                        >
                          <AtSign className="w-3 h-3 text-purple-600" />
                          <span>@ Mention Staff</span>
                        </button>

                        {/* Quick staff mention picker dropdown */}
                        {isMentionPickerOpen && (
                          <div className="absolute right-0 mt-1 w-52 max-h-48 overflow-y-auto bg-white rounded-md shadow-xl border border-purple-200 z-50 py-1 text-xs">
                            <div className="px-2.5 py-1 text-[10px] font-bold uppercase text-purple-700 border-b border-purple-100">
                              Mention a staff member
                            </div>
                            {allSchoolStaff.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => handleInsertMention(s.name)}
                                className="w-full text-left px-2.5 py-1.5 hover:bg-purple-50 flex items-center justify-between cursor-pointer"
                              >
                                <span className="font-medium text-[#1E293B] truncate">{s.name}</span>
                                <span className="text-[9px] font-mono text-purple-600 uppercase ml-1 shrink-0">
                                  {s.roleType === 'support' ? 'Support' : 'Teacher'}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <textarea
                      ref={textareaRef}
                      value={noteText}
                      onChange={handleNoteTextChange}
                      rows={2}
                      placeholder="e.g. Absent today, please check with @Ms Kaur, sensory room..."
                      className={`w-full text-xs px-2.5 py-1.5 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E] text-[#DC2626] font-medium ${
                        noteBold ? 'font-bold' : ''
                      }`}
                    />

                    {/* Inline @ Mention autocomplete suggestions */}
                    {mentionQuery !== null && mentionSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white rounded-md shadow-xl border border-purple-300 z-50 py-1 text-xs">
                        <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-800 bg-purple-50 border-b border-purple-100 flex items-center gap-1">
                          <AtSign className="w-3 h-3 text-purple-600" />
                          <span>Matching Staff ({mentionSuggestions.length})</span>
                        </div>
                        {mentionSuggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleInsertMention(s.name)}
                            className="w-full text-left px-3 py-1.5 hover:bg-purple-50 flex items-center justify-between cursor-pointer border-b border-slate-50 last:border-0"
                          >
                            <span className="font-semibold text-[#1E293B]">@{s.name}</span>
                            <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                              {s.roleType === 'support' ? 'Supporting Staff' : 'Teacher'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Formatting & Controls Options */}
                  <div className="space-y-2 bg-[#F8FAFC] p-2.5 rounded-md border border-[#E2E8F0]">
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Bold font option */}
                      <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer select-none text-[#1C2333]">
                        <input
                          type="checkbox"
                          checked={noteBold}
                          onChange={(e) => setNoteBold(e.target.checked)}
                          className="rounded border-[#9CA3AF] text-[#1C2333] focus:ring-[#1C2333] h-4 w-4 cursor-pointer"
                        />
                        <span className="flex items-center gap-0.5">
                          <Bold className="w-3.5 h-3.5" />
                          <span>Bold Font</span>
                        </span>
                      </label>

                      {/* Highlight cell */}
                      <label
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold select-none ${
                          isCover ? 'opacity-60 cursor-not-allowed text-[#4B5563]' : 'cursor-pointer text-[#1F2937]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isCover ? true : highlight}
                          disabled={isCover}
                          onChange={(e) => setHighlight(e.target.checked)}
                          className="rounded border-[#9CA3AF] text-[#DC2626] focus:ring-[#DC2626] h-4 w-4 cursor-pointer"
                        />
                        <span>Highlight cell</span>
                      </label>

                      {/* Put note at top of slot */}
                      <label
                        className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none text-[#1F2937]"
                        title="Display this note at the top of the selected slot above the student's name on the schedule"
                      >
                        <input
                          type="checkbox"
                          checked={positionTop}
                          onChange={(e) => setPositionTop(e.target.checked)}
                          className="rounded border-[#9CA3AF] text-[#2563EB] focus:ring-[#2563EB] h-4 w-4 cursor-pointer"
                        />
                        <span className="flex items-center gap-1 text-[#1C2333]">
                          <ArrowUpToLine className="w-3.5 h-3.5 text-[#2563EB]" />
                          <span>Put note at top of slot (above students name)</span>
                        </span>
                      </label>

                      {/* Keep Indefinitely tickbox */}
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none text-[#1F2937]">
                        <input
                          type="checkbox"
                          checked={keepIndefinitely}
                          onChange={(e) => setKeepIndefinitely(e.target.checked)}
                          className="rounded border-[#9CA3AF] text-[#2F6F4E] focus:ring-[#2F6F4E] h-4 w-4 cursor-pointer"
                        />
                        <span className="flex items-center gap-1 text-[#1C2333]">
                          <Pin className="w-3.5 h-3.5 text-[#2F6F4E]" />
                          <span>Keep indefinitely</span>
                        </span>
                      </label>

                      {/* Assign cover */}
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none text-[#1F2937]">
                        <input
                          type="checkbox"
                          checked={isCover}
                          onChange={(e) => handleCoverToggle(e.target.checked)}
                          className="rounded border-[#9CA3AF] text-[#DC2626] focus:ring-[#DC2626] h-4 w-4 cursor-pointer"
                        />
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-[#DC2626] text-white">
                          Assign Cover
                        </span>
                      </label>
                    </div>

                    {/* Expiration status info banner */}
                    <div className="text-[11px] px-2.5 py-1.5 rounded bg-white border border-[#E2E8F0] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {keepIndefinitely ? (
                          <>
                            <Pin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="text-emerald-800 font-medium">
                              <strong>Permanent note:</strong> Kept indefinitely until manually deleted.
                            </span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="text-slate-600">
                              <strong>Daily note:</strong> Auto-deleted at the end of the day (3:10 PM Mon–Thu / 12:00 PM Fri).
                            </span>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] text-[#94A3B8] italic shrink-0">
                        {keepIndefinitely ? 'No auto-reset' : 'Auto-resets'}
                      </span>
                    </div>

                    {/* Highlight colour picker (shown when highlight is enabled and not a cover note) */}
                    {(isCover ? false : highlight) && (
                      <div className="flex items-center gap-2 pt-2 border-t border-[#E2E8F0] flex-wrap">
                        <span className="text-[11px] font-semibold text-[#4A5268]">Highlight Colour:</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Yellow */}
                          <button
                            type="button"
                            onClick={() => setHighlightColor('yellow')}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                              highlightColor === 'yellow'
                                ? 'bg-[#FEF08A] text-[#854D0E] ring-2 ring-[#EAB308] shadow-xs'
                                : 'bg-[#FEF9C3] text-[#A16207] hover:bg-[#FEF08A] opacity-75'
                            }`}
                          >
                            <span className="w-2.5 h-2.5 rounded-full bg-[#EAB308] border border-[#CA8A04] shrink-0" />
                            <span>Yellow</span>
                          </button>

                          {/* Bright Green */}
                          <button
                            type="button"
                            onClick={() => setHighlightColor('green')}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                              highlightColor === 'green'
                                ? 'bg-[#86EFAC] text-[#14532D] ring-2 ring-[#22C55E] shadow-xs'
                                : 'bg-[#DCFCE7] text-[#166534] hover:bg-[#86EFAC] opacity-75'
                            }`}
                          >
                            <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] border border-[#16A34A] shrink-0" />
                            <span>Bright Green</span>
                          </button>

                          {/* Sky Blue */}
                          <button
                            type="button"
                            onClick={() => setHighlightColor('blue')}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                              highlightColor === 'blue'
                                ? 'bg-[#7DD3FC] text-[#0C4A6E] ring-2 ring-[#0284C7] shadow-xs'
                                : 'bg-[#E0F2FE] text-[#0369A1] hover:bg-[#7DD3FC] opacity-75'
                            }`}
                          >
                            <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8] border border-[#0284C7] shrink-0" />
                            <span>Sky Blue</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cover Staff Selector */}
                  {isCover && (
                    <div className="space-y-2 pt-1 bg-[#FFFDF5] p-2.5 rounded-md border border-[#FDE68A]" ref={dropdownRef}>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-[#1F2937]">
                          Cover Staff Member
                        </label>
                        {coveredBy && (
                          <button
                            type="button"
                            onClick={() => handleSelectStaffCandidate('')}
                            className="text-[11px] text-[#DC2626] hover:text-[#991B1B] font-semibold cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            <span>Clear Cover</span>
                          </button>
                        )}
                      </div>

                      {/* Filter Search Input */}
                      {candidateStaffList.length > 4 && (
                        <div className="relative">
                          <input
                            type="text"
                            value={coverSearchTerm}
                            onChange={(e) => setCoverSearchTerm(e.target.value)}
                            placeholder="Filter staff by name..."
                            className="w-full text-xs px-2.5 py-1 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#2F6F4E]"
                          />
                          {coverSearchTerm && (
                            <button
                              type="button"
                              onClick={() => setCoverSearchTerm('')}
                              className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}

                      {/* Main Cover Staff Dropdown */}
                      <div>
                        <select
                          id="cover-staff-select"
                          value={coveredBy}
                          onChange={(e) => handleSelectStaffCandidate(e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-[#DCDFE4] rounded-md bg-white font-medium text-[#1C2333] focus:outline-none focus:ring-2 focus:ring-[#2F6F4E] cursor-pointer"
                        >
                          <option value="">-- Select cover staff member --</option>
                          {candidateSupportingStaff.length > 0 && (
                            <optgroup label="Supporting Staff (LSAs)">
                              {candidateSupportingStaff.map((staff) => {
                                const status = getStaffSlotStatus(staff.name);
                                return (
                                  <option key={staff.id} value={staff.name}>
                                    {staff.name} {status.isFree ? '— [Free]' : `— [Booked: ${status.details[0] || 'Lesson'}]`}
                                  </option>
                                );
                              })}
                            </optgroup>
                          )}
                          {candidateTeachers.length > 0 && (
                            <optgroup label="Teachers">
                              {candidateTeachers.map((staff) => {
                                const status = getStaffSlotStatus(staff.name);
                                return (
                                  <option key={staff.id} value={staff.name}>
                                    {staff.name} {status.isFree ? '— [Free]' : `— [Teaching/Busy: ${status.details[0] || 'Lesson'}]`}
                                  </option>
                                );
                              })}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      {/* Selected cover staff status banner */}
                      {coveredBy && (
                        <div className="flex items-center justify-between text-xs pt-0.5">
                          {(() => {
                            const status = getStaffSlotStatus(coveredBy);
                            return status.isFree ? (
                              <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{coveredBy} is <strong>Free</strong> for this period ({status.duration})</span>
                              </div>
                            ) : (
                              <div className="text-[11px] font-semibold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-1 rounded flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>Notice: {coveredBy} has existing duties ({status.details.join(', ')})</span>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Conflict Notification Banner when staff member has another lesson */}
                      {coveredBy && pendingCandidateStatus && !pendingCandidateStatus.isFree && (
                        <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-md text-xs space-y-1.5">
                          <div className="flex items-start gap-2 text-amber-900">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-bold">
                                Schedule Notice: {coveredBy} has an existing lesson
                              </div>
                              <div className="text-[11px] text-amber-800 mt-0.5">
                                {pendingCandidateStatus.slotLabel}: {pendingCandidateStatus.details.join(', ')}
                              </div>
                              <div className="text-[10.5px] text-amber-900 mt-0.5 font-medium">
                                Assigned as cover with conflict override.
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleCancelConflict}
                              className="px-2 py-0.5 text-[11px] font-semibold rounded border border-amber-300 bg-white text-amber-900 hover:bg-amber-100 cursor-pointer"
                            >
                              Clear Cover Staff
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveNote}
                        disabled={!noteText.trim() && !isCover}
                        className={`px-3.5 py-1.5 rounded text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors ${
                          noteText.trim() || isCover
                            ? editingNoteId
                              ? 'bg-amber-600 hover:bg-amber-700 text-white'
                              : 'bg-[#1C2333] hover:bg-[#2D3748] text-white'
                            : 'bg-[#EAECEF] text-[#94A3B8] cursor-not-allowed'
                        }`}
                      >
                        <StickyNote className="w-3.5 h-3.5 text-[#FEF08A]" />
                        <span>{editingNoteId ? 'Update Note' : '+ Add Note'}</span>
                      </button>
                      {editingNoteId && (
                        <button
                          type="button"
                          onClick={handleCancelEditNote}
                          className="px-2.5 py-1.5 rounded text-xs font-medium text-[#4A5268] hover:bg-slate-100 border border-[#DCDFE4] cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {(savedSuccess || noteSuccessMsg) && (
                      <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 animate-in fade-in">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{noteSuccessMsg || 'Saved'}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: QUICK ASSIGN */}
            {adminTab === 'quick_assign' && (
              <div className="space-y-3">
                {availableStudents.length === 0 ? (
                  <p className="text-xs text-[#4A5268] italic py-2">
                    All students are already assigned to this slot.
                  </p>
                ) : (
                  <form onSubmit={handleAssign} className="space-y-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#1C2333] mb-1">
                        Student
                      </label>
                      <select
                        value={selectedStudent}
                        onChange={(e) => setSelectedStudent(e.target.value)}
                        className="w-full text-xs px-2.5 py-2 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                      >
                        <option value="">-- Select student --</option>
                        {availableStudents.map((stu) => {
                          const checkSlotId =
                            isPaired && slotA && slotB && targetMode === 'slotB'
                              ? slotB.id
                              : slotA?.id || slotId;
                          const stuEntry = store.entries.find(
                            (e) => e.student === stu && e.day === targetDay && e.slotId === checkSlotId
                          );
                          const label = stuEntry?.subject
                            ? `${stu} (${stuEntry.subject}${stuEntry.room ? ` · Rm ${stuEntry.room}` : ''})`
                            : stu;
                          return (
                            <option key={stu} value={stu}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {isPaired && slotA && slotB && (
                      <label className="flex items-center gap-2 p-2 rounded bg-[#F0F7F4] border border-[#C3DFD1] text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={targetMode === 'both'}
                          onChange={(e) =>
                            handleSwitchTargetMode(
                              e.target.checked ? 'both' : clickedSlot?.id === slotB.id ? 'slotB' : 'slotA'
                            )
                          }
                          className="rounded border-[#2F6F4E] text-[#2F6F4E] focus:ring-[#2F6F4E] w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="font-semibold text-[#1C2333]">
                          80-minute support — merge {slotA.label} &amp; {slotB.label} ({slotA.start}–{slotB.end})
                        </span>
                      </label>
                    )}

                    {selectedStudent && quickAssignOverlaps.length > 0 && (
                      <div className="p-2.5 rounded bg-[#FBE6E4] border border-[#f5c6cb] text-[#B23A31] text-xs space-y-0.5">
                        <div className="font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Conflict Warning: {staffName} is already scheduled</span>
                        </div>
                        {quickAssignOverlaps.map((item, idx) => (
                          <div key={idx} className="text-[11px]">
                            • {item}
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedStudent && quickAssignShared.length > 0 && quickAssignOverlaps.length === 0 && (
                      <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-0.5">
                        <div className="font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Shared Lesson Support (No Conflict)</span>
                        </div>
                        {quickAssignShared.map((item, idx) => (
                          <div key={idx} className="text-[11px] text-emerald-700">
                            • {item}
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!selectedStudent}
                      className={`w-full py-2 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        selectedStudent
                          ? 'bg-[#2F6F4E] text-white hover:bg-[#255c40]'
                          : 'bg-[#EAECEF] text-[#4A5268] cursor-not-allowed'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Assign to Slot</span>
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-3 mt-3 border-t border-[#EAECEF]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] text-[#1C2333] hover:bg-[#F5F6F8] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
