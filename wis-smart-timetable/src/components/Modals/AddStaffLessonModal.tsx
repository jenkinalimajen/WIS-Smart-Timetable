import React, { useState, useEffect, useMemo } from 'react';
import { useTimetable } from '../../context/TimetableContext';
import { DayOfWeek } from '../../types';
import {
  DAY_FULL,
  DAYS,
  slotsFor,
  getGroupSiblingId,
  assignmentsForLsaSlot,
  filterActiveStaffNotes,
  normalizeTeacherKey,
} from '../../utils/timetable';
import {
  X,
  BookOpen,
  BookmarkCheck,
  User,
  Users,
  Clock,
  MapPin,
  CheckCircle2,
  Plus,
  AlertTriangle,
  GraduationCap,
  Check,
} from 'lucide-react';

interface AddStaffLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStaffName?: string;
  initialDay?: DayOfWeek;
  initialSlotId?: string;
  initialLessonType?: 'withdrawal' | 'lesson';
  initialMode?: 'lesson' | 'class';
}

const WITHDRAWAL_SUGGESTIONS = [
  'Literacy Intervention',
  'Numeracy Support',
  'Speech & Language',
  'Sensory Support',
  'Reading',
  'Maths Support',
  'Social Skills',
];

const INCLASS_SUGGESTIONS = [
  'Mathematics',
  'English',
  'Science',
  'History',
  'Art & Design',
  'Geography',
  'PE',
];

export const AddStaffLessonModal: React.FC<AddStaffLessonModalProps> = ({
  isOpen,
  onClose,
  initialStaffName,
  initialDay,
  initialSlotId,
  initialLessonType = 'withdrawal',
  initialMode = 'lesson',
}) => {
  const { store, currentDay, saveLessonAndSupport, saveStaffClass } = useTimetable();

  const [mode, setMode] = useState<'lesson' | 'class'>(initialMode);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(initialDay || currentDay);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [lessonType, setLessonType] = useState<'withdrawal' | 'lesson'>(initialLessonType);

  // Single student mode state
  const [studentInputMode, setStudentInputMode] = useState<'existing' | 'new'>('existing');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [newStudentName, setNewStudentName] = useState<string>('');

  // Multi-student Class mode state
  const [classStudents, setClassStudents] = useState<string[]>([]);
  const [classNewStudentInput, setClassNewStudentInput] = useState<string>('');
  const [classSupportStaff, setClassSupportStaff] = useState<string>('');
  const [existingClassId, setExistingClassId] = useState<string | undefined>(undefined);

  const [subject, setSubject] = useState<string>('Literacy Intervention');
  const [teacher, setTeacher] = useState<string>('');
  const [room, setRoom] = useState<string>('SEN 1');
  const [applyDoublePeriod, setApplyDoublePeriod] = useState<boolean>(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const slots = useMemo(() => slotsFor(selectedDay, store.schedule), [selectedDay, store.schedule]);
  const activeStaffNotes = useMemo(
    () => filterActiveStaffNotes(store.staffNotes || []),
    [store.staffNotes]
  );

  const siblingId = useMemo(
    () => (selectedSlotId ? getGroupSiblingId(selectedDay, selectedSlotId, store.schedule) : null),
    [selectedDay, selectedSlotId, store.schedule]
  );
  const isPaired = Boolean(siblingId);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      const staffDefault =
        initialStaffName || (store.lsaPool.length > 0 ? store.lsaPool[0].name : '');
      setSelectedStaff(staffDefault);

      const dayDefault = initialDay || currentDay;
      setSelectedDay(dayDefault);

      const daySlots = slotsFor(dayDefault, store.schedule);
      let slotDefault = initialSlotId || '';
      if (!slotDefault && daySlots.length > 0) {
        const freeLessonSlot = daySlots.find(
          (s) =>
            s.type !== 'fixed' &&
            (!staffDefault ||
              assignmentsForLsaSlot(
                staffDefault,
                dayDefault,
                s.id,
                store.students,
                store.entries,
                store.lsaAssignments,
                store.primarySupport || []
              ).length === 0)
        );
        const firstLessonSlot = daySlots.find((s) => s.type !== 'fixed');
        slotDefault = freeLessonSlot?.id || firstLessonSlot?.id || daySlots[0].id;
      }
      setSelectedSlotId(slotDefault);

      const initSibId = slotDefault
        ? getGroupSiblingId(dayDefault, slotDefault, store.schedule)
        : null;
      let shouldApplyDouble = true;
      if (initSibId && staffDefault) {
        const curAssigns = assignmentsForLsaSlot(
          staffDefault,
          dayDefault,
          slotDefault,
          store.students,
          store.entries,
          store.lsaAssignments,
          store.primarySupport || []
        );
        const sibAssigns = assignmentsForLsaSlot(
          staffDefault,
          dayDefault,
          initSibId,
          store.students,
          store.entries,
          store.lsaAssignments,
          store.primarySupport || []
        );
        if (curAssigns.length === 0 && sibAssigns.length > 0) {
          shouldApplyDouble = false;
        }
      }

      setLessonType(initialLessonType);
      if (initialLessonType === 'withdrawal') {
        setSubject('Literacy Intervention');
        setRoom('SEN 1');
      } else {
        setSubject('Mathematics');
        setRoom('');
      }

      setStudentInputMode('existing');
      setSelectedStudent('');
      setNewStudentName('');
      setClassStudents([]);
      setClassNewStudentInput('');
      setClassSupportStaff('');
      setExistingClassId(undefined);
      setTeacher('');
      setApplyDoublePeriod(shouldApplyDouble);
      setSuccessMsg(null);
    }
  }, [
    isOpen,
    initialMode,
    initialStaffName,
    initialDay,
    initialSlotId,
    initialLessonType,
    currentDay,
    store.lsaPool,
    store.schedule,
    store.students,
  ]);

  // If in 'class' mode and selectedStaff + selectedDay + selectedSlotId already has a Class for this teacher, pre-populate it
  useEffect(() => {
    if (!isOpen || mode !== 'class' || !selectedStaff || !selectedSlotId) return;
    const existingEntries = store.entries.filter(
      (e) =>
        e.day === selectedDay &&
        e.slotId === selectedSlotId &&
        e.classId &&
        e.teacher?.trim().toLowerCase() === selectedStaff.trim().toLowerCase()
    );
    if (existingEntries.length > 0) {
      const first = existingEntries[0];
      setExistingClassId(first.classId);
      setSubject(first.subject);
      setRoom(first.room || '');
      setLessonType(first.lessonType || 'lesson');
      setClassStudents(Array.from(new Set(existingEntries.map((e) => e.student))));
      const sup = store.lsaAssignments.find(
        (a) =>
          a.day === selectedDay &&
          a.slotId === selectedSlotId &&
          existingEntries.some((e) => e.student === a.student) &&
          a.lsa &&
          a.lsa !== '__NONE__'
      );
      setClassSupportStaff(sup?.lsa || '');
    } else {
      setExistingClassId(undefined);
    }
  }, [isOpen, mode, selectedStaff, selectedDay, selectedSlotId, store.entries, store.lsaAssignments]);

  const handleDayChange = (newDay: DayOfWeek) => {
    setSelectedDay(newDay);
    const daySlots = slotsFor(newDay, store.schedule);
    setSelectedSlotId(daySlots.length > 0 ? daySlots[0].id : '');
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

  const effectiveStudent =
    studentInputMode === 'new' ? newStudentName.trim() : selectedStudent.trim();

  // Live double-booking / conflict check for selectedStaff (and classSupportStaff in Class mode)
  const slotConflicts = useMemo(() => {
    if (!selectedStaff.trim() || !selectedSlotId) return [];
    const targetSlots =
      isPaired && applyDoublePeriod && siblingId
        ? [selectedSlotId, siblingId]
        : [selectedSlotId];

    const warnings: { staffLabel: string; slotLabel: string; details: string[] }[] = [];

    const checkStaffInSlot = (
      staffToCheck: string,
      roleLabel: string,
      exemptStudentsLower: Set<string>,
      exemptClassId?: string
    ) => {
      for (const sid of targetSlots) {
        const slotObj = slots.find((s) => s.id === sid);
        const slotLabel = slotObj ? `${slotObj.label} (${slotObj.start}–${slotObj.end})` : sid;
        const cleanTargetTeacher = teacher.replace(/\./g, '').trim().toLowerCase();
        const cleanTargetSubject = subject.trim().toLowerCase();

        const existingAssigns = assignmentsForLsaSlot(
          staffToCheck,
          selectedDay,
          sid,
          store.students,
          store.entries,
          store.lsaAssignments,
          store.primarySupport || []
        ).filter((a) => {
          if (exemptStudentsLower.has(a.student.trim().toLowerCase())) return false;
          if (exemptClassId && a.classId === exemptClassId) return false;

          const normTargetTeacher = normalizeTeacherKey(cleanTargetTeacher);
          const normATeacher = normalizeTeacherKey(a.teacher);

          // If same lesson with same teacher, no conflict!
          if (
            normTargetTeacher &&
            normATeacher &&
            normTargetTeacher === normATeacher
          ) {
            return false;
          }

          return true;
        });

        const coverDuties = activeStaffNotes.filter(
          (n) =>
            n.coveredBy?.trim().toLowerCase() === staffToCheck.trim().toLowerCase() &&
            n.day === selectedDay &&
            n.slotId === sid &&
            n.isCover
        );

        const details: string[] = [];
        existingAssigns.forEach((a) => {
          const ent = store.entries.find(
            (e) => e.student === a.student && e.day === selectedDay && e.slotId === sid
          );
          details.push(`${a.student}${ent?.subject ? ` (${ent.subject})` : ''}`);
        });
        coverDuties.forEach((c) => {
          details.push(`Covering ${c.staffName}${c.student ? ` (${c.student})` : ''}`);
        });

        if (details.length > 0) {
          warnings.push({ staffLabel: `${staffToCheck} (${roleLabel})`, slotLabel, details });
        }
      }
    };

    if (mode === 'lesson') {
      if (!effectiveStudent) return [];
      const exempt = new Set<string>([effectiveStudent.toLowerCase()]);
      checkStaffInSlot(selectedStaff, 'Support', exempt);
    } else {
      if (classStudents.length === 0) return [];
      // In Class mode, students in the class do NOT conflict with each other for the teacher or support staff
      const exempt = new Set<string>(classStudents.map((s) => s.trim().toLowerCase()));
      checkStaffInSlot(selectedStaff, 'Class Teacher', exempt, existingClassId);
      if (classSupportStaff.trim() && classSupportStaff.trim() !== '__NONE__') {
        checkStaffInSlot(classSupportStaff.trim(), 'Class Support', exempt, existingClassId);
      }
    }

    return warnings;
  }, [
    mode,
    selectedStaff,
    selectedSlotId,
    isPaired,
    applyDoublePeriod,
    siblingId,
    slots,
    selectedDay,
    store.students,
    store.entries,
    store.lsaAssignments,
    store.primarySupport,
    effectiveStudent,
    classStudents,
    classSupportStaff,
    existingClassId,
    activeStaffNotes,
  ]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveStaff = selectedStaff.trim();
    if (!effectiveStaff || !selectedSlotId) return;

    if (mode === 'class') {
      if (classStudents.length === 0) return;
      const effectiveSubject =
        subject.trim() ||
        (lessonType === 'withdrawal' ? 'Withdrawal Class' : 'Class Lesson');

      // A withdrawal class only applies to more than one student!
      if (classStudents.length === 1 && lessonType === 'withdrawal') {
        const singleStudent = classStudents[0];
        saveLessonAndSupport(singleStudent, selectedDay, selectedSlotId, {
          subject: effectiveSubject,
          teacher: effectiveStaff,
          room: room.trim(),
          lessonType: 'withdrawal',
          assignedStaff: classSupportStaff.trim() || undefined,
          applyToDoublePeriod: Boolean(isPaired && applyDoublePeriod),
          applyToSubject: false,
          classId: undefined,
          className: undefined,
        });

        setSuccessMsg(`Added 1:1 Withdrawal lesson for ${singleStudent}`);
        setTimeout(() => {
          onClose();
        }, 900);
        return;
      }

      saveStaffClass({
        teacherStaff: effectiveStaff,
        day: selectedDay,
        slotId: selectedSlotId,
        students: classStudents,
        subject: effectiveSubject,
        room: room.trim(),
        lessonType,
        supportStaff: classSupportStaff.trim(),
        applyToDoublePeriod: Boolean(isPaired && applyDoublePeriod),
        classId: existingClassId,
      });

      setSuccessMsg(
        `Saved class "${effectiveSubject}" with ${effectiveStaff} as Teacher (${classStudents.length} student${
          classStudents.length > 1 ? 's' : ''
        })`
      );

      setTimeout(() => {
        onClose();
      }, 900);
      return;
    }

    if (!effectiveStudent) return;

    const effectiveSubject =
      subject.trim() ||
      (lessonType === 'withdrawal' ? 'Withdrawal Support' : 'In-Class Support');

    saveLessonAndSupport(effectiveStudent, selectedDay, selectedSlotId, {
      subject: effectiveSubject,
      teacher: teacher.trim(),
      room: room.trim(),
      lessonType,
      assignedStaff: effectiveStaff,
      applyToDoublePeriod: Boolean(isPaired && applyDoublePeriod),
      applyToSubject: false,
      classId: undefined,
      className: undefined,
    });

    setSuccessMsg(
      `Added ${lessonType === 'withdrawal' ? 'Withdrawal' : 'In-Class'} lesson for ${effectiveStudent}`
    );

    if (studentInputMode === 'new') {
      setNewStudentName('');
      setStudentInputMode('existing');
    }

    setTimeout(() => {
      onClose();
    }, 900);
  };

  const isFormValid =
    Boolean(selectedStaff) &&
    Boolean(selectedSlotId) &&
    (mode === 'class' ? classStudents.length > 0 : Boolean(effectiveStudent));

  const allAvailableStudents = useMemo(() => {
    const set = new Set([...store.students, ...classStudents]);
    return Array.from(set).sort();
  }, [store.students, classStudents]);

  return (
    <div
      className="fixed inset-0 bg-[#141620]/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg w-full max-w-md p-5 shadow-xl border border-[#DCDFE4] my-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-[#EAECEF] mb-3">
          <h3 className="text-[16px] font-bold text-[#1C2333]">
            {mode === 'class' ? 'Add Class to Staff (Teacher)' : 'Add Lesson to Staff'}
          </h3>
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#1C2333] p-1 rounded-md hover:bg-[#F5F6F8] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher: Single Lesson vs Multi-Student Class */}
        <div className="grid grid-cols-2 gap-1.5 bg-[#F5F6F8] p-1 rounded-md border border-[#DCDFE4] mb-3.5">
          <button
            type="button"
            onClick={() => setMode('lesson')}
            className={`py-1.5 px-2.5 rounded text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              mode === 'lesson'
                ? 'bg-white text-[#1C2333] shadow-xs border border-[#DCDFE4]'
                : 'text-[#4A5268] hover:text-[#1C2333]'
            }`}
          >
            <User className="w-3.5 h-3.5 text-[#2F6F4E]" />
            <span>Single Lesson</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('class')}
            className={`py-1.5 px-2.5 rounded text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              mode === 'class'
                ? 'bg-[#FEF3C7] text-[#92400E] shadow-xs border border-[#FDE68A]'
                : 'text-[#4A5268] hover:text-[#1C2333]'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-[#B45309]" />
            <span>Class (Multiple Students)</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Staff & Lesson Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-[#1C2333] mb-1">
                {mode === 'class' ? 'Staff Member (Teacher)' : 'Staff Member'}
              </label>
              <div className="relative">
                <Users className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-2.5 pointer-events-none" />
                <select
                  id="add-lesson-staff-select"
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="w-full text-xs pl-8 pr-2.5 py-2 border border-[#DCDFE4] rounded bg-white text-[#1C2333] font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                  required
                >
                  {store.lsaPool.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C2333] mb-1">
                Lesson Type
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  id="btn-select-withdrawal"
                  onClick={() => {
                    setLessonType('withdrawal');
                    if (!subject || INCLASS_SUGGESTIONS.includes(subject)) {
                      setSubject('Literacy Intervention');
                    }
                    if (!room) setRoom('SEN 1');
                  }}
                  className={`py-2 px-2 rounded border text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                    lessonType === 'withdrawal'
                      ? 'bg-[#EBF5FB] border-[#2A6FA8] text-[#2A6FA8] ring-1 ring-[#2A6FA8]'
                      : 'bg-white border-[#DCDFE4] text-[#4A5268] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <BookmarkCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Withdrawal</span>
                </button>

                <button
                  type="button"
                  id="btn-select-inclass"
                  onClick={() => {
                    setLessonType('lesson');
                    if (!subject || WITHDRAWAL_SUGGESTIONS.includes(subject)) {
                      setSubject('Mathematics');
                    }
                  }}
                  className={`py-2 px-2 rounded border text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                    lessonType === 'lesson'
                      ? 'bg-[#E4F0EA] border-[#2F6F4E] text-[#2F6F4E] ring-1 ring-[#2F6F4E]'
                      : 'bg-white border-[#DCDFE4] text-[#4A5268] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span>In-Class</span>
                </button>
              </div>
            </div>
          </div>

          {/* Day & Time Slot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-[#1C2333] mb-1">Day</label>
              <select
                id="add-lesson-day-select"
                value={selectedDay}
                onChange={(e) => handleDayChange(e.target.value as DayOfWeek)}
                className="w-full text-xs px-2.5 py-2 border border-[#DCDFE4] rounded bg-white text-[#1C2333] focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {DAY_FULL[d]} ({d})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C2333] mb-1">Time Slot</label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-2.5 pointer-events-none" />
                <select
                  id="add-lesson-slot-select"
                  value={selectedSlotId}
                  onChange={(e) => setSelectedSlotId(e.target.value)}
                  className="w-full text-xs pl-8 pr-2.5 py-2 border border-[#DCDFE4] rounded bg-white text-[#1C2333] focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                  required
                >
                  {slots.map((s) => {
                    const existing = selectedStaff
                      ? assignmentsForLsaSlot(
                          selectedStaff,
                          selectedDay,
                          s.id,
                          store.students,
                          store.entries,
                          store.lsaAssignments,
                          store.primarySupport || []
                        )
                      : [];
                    const busyTag =
                      existing.length > 0
                        ? ` · Booked (${existing.map((a) => a.student).join(', ')})`
                        : '';
                    return (
                      <option key={s.id} value={s.id}>
                        {s.label} ({s.start}–{s.end}){busyTag}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {isPaired && (
            <label className="flex items-center gap-2 p-2 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={applyDoublePeriod}
                onChange={(e) => setApplyDoublePeriod(e.target.checked)}
                className="rounded border-[#CBD5E1] text-[#2F6F4E] focus:ring-[#2F6F4E] w-3.5 h-3.5"
              />
              <span className="font-medium text-[#1E293B]">
                Full 80-minute double period (both paired slots)
              </span>
            </label>
          )}

          {/* Student(s) Selection */}
          {mode === 'lesson' ? (
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
                  id="add-lesson-student-select"
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-[#DCDFE4] rounded bg-white text-[#1C2333] focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                  required
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
                  id="add-lesson-new-student-input"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="Student full name"
                  className="w-full text-xs px-3 py-2 border border-[#DCDFE4] rounded bg-white text-[#1C2333] focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                  autoFocus
                  required
                />
              )}
            </div>
          ) : (
            <div className="space-y-2 p-3 rounded-md bg-[#FFFBEB]/60 border border-[#FDE68A]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#92400E] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>Students in Class ({classStudents.length} selected)</span>
                </label>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setClassStudents([...allAvailableStudents])}
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

              {allAvailableStudents.length === 0 ? (
                <p className="text-[11px] text-[#64748B] italic">
                  No students in roster yet. Add a student below.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto grid grid-cols-2 gap-1.5 p-1.5 bg-white rounded border border-[#E2E8F0]">
                  {allAvailableStudents.map((stu) => {
                    const checked = classStudents.includes(stu);
                    return (
                      <button
                        key={stu}
                        type="button"
                        onClick={() => toggleClassStudent(stu)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-left text-xs font-medium border transition-all cursor-pointer truncate ${
                          checked
                            ? 'bg-[#FEF3C7] border-[#F59E0B] text-[#78350F] font-semibold'
                            : 'bg-white border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC]'
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
              <div className="flex gap-1.5 pt-1">
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
          )}

          {/* Subject & Quick Chips */}
          <div>
            <label className="block text-xs font-semibold text-[#1C2333] mb-1">
              {mode === 'class' ? 'Class / Subject Name' : 'Subject'}
            </label>
            <input
              type="text"
              id="add-lesson-subject-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={
                lessonType === 'withdrawal' ? 'e.g. Literacy Intervention' : 'e.g. Mathematics'
              }
              className="w-full text-xs px-3 py-2 border border-[#DCDFE4] rounded bg-white text-[#1C2333] focus:outline-none focus:ring-2 focus:ring-[#2F6F4E] mb-1.5"
            />
            <div className="flex flex-wrap gap-1">
              {(lessonType === 'withdrawal' ? WITHDRAWAL_SUGGESTIONS : INCLASS_SUGGESTIONS).map(
                (sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setSubject(sug)}
                    className={`text-[10px] font-medium px-2 py-0.5 rounded cursor-pointer transition-colors border ${
                      subject === sug
                        ? 'bg-[#1C2333] text-white border-[#1C2333]'
                        : 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0] hover:bg-[#E2E8F0]'
                    }`}
                  >
                    {sug}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Room & Teacher (or Class Support Staff in Class Mode) */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-[#1C2333] mb-1">
                Room <span className="font-normal text-[#64748B]">(optional)</span>
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="e.g. SEN 1"
                  className="w-full text-xs pl-8 pr-2.5 py-2 border border-[#DCDFE4] rounded bg-white text-[#1C2333] focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                />
              </div>
            </div>

            {mode === 'lesson' ? (
              <div>
                <label className="block text-xs font-semibold text-[#1C2333] mb-1">
                  Teacher <span className="font-normal text-[#64748B]">(optional)</span>
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={teacher}
                    onChange={(e) => setTeacher(e.target.value)}
                    placeholder="e.g. Class teacher"
                    className="w-full text-xs pl-8 pr-2.5 py-2 border border-[#DCDFE4] rounded bg-white text-[#1C2333] focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-[#1C2333] mb-1">
                  Support Staff <span className="font-normal text-[#64748B]">(optional)</span>
                </label>
                <select
                  value={classSupportStaff}
                  onChange={(e) => setClassSupportStaff(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-[#DCDFE4] rounded bg-white text-[#1C2333] focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
                >
                  <option value="">-- Teacher only --</option>
                  {store.lsaPool
                    .filter((p) => p.name !== selectedStaff)
                    .map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {mode === 'class' && (
            <div className="p-2 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#475569]">
              <strong>{selectedStaff}</strong> will be scheduled as the <strong>Teacher</strong> for all selected students in this class. No conflict is triggered for the teacher or support staff within this class.
            </div>
          )}

          {/* Double-Booking / Conflict Warning */}
          {slotConflicts.length > 0 && (
            <div className="p-2.5 rounded bg-[#FBE6E4] border border-[#f5c6cb] text-[#B23A31] text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#B23A31]" />
                <span>Schedule Conflict Outside This Lesson/Class</span>
              </div>
              <div className="text-[11px] space-y-0.5">
                {slotConflicts.map((c, i) => (
                  <div key={i}>
                    • <strong>{c.staffLabel} — {c.slotLabel}:</strong> already scheduled with {c.details.join(', ')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EAECEF]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] text-[#1C2333] hover:bg-[#F5F6F8] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-submit-add-lesson"
              disabled={!isFormValid}
              className={`px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer ${
                isFormValid
                  ? mode === 'class'
                    ? 'bg-[#B45309] hover:bg-[#92400E] text-white'
                    : lessonType === 'withdrawal'
                    ? 'bg-[#2A6FA8] hover:bg-[#205785] text-white'
                    : 'bg-[#2F6F4E] hover:bg-[#255c40] text-white'
                  : 'bg-[#EAECEF] text-[#8C95A6] cursor-not-allowed'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {mode === 'class'
                  ? existingClassId
                    ? `Update Class (${classStudents.length})`
                    : `Add Class (${classStudents.length})`
                  : 'Add Lesson'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


