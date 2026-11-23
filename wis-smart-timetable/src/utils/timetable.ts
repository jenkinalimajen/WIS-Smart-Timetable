import {
  DayOfWeek,
  TimeSlot,
  TimetableEntry,
  ScheduleOverrides,
  LsaAssignment,
  PrimarySupportAssignment,
  ActiveSupport,
  StaffAssignmentDetail,
  ConflictItem,
  Announcement,
  StaffSlotNote,
  StaffMember,
  StaffDesignation,
} from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function getStaffDesignation(member?: Pick<StaffMember, 'designation'> | null): StaffDesignation {
  return member?.designation === 'SEND' ? 'SEND' : 'LSA';
}

export function sortStaffPool(pool: StaffMember[]): StaffMember[] {
  return [...pool].sort((a, b) => {
    const rankA = getStaffDesignation(a) === 'LSA' ? 0 : 1;
    const rankB = getStaffDesignation(b) === 'LSA' ? 0 : 1;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name);
  });
}

export function getOrderedStaffNames(pool: StaffMember[]): string[] {
  return sortStaffPool(pool).map((p) => p.name);
}

export const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const DAY_FULL: Record<DayOfWeek, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
};

export const DEFAULT_SLOTS_WEEKDAY: TimeSlot[] = [
  { id: 'reg', label: 'Registration', start: '7:40', end: '7:50', type: 'fixed', defaultLabel: 'Registration' },
  { id: 'l1a', label: 'Lesson 1a', start: '7:50', end: '8:30', type: 'lesson', group: 'l1' },
  { id: 'l1b', label: 'Lesson 1b', start: '8:30', end: '9:10', type: 'lesson', group: 'l1' },
  { id: 'l2a', label: 'Lesson 2a', start: '9:10', end: '9:50', type: 'lesson', group: 'l2' },
  { id: 'l2b', label: 'Lesson 2b', start: '9:50', end: '10:30', type: 'lesson', group: 'l2' },
  { id: 'brk1', label: 'Break1 (Br1)', start: '10:30', end: '10:50', type: 'fixed', defaultLabel: 'Break1 (Br1)' },
  { id: 'brk2', label: 'Break2 (Br2)', start: '10:50', end: '11:10', type: 'fixed', defaultLabel: 'Break2 (Br2)' },
  { id: 'l3a', label: 'Lesson 3a', start: '11:10', end: '11:50', type: 'lesson', group: 'l3' },
  { id: 'l3b', label: 'Lesson 3b', start: '11:50', end: '12:30', type: 'lesson', group: 'l3' },
  { id: 'l4a', label: 'Lesson 4a', start: '12:30', end: '1:10', type: 'lesson', group: 'l4a', defaultLabel: 'Lunch 1' },
  { id: 'l4b', label: 'Lesson 4b', start: '1:10', end: '1:50', type: 'lesson', group: 'l4b', defaultLabel: 'Lunch 2' },
  { id: 'l5a', label: 'Lesson 5a', start: '1:50', end: '2:30', type: 'lesson', group: 'l5' },
  { id: 'l5b', label: 'Lesson 5b', start: '2:30', end: '3:10', type: 'lesson', group: 'l5' },
];

export const DEFAULT_SLOTS_FRIDAY: TimeSlot[] = [
  { id: 'reg', label: 'Registration', start: '7:40', end: '7:50', type: 'fixed', defaultLabel: 'Registration' },
  { id: 'l1a', label: 'Lesson 1a', start: '7:50', end: '8:30', type: 'lesson', group: 'l1' },
  { id: 'l1b', label: 'Lesson 1b', start: '8:30', end: '9:10', type: 'lesson', group: 'l1' },
  { id: 'l2', label: 'Lesson 2', start: '9:10', end: '9:50', type: 'lesson', group: 'l2f' },
  { id: 'brk', label: 'Break', start: '9:50', end: '10:10', type: 'fixed', defaultLabel: 'Break' },
  { id: 'l3a', label: 'Lesson 3a', start: '10:10', end: '10:50', type: 'lesson', group: 'l3' },
  { id: 'l3b', label: 'Lesson 3b', start: '10:50', end: '11:30', type: 'lesson', group: 'l3' },
];

export const MAX_ROWS = DEFAULT_SLOTS_WEEKDAY.length;

export const LESSON_TYPE_LABELS = {
  lesson: 'In-class lesson',
  withdrawal: 'Withdrawal lesson',
};

export function slotsFor(day: DayOfWeek, schedule?: ScheduleOverrides): TimeSlot[] {
  if (day === 'Fri' && schedule?.fridaySlots && Array.isArray(schedule.fridaySlots) && schedule.fridaySlots.length > 0) {
    return schedule.fridaySlots.map((s) => ({ ...s }));
  }
  if (day !== 'Fri' && schedule?.weekdaySlots && Array.isArray(schedule.weekdaySlots) && schedule.weekdaySlots.length > 0) {
    return schedule.weekdaySlots.map((s) => ({ ...s }));
  }
  const base = day === 'Fri' ? DEFAULT_SLOTS_FRIDAY : DEFAULT_SLOTS_WEEKDAY;
  const key = day === 'Fri' ? 'friday' : 'weekday';
  const overrides = (schedule && schedule[key]) || {};
  return base.map((s) => {
    const slot = overrides[s.id] ? Object.assign({}, s, overrides[s.id]) : { ...s };
    // Ensure Break 1 and Break 2 display the updated naming if prior generic "Break" was stored
    if (s.id === 'brk1' && (!overrides[s.id]?.label || overrides[s.id]?.label === 'Break')) {
      slot.label = 'Break1 (Br1)';
      slot.defaultLabel = 'Break1 (Br1)';
    } else if (s.id === 'brk2' && (!overrides[s.id]?.label || overrides[s.id]?.label === 'Break')) {
      slot.label = 'Break2 (Br2)';
      slot.defaultLabel = 'Break2 (Br2)';
    }
    return slot;
  });
}

export function getGroupSiblingId(day: DayOfWeek, slotId: string, schedule?: ScheduleOverrides): string | null {
  const slots = slotsFor(day, schedule);
  const idx = slots.findIndex((x) => x.id === slotId);
  if (idx === -1) return null;
  const s = slots[idx];

  // 1. Explicit group match
  if (s.group) {
    const sibling = slots.find((x) => x.id !== slotId && x.group === s.group);
    if (sibling) return sibling.id;
  }

  // 2. Fallback for renamed/custom slots (e.g. "Lesson 1a" & "Lesson 1b" or "Period 2a" & "Period 2b")
  if (s.type === 'lesson') {
    const idMatch = s.id.match(/^(.+?)([ab])$/i);
    if (idMatch) {
      const targetId = `${idMatch[1]}${idMatch[2].toLowerCase() === 'a' ? 'b' : 'a'}`;
      const sibById = slots.find((x) => x.id.toLowerCase() === targetId.toLowerCase());
      if (sibById) return sibById.id;
    }

    const labelMatch = s.label.trim().match(/^(.+?\d+)\s*([ab])$/i);
    if (labelMatch) {
      const prefix = labelMatch[1].trim().toLowerCase();
      const targetSuffix = labelMatch[2].toLowerCase() === 'a' ? 'b' : 'a';
      const sibByLabel = slots.find((x) => {
        if (x.id === slotId || x.type !== 'lesson') return false;
        const m = x.label.trim().match(/^(.+?\d+)\s*([ab])$/i);
        return Boolean(m && m[1].trim().toLowerCase() === prefix && m[2].toLowerCase() === targetSuffix);
      });
      if (sibByLabel) return sibByLabel.id;
    }
  }

  return null;
}

export function areSlotsPaired(s?: TimeSlot | null, nextSlot?: TimeSlot | null): boolean {
  if (!s || !nextSlot) return false;
  if (s.group && nextSlot.group && s.group === nextSlot.group) return true;
  if (s.type === 'lesson' && nextSlot.type === 'lesson') {
    const idA = s.id.match(/^(.+?)a$/i);
    const idB = nextSlot.id.match(/^(.+?)b$/i);
    if (idA && idB && idA[1].toLowerCase() === idB[1].toLowerCase()) return true;

    const lblA = s.label.trim().match(/^(.+?\d+)\s*a$/i);
    const lblB = nextSlot.label.trim().match(/^(.+?\d+)\s*b$/i);
    if (lblA && lblB && lblA[1].trim().toLowerCase() === lblB[1].trim().toLowerCase()) return true;
  }
  return false;
}

export function entriesMatch(a?: TimetableEntry | null, b?: TimetableEntry | null): boolean {
  if (!a || !b) return false;
  return (
    a.subject === b.subject &&
    (a.teacher || '') === (b.teacher || '') &&
    (a.room || '') === (b.room || '') &&
    (a.lessonType || 'lesson') === (b.lessonType || 'lesson')
  );
}

export function canMerge(a?: TimetableEntry | null, b?: TimetableEntry | null): boolean {
  return entriesMatch(a, b) && !a?.split && !b?.split;
}

export function canStudentSlotsMerge(
  studentName: string,
  day: DayOfWeek,
  s: TimeSlot,
  nextSlot: TimeSlot | undefined,
  entries: TimetableEntry[],
  secondaryAssignments?: LsaAssignment[],
  primarySupport?: PrimarySupportAssignment[],
  staffNotes?: StaffSlotNote[]
): boolean {
  if (!areSlotsPaired(s, nextSlot) || !nextSlot) return false;
  const entryMap = getEntryLookup(entries);
  const e1 = entryMap.get(`${studentName}|${day}|${s.id}`);
  const e2 = entryMap.get(`${studentName}|${day}|${nextSlot.id}`);
  if (!canMerge(e1, e2)) return false;
  if (secondaryAssignments && primarySupport) {
    const a1 = getActiveSupport(studentName, day, s.id, entries, secondaryAssignments, primarySupport, staffNotes);
    const a2 = getActiveSupport(studentName, day, nextSlot.id, entries, secondaryAssignments, primarySupport, staffNotes);
    const lsa1 = a1?.lsa?.trim().toLowerCase() || '';
    const lsa2 = a2?.lsa?.trim().toLowerCase() || '';
    const type1 = a1?.type || '';
    const type2 = a2?.type || '';
    if (lsa1 !== lsa2 || type1 !== type2) return false;
  }
  return true;
}

export function parseClock(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const str = raw.toString().trim();
  const m = str.match(/^(\d{1,2}):(\d{2})\s*([AaPp]\.?[Mm]\.?)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3] ? m[3].toLowerCase().replace(/\./g, '') : null;
  if (ap === 'pm') {
    if (h !== 12) h += 12;
  } else if (ap === 'am') {
    if (h === 12) h = 0;
  } else {
    // School day heuristic: 1, 2, 3 o'clock without AM/PM mean afternoon (13, 14, 15)
    if (h >= 1 && h <= 6) h += 12;
  }
  return h * 60 + min;
}

export function slotMinutes(s: TimeSlot): { start: number | null; end: number | null } {
  return { start: parseClock(s.start), end: parseClock(s.end) };
}

export function parsePeriodByTime(day: DayOfWeek, raw: string, schedule?: ScheduleOverrides): string[] | null {
  const str = raw.toString().trim();
  const parts = str.split(/\s*(?:-|–|—|to)\s*/i).filter(Boolean);
  const slots = slotsFor(day, schedule).map((s) => Object.assign({}, s, slotMinutes(s)));
  const startMin = parseClock(parts[0]);
  if (startMin == null) return null;
  let startIdx = slots.findIndex((s) => s.start === startMin);
  if (startIdx === -1) {
    startIdx = slots.findIndex((s) => s.start != null && Math.abs(s.start - startMin) <= 2);
  }
  if (startIdx === -1) return null;
  if (parts.length < 2) {
    return [slots[startIdx].id];
  }
  const endMin = parseClock(parts[1]);
  if (endMin == null) return [slots[startIdx].id];
  const ids: string[] = [];
  for (let i = startIdx; i < slots.length; i++) {
    ids.push(slots[i].id);
    if (slots[i].end != null && slots[i].end! >= endMin - 2) break;
  }
  return ids;
}

export function normalizePeriod(day: DayOfWeek, raw: string, schedule?: ScheduleOverrides): string[] | null {
  if (!raw) return null;
  const s = raw.toString().trim().toLowerCase().replace(/[\s_\-()]+/g, '');
  const daySlots = slotsFor(day, schedule);

  // 1. Direct slot ID or custom slot label match
  const exact = daySlots.find(
    (slot) =>
      slot.id.toLowerCase() === s ||
      slot.label.trim().toLowerCase().replace(/[\s_\-()]+/g, '') === s
  );
  if (exact) return [exact.id];

  // 2. Comprehensive base map for period names, letters, and numbers
  const map: Record<string, string[]> = {
    registration: ['reg'],
    reg: ['reg'],
    tutor: ['reg'],
    tutortime: ['reg'],
    form: ['reg'],
    homeroom: ['reg'],
    hr: ['reg'],
    lesson1: ['l1a', 'l1b'],
    l1: ['l1a', 'l1b'],
    period1: ['l1a', 'l1b'],
    p1: ['l1a', 'l1b'],
    lesson1a: ['l1a'],
    l1a: ['l1a'],
    period1a: ['l1a'],
    p1a: ['l1a'],
    lesson1b: ['l1b'],
    l1b: ['l1b'],
    period1b: ['l1b'],
    p1b: ['l1b'],
    lesson3: ['l3a', 'l3b'],
    l3: ['l3a', 'l3b'],
    period3: ['l3a', 'l3b'],
    p3: ['l3a', 'l3b'],
    lesson3a: ['l3a'],
    l3a: ['l3a'],
    period3a: ['l3a'],
    p3a: ['l3a'],
    lesson3b: ['l3b'],
    l3b: ['l3b'],
    period3b: ['l3b'],
    p3b: ['l3b'],
    lesson4: ['l4a', 'l4b'],
    l4: ['l4a', 'l4b'],
    period4: ['l4a', 'l4b'],
    p4: ['l4a', 'l4b'],
    lesson4a: ['l4a'],
    l4a: ['l4a'],
    period4a: ['l4a'],
    p4a: ['l4a'],
    lunch1: ['l4a'],
    lesson4b: ['l4b'],
    l4b: ['l4b'],
    period4b: ['l4b'],
    p4b: ['l4b'],
    lunch2: ['l4b'],
    break: ['brk1'],
    break1: ['brk1'],
    br1: ['brk1'],
    brk1: ['brk1'],
    break1br1: ['brk1'],
    break2: ['brk2'],
    br2: ['brk2'],
    brk2: ['brk2'],
    break2br2: ['brk2'],
  };

  if (day === 'Fri') {
    const hasL2 = daySlots.some((slot) => slot.id === 'l2');
    const hasL2a = daySlots.some((slot) => slot.id === 'l2a');
    // If Friday schedule has single 'l2' slot (default 9:10-9:50 slot), map L2/L2a/L2b to 'l2'
    const l2Target = (!hasL2a && hasL2) ? ['l2'] : ['l2a'];

    const hasBrk1 = daySlots.some((slot) => slot.id === 'brk1');
    const hasBrk2 = daySlots.some((slot) => slot.id === 'brk2');
    const hasL3a = daySlots.some((slot) => slot.id === 'l3a');
    const hasL3b = daySlots.some((slot) => slot.id === 'l3b');

    // On Friday, when importing from a timetable grid that uses Mon–Thu headers (where Br1/Br2 are cols 6 & 7,
    // which correspond to Friday's L3a 10:10-10:50 and L3b 10:50-11:30), map Br1 -> l3a and Br2 -> l3b.
    const friBr1Target = (hasBrk1 && hasBrk2) ? ['brk1'] : (hasL3a ? ['l3a'] : ['brk']);
    const friBr2Target = (hasBrk1 && hasBrk2) ? ['brk2'] : (hasL3b ? ['l3b'] : ['brk']);

    Object.assign(map, {
      lesson2: ['l2'],
      l2: ['l2'],
      period2: ['l2'],
      p2: ['l2'],
      lesson2a: l2Target,
      l2a: l2Target,
      period2a: l2Target,
      p2a: l2Target,
      lesson2b: l2Target,
      l2b: l2Target,
      period2b: l2Target,
      p2b: l2Target,
      break: ['brk'],
      brk: ['brk'],
      br: ['brk'],
      break1: friBr1Target,
      br1: friBr1Target,
      brk1: friBr1Target,
      break1br1: friBr1Target,
      break2: friBr2Target,
      br2: friBr2Target,
      brk2: friBr2Target,
      break2br2: friBr2Target,
    });
  } else {
    Object.assign(map, {
      lesson2: ['l2a', 'l2b'],
      l2: ['l2a', 'l2b'],
      period2: ['l2a', 'l2b'],
      p2: ['l2a', 'l2b'],
      lesson2a: ['l2a'],
      l2a: ['l2a'],
      period2a: ['l2a'],
      p2a: ['l2a'],
      lesson2b: ['l2b'],
      l2b: ['l2b'],
      period2b: ['l2b'],
      p2b: ['l2b'],
      lesson5: ['l5a', 'l5b'],
      l5: ['l5a', 'l5b'],
      period5: ['l5a', 'l5b'],
      p5: ['l5a', 'l5b'],
      lesson5a: ['l5a'],
      l5a: ['l5a'],
      period5a: ['l5a'],
      p5a: ['l5a'],
      lesson5b: ['l5b'],
      l5b: ['l5b'],
      period5b: ['l5b'],
      p5b: ['l5b'],
    });
  }

  if (map[s]) {
    const existingIds = map[s].filter((id) => daySlots.some((ds) => ds.id === id));
    if (existingIds.length > 0) return existingIds;
  }
  return parsePeriodByTime(day, raw, schedule);
}

export function isBreakOrFixedSubject(subject?: string | null): boolean {
  if (!subject) return true;
  const s = subject.trim().toLowerCase();
  if (!s) return true;
  return (
    s === 'break' ||
    s === 'br' ||
    s === 'brk' ||
    s === 'break 1' ||
    s === 'break1' ||
    s === 'br1' ||
    s === 'brk1' ||
    s === 'break1 (br1)' ||
    s === 'break 2' ||
    s === 'break2' ||
    s === 'br2' ||
    s === 'brk2' ||
    s === 'break2 (br2)' ||
    isRegistrationOrTutorSubject(s)
  );
}

/**
 * Repairs Friday entries where a student's last lesson was embedded into the 'brk' (or 'brk1'/'brk2')
 * break slot instead of 'l3a' and 'l3b'. Moves the lesson into both 'l3a' and 'l3b' (merged 80-min lesson)
 * and cleans up the break slot.
 */
export function normalizeFridayEntries(
  entries: TimetableEntry[],
  assignments: LsaAssignment[] = [],
  schedule?: ScheduleOverrides
): { entries: TimetableEntry[]; assignments: LsaAssignment[]; changed: boolean } {
  const friSlots = slotsFor('Fri', schedule);
  const hasL3a = friSlots.some((s) => s.id === 'l3a');
  const hasL3b = friSlots.some((s) => s.id === 'l3b');
  if (!hasL3a || !hasL3b) {
    return { entries, assignments, changed: false };
  }

  let changed = false;
  let nextEntries = [...entries];
  let nextAssignments = [...assignments];

  const friBreakEntries = nextEntries.filter(
    (e) =>
      e.day === 'Fri' &&
      (e.slotId === 'brk' || e.slotId === 'brk1' || e.slotId === 'brk2') &&
      !isBreakOrFixedSubject(e.subject)
  );

  for (const brkEntry of friBreakEntries) {
    const student = brkEntry.student;
    const existingL3a = nextEntries.find((e) => e.student === student && e.day === 'Fri' && e.slotId === 'l3a');
    const existingL3b = nextEntries.find((e) => e.student === student && e.day === 'Fri' && e.slotId === 'l3b');

    const isPlaceholderL3a =
      !existingL3a ||
      (existingL3a.subject.trim().toLowerCase() === 'support' && !existingL3a.teacher && !existingL3a.room);
    const isPlaceholderL3b =
      !existingL3b ||
      (existingL3b.subject.trim().toLowerCase() === 'support' && !existingL3b.teacher && !existingL3b.room);

    if (isPlaceholderL3a && isPlaceholderL3b) {
      changed = true;
      // Remove the misplaced lesson from the break slot
      nextEntries = nextEntries.filter((e) => e.id !== brkEntry.id);

      // Upsert into l3a
      const l3aEntry: TimetableEntry = {
        ...brkEntry,
        id: existingL3a?.id || `${brkEntry.id}_l3a`,
        day: 'Fri',
        slotId: 'l3a',
        split: false,
      };
      // Upsert into l3b
      const l3bEntry: TimetableEntry = {
        ...brkEntry,
        id: existingL3b?.id || `${brkEntry.id}_l3b`,
        day: 'Fri',
        slotId: 'l3b',
        split: false,
      };

      nextEntries = nextEntries.filter(
        (e) => !(e.student === student && e.day === 'Fri' && (e.slotId === 'l3a' || e.slotId === 'l3b'))
      );
      nextEntries.push(l3aEntry, l3bEntry);

      // Also migrate any LSA assignment that was attached to the Friday break slot for this student
      const brkAssign = nextAssignments.find(
        (a) => a.student === student && a.day === 'Fri' && a.slotId === brkEntry.slotId
      );
      if (brkAssign) {
        nextAssignments = nextAssignments.filter((a) => a.id !== brkAssign.id);
        for (const targetSid of ['l3a', 'l3b']) {
          const hasTargetAssign = nextAssignments.some(
            (a) => a.student === student && a.day === 'Fri' && a.slotId === targetSid
          );
          if (!hasTargetAssign) {
            nextAssignments.push({
              ...brkAssign,
              id: `${brkAssign.id}_${targetSid}`,
              slotId: targetSid,
            });
          }
        }
      }
    }
  }

  return { entries: nextEntries, assignments: nextAssignments, changed };
}

export function normalizeStudentName(raw: string | number | null | undefined): string {
  const s = (raw || '').toString().trim();
  const m = s.match(/^([^,]+),\s*(.+?)\s+([0-9]{1,2}[A-Za-z]{1,4})$/);
  if (m) {
    const last = m[1].trim();
    const first = m[2].trim();
    const classCode = m[3].trim();
    return `${first} ${last} (${classCode})`;
  }
  const m2 = s.match(/^([^,]+),\s*(.+)$/);
  if (m2) {
    const last = m2[1].trim();
    const first = m2[2].trim();
    return `${first} ${last}`;
  }
  return s;
}

export function normalizeDay(raw: string | number | null | undefined): DayOfWeek | null {
  if (!raw) return null;
  const s = raw.toString().trim().toLowerCase();
  const map: Record<string, DayOfWeek> = {
    mon: 'Mon',
    monday: 'Mon',
    tue: 'Tue',
    tues: 'Tue',
    tuesday: 'Tue',
    wed: 'Wed',
    weds: 'Wed',
    wednesday: 'Wed',
    thu: 'Thu',
    thur: 'Thu',
    thurs: 'Thu',
    thursday: 'Thu',
    fri: 'Fri',
    friday: 'Fri',
  };
  return map[s] || null;
}

export function getSlotTimeRange(day: DayOfWeek, slotId: string, schedule?: ScheduleOverrides) {
  const slots = slotsFor(day, schedule);
  const s = slots.find((x) => x.id === slotId);
  if (!s) return null;
  const start = parseClock(s.start);
  const end = parseClock(s.end);
  if (start == null || end == null) return null;
  return { start, end };
}

export function rangesOverlap(
  r1: { start: number; end: number } | null,
  r2: { start: number; end: number } | null
): boolean {
  if (!r1 || !r2) return false;
  return r1.start < r2.end && r2.start < r1.end;
}

export function minutesToLabel(mins: number | null): string {
  if (mins == null) return '?';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  let displayH = h > 12 ? h - 12 : h;
  if (displayH === 0) displayH = 12;
  return `${displayH}:${m.toString().padStart(2, '0')}`;
}

const entryLookupCache = new WeakMap<TimetableEntry[], Map<string, TimetableEntry>>();
const teacherSlotLookupCache = new WeakMap<TimetableEntry[], Map<string, TimetableEntry[]>>();
const secondaryLookupCache = new WeakMap<LsaAssignment[], Map<string, LsaAssignment>>();
const primaryLookupCache = new WeakMap<PrimarySupportAssignment[], Map<string, PrimarySupportAssignment>>();

export function getEntryLookup(entries: TimetableEntry[]): Map<string, TimetableEntry> {
  let map = entryLookupCache.get(entries);
  if (!map) {
    map = new Map<string, TimetableEntry>();
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      map.set(`${e.student}|${e.day}|${e.slotId}`, e);
    }
    entryLookupCache.set(entries, map);
  }
  return map;
}

function getTeacherSlotLookup(entries: TimetableEntry[]): Map<string, TimetableEntry[]> {
  let map = teacherSlotLookupCache.get(entries);
  if (!map) {
    map = new Map<string, TimetableEntry[]>();
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e.teacher) {
        const key = `${e.teacher.trim().toLowerCase()}|${e.day}|${e.slotId}`;
        let list = map.get(key);
        if (!list) {
          list = [];
          map.set(key, list);
        }
        list.push(e);
      }
    }
    teacherSlotLookupCache.set(entries, map);
  }
  return map;
}

function getSecondaryLookup(secondaryAssignments: LsaAssignment[]): Map<string, LsaAssignment> {
  let map = secondaryLookupCache.get(secondaryAssignments);
  if (!map) {
    map = new Map<string, LsaAssignment>();
    for (let i = 0; i < secondaryAssignments.length; i++) {
      const a = secondaryAssignments[i];
      map.set(`${a.student}|${a.day}|${a.slotId}`, a);
    }
    secondaryLookupCache.set(secondaryAssignments, map);
  }
  return map;
}

function getPrimaryLookup(primarySupport: PrimarySupportAssignment[]): Map<string, PrimarySupportAssignment> {
  let map = primaryLookupCache.get(primarySupport);
  if (!map) {
    map = new Map<string, PrimarySupportAssignment>();
    for (let i = 0; i < primarySupport.length; i++) {
      const p = primarySupport[i];
      map.set(`${p.student}|${p.subject.trim().toLowerCase()}`, p);
    }
    primaryLookupCache.set(primarySupport, map);
  }
  return map;
}

export function getActiveSupport(
  student: string,
  day: DayOfWeek,
  slotId: string,
  entries: TimetableEntry[],
  secondaryAssignments: LsaAssignment[],
  primarySupport: PrimarySupportAssignment[],
  staffNotes?: StaffSlotNote[]
): ActiveSupport | null {
  let baseSupport: ActiveSupport | null = null;
  const secondary = getSecondaryLookup(secondaryAssignments).get(`${student}|${day}|${slotId}`);
  if (secondary && secondary.lsa) {
    if (secondary.lsa === '__NONE__') return null;
    baseSupport = { lsa: secondary.lsa, type: 'secondary' };
  } else {
    const entry = getEntryLookup(entries).get(`${student}|${day}|${slotId}`);
    if (!entry || !entry.subject) return null;
    const primary = primarySupport
      ? getPrimaryLookup(primarySupport).get(`${student}|${entry.subject.trim().toLowerCase()}`)
      : undefined;
    if (primary && primary.lsa) {
      baseSupport = { lsa: primary.lsa, type: 'primary' };
    }
  }

  if (!baseSupport) return null;

  // Check if staff member is covered by someone else, or relieved because they were assigned to cover another lesson
  if (staffNotes && staffNotes.length > 0) {
    const assignedLsaLower = baseSupport.lsa.trim().toLowerCase();
    
    // 1. If assigned staff has a cover assigned, return the covering staff member
    const coverNote = staffNotes.find(
      (n) => n.staffName.trim().toLowerCase() === assignedLsaLower && n.day === day && n.slotId === slotId && n.isCover && n.coveredBy
    );
    if (coverNote && coverNote.coveredBy) {
      return {
        lsa: coverNote.coveredBy,
        type: 'cover',
        originalLsa: baseSupport.lsa,
        coveringFor: baseSupport.lsa,
      };
    }

    // 2. If assigned staff was relieved because they were assigned to cover someone else in this slot
    const isRelievedCoveringOther = staffNotes.some(
      (n) => n.coveredBy && n.coveredBy.trim().toLowerCase() === assignedLsaLower && n.day === day && n.slotId === slotId && n.isCover
    );
    if (isRelievedCoveringOther) {
      return {
        lsa: baseSupport.lsa,
        type: 'relieved',
        originalLsa: baseSupport.lsa,
      };
    }
  }

  return baseSupport;
}

export function assignmentsForLsaSlot(
  staffName: string,
  day: DayOfWeek,
  slotId: string,
  students: string[],
  entries: TimetableEntry[],
  secondaryAssignments: LsaAssignment[],
  primarySupport: PrimarySupportAssignment[]
): StaffAssignmentDetail[] {
  const result: StaffAssignmentDetail[] = [];
  const target = staffName.trim().toLowerCase();
  if (!target) return result;
  const addedStudents = new Set<string>();
  const entryMap = getEntryLookup(entries);

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const active = getActiveSupport(student, day, slotId, entries, secondaryAssignments, primarySupport);
    if (active && active.lsa.trim().toLowerCase() === target) {
      const entry = entryMap.get(`${student}|${day}|${slotId}`);
      result.push({
        student,
        day,
        slotId,
        lsa: staffName,
        type: active.type,
        classId: entry?.classId,
        className: entry?.className,
        subject: entry?.subject,
        teacher: entry?.teacher,
        room: entry?.room,
      });
      addedStudents.add(student.trim().toLowerCase());
    }
  }

  // Also include lessons where this staff member is scheduled as the teacher
  const teacherEntries = getTeacherSlotLookup(entries).get(`${target}|${day}|${slotId}`);
  if (teacherEntries) {
    for (let i = 0; i < teacherEntries.length; i++) {
      const e = teacherEntries[i];
      const normStu = e.student.trim().toLowerCase();
      if (!addedStudents.has(normStu)) {
        result.push({
          student: e.student,
          day,
          slotId,
          lsa: staffName,
          type: 'teacher',
          classId: e.classId,
          className: e.className,
          subject: e.subject,
          teacher: e.teacher,
          room: e.room,
        });
        addedStudents.add(normStu);
      }
    }
  }

  return result;
}

export function normalizeTeacherKey(name?: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/^(mr|mrs|ms|miss|dr)\s+/, '')
    .trim();
}

export function getAssignmentConflictUnitKey(
  a: LsaAssignment | StaffAssignmentDetail,
  entries?: TimetableEntry[]
): string {
  const assign = a as StaffAssignmentDetail;
  if (assign.classId) {
    return `class:${assign.classId}`;
  }

  let teacher = assign.teacher;
  let subject = assign.subject;

  if ((!teacher || !subject) && entries && a.student && a.day && a.slotId) {
    const normStu = a.student.trim().toLowerCase();
    const entry = entries.find(
      (e) =>
        e.student.trim().toLowerCase() === normStu &&
        e.day === a.day &&
        e.slotId === a.slotId
    );
    if (entry) {
      if (entry.classId) return `class:${entry.classId}`;
      teacher = teacher || entry.teacher;
      subject = subject || entry.subject;
    }
  }

  const normTeacher = normalizeTeacherKey(teacher);

  // If both students share the same teacher in the slot, they are in the same lesson!
  if (normTeacher) {
    return `lesson:${normTeacher}`;
  }

  return `student:${a.student.trim().toLowerCase()}`;
}

export function hasSlotConflict(
  assigns: StaffAssignmentDetail[],
  entries?: TimetableEntry[]
): boolean {
  if (assigns.length <= 1) return false;
  const units = new Set<string>();
  for (let i = 0; i < assigns.length; i++) {
    units.add(getAssignmentConflictUnitKey(assigns[i], entries));
    if (units.size > 1) return true;
  }
  return false;
}

export function canStaffSlotsMerge(
  staffName: string,
  day: DayOfWeek,
  s: TimeSlot,
  nextSlot: TimeSlot | undefined,
  students: string[],
  entries: TimetableEntry[],
  assignments: LsaAssignment[],
  primarySupport: PrimarySupportAssignment[],
  staffNotes?: StaffSlotNote[]
): boolean {
  if (!areSlotsPaired(s, nextSlot) || !nextSlot) return false;

  const a1 = assignmentsForLsaSlot(staffName, day, s.id, students, entries, assignments, primarySupport);
  const a2 = assignmentsForLsaSlot(staffName, day, nextSlot.id, students, entries, assignments, primarySupport);

  const n1List = (staffNotes || []).filter((n) => n.staffName.toLowerCase() === staffName.toLowerCase() && n.day === day && n.slotId === s.id);
  const n2List = (staffNotes || []).filter((n) => n.staffName.toLowerCase() === staffName.toLowerCase() && n.day === day && n.slotId === nextSlot.id);
  const c1 = (staffNotes || []).find((n) => n.coveredBy?.toLowerCase() === staffName.toLowerCase() && n.day === day && n.slotId === s.id && n.isCover);
  const c2 = (staffNotes || []).find((n) => n.coveredBy?.toLowerCase() === staffName.toLowerCase() && n.day === day && n.slotId === nextSlot.id && n.isCover);

  // 1. Covering Staff check:
  // If this staff member is covering someone in both slots:
  if (c1 && c2 && c1.isCover && c2.isCover) {
    // If covering the same staff member for the same lesson across both slots, merge into ONE 80-minute slot!
    if (
      c1.staffName.toLowerCase() === c2.staffName.toLowerCase() &&
      (c1.student === c2.student || (!c1.student && !c2.student)) &&
      (c1.subject === c2.subject || (!c1.subject && !c2.subject))
    ) {
      return true;
    }
    // If covering different staff or different lessons in the two 40m slots, do not merge (split cover)
    return false;
  }
  // If covering in one slot but not the other, cannot merge (split cover of 40m each)
  if (Boolean(c1?.isCover) !== Boolean(c2?.isCover)) return false;

  // 2. Covered Staff check:
  const n1Cover = n1List.find((n) => n.isCover);
  const n2Cover = n2List.find((n) => n.isCover);
  if (n1Cover && n2Cover) {
    if (n1Cover.coveredBy && n1Cover.coveredBy.toLowerCase() === n2Cover.coveredBy?.toLowerCase()) {
      return true;
    }
    return false;
  }
  if (Boolean(n1Cover) !== Boolean(n2Cover)) return false;

  // Notes check: both slots must have matching notes
  if (n1List.length !== n2List.length) return false;
  if (n1List.length > 0) {
    const sorted1 = [...n1List].sort((a, b) => a.text.localeCompare(b.text));
    const sorted2 = [...n2List].sort((a, b) => a.text.localeCompare(b.text));
    for (let i = 0; i < sorted1.length; i++) {
      if (
        sorted1[i].text !== sorted2[i].text ||
        Boolean(sorted1[i].highlight) !== Boolean(sorted2[i].highlight) ||
        (sorted1[i].highlightColor || 'yellow') !== (sorted2[i].highlightColor || 'yellow') ||
        Boolean(sorted1[i].bold) !== Boolean(sorted2[i].bold) ||
        Boolean(sorted1[i].position === 'top' || sorted1[i].pinToTop) !== Boolean(sorted2[i].position === 'top' || sorted2[i].pinToTop) ||
        Boolean(sorted1[i].isCover) !== Boolean(sorted2[i].isCover) ||
        Boolean(sorted1[i].keepIndefinitely) !== Boolean(sorted2[i].keepIndefinitely)
      ) {
        return false;
      }
    }
  }

  // Both are free periods in this 80m block
  if (a1.length === 0 && a2.length === 0) {
    if (n1List.length === 0 && n2List.length === 0 && !c1 && !c2) return true;
    if (n1List.length > 0 && n2List.length > 0 && !c1 && !c2 && !n1Cover && !n2Cover) {
      return true;
    }
    return false;
  }
  if (a1.length === 0 || a2.length === 0) return false;

  const entryMap = getEntryLookup(entries);

  // Single student assigned in both slots
  if (a1.length === 1 && a2.length === 1) {
    if (a1[0].student !== a2[0].student) return false;
    const student = a1[0].student;
    const e1 = entryMap.get(`${student}|${day}|${s.id}`);
    const e2 = entryMap.get(`${student}|${day}|${nextSlot.id}`);
    return canMerge(e1, e2);
  }

  // Multiple students assigned in both slots (must match students and lessons)
  if (a1.length === a2.length) {
    const s1 = [...a1.map((x) => x.student)].sort();
    const s2 = [...a2.map((x) => x.student)].sort();
    const allMatch = s1.every((val, idx) => val === s2[idx]);
    if (!allMatch) return false;
    return s1.every((student) => {
      const e1 = entryMap.get(`${student}|${day}|${s.id}`);
      const e2 = entryMap.get(`${student}|${day}|${nextSlot.id}`);
      return canMerge(e1, e2);
    });
  }

  return false;
}

export interface StaffWeeklySlotAssignment {
  student: string;
  day: DayOfWeek;
  slotId: string;
  slotLabel: string;
  timeRange: string;
  subject: string;
  room?: string;
  teacher?: string;
  type: 'primary' | 'secondary' | 'cover' | 'relieved' | 'teacher';
  classId?: string;
}

export interface StaffAssignedSlotsResult {
  uniqueSlotsCount: number;
  totalAllocationsCount: number;
  assignments: StaffWeeklySlotAssignment[];
  byDay: Record<DayOfWeek, StaffWeeklySlotAssignment[]>;
}

export function getStaffAssignedSlots(
  staffName: string,
  students: string[],
  entries: TimetableEntry[],
  secondaryAssignments: LsaAssignment[],
  primarySupport: PrimarySupportAssignment[],
  schedule?: ScheduleOverrides
): StaffAssignedSlotsResult {
  const assignments: StaffWeeklySlotAssignment[] = [];
  const byDay: Record<DayOfWeek, StaffWeeklySlotAssignment[]> = {
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
  };

  const entryMap = getEntryLookup(entries);

  DAYS.forEach((day) => {
    const slots = slotsFor(day, schedule);
    slots.forEach((s) => {
      const slotAssigns = assignmentsForLsaSlot(
        staffName,
        day,
        s.id,
        students,
        entries,
        secondaryAssignments,
        primarySupport
      );
      slotAssigns.forEach((a) => {
        const entry = entryMap.get(`${a.student}|${day}|${s.id}`);
        const item: StaffWeeklySlotAssignment = {
          student: a.student,
          day,
          slotId: s.id,
          slotLabel: s.label,
          timeRange: `${s.start}–${s.end}`,
          subject: entry?.subject || 'Support',
          room: entry?.room,
          teacher: entry?.teacher,
          type: a.type,
          classId: entry?.classId,
        };
        assignments.push(item);
        byDay[day].push(item);
      });
    });
  });

  const uniqueKeys = new Set(assignments.map((a) => `${a.day}_${a.slotId}`));

  return {
    uniqueSlotsCount: uniqueKeys.size,
    totalAllocationsCount: assignments.length,
    assignments,
    byDay,
  };
}

export function getTotalActiveSupportSlotsCount(
  students: string[],
  entries: TimetableEntry[],
  secondaryAssignments: LsaAssignment[],
  primarySupport: PrimarySupportAssignment[],
  schedule?: ScheduleOverrides
): { uniqueSlotSessions: number; totalAllocations: number } {
  let totalAllocations = 0;
  const uniqueLsaSlotKeys = new Set<string>();

  DAYS.forEach((day) => {
    const slots = slotsFor(day, schedule);
    slots.forEach((s) => {
      students.forEach((student) => {
        const active = getActiveSupport(student, day, s.id, entries, secondaryAssignments, primarySupport);
        if (active && active.lsa && active.lsa !== '__NONE__') {
          totalAllocations++;
          uniqueLsaSlotKeys.add(`${active.lsa.trim().toLowerCase()}_${day}_${s.id}`);
        }
      });
    });
  });

  return {
    uniqueSlotSessions: uniqueLsaSlotKeys.size,
    totalAllocations,
  };
}

export function activeSupportForDay(
  day: DayOfWeek,
  students: string[],
  entries: TimetableEntry[],
  secondaryAssignments: LsaAssignment[],
  primarySupport: PrimarySupportAssignment[],
  schedule?: ScheduleOverrides,
  lsaPool?: StaffMember[]
): StaffAssignmentDetail[] {
  const list: StaffAssignmentDetail[] = [];
  const slots = slotsFor(day, schedule);
  const addedKeys = new Set<string>();
  const entryMap = getEntryLookup(entries);

  students.forEach((student) => {
    slots.forEach((s) => {
      const active = getActiveSupport(student, day, s.id, entries, secondaryAssignments, primarySupport);
      if (active) {
        const entry = entryMap.get(`${student}|${day}|${s.id}`);
        list.push({
          student,
          day,
          slotId: s.id,
          lsa: active.lsa,
          type: active.type,
          classId: entry?.classId,
          className: entry?.className,
          subject: entry?.subject,
          teacher: entry?.teacher,
          room: entry?.room,
        });
        addedKeys.add(`${active.lsa.trim().toLowerCase()}|${student.trim().toLowerCase()}|${s.id}`);
      }
    });
  });

  if (lsaPool && lsaPool.length > 0) {
    const poolMap = new Map<string, string>();
    lsaPool.forEach((p) => {
      poolMap.set(p.name.trim().toLowerCase(), p.name);
    });

    entries.forEach((e) => {
      if (e.day === day && e.teacher) {
        const canonicalName = poolMap.get(e.teacher.trim().toLowerCase());
        if (canonicalName) {
          const key = `${canonicalName.trim().toLowerCase()}|${e.student.trim().toLowerCase()}|${e.slotId}`;
          if (!addedKeys.has(key)) {
            list.push({
              student: e.student,
              day,
              slotId: e.slotId,
              lsa: canonicalName,
              type: 'teacher',
              classId: e.classId,
              className: e.className,
              subject: e.subject,
              teacher: e.teacher,
              room: e.room,
            });
            addedKeys.add(key);
          }
        }
      }
    });
  }

  return list;
}

export function computeConflicts(
  day: DayOfWeek,
  assignments: (LsaAssignment | StaffAssignmentDetail)[],
  schedule?: ScheduleOverrides,
  entries?: TimetableEntry[]
): Record<string, number> {
  const dayAssignments = assignments.filter((a) => a.day === day && a.lsa && a.lsa !== '__NONE__');
  const byLsa: Record<string, (LsaAssignment | StaffAssignmentDetail)[]> = {};
  dayAssignments.forEach((a) => {
    const normLsa = a.lsa.trim().toLowerCase();
    (byLsa[normLsa] = byLsa[normLsa] || []).push(a);
  });
  const map: Record<string, number> = {};
  Object.keys(byLsa).forEach((normLsa) => {
    const list = byLsa[normLsa];
    list.forEach((a) => {
      const rangeA = getSlotTimeRange(day, a.slotId, schedule);
      const unitA = getAssignmentConflictUnitKey(a, entries);
      const overlappingUnits = new Set<string>([unitA]);
      list.forEach((b) => {
        if (b === a || b.student.trim().toLowerCase() === a.student.trim().toLowerCase()) return;
        const unitB = getAssignmentConflictUnitKey(b, entries);
        if (unitB === unitA) return;
        const rangeB = getSlotTimeRange(day, b.slotId, schedule);
        if (rangesOverlap(rangeA, rangeB) || a.slotId === b.slotId) {
          overlappingUnits.add(unitB);
        }
      });
      const count = overlappingUnits.size;
      const exactKey = `${a.lsa}|${a.slotId}`;
      const normKey = `${normLsa}|${a.slotId}`;
      map[exactKey] = Math.max(map[exactKey] || 0, count);
      map[normKey] = Math.max(map[normKey] || 0, count);
    });
  });
  return map;
}

export function getDayConflicts(
  day: DayOfWeek,
  assignments: (LsaAssignment | StaffAssignmentDetail)[],
  schedule?: ScheduleOverrides,
  entries?: TimetableEntry[]
): ConflictItem[] {
  const dayAssignments = assignments.filter((a) => a.day === day && a.lsa && a.lsa !== '__NONE__');
  const byLsa: Record<
    string,
    {
      displayName: string;
      items: Array<(LsaAssignment | StaffAssignmentDetail) & { range: { start: number; end: number } | null }>;
    }
  > = {};
  dayAssignments.forEach((a) => {
    const normLsa = a.lsa.trim().toLowerCase();
    if (!byLsa[normLsa]) {
      byLsa[normLsa] = { displayName: a.lsa.trim(), items: [] };
    }
    byLsa[normLsa].items.push(Object.assign({}, a, { range: getSlotTimeRange(day, a.slotId, schedule) }));
  });
  const results: ConflictItem[] = [];
  Object.keys(byLsa).forEach((normLsa) => {
    const { displayName: lsa, items: list } = byLsa[normLsa];
    const n = list.length;
    const parent = list.map((_, i) => i);
    function find(i: number): number {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    }
    function union(i: number, j: number) {
      const ri = find(i);
      const rj = find(j);
      if (ri !== rj) parent[ri] = rj;
    }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const unitI = getAssignmentConflictUnitKey(list[i], entries);
        const unitJ = getAssignmentConflictUnitKey(list[j], entries);
        if (unitI === unitJ) continue; // Same class or same lesson with same teacher: NOT a conflict!
        if (
          list[i].student.trim().toLowerCase() !== list[j].student.trim().toLowerCase() &&
          (rangesOverlap(list[i].range, list[j].range) || list[i].slotId === list[j].slotId)
        ) {
          union(i, j);
        }
      }
    }
    const clusters: Record<number, typeof list> = {};
    list.forEach((a, i) => {
      const root = find(i);
      (clusters[root] = clusters[root] || []).push(a);
    });
    Object.values(clusters).forEach((cluster) => {
      const distinctUnits = new Set(cluster.map((a) => getAssignmentConflictUnitKey(a, entries)));
      if (distinctUnits.size < 2) return;
      const distinctStudents = Array.from(new Set(cluster.map((a) => a.student.trim())));
      if (distinctStudents.length < 2) return;
      const starts = cluster.map((a) => a.range?.start).filter((x): x is number => x != null);
      const ends = cluster.map((a) => a.range?.end).filter((x): x is number => x != null);
      const slotLabel =
        starts.length && ends.length
          ? `${minutesToLabel(Math.min(...starts))}–${minutesToLabel(Math.max(...ends))}`
          : Array.from(new Set(cluster.map((a) => a.slotId))).join(', ');
      results.push({
        day,
        lsa,
        students: distinctStudents,
        slotLabel,
        slotIds: Array.from(new Set(cluster.map((a) => a.slotId))),
      });
    });
  });
  return results;
}

export function getAllWeekConflicts(
  assignments: (LsaAssignment | StaffAssignmentDetail)[],
  schedule?: ScheduleOverrides,
  entries?: TimetableEntry[]
): ConflictItem[] {
  const all: ConflictItem[] = [];
  DAYS.forEach((day) => {
    getDayConflicts(day, assignments, schedule, entries).forEach((c) => all.push(c));
  });
  return all;
}

const PALETTE = ['#2F6F4E', '#2A5D8C', '#8A6410', '#7A4A9E', '#B0542A', '#3D7A7A', '#5E5EA6', '#9A4A5C'];
export function subjectColor(subject: string): string {
  let h = 0;
  for (let i = 0; i < subject.length; i++) {
    h = (h * 31 + subject.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

export interface StudentSubjectFill {
  hex: string;
  rgb: [number, number, number];
  borderHex: string;
}

// Exclusive dedicated fill color for withdrawal lessons only.
// This color is reserved strictly for withdrawals across views, PDF exports, and print documents.
export const WITHDRAWAL_FILL: StudentSubjectFill = {
  hex: '#DCEEFB',
  rgb: [220, 238, 251],
  borderHex: '#2A6FA8',
};

// Fixed colors across all individual student timetables for Days (light greyish blue) and Lessons Header (light peach)
export const STUDENT_DAYS_FILL = {
  hex: '#D8E2EF',
  rgb: [216, 226, 239] as [number, number, number],
};

export const STUDENT_HEADER_PEACH_FILL = {
  hex: '#FFEDD5',
  rgb: [255, 237, 213] as [number, number, number],
};

export function isRegistrationOrTutorSubject(subject?: string | null): boolean {
  if (!subject) return false;
  const s = subject.trim().toLowerCase();
  return (
    s === 'registration' ||
    s === 'reg' ||
    s === 'morning registration' ||
    s === 'am registration' ||
    s === 'pm registration' ||
    s === 'tutor time' ||
    s === 'tutortime' ||
    s === 'tutor' ||
    s === 'tutor period' ||
    s === 'tutor group' ||
    s === 'form time' ||
    s === 'form' ||
    s === 'form period' ||
    s === 'form tutor' ||
    s === 'homeroom' ||
    s === 'home room' ||
    s === 'roll call' ||
    /^registration\b/i.test(s) ||
    /^tutor\s*time\b/i.test(s) ||
    /^form\s*time\b/i.test(s)
  );
}

export function isFixedOrRegistrationSlot(slot?: TimeSlot | null, entry?: TimetableEntry | null): boolean {
  if (slot) {
    if (slot.type === 'fixed') return true;
    const lbl = slot.label.trim().toLowerCase();
    const id = slot.id.trim().toLowerCase();
    if (
      id === 'reg' ||
      lbl === 'registration' ||
      lbl === 'reg' ||
      lbl === 'tutor time' ||
      lbl === 'tutortime' ||
      lbl === 'tutor' ||
      lbl === 'form time' ||
      lbl === 'homeroom' ||
      /^registration\b/i.test(lbl) ||
      /^tutor\s*time\b/i.test(lbl)
    ) {
      return true;
    }
  }
  if (entry && isRegistrationOrTutorSubject(entry.subject)) {
    return true;
  }
  return false;
}

// 32 distinct, vibrant pastel fill colors for standard student subjects.
// Arranged in an alternating chromatic order so adjacent alphabetical subjects
// always receive distinctively contrasting hues (Green -> Purple -> Yellow -> Coral -> Cyan -> Lime -> Magenta -> Blue...).
// Excludes light peach (reserved for headers), light greyish-blue (reserved for days), and #DCEEFB (reserved for withdrawal).
export const STUDENT_SUBJECT_PALETTE: StudentSubjectFill[] = [
  // 0: Fresh Mint / Emerald Green
  { hex: '#A7F3D0', rgb: [167, 243, 208], borderHex: '#34D399' },
  // 1: Soft Lavender / Purple
  { hex: '#DDD6FE', rgb: [221, 214, 254], borderHex: '#A78BFA' },
  // 2: Warm Sunny Gold
  { hex: '#FEF08A', rgb: [254, 240, 138], borderHex: '#FACC15' },
  // 3: Coral Blossom Pink
  { hex: '#FECDD3', rgb: [254, 205, 211], borderHex: '#FB7185' },
  // 4: Bright Aqua / Turquoise
  { hex: '#A5F3FC', rgb: [165, 243, 252], borderHex: '#38BDF8' },
  // 5: Crisp Lime
  { hex: '#D9F99D', rgb: [217, 249, 157], borderHex: '#A3E635' },
  // 6: Vivid Orchid / Magenta
  { hex: '#FBCFE8', rgb: [251, 207, 232], borderHex: '#F472B6' },
  // 7: Periwinkle / Soft Indigo
  { hex: '#C7D2FE', rgb: [199, 210, 254], borderHex: '#818CF8' },
  // 8: Rose Carnation Pink
  { hex: '#F9A8D4', rgb: [249, 168, 212], borderHex: '#EC4899' },
  // 9: Deep Seafoam Teal
  { hex: '#99F6E4', rgb: [153, 246, 228], borderHex: '#2DD4BF' },
  // 10: Rich Thistle Violet
  { hex: '#E9D5FF', rgb: [233, 213, 255], borderHex: '#C084FC' },
  // 11: Warm Apricot Amber
  { hex: '#FDE68A', rgb: [253, 230, 138], borderHex: '#F59E0B' },
  // 12: Raspberry Blush
  { hex: '#FDA4AF', rgb: [253, 164, 175], borderHex: '#F43F5E' },
  // 13: Clear Sky Blue
  { hex: '#BAE6FD', rgb: [186, 230, 253], borderHex: '#0284C7' },
  // 14: Spring Apple Green
  { hex: '#BBF7D0', rgb: [187, 247, 208], borderHex: '#4ADE80' },
  // 15: Soft Mauve Plum
  { hex: '#F5D0FE', rgb: [245, 208, 254], borderHex: '#E879F9' },
  // 16: Buttercup Yellow
  { hex: '#FDE047', rgb: [253, 224, 71], borderHex: '#CA8A04' },
  // 17: Gentle Royal Blue
  { hex: '#BFDBFE', rgb: [191, 219, 254], borderHex: '#60A5FA' },
  // 18: Pistachio Sage
  { hex: '#C6F6D5', rgb: [198, 246, 213], borderHex: '#48BB78' },
  // 19: Watermelon Rose
  { hex: '#FFE4E6', rgb: [255, 228, 230], borderHex: '#FDA4AF' },
  // 20: Electric Mint
  { hex: '#B2F5EA', rgb: [178, 245, 234], borderHex: '#319795' },
  // 21: Dusky Lilac
  { hex: '#EDE9FE', rgb: [237, 233, 254], borderHex: '#8B5CF6' },
  // 22: Honey Gold
  { hex: '#FEF3C7', rgb: [254, 243, 199], borderHex: '#D97706' },
  // 23: Glacier Blue
  { hex: '#CFFAFE', rgb: [207, 250, 254], borderHex: '#06B6D4' },
  // 24: Olive Herb
  { hex: '#E9EDC9', rgb: [233, 237, 201], borderHex: '#A3B18A' },
  // 25: Punch Fuchsia
  { hex: '#FAE8FF', rgb: [250, 232, 255], borderHex: '#D946EF' },
  // 26: Powder Blue
  { hex: '#E0E7FF', rgb: [224, 231, 255], borderHex: '#6366F1' },
  // 27: Meadow Green
  { hex: '#D1FAE5', rgb: [209, 250, 229], borderHex: '#10B981' },
  // 28: Coral Pink
  { hex: '#FEE2E2', rgb: [254, 226, 226], borderHex: '#EF4444' },
  // 29: Chartreuse Yellow
  { hex: '#ECFCCB', rgb: [236, 252, 203], borderHex: '#84CC16' },
  // 30: Deep Wisteria
  { hex: '#F3E8FF', rgb: [243, 232, 255], borderHex: '#9333EA' },
  // 31: Celadon Mint
  { hex: '#D8F3DC', rgb: [216, 243, 220], borderHex: '#2D6A4F' },
];

/**
 * Builds a 1-to-1 subject-to-color mapping for a student's timetable.
 * Excludes withdrawal entries and registration/tutor time entries so fixed colors remain strictly exclusive.
 */
export function buildStudentSubjectColorMap(
  entriesOrSubjects: (TimetableEntry | string)[]
): Map<string, StudentSubjectFill> {
  const map = new Map<string, StudentSubjectFill>();
  const seen = new Set<string>();
  const subjectList: string[] = [];

  for (const item of entriesOrSubjects) {
    if (typeof item !== 'string' && item.lessonType === 'withdrawal') {
      continue; // Skip withdrawal items from consuming or assigning subject colors
    }
    const raw = typeof item === 'string' ? item : item.subject;
    const clean = (raw || '').trim();
    if (!clean || isRegistrationOrTutorSubject(clean)) continue;
    const lower = clean.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      subjectList.push(clean);
    }
  }

  // Stable sort so the same subject always receives the same assigned color across views & exports
  subjectList.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  subjectList.forEach((subj, idx) => {
    const fill = STUDENT_SUBJECT_PALETTE[idx % STUDENT_SUBJECT_PALETTE.length];
    map.set(subj.toLowerCase().trim(), fill);
  });

  return map;
}

export function getStudentSubjectFill(
  subject: string,
  colorMap?: Map<string, StudentSubjectFill>
): StudentSubjectFill {
  if (!subject) return { hex: '#FFFFFF', rgb: [255, 255, 255], borderHex: '#CBD5E1' };
  const s = subject.trim().toLowerCase();

  if (colorMap && colorMap.has(s)) {
    return colorMap.get(s)!;
  }

  // Consistent fallback: 31-hash across palette
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return STUDENT_SUBJECT_PALETTE[h % STUDENT_SUBJECT_PALETTE.length];
}

export function getAnnouncementExpiry(postDateStr: string): Date | null {
  const postDate = new Date(postDateStr);
  if (isNaN(postDate.getTime())) return null;
  // Mon-Thu cutoff: 3:10pm (15:10), Fri cutoff: 12:00 noon
  const cutoffs: Record<number, { h: number; m: number }> = {
    1: { h: 15, m: 10 },
    2: { h: 15, m: 10 },
    3: { h: 15, m: 10 },
    4: { h: 15, m: 10 },
    5: { h: 12, m: 0 },
  };
  const d = new Date(postDate.getFullYear(), postDate.getMonth(), postDate.getDate());
  for (let i = 0; i < 9; i++) {
    const dow = d.getDay();
    const cutoff = cutoffs[dow];
    if (cutoff) {
      const candidate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), cutoff.h, cutoff.m, 0, 0);
      if (candidate.getTime() >= postDate.getTime()) return candidate;
    }
    d.setDate(d.getDate() + 1);
  }
  return null;
}

export function filterActiveAnnouncements(announcements: Announcement[]): Announcement[] {
  const now = Date.now();
  return announcements.filter((a) => {
    const expiry = getAnnouncementExpiry(a.date);
    return !expiry || expiry.getTime() > now;
  });
}

/**
 * School day end times:
 * Mon-Thu: 3:10 PM (15:10)
 * Fri: 12:00 PM (12:00)
 */
export const SCHOOL_DAY_CUTOFFS: Record<number, { h: number; m: number }> = {
  1: { h: 15, m: 10 }, // Mon: 3:10 PM
  2: { h: 15, m: 10 }, // Tue: 3:10 PM
  3: { h: 15, m: 10 }, // Wed: 3:10 PM
  4: { h: 15, m: 10 }, // Thu: 3:10 PM
  5: { h: 12, m: 0 },  // Fri: 12:00 PM
};

export const DAY_OF_WEEK_MAP: Record<DayOfWeek, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
};

export const NUMBER_TO_DAY_MAP: Record<number, DayOfWeek> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
};

/**
 * Checks whether the daily cutoff time has passed for a given day.
 * - If target day is in the past this week or on a weekend, returns true.
 * - If target day is today, returns true if current time >= cutoff (3:10 PM Mon-Thu, 12:00 PM Fri).
 * - If target day is upcoming later this week, returns false.
 */
export function isCutoffPassedForDay(day: DayOfWeek, now: Date = new Date()): boolean {
  const dow = now.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const targetDow = DAY_OF_WEEK_MAP[day] || 1;

  // Weekend: user is viewing / planning for the upcoming school week (Mon-Fri).
  // None of the upcoming week's school days have passed cutoff yet.
  if (dow === 0 || dow === 6) {
    return false;
  }

  // Target day was earlier this week (e.g. today is Wed, target is Mon/Tue)
  if (targetDow < dow) {
    return true;
  }

  // Target day is today: check against today's cutoff
  if (targetDow === dow) {
    const cutoff = SCHOOL_DAY_CUTOFFS[dow];
    if (!cutoff) return true;
    const cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cutoff.h, cutoff.m, 0, 0);
    return now.getTime() >= cutoffDate.getTime();
  }

  // Target day is upcoming later this week (e.g. today is Mon, target is Tue..Fri)
  return false;
}

/**
 * Returns the next upcoming school day (Mon-Fri).
 * If Mon-Wed after cutoff -> Tue, Wed, Thu
 * If Thu after cutoff -> Fri
 * If Fri after cutoff, Saturday, or Sunday -> Mon
 */
export function getNextSchoolDay(now: Date = new Date()): DayOfWeek {
  const dow = now.getDay();
  if (dow === 1) return 'Tue';
  if (dow === 2) return 'Wed';
  if (dow === 3) return 'Thu';
  if (dow === 4) return 'Fri';
  return 'Mon'; // Fri after cutoff, Sat, Sun
}

/**
 * Returns the current school day if before cutoff, or the next school day if after cutoff or on weekend.
 */
export function getCurrentOrNextSchoolDay(now: Date = new Date()): DayOfWeek {
  const dow = now.getDay();
  const cutoff = SCHOOL_DAY_CUTOFFS[dow];
  if (cutoff) {
    const cutoffTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cutoff.h, cutoff.m, 0, 0);
    if (now.getTime() < cutoffTime.getTime()) {
      return NUMBER_TO_DAY_MAP[dow] || 'Mon';
    }
  }
  return getNextSchoolDay(now);
}

/**
 * Determines which school day a note or cover belongs to.
 * Any note or cover created after time cutoff (3:10 PM Mon-Thu, 12:00 PM Fri) is considered for the next school day.
 */
export function getEffectiveDayForNote(
  targetDay: DayOfWeek,
  now: Date = new Date()
): { effectiveDay: DayOfWeek; isAfterCutoff: boolean; nextDay: DayOfWeek } {
  const isAfterCutoff = isCutoffPassedForDay(targetDay, now);
  const nextDay = getNextSchoolDay(now);

  if (isAfterCutoff) {
    return {
      effectiveDay: nextDay,
      isAfterCutoff: true,
      nextDay,
    };
  }

  return {
    effectiveDay: targetDay,
    isAfterCutoff: false,
    nextDay,
  };
}

/**
 * Calculates the exact calendar date display for a school day.
 * If the day's cutoff has already passed, shows the upcoming occurrence.
 */
export function getCalendarDateForSchoolDay(
  day: DayOfWeek,
  now: Date = new Date()
): { dateDisplay: string; timestamp: number } {
  const dow = now.getDay(); // 0=Sun, 1=Mon...
  const targetDow = DAY_OF_WEEK_MAP[day] || 1;
  const isPast = isCutoffPassedForDay(day, now);

  let daysOffset = 0;
  if (isPast) {
    if (dow === targetDow) {
      daysOffset = 7;
    } else if (targetDow > dow) {
      daysOffset = targetDow - dow;
    } else {
      daysOffset = 7 - (dow - targetDow);
    }
  } else {
    if (dow === 0) {
      daysOffset = targetDow;
    } else if (dow === 6) {
      daysOffset = targetDow + 1;
    } else {
      daysOffset = targetDow - dow;
    }
  }

  const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysOffset, 0, 0, 0, 0);
  const dateDisplay = targetDate.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return {
    dateDisplay,
    timestamp: targetDate.getTime(),
  };
}

/**
 * Calculates when a staff note or cover expires:
 * - Disappears and resets to original schedule at the end of the day: 3:10 PM Mondays to Thursdays and 12:00 PM on Fridays.
 * - Anything assigned after the end time of that day will get carried over to the next day.
 */
export function calculateNoteExpiration(targetDay: DayOfWeek, createdAtDate: Date = new Date()): Date {
  const created = new Date(createdAtDate);
  const dow = created.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const targetDow = DAY_OF_WEEK_MAP[targetDay] || 1;
  const targetCutoff = SCHOOL_DAY_CUTOFFS[targetDow] || { h: 15, m: 10 };

  let dayOffset = targetDow - dow;
  if (dow === 0) {
    // Sunday: Mon is tomorrow (+1)
    dayOffset = targetDow;
  } else if (dow === 6) {
    // Saturday: Mon is in 2 days (+2)
    dayOffset = targetDow + 1;
  } else if (targetDow === dow) {
    // Same day: check if created after cutoff
    const cutoff = SCHOOL_DAY_CUTOFFS[dow];
    const cutoffTime = cutoff
      ? new Date(created.getFullYear(), created.getMonth(), created.getDate(), cutoff.h, cutoff.m, 0, 0).getTime()
      : 0;
    if (created.getTime() >= cutoffTime) {
      dayOffset = 7;
    } else {
      dayOffset = 0;
    }
  } else if (targetDow < dow) {
    dayOffset = 7 - (dow - targetDow);
  }

  const expDate = new Date(
    created.getFullYear(),
    created.getMonth(),
    created.getDate() + dayOffset,
    targetCutoff.h,
    targetCutoff.m,
    0,
    0
  );
  return expDate;
}

export function isNoteExpired(note: StaffSlotNote, now: Date = new Date()): boolean {
  if (note.keepIndefinitely) {
    return false;
  }

  if (note.expiresAt) {
    const expTime = new Date(note.expiresAt).getTime();
    if (!isNaN(expTime)) {
      return now.getTime() >= expTime;
    }
  }

  const created = note.createdAt ? new Date(note.createdAt) : now;
  const calculatedExp = calculateNoteExpiration(note.day, created);
  return now.getTime() >= calculatedExp.getTime();
}

export function filterActiveStaffNotes(notes: StaffSlotNote[], now: Date = new Date()): StaffSlotNote[] {
  return (notes || []).filter((n) => !isNoteExpired(n, now));
}

/**
 * Extract staff members mentioned using @ from note text.
 * Matches against known staff names (case-insensitive) or extracts @Name tokens.
 */
export function extractMentionedStaff(text: string, knownStaffNames: string[] = []): string[] {
  if (!text || !text.includes('@')) return [];
  const mentioned = new Set<string>();
  const normalizedKnown = knownStaffNames.map((n) => ({ original: n.trim(), lower: n.trim().toLowerCase() }));

  // 1. Match against known staff names first
  for (const { original, lower } of normalizedKnown) {
    if (!lower) continue;
    const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`@${escaped}(?=[\\s,;.!?)\\]]|$)`, 'i');
    if (regex.test(text)) {
      mentioned.add(original);
    }
  }

  // 2. Also match general @Token if not yet covered
  const generalMatches = text.match(/@([A-Za-z0-9_.'-]+(?:\s+[A-Za-z0-9_.'-]+)?)/g);
  if (generalMatches) {
    for (const raw of generalMatches) {
      const clean = raw.slice(1).trim().replace(/[.,;:!?]+$/, '');
      if (clean && !Array.from(mentioned).some((m) => m.toLowerCase() === clean.toLowerCase())) {
        const match = normalizedKnown.find((k) => k.lower === clean.toLowerCase());
        if (match) {
          mentioned.add(match.original);
        } else if (clean.length >= 2) {
          mentioned.add(clean);
        }
      }
    }
  }

  return Array.from(mentioned);
}

/**
 * Checks if a specific staff member is mentioned in a note.
 */
export function isStaffMentionedInNote(note: StaffSlotNote, targetStaff: string): boolean {
  if (!targetStaff) return false;
  const targetLower = targetStaff.trim().toLowerCase();
  if (note.staffName && note.staffName.trim().toLowerCase() === targetLower) return false;
  if (note.mentionedStaff && note.mentionedStaff.some((m) => m.trim().toLowerCase() === targetLower)) {
    return true;
  }
  if (note.text && note.text.includes('@')) {
    const escaped = targetLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`@${escaped}(?=[\\s,;.!?)\\]]|$)`, 'i');
    return regex.test(note.text);
  }
  return false;
}

export interface NoteTextPart {
  text: string;
  isMention: boolean;
}

/**
 * Parses note text into regular text and @mentions.
 * When parsed, the '@' is removed from the mention text and flagged with isMention: true,
 * enabling automatic bolding of the mentioned staff's name.
 */
export function parseNoteMentionParts(text: string, knownStaffNames: string[] = []): NoteTextPart[] {
  if (!text || !text.includes('@')) {
    return [{ text: text || '', isMention: false }];
  }

  const parts: NoteTextPart[] = [];
  const normalizedKnown = [...knownStaffNames]
    .map((s) => s.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  let currentIndex = 0;
  while (currentIndex < text.length) {
    const atIndex = text.indexOf('@', currentIndex);
    if (atIndex === -1) {
      parts.push({ text: text.slice(currentIndex), isMention: false });
      break;
    }

    if (atIndex > currentIndex) {
      parts.push({ text: text.slice(currentIndex, atIndex), isMention: false });
    }

    // Check if after '@' we have a match with any known staff name
    const remaining = text.slice(atIndex + 1);
    let matchedName: string | null = null;
    let matchLen = 0;

    for (const known of normalizedKnown) {
      if (
        remaining.toLowerCase().startsWith(known.toLowerCase()) &&
        (remaining.length === known.length || /[\s,;.!?)\\]]/.test(remaining[known.length]))
      ) {
        matchedName = known;
        matchLen = known.length;
        break;
      }
    }

    if (!matchedName) {
      // General match: 1 to 3 words
      const genMatch = remaining.match(/^([A-Za-z0-9_.'-]+(?:\s+[A-Za-z0-9_.'-]+){0,2})/);
      if (genMatch && genMatch[1]) {
        const clean = genMatch[1].replace(/[.,;:!?]+$/, '');
        if (clean.length >= 2) {
          matchedName = clean;
          matchLen = clean.length;
        }
      }
    }

    if (matchedName && matchLen > 0) {
      // Strip '@' and add as mention part (which renders bold)
      parts.push({ text: matchedName, isMention: true });
      currentIndex = atIndex + 1 + matchLen;
    } else {
      // Not a valid mention, push the '@' as regular text
      parts.push({ text: '@', isMention: false });
      currentIndex = atIndex + 1;
    }
  }

  return parts;
}

/**
 * Strips '@' and bolds mentioned names in HTML output.
 */
export function formatNoteMentionHTML(text: string, knownStaffNames: string[] = []): string {
  const parts = parseNoteMentionParts(text, knownStaffNames);
  return parts
    .map((p) => (p.isMention ? `<strong>${escapeHtml(p.text)}</strong>` : escapeHtml(p.text)))
    .join('');
}

export interface ConsolidatedStaffLesson {
  id: string;
  isClass: boolean;
  classId?: string;
  subject: string;
  teacher?: string;
  room?: string;
  lessonType?: 'lesson' | 'withdrawal';
  type: 'assigned' | 'primary' | 'secondary' | 'cover' | 'relieved' | 'teacher';
  students: string[];
}

/**
 * Consolidates multiple students in a shared class into a single concise lesson block
 * with one subject, one teacher, one room, and the list of students.
 */
export function consolidateStaffSlotAssignments(
  assigns: StaffAssignmentDetail[],
  day: DayOfWeek,
  slotId: string,
  entries: TimetableEntry[]
): ConsolidatedStaffLesson[] {
  if (!assigns || assigns.length === 0) return [];

  const map = new Map<string, ConsolidatedStaffLesson>();

  assigns.forEach((a, idx) => {
    const entry = entries.find(
      (e) => e.student === a.student && e.day === day && e.slotId === slotId
    );

    const subject = entry?.subject || (entry?.lessonType === 'withdrawal' ? 'Withdrawal Support' : 'In-Class Support');
    const teacher = entry?.teacher || '';
    const room = entry?.room || '';
    const lessonType = entry?.lessonType || 'lesson';
    const rawClassId = a.classId || entry?.classId;

    // A class (especially a withdrawal class) strictly requires more than one student.
    // If only 1 student has this classId in this slot, it is NOT treated as a class!
    let classId = rawClassId;
    if (classId) {
      const studentsWithThisClass = entries.filter(
        (e) => e.day === day && e.slotId === slotId && e.classId === classId
      );
      if (studentsWithThisClass.length <= 1) {
        classId = undefined;
      }
    }

    let key: string;
    if (classId) {
      key = `class_${classId}`;
    } else if (entry?.subject && lessonType !== 'withdrawal') {
      // For general in-class support with identical teacher/room/subject, group as shared support
      key = `shared_${subject.trim().toLowerCase()}_${teacher.trim().toLowerCase()}_${room.trim().toLowerCase()}_${lessonType}`;
    } else {
      // Individual student withdrawal lessons are distinct 1:1 sessions
      key = `single_${a.student}_${idx}`;
    }

    const existing = map.get(key);
    if (existing) {
      if (!existing.students.includes(a.student)) {
        existing.students.push(a.student);
      }
      if (existing.students.length > 1) existing.isClass = true;
      if (a.type === 'teacher') existing.type = 'teacher';
    } else {
      map.set(key, {
        id: `csl_${idx}_${a.student}`,
        isClass: false, // only true if existing.students.length > 1
        classId,
        subject,
        teacher: teacher || undefined,
        room: room || undefined,
        lessonType,
        type: a.type,
        students: [a.student],
      });
    }
  });

  const list = Array.from(map.values());
  list.forEach((item) => {
    // A withdrawal class only applies to more than one student!
    if (item.students.length > 1) {
      item.isClass = true;
    } else {
      item.isClass = false;
    }
    item.students.sort((a, b) => a.localeCompare(b));
  });

  return list;
}

/**
 * Ensures that withdrawal classes only exist if there are 2 or more students in that session.
 * Single-student withdrawal lessons must strictly be 1:1 sessions (no classId / className).
 */
export function sanitizeWithdrawalEntries(entries: TimetableEntry[]): TimetableEntry[] {
  if (!entries || entries.length === 0) return [];
  const classStudentsMap = new Map<string, Set<string>>();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.classId) {
      const k = `${e.day}|${e.slotId}|${e.classId}`;
      let s = classStudentsMap.get(k);
      if (!s) {
        s = new Set<string>();
        classStudentsMap.set(k, s);
      }
      s.add(e.student);
    }
  }

  return entries.map((e) => {
    if (e.classId) {
      const k = `${e.day}|${e.slotId}|${e.classId}`;
      const count = classStudentsMap.get(k)?.size || 0;
      if (
        (e.lessonType === 'withdrawal' && count <= 1) ||
        (count <= 1 && (e.className === e.subject || e.className?.toLowerCase().includes("'s session")))
      ) {
        const copy = { ...e };
        delete copy.classId;
        delete copy.className;
        return copy;
      }
    }
    return e;
  });
}

export function getNextResetTime(now: Date = new Date()): { time: Date; label: string; isFriday: boolean } {
  const dow = now.getDay();
  const cutoff = SCHOOL_DAY_CUTOFFS[dow];
  if (cutoff) {
    const todayCutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cutoff.h, cutoff.m, 0, 0);
    if (now.getTime() < todayCutoff.getTime()) {
      return {
        time: todayCutoff,
        label: dow === 5 ? 'Today at 12:00 PM' : 'Today at 3:10 PM',
        isFriday: dow === 5,
      };
    }
  }

  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  if (dow === 4) {
    next.setDate(next.getDate() + 1);
    next.setHours(12, 0, 0, 0);
    return { time: next, label: 'Friday at 12:00 PM', isFriday: true };
  } else if (dow === 5) {
    next.setDate(next.getDate() + 3);
    next.setHours(15, 10, 0, 0);
    return { time: next, label: 'Monday at 3:10 PM', isFriday: false };
  } else if (dow === 6) {
    next.setDate(next.getDate() + 2);
    next.setHours(15, 10, 0, 0);
    return { time: next, label: 'Monday at 3:10 PM', isFriday: false };
  } else if (dow === 0) {
    next.setDate(next.getDate() + 1);
    next.setHours(15, 10, 0, 0);
    return { time: next, label: 'Monday at 3:10 PM', isFriday: false };
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(15, 10, 0, 0);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return { time: next, label: `${dayNames[next.getDay()]} at 3:10 PM`, isFriday: false };
  }
}

function toCSVValue(v: string | number | null | undefined): string {
  const s = v == null ? '' : v.toString();
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function downloadCSVFile(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows.map((r) => r.map(toCSVValue).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportIndividualCSV(
  type: 'student' | 'staff',
  name: string,
  entries: TimetableEntry[],
  assignments: LsaAssignment[],
  primarySupport: PrimarySupportAssignment[],
  students: string[],
  schedule?: ScheduleOverrides,
  indivDayView: DayOfWeek | 'all' = 'all'
) {
  const isAllWeek = indivDayView === 'all';
  const monThuSlots = slotsFor('Mon', schedule);
  const friSlots = slotsFor('Fri', schedule);

  const rows: (string | number)[][] = [];

  const buildCsvRow = (day: DayOfWeek, currentSlots: TimeSlot[]) => {
    const gridRow: string[] = [DAY_FULL[day]];
    currentSlots.forEach((s) => {
      if (type === 'student') {
        const e = entries.find((x) => x.student === name && x.day === day && x.slotId === s.id);
        if (e) {
          const parts = [
            e.subject + (e.lessonType === 'withdrawal' ? ' [Withdrawal]' : ''),
            e.teacher || '',
            e.room ? 'Rm ' + e.room : '',
          ].filter(Boolean);
          gridRow.push(parts.join(' | '));
        } else {
          gridRow.push(s.type === 'fixed' ? s.defaultLabel || 'Registration' : '');
        }
      } else {
        const assigns = assignmentsForLsaSlot(name, day, s.id, students, entries, assignments, primarySupport);
        if (assigns.length === 0) {
          gridRow.push('');
        } else {
          const parts = assigns.map((a) => {
            const e = entries.find((x) => x.student === a.student && x.day === day && x.slotId === s.id);
            return `${a.student} (${e?.subject || 'Support'}${e?.room ? ', Rm ' + e.room : ''}${
              e?.lessonType === 'withdrawal' ? ', Withdrawal' : ''
            })`;
          });
          gridRow.push(parts.join('; '));
        }
      }
    });
    return gridRow;
  };

  // Section 1: Visual Grid Matrix (matching timetable screen layout)
  if (isAllWeek) {
    // Monday – Thursday Header & Rows
    rows.push(['Day', ...monThuSlots.map((s) => `${s.label} (${s.start}-${s.end})`)]);
    (['Mon', 'Tue', 'Wed', 'Thu'] as DayOfWeek[]).forEach((day) => {
      rows.push(buildCsvRow(day, monThuSlots));
    });

    // Dedicated Friday Header & Row inserted between Thursday and Friday
    rows.push([]);
    rows.push(['Friday Timetable', ...friSlots.map((s) => `${s.label} (${s.start}-${s.end})`), 'Early Finish (11:30)']);
    const friRow = buildCsvRow('Fri', friSlots);
    friRow.push('School closes at 11:30');
    rows.push(friRow);
  } else if (indivDayView === 'Fri') {
    rows.push(['Day', ...friSlots.map((s) => `${s.label} (${s.start}-${s.end})`), 'Early Finish (11:30)']);
    const friRow = buildCsvRow('Fri', friSlots);
    friRow.push('School closes at 11:30');
    rows.push(friRow);
  } else {
    const daySlots = slotsFor(indivDayView, schedule);
    rows.push(['Day', ...daySlots.map((s) => `${s.label} (${s.start}-${s.end})`)]);
    rows.push(buildCsvRow(indivDayView, daySlots));
  }

  // Empty separator
  rows.push([]);

  // Section 2: Detailed chronological schedule
  const scheduleHeader = ['Day', 'Period', 'Time', 'Subject', 'Teacher', 'Room', 'Lesson type'];
  if (type === 'staff') {
    scheduleHeader.push('Student');
  }
  rows.push(scheduleHeader);

  const daysToRender = isAllWeek ? DAYS : [indivDayView];
  daysToRender.forEach((day) => {
    slotsFor(day, schedule).forEach((s) => {
      if (type === 'student') {
        const e = entries.find((x) => x.student === name && x.day === day && x.slotId === s.id);
        rows.push([
          DAY_FULL[day],
          s.label,
          `${s.start}-${s.end}`,
          e ? e.subject : s.defaultLabel || '',
          e ? e.teacher || '' : '',
          e ? e.room || '' : '',
          e ? LESSON_TYPE_LABELS[e.lessonType || 'lesson'] : '',
        ]);
      } else {
        const assigns = assignmentsForLsaSlot(name, day, s.id, students, entries, assignments, primarySupport);
        if (assigns.length === 0) {
          rows.push([DAY_FULL[day], s.label, `${s.start}-${s.end}`, '', '', '', '', '']);
        } else {
          assigns.forEach((a) => {
            const e = entries.find((x) => x.student === a.student && x.day === day && x.slotId === s.id);
            rows.push([
              DAY_FULL[day],
              s.label,
              `${s.start}-${s.end}`,
              e ? e.subject : 'Support',
              e ? e.teacher || '' : '',
              e ? e.room || '' : '',
              e ? LESSON_TYPE_LABELS[e.lessonType || 'lesson'] : '',
              a.student,
            ]);
          });
        }
      }
    });
  });

  downloadCSVFile(`${name.replace(/[^\w\- ]/g, '')}_timetable.csv`, rows);
}

export function exportGridCSV(
  kind: 'students' | 'staff',
  day: DayOfWeek | 'all',
  students: string[],
  staffList: string[],
  entries: TimetableEntry[],
  assignments: LsaAssignment[],
  primarySupport: PrimarySupportAssignment[],
  schedule?: ScheduleOverrides
) {
  const daysToExport: DayOfWeek[] = day === 'all' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] : [day];
  const rowNames = kind === 'students' ? students : staffList;
  const rows: (string | number | null | undefined)[][] = [];

  daysToExport.forEach((d) => {
    const slots = slotsFor(d, schedule);
    rows.push([`=== ${DAY_FULL[d]} — ${kind === 'students' ? 'Students Timetable' : 'Staff Deployment'} ===`]);
    const header = ['Day', 'Name', ...slots.map((s) => `${s.label} (${s.start}-${s.end})`)];
    if (d === 'Fri') {
      header.push('Early Finish (11:30)');
    }
    rows.push(header);

    rowNames.forEach((name) => {
      const row = [d, name];
      slots.forEach((s) => {
        if (kind === 'students') {
          const e = entries.find((x) => x.student === name && x.day === d && x.slotId === s.id);
          const active = getActiveSupport(name, d, s.id, entries, assignments, primarySupport);
          if (e) {
            const lsaBadge =
              active?.lsa && active.lsa !== '__NONE__' ? ` [${active.lsa}]` : '';
            row.push(
              `${e.subject}${e.lessonType === 'withdrawal' ? ' (Withdrawal)' : ''}${e.teacher ? ' / ' + e.teacher : ''}${
                e.room ? ' / Rm ' + e.room : ''
              }${lsaBadge}`
            );
          } else {
            row.push(s.type === 'fixed' ? s.defaultLabel || 'Registration' : '');
          }
        } else {
          const assigns = assignmentsForLsaSlot(name, d, s.id, students, entries, assignments, primarySupport);
          if (assigns.length === 0) {
            row.push('');
          } else {
            const parts = assigns.map((a) => {
              const e = entries.find((x) => x.student === a.student && x.day === d && x.slotId === s.id);
              return `${a.student} (${e?.subject || 'Support'}${e?.room ? ', Rm ' + e.room : ''}${
                e?.lessonType === 'withdrawal' ? ', Withdrawal' : ''
              })`;
            });
            row.push(parts.join('; '));
          }
        }
      });
      if (d === 'Fri') {
        row.push('Early Finish (11:30)');
      }
      rows.push(row);
    });
    rows.push([]);
  });

  const filename = day === 'all' ? `Full_Week_${kind}_timetable.csv` : `${DAY_FULL[day]}_${kind}_timetable.csv`;
  downloadCSVFile(filename, rows);
}

export function exportGridPDF(
  kind: 'students' | 'staff',
  day: DayOfWeek,
  students: string[],
  staffList: string[],
  entries: TimetableEntry[],
  assignments: LsaAssignment[],
  primarySupport: PrimarySupportAssignment[],
  schedule?: ScheduleOverrides,
  staffNotes?: StaffSlotNote[],
  staffPool?: StaffMember[]
) {
  const slots = slotsFor(day, schedule);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const staffDesignationByName = new Map<string, StaffDesignation>();
  if (staffPool) {
    staffPool.forEach((m) => {
      staffDesignationByName.set(m.name.trim().toLowerCase(), getStaffDesignation(m));
    });
  }

  const orderedStaff = staffPool && staffPool.length > 0 ? getOrderedStaffNames(staffPool) : staffList;
  const rosterItems = kind === 'students' ? students : orderedStaff;
  const totalItems = rosterItems.length;

  // If roster is long (> 7 items), divide into several balanced pages
  // Each page will comfortably hold 5-7 rows with generous cell height without clipping
  const pageChunks: string[][] = [];
  if (totalItems <= 7) {
    pageChunks.push(rosterItems);
  } else {
    const totalPages = Math.ceil(totalItems / 7);
    const itemsPerPage = Math.ceil(totalItems / totalPages);
    for (let i = 0; i < totalItems; i += itemsPerPage) {
      pageChunks.push(rosterItems.slice(i, i + itemsPerPage));
    }
  }

  const isFriday = day === 'Fri';
  const formatSlotHeader = (s: TimeSlot) => {
    let lbl = s.label;
    if (s.id === 'reg') lbl = 'Reg';
    else if (s.id === 'brk1') lbl = 'Break 1';
    else if (s.id === 'brk2') lbl = 'Break 2';
    else if (s.id === 'brk') lbl = 'Break';
    else lbl = s.label.replace('Lesson ', 'L');
    return `${lbl}\n${s.start}–${s.end}`;
  };

  const headCols = [kind === 'students' ? 'Student' : 'Staff', ...slots.map(formatSlotHeader)];
  if (isFriday) {
    headCols.push('Early Finish\n11:30');
  }
  const head = [headCols];
  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const titleText = `${DAY_FULL[day]} — ${kind === 'students' ? 'All Students Timetable' : 'Staff Deployment Timetable'}`;
  const totalPages = Math.max(1, pageChunks.length);

  pageChunks.forEach((chunk, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage('a4', 'landscape');
    }

    const chunkRowHeight = Math.min(30, Math.max(20, Math.floor(162 / Math.max(1, chunk.length))));
    const startIdx = pageChunks.slice(0, pageIndex).reduce((acc, c) => acc + c.length, 0);
    const endIdx = startIdx + chunk.length;

    const pageSubtitle = totalPages > 1
      ? (kind === 'students'
          ? `Student schedule & support allocations · Page ${pageIndex + 1} of ${totalPages} (Students ${startIdx + 1}–${endIdx} of ${totalItems})`
          : `Staff allocations & lesson support · Page ${pageIndex + 1} of ${totalPages} (Staff ${startIdx + 1}–${endIdx} of ${totalItems})`)
      : (kind === 'students'
          ? `Consolidated schedule of student lessons and assigned support (${totalItems} students)`
          : `Consolidated staff allocations and lesson support deployments (${totalItems} staff members)`);

    const pageBody: any[] = [];

    if (kind === 'students') {
      chunk.forEach((student) => {
        const row: any[] = [
          {
            content: student,
            styles: {
              fontStyle: 'bold',
              fillColor: [248, 250, 252],
              textColor: [15, 23, 42],
              fontSize: 7.5,
              halign: 'center',
              valign: 'middle',
              minCellHeight: chunkRowHeight,
            },
          },
        ];
        let skipCols = 0;
        slots.forEach((s, i) => {
          if (skipCols > 0) {
            skipCols--;
            return;
          }
          let colSpan = 1;
          const nextSlot = slots[i + 1];
          if (canStudentSlotsMerge(student, day, s, nextSlot, entries)) {
            colSpan = 2;
            skipCols = 1;
          }

          const entry = getEntryLookup(entries).get(`${student}|${day}|${s.id}`);
          const active = getActiveSupport(student, day, s.id, entries, assignments, primarySupport, staffNotes);
          const isFixed = isFixedOrRegistrationSlot(s, entry);

          if (entry) {
            const isWithdrawal = entry.lessonType === 'withdrawal';
            const lines: string[] = [entry.subject + (isWithdrawal ? ' [Withdrawal]' : '')];
            const meta = [entry.teacher, entry.room ? `Rm ${entry.room}` : ''].filter(Boolean).join(' · ');
            if (meta) lines.push(meta);
            if (active && active.lsa && active.lsa !== '__NONE__') {
              lines.push(
                active.type === 'cover'
                  ? `Cover: ${active.lsa}`
                  : active.type === 'secondary'
                  ? `Secondary: ${active.lsa}`
                  : `Support: ${active.lsa}`
              );
            }

            row.push({
              content: lines.join('\n'),
              colSpan,
              isObliquePattern: isFixed,
              isWithdrawalPattern: isFixed && isWithdrawal,
              styles: {
                fillColor: isWithdrawal ? [220, 238, 251] : isFixed ? [241, 245, 249] : [255, 255, 255],
                textColor: isWithdrawal ? [2, 132, 199] : [15, 23, 42],
                fontStyle: isWithdrawal ? 'bold' : 'normal',
                fontSize: 6.2,
                cellPadding: 1.0,
                valign: 'top',
                minCellHeight: chunkRowHeight,
              },
            });
          } else if (isFixed) {
            row.push({
              content: s.defaultLabel || 'Registration',
              colSpan,
              isObliquePattern: true,
              isWithdrawalPattern: false,
              styles: {
                fillColor: [241, 245, 249],
                textColor: [100, 116, 139],
                fontStyle: 'italic',
                fontSize: 6.0,
                cellPadding: 1.0,
                halign: 'center',
                valign: 'top',
                minCellHeight: chunkRowHeight,
              },
            });
          } else {
            row.push({
              content: '',
              colSpan,
              styles: {
                fillColor: [255, 255, 255],
                cellPadding: 1.0,
                valign: 'top',
                minCellHeight: chunkRowHeight,
              },
            });
          }
        });

        if (isFriday) {
          row.push({
            content: 'Early Finish (11:30)',
            styles: {
              fontStyle: 'italic',
              textColor: [100, 116, 139],
              fillColor: [248, 250, 252],
              halign: 'center',
              valign: 'middle',
              fontSize: 6.5,
              minCellHeight: chunkRowHeight,
            },
          });
        }

        pageBody.push(row);
      });
    } else {
      // kind === 'staff'
      chunk.forEach((staffName) => {
        const isSend = staffDesignationByName.get(staffName.trim().toLowerCase()) === 'SEND';
        const row: any[] = [
          {
            content: staffName,
            styles: {
              fontStyle: 'bold',
              fillColor: [248, 250, 252],
              textColor: isSend ? [29, 78, 216] : [15, 23, 42],
              fontSize: 7.5,
              halign: 'center',
              valign: 'middle',
              minCellHeight: chunkRowHeight,
            },
          },
        ];
        let skipCols = 0;
        slots.forEach((s, i) => {
          if (skipCols > 0) {
            skipCols--;
            return;
          }
          let colSpan = 1;
          const nextSlot = slots[i + 1];
          if (canStaffSlotsMerge(staffName, day, s, nextSlot, students, entries, assignments, primarySupport, staffNotes)) {
            colSpan = 2;
            skipCols = 1;
          }

          const cellNotes = (staffNotes || []).filter(
            (n) => n.staffName.toLowerCase() === staffName.toLowerCase() && n.day === day && n.slotId === s.id
          );
          const coveringNote = (staffNotes || []).find(
            (n) => n.coveredBy?.toLowerCase() === staffName.toLowerCase() && n.day === day && n.slotId === s.id && n.isCover
          );

          const assigned = assignmentsForLsaSlot(staffName, day, s.id, students, entries, assignments, primarySupport);
          if (assigned.length === 0 && cellNotes.length === 0 && !coveringNote) {
            row.push({
              content: s.type === 'fixed' ? s.defaultLabel || 'Break' : '',
              colSpan,
              styles: {
                fillColor: s.type === 'fixed' ? [248, 250, 252] : [255, 255, 255],
                textColor: [100, 116, 139],
                fontStyle: 'italic',
                fontSize: 6.0,
                cellPadding: 1.0,
                halign: s.type === 'fixed' ? 'center' : 'left',
                valign: 'top',
                minCellHeight: chunkRowHeight,
              },
            });
          } else {
            const isStruckThrough = coveringNote?.confirmedConflict;
            const prefix = isStruckThrough ? '[CONFLICT] ' : '';
            const topNotes = cellNotes.filter((cn) => cn.position === 'top' || cn.pinToTop);
            const bottomNotes = cellNotes.filter((cn) => cn.position !== 'top' && !cn.pinToTop);

            const items: string[] = [];

            topNotes.forEach((cn) => {
              let noteStr = cn.isCover ? `[COVER: ${cn.coveredBy || 'Pending'}]` : `[NOTE]`;
              if (cn.text) noteStr += ` ${cn.text}`;
              items.push(noteStr);
            });

            const consolidated = consolidateStaffSlotAssignments(assigned, day, s.id, entries);
            consolidated.forEach((c) => {
              if (c.isClass) {
                const rm = c.room ? `Rm ${c.room}` : '';
                const tch = c.teacher ? `T: ${c.teacher}` : '';
                const w = c.lessonType === 'withdrawal' ? '[W]' : '';
                const meta = [c.subject, rm, tch, w].filter(Boolean).join(' · ');
                items.push(`${prefix}${meta}\nStudents: ${c.students.join(', ')}`);
                return;
              }
              const e = getEntryLookup(entries).get(`${c.students[0]}|${day}|${s.id}`);
              const sub = e?.subject || 'Support';
              const rm = e?.room ? `Rm ${e.room}` : '';
              const tch = e?.teacher ? `T: ${e.teacher}` : '';
              const w = e?.lessonType === 'withdrawal' ? '[W]' : '';
              const meta = [sub, rm, tch, w].filter(Boolean).join(' · ');
              items.push(`${prefix}${c.students[0]}${meta ? '\n' + meta : ''}`);
            });

            if (coveringNote) {
              let covStr = `[COVERING: ${coveringNote.staffName}]`;
              if (coveringNote.student) covStr += `\n${coveringNote.student}${coveringNote.subject ? ` · ${coveringNote.subject}` : ''}${coveringNote.room ? ` (Rm ${coveringNote.room})` : ''}`;
              if (coveringNote.text) covStr += `\n${coveringNote.text}`;
              items.push(covStr);
            }

            bottomNotes.forEach((cn) => {
              let noteStr = cn.isCover ? `[COVER: ${cn.coveredBy || 'Pending'}]` : `[NOTE]`;
              if (cn.text) noteStr += ` ${cn.text}`;
              items.push(noteStr);
            });

            const hasWithdrawal = assigned.some((a) => {
              const e = entries.find((x) => x.student === a.student && x.day === day && x.slotId === s.id);
              return e?.lessonType === 'withdrawal';
            });
            const isConflict = hasSlotConflict(assigned, entries);
            const isCoverDuty = Boolean(coveringNote && coveringNote.isCover) || cellNotes.some((n) => n.isCover);
            const activeHighlightNote = cellNotes.find((n) => n.highlight && !n.isCover);
            const highlightColor = isCoverDuty ? 'yellow' : activeHighlightNote ? (activeHighlightNote.highlightColor || 'yellow') : null;

            const pdfFillColor = highlightColor === 'green'
              ? [187, 247, 208]
              : highlightColor === 'blue'
              ? [186, 230, 253]
              : highlightColor === 'yellow'
              ? [254, 240, 138]
              : isConflict
              ? [251, 230, 228]
              : hasWithdrawal
              ? [220, 238, 251]
              : [255, 255, 255];

            const pdfTextColor = (highlightColor || cellNotes.length > 0)
              ? [220, 38, 38]
              : isConflict
              ? [178, 58, 49]
              : [15, 23, 42];

            row.push({
              content: items.join('\n\n'),
              colSpan,
              styles: {
                fillColor: pdfFillColor,
                textColor: pdfTextColor,
                fontSize: 6.2,
                cellPadding: 1.0,
                valign: 'top',
                minCellHeight: chunkRowHeight,
              },
            });
          }
        });

        if (isFriday) {
          row.push({
            content: 'Early Finish (11:30)',
            styles: {
              fontStyle: 'italic',
              textColor: [100, 116, 139],
              fillColor: [248, 250, 252],
              halign: 'center',
              valign: 'middle',
              fontSize: 6.5,
              minCellHeight: chunkRowHeight,
            },
          });
        }

        pageBody.push(row);
      });
    }

    // Header drawing
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(titleText, 10, 11);

    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(pageSubtitle, 10, 16);

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Department Timetable · Generated ${dateStr}`, 287, 11, { align: 'right' });

    // Exact proportional column widths spanning the full 285mm printable width of A4 landscape (6mm margins)
    const totalTableWidth = 285; // 297mm landscape - 12mm margins (6mm left + 6mm right)
    const columnStyles: Record<number, any> = {};

    if (isFriday) {
      const nameColWidth = 26;
      const fixedSlotWidth = 14;
      const fixedCount = slots.filter((s) => s.type === 'fixed').length;
      const lessonCount = slots.length - fixedCount;
      const remainingWidth = Math.max(40, totalTableWidth - nameColWidth - fixedCount * fixedSlotWidth);
      const lessonSlotWidth = lessonCount > 0 ? Math.min(24, Math.floor((remainingWidth * 0.65) / lessonCount)) : 24;
      const earlyFinishWidth = Math.max(20, remainingWidth - lessonCount * lessonSlotWidth);

      columnStyles[0] = { cellWidth: nameColWidth, halign: 'center', valign: 'middle' };
      slots.forEach((s, idx) => {
        columnStyles[idx + 1] = {
          cellWidth: s.type === 'fixed' ? fixedSlotWidth : lessonSlotWidth,
          halign: s.type === 'fixed' ? 'center' : 'left',
        };
      });
      columnStyles[slots.length + 1] = { cellWidth: earlyFinishWidth, halign: 'center', valign: 'middle' };
    } else {
      // Mon-Thu: 14 columns: Name (22mm), 3 Fixed (12mm each = 36mm), 10 Lesson (22.7mm each = 227mm) -> Sum = 285mm
      const nameColWidth = 22;
      const fixedSlotWidth = 12;
      const fixedCount = slots.filter((s) => s.type === 'fixed').length;
      const lessonCount = slots.length - fixedCount;
      const lessonSlotWidth = (totalTableWidth - nameColWidth - (fixedCount * fixedSlotWidth)) / Math.max(1, lessonCount);

      columnStyles[0] = { cellWidth: nameColWidth, halign: 'center', valign: 'middle' };
      slots.forEach((s, idx) => {
        columnStyles[idx + 1] = {
          cellWidth: s.type === 'fixed' ? fixedSlotWidth : lessonSlotWidth,
          halign: s.type === 'fixed' ? 'center' : 'left',
        };
      });
    }

    // Table drawing
    autoTable(doc, {
      head,
      body: pageBody,
      startY: 21,
      tableWidth: totalTableWidth,
      margin: { top: 21, bottom: 10, left: 6, right: 6 },
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: {
        fontSize: 6.2,
        cellPadding: 1.0,
        lineColor: [100, 116, 139],
        lineWidth: 0.2,
        valign: 'top',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [28, 35, 51],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        fontSize: 6.5,
        minCellHeight: 6.5,
        cellPadding: 0.8,
        lineColor: [100, 116, 139],
        lineWidth: 0.2,
      },
      bodyStyles: {
        minCellHeight: chunkRowHeight,
      },
      columnStyles,
      willDrawCell: (data: any) => {
        const raw = data.cell?.raw as any;
        if (data.section === 'body' && raw && typeof raw === 'object' && raw.isObliquePattern) {
          drawPdfObliqueStripes(
            doc,
            data.cell.x,
            data.cursor.y,
            data.cell.width,
            data.cell.height,
            Boolean(raw.isWithdrawalPattern)
          );
          data.cell.styles.fillColor = false as any;
          const lc = data.cell.styles.lineColor || [100, 116, 139];
          doc.setDrawColor(lc[0], lc[1], lc[2]);
          doc.setLineWidth(typeof data.cell.styles.lineWidth === 'number' ? data.cell.styles.lineWidth : 0.2);
          const tc = data.cell.styles.textColor || [15, 23, 42];
          doc.setTextColor(tc[0], tc[1], tc[2]);
        }
      },
    });

    // Footer drawing
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Official School Schedule · Department Timetable', 10, 204);
    if (totalPages > 1) {
      doc.text(`Page ${pageIndex + 1} of ${totalPages}`, 287, 204, { align: 'right' });
    }
  });

  doc.save(`${DAY_FULL[day]}_${kind}_timetable.pdf`);
}

function drawPdfObliqueStripes(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  isWithdrawal?: boolean
) {
  if (w <= 0 || h <= 0) return;
  if (isWithdrawal) {
    doc.setFillColor(220, 238, 251);
  } else {
    doc.setFillColor(255, 255, 255);
  }
  doc.rect(x, y, w, h, 'F');

  const inset = 0.2;
  const rx = x + inset;
  const ry = y + inset;
  const rw = Math.max(0, w - inset * 2);
  const rh = Math.max(0, h - inset * 2);
  if (rw <= 0 || rh <= 0) return;

  if (isWithdrawal) {
    doc.setDrawColor(201, 226, 245);
  } else {
    doc.setDrawColor(226, 232, 240);
  }
  doc.setLineWidth(0.75);

  const step = 2.0;
  const maxD = rw + rh;
  for (let d = step * 0.5; d < maxD; d += step) {
    const x1Offset = Math.max(0, d - rh);
    const y1Offset = d - x1Offset;
    const x2Offset = Math.min(rw, d);
    const y2Offset = d - x2Offset;
    doc.line(rx + x1Offset, ry + y1Offset, rx + x2Offset, ry + y2Offset);
  }
}

export function exportIndividualPDF(
  type: 'student' | 'staff',
  name: string,
  entries: TimetableEntry[],
  assignments: LsaAssignment[],
  primarySupport: PrimarySupportAssignment[],
  students: string[],
  schedule?: ScheduleOverrides,
  indivDayView: DayOfWeek | 'all' = 'all',
  rowExpansion: 'compact' | 'standard' | 'expanded' = 'standard',
  staffNotes?: StaffSlotNote[]
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Document Title & Metadata
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  const titleText = `${name} — ${type === 'student' ? 'Student Timetable' : 'Staff Support Timetable'}`;
  doc.text(titleText, 14, 11);

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const subtitleText =
    indivDayView === 'all'
      ? 'Full Week Schedule (Monday – Friday)'
      : `${DAY_FULL[indivDayView]} Schedule`;
  doc.text(subtitleText, 14, 15);

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  doc.text(`Department Timetable · Generated ${dateStr}`, 283, 11, { align: 'right' });

  const isAllWeek = indivDayView === 'all';
  const monThuSlots = slotsFor('Mon', schedule);
  const friSlots = slotsFor('Fri', schedule);

  const studentEntries =
    type === 'student' ? entries.filter((e) => e.student === name && e.lessonType !== 'withdrawal') : [];
  const subjectColorMap = type === 'student' ? buildStudentSubjectColorMap(studentEntries) : undefined;

  const startY = 17.5;
  const headHeight = 7.0; // strictly compact, do not expand header row

  const expansion = rowExpansion || 'standard';
  let targetRowHeight: number;
  if (isAllWeek) {
    if (expansion === 'compact') targetRowHeight = 21;
    else if (expansion === 'expanded') targetRowHeight = 27;
    else targetRowHeight = 24;
  } else {
    if (expansion === 'compact') targetRowHeight = 70;
    else if (expansion === 'expanded') targetRowHeight = 90;
    else targetRowHeight = 80;
  }

  const buildDayRow = (day: DayOfWeek, daySlots: TimeSlot[], rowMinHeight: number) => {
    const row: any[] = [
      {
        content: DAY_FULL[day],
        styles: {
          fontStyle: 'bold',
          fillColor: type === 'student' ? STUDENT_DAYS_FILL.rgb : [248, 250, 252],
          textColor: [15, 23, 42],
          fontSize: 8.5,
          halign: 'center',
          valign: 'middle',
          minCellHeight: rowMinHeight,
        },
      },
    ];
    let skipCols = 0;

    daySlots.forEach((s, i) => {
      if (skipCols > 0) {
        skipCols--;
        return;
      }
      let colSpan = 1;
      const nextSlot = daySlots[i + 1];

      if (type === 'student') {
        if (canStudentSlotsMerge(name, day, s, nextSlot, entries)) {
          colSpan = 2;
          skipCols = 1;
        }

        const entry = getEntryLookup(entries).get(`${name}|${day}|${s.id}`);
        const isFixed = isFixedOrRegistrationSlot(s, entry);

        if (entry) {
          const isWithdrawal = entry.lessonType === 'withdrawal';
          const fill = isWithdrawal
            ? WITHDRAWAL_FILL
            : isFixed
            ? { hex: '#F1F5F9', rgb: [241, 245, 249] as [number, number, number], borderHex: '#64748B' }
            : getStudentSubjectFill(entry.subject, subjectColorMap);

          const lines: string[] = [entry.subject + (isWithdrawal ? ' [Withdrawal]' : '')];
          const meta = [entry.teacher, entry.room ? `Rm ${entry.room}` : ''].filter(Boolean).join(' · ');
          if (meta) lines.push(meta);

          row.push({
            content: lines.join('\n'),
            colSpan,
            isObliquePattern: isFixed,
            isWithdrawalPattern: isFixed && isWithdrawal,
            styles: {
              fillColor: fill.rgb,
              textColor: isWithdrawal ? [2, 132, 199] : [15, 23, 42],
              fontStyle: isWithdrawal ? 'bold' : 'normal',
              fontSize: expansion === 'compact' ? 7.2 : 7.6,
              cellPadding: expansion === 'compact' ? 1.4 : 1.8,
              valign: 'top',
              minCellHeight: rowMinHeight,
            },
          });
        } else if (isFixed) {
          row.push({
            content: s.defaultLabel || 'Registration',
            colSpan,
            isObliquePattern: true,
            isWithdrawalPattern: false,
            styles: {
              fillColor: [241, 245, 249],
              textColor: [100, 116, 139],
              fontStyle: 'italic',
              fontSize: 7,
              cellPadding: 1.5,
              valign: 'top',
              minCellHeight: rowMinHeight,
            },
          });
        } else {
          row.push({
            content: '',
            colSpan,
            styles: {
              fillColor: [255, 255, 255],
              cellPadding: 1.5,
              valign: 'top',
              minCellHeight: rowMinHeight,
            },
          });
        }
      } else {
        // Staff individual
        if (canStaffSlotsMerge(name, day, s, nextSlot, students, entries, assignments, primarySupport, staffNotes)) {
          colSpan = 2;
          skipCols = 1;
        }

        const cellNotes = (staffNotes || []).filter(
          (n) => n.staffName.toLowerCase() === name.toLowerCase() && n.day === day && n.slotId === s.id
        );
        const coveringNote = (staffNotes || []).find(
          (n) => n.coveredBy?.toLowerCase() === name.toLowerCase() && n.day === day && n.slotId === s.id && n.isCover
        );

        const assigned = assignmentsForLsaSlot(name, day, s.id, students, entries, assignments, primarySupport);
        if (assigned.length === 0 && cellNotes.length === 0 && !coveringNote) {
          row.push({
            content: '',
            colSpan,
            isObliquePattern: s.type === 'fixed',
            isWithdrawalPattern: false,
            styles: {
              fillColor: [255, 255, 255],
              cellPadding: 1.5,
              valign: 'top',
              minCellHeight: rowMinHeight,
            },
          });
        } else {
          const isStruckThrough = coveringNote?.confirmedConflict;
          const topNotes = cellNotes.filter((cn) => cn.position === 'top' || cn.pinToTop);
          const bottomNotes = cellNotes.filter((cn) => cn.position !== 'top' && !cn.pinToTop);

          const items: string[] = [];

          topNotes.forEach((cn) => {
            let noteStr = cn.isCover ? `[COVER: ${cn.coveredBy || 'Pending'}]` : `[NOTE]`;
            if (cn.text) noteStr += ` ${cn.text}`;
            items.push(noteStr);
          });

          assigned.forEach((a) => {
            const e = getEntryLookup(entries).get(`${a.student}|${day}|${s.id}`);
            const sub = e?.subject || 'Support';
            const rm = e?.room ? `Rm ${e.room}` : '';
            const tch = e?.teacher ? `Teacher: ${e.teacher}` : '';
            const w = e?.lessonType === 'withdrawal' ? '[Withdrawal]' : '';
            const meta = [sub, rm, tch, w].filter(Boolean).join(' · ');
            const prefix = isStruckThrough ? '[CONFLICT/COVERED] ' : '';
            items.push(`${prefix}${a.student}${meta ? '\n' + meta : ''}`);
          });

          if (coveringNote) {
            let covStr = `[COVERING: ${coveringNote.staffName}]`;
            if (coveringNote.student) covStr += `\n${coveringNote.student}${coveringNote.subject ? ` · ${coveringNote.subject}` : ''}${coveringNote.room ? ` (Rm ${coveringNote.room})` : ''}`;
            if (coveringNote.text) covStr += `\n${coveringNote.text}`;
            items.push(covStr);
          }

          bottomNotes.forEach((cn) => {
            let noteStr = cn.isCover ? `[COVER: ${cn.coveredBy || 'Pending'}]` : `[NOTE]`;
            if (cn.text) noteStr += ` ${cn.text}`;
            items.push(noteStr);
          });

          const hasWithdrawal = assigned.some((a) => {
            const e = entries.find((x) => x.student === a.student && x.day === day && x.slotId === s.id);
            return e?.lessonType === 'withdrawal';
          });
          const isConflict = hasSlotConflict(assigned, entries);
          const isCoverDuty = Boolean(coveringNote && coveringNote.isCover) || cellNotes.some((n) => n.isCover);
          const activeHighlightNote = cellNotes.find((n) => n.highlight && !n.isCover);
          const highlightColor = isCoverDuty ? 'yellow' : activeHighlightNote ? (activeHighlightNote.highlightColor || 'yellow') : null;

          const pdfFillColor = highlightColor === 'green'
            ? [187, 247, 208]
            : highlightColor === 'blue'
            ? [186, 230, 253]
            : highlightColor === 'yellow'
            ? [254, 240, 138]
            : isConflict
            ? [251, 230, 228]
            : hasWithdrawal
            ? [220, 238, 251]
            : [255, 255, 255];

          const pdfTextColor = (highlightColor || cellNotes.length > 0)
            ? [220, 38, 38]
            : isConflict
            ? [178, 58, 49]
            : [15, 23, 42];

          row.push({
            content: items.join(assigned.length > 2 ? '\n' : '\n\n'),
            colSpan,
            isObliquePattern: s.type === 'fixed' && !highlightColor && !isConflict,
            isWithdrawalPattern: s.type === 'fixed' && hasWithdrawal,
            styles: {
              fillColor: pdfFillColor,
              textColor: pdfTextColor,
              fontSize: assigned.length > 1 ? 6.8 : (expansion === 'compact' ? 7.0 : 7.5),
              cellPadding: assigned.length > 1 ? 1.4 : (expansion === 'compact' ? 1.4 : 1.8),
              valign: 'top',
              minCellHeight: rowMinHeight,
            },
          });
        }
      }
    });

    return row;
  };

  const isStudent = type === 'student';
  const commonAutoTableStyles = {
    theme: 'grid' as const,
    margin: { top: 16, bottom: 6, left: 10, right: 10 },
    pageBreak: 'avoid' as const,
    styles: {
      fontSize: expansion === 'compact' ? 7.2 : expansion === 'expanded' ? 8.0 : 7.5,
      cellPadding: expansion === 'compact' ? 1.4 : expansion === 'expanded' ? 2.0 : 1.8,
      lineColor: [100, 116, 139] as [number, number, number],
      lineWidth: 0.2,
      valign: 'top' as const,
      overflow: 'linebreak' as const,
    },
    headStyles: {
      fillColor: (isStudent ? STUDENT_HEADER_PEACH_FILL.rgb : [28, 35, 51]) as [number, number, number],
      textColor: (isStudent ? [15, 23, 42] : [255, 255, 255]) as [number, number, number],
      fontStyle: 'bold' as const,
      halign: 'center' as const,
      valign: 'middle' as const,
      fontSize: 7.2,
      minCellHeight: headHeight, // strictly compact, do not expand header row
      cellPadding: 1.5,
      lineColor: [100, 116, 139] as [number, number, number],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center' as const, valign: 'middle' as const },
    },
    didParseCell: (data: any) => {
      if (isStudent) {
        if (data.section === 'head') {
          if (data.column.index === 0) {
            data.cell.styles.fillColor = STUDENT_DAYS_FILL.rgb; // fixed light greyish blue for Day header
            data.cell.styles.textColor = [15, 23, 42];
          } else {
            data.cell.styles.fillColor = STUDENT_HEADER_PEACH_FILL.rgb; // fixed light peach for lesson/time header
            data.cell.styles.textColor = [15, 23, 42];
          }
        } else if (data.section === 'body' && data.column.index === 0) {
          data.cell.styles.fillColor = STUDENT_DAYS_FILL.rgb; // fixed light greyish blue for days column
          data.cell.styles.textColor = [15, 23, 42];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    willDrawCell: (data: any) => {
      const raw = data.cell?.raw as any;
      if (data.section === 'body' && raw && typeof raw === 'object' && raw.isObliquePattern) {
        drawPdfObliqueStripes(
          doc,
          data.cell.x,
          data.cursor.y,
          data.cell.width,
          data.cell.height,
          Boolean(raw.isWithdrawalPattern)
        );
        data.cell.styles.fillColor = false as any;
        const lc = data.cell.styles.lineColor || [100, 116, 139];
        doc.setDrawColor(lc[0], lc[1], lc[2]);
        doc.setLineWidth(typeof data.cell.styles.lineWidth === 'number' ? data.cell.styles.lineWidth : 0.2);
        const tc = data.cell.styles.textColor || [15, 23, 42];
        doc.setTextColor(tc[0], tc[1], tc[2]);
      }
    },
  };

  if (isAllWeek) {
    // Two seamless tables on the landscape page:
    // 1) Monday – Thursday (4 rows)
    // 2) Friday with its own separate header inserted between Thursday and Friday!
    // Table 1: Mon – Thu
    const monThuHead = [['Day', ...monThuSlots.map((s) => `${s.label}\n${s.start}–${s.end}`)]];
    const monThuBody = (['Mon', 'Tue', 'Wed', 'Thu'] as DayOfWeek[]).map((d) =>
      buildDayRow(d, monThuSlots, targetRowHeight)
    );

    autoTable(doc, {
      ...commonAutoTableStyles,
      head: monThuHead,
      body: monThuBody,
      startY,
      bodyStyles: {
        minCellHeight: targetRowHeight,
      },
    });

    // Table 2: Friday with separate header inserted between Thursday and Friday
    const friHead = [
      ['Day', ...friSlots.map((s) => `${s.label}\n${s.start}–${s.end}`), 'Early Finish\n11:30'],
    ];
    const friRow = buildDayRow('Fri', friSlots, targetRowHeight);
    friRow.push({
      content: 'School closes at 11:30',
      styles: {
        fillColor: [241, 245, 249],
        textColor: [100, 116, 139],
        fontStyle: 'italic',
        halign: 'center',
        valign: 'middle',
        fontSize: 7.2,
        minCellHeight: targetRowHeight,
      },
    });

    const nextStartY = ((doc as any).lastAutoTable?.finalY || 128) + 2;

    autoTable(doc, {
      ...commonAutoTableStyles,
      head: friHead,
      body: [friRow],
      startY: nextStartY,
      bodyStyles: {
        minCellHeight: targetRowHeight,
      },
    });
  } else if (indivDayView === 'Fri') {
    const friHead = [
      ['Day', ...friSlots.map((s) => `${s.label}\n${s.start}–${s.end}`), 'Early Finish\n11:30'],
    ];
    const friRow = buildDayRow('Fri', friSlots, targetRowHeight);
    friRow.push({
      content: 'School closes at 11:30',
      styles: {
        fillColor: [241, 245, 249],
        textColor: [100, 116, 139],
        fontStyle: 'italic',
        halign: 'center',
        valign: 'middle',
        fontSize: 7.8,
        minCellHeight: targetRowHeight,
      },
    });

    autoTable(doc, {
      ...commonAutoTableStyles,
      head: friHead,
      body: [friRow],
      startY,
      bodyStyles: {
        minCellHeight: targetRowHeight,
      },
    });
  } else {
    const daySlots = slotsFor(indivDayView, schedule);
    const head = [['Day', ...daySlots.map((s) => `${s.label}\n${s.start}–${s.end}`)]];
    const body = [buildDayRow(indivDayView, daySlots, targetRowHeight)];

    autoTable(doc, {
      ...commonAutoTableStyles,
      head,
      body,
      startY,
      bodyStyles: {
        minCellHeight: targetRowHeight,
      },
    });
  }

  // Strictly enforce single page constraint for individual timetables
  while (doc.getNumberOfPages() > 1) {
    doc.deletePage(doc.getNumberOfPages());
  }

  doc.save(`${name.replace(/[^\w\- ]/g, '')}_timetable.pdf`);
}

export function downloadTimetableHTML(options: PrintTimetableDocumentOptions, filename: string): void {
  const html = generateTimetableDocumentHTML(options);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}


export function generateCsvTemplate(): string {
  return (
    'Student,Day,Period,Subject,Teacher,Room,Lesson Type\n' +
    'Amira Hassan,Mon,Registration,Registration,Mr Owens,B12,In-class\n' +
    'Amira Hassan,Mon,Lesson1,Mathematics,Mr Owens,B12,In-class\n' +
    'Amira Hassan,Mon,Lesson2a,English,Ms Farah,A04,In-class\n' +
    'Amira Hassan,Mon,Lesson2b,Literacy Intervention,Ms Kaur,SEN1,Withdrawal\n' +
    'Jacob Lee,Fri,Lesson2,Science,Dr Patel,Lab 2,In-class\n'
  );
}

export interface PrintTimetableDocumentOptions {
  view: 'students' | 'staff' | 'individual';
  day: DayOfWeek;
  allDays?: boolean;
  students: string[];
  staffList: string[];
  staffPool?: StaffMember[];
  entries: TimetableEntry[];
  assignments: LsaAssignment[];
  primarySupport: PrimarySupportAssignment[];
  schedule?: ScheduleOverrides;
  indivType?: 'student' | 'staff';
  indivName?: string | null;
  indivDayView?: DayOfWeek | 'all';
  rowExpansion?: 'compact' | 'standard' | 'expanded';
  staffNotes?: StaffSlotNote[];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateTimetableDocumentHTML(options: PrintTimetableDocumentOptions): string {
  const {
    view,
    day,
    students,
    staffList,
    staffPool,
    entries,
    assignments,
    primarySupport,
    schedule,
    indivType = 'student',
    indivName = '',
    indivDayView = 'all',
  } = options;

  const staffDesignationByName = new Map<string, StaffDesignation>();
  if (staffPool) {
    staffPool.forEach((m) => {
      staffDesignationByName.set(m.name.trim().toLowerCase(), getStaffDesignation(m));
    });
  }

  let docTitle = 'Department Timetable';
  let docSubtitle = '';
  let tableHeaderHtml = '';
  let pagesHtml = '';

  const nowStr = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const entryMap = getEntryLookup(entries);

  if (view === 'students' || view === 'staff') {
    const isStudents = view === 'students';
    const daysToPrint: DayOfWeek[] = options.allDays ? DAYS : [day];
    docTitle = options.allDays ? `Department Timetable — Full Week (Mon–Fri)` : `Department Timetable — ${DAY_FULL[day]}`;
    const orderedStaff = staffPool && staffPool.length > 0 ? getOrderedStaffNames(staffPool) : staffList;
    const rosterItems = isStudents ? students : orderedStaff;
    const totalItems = rosterItems.length;

    docSubtitle = isStudents
      ? `Student Timetable & Support Allocations (${totalItems} students)`
      : `Staff Deployment & Support Allocation (${totalItems} staff members)`;

    // Partition roster items into balanced pages (max 7 rows per page)
    const pageChunks: string[][] = [];
    if (totalItems <= 7) {
      pageChunks.push(rosterItems);
    } else {
      const totalPages = Math.ceil(totalItems / 7);
      const itemsPerPage = Math.ceil(totalItems / totalPages);
      for (let i = 0; i < totalItems; i += itemsPerPage) {
        pageChunks.push(rosterItems.slice(i, i + itemsPerPage));
      }
    }

    const totalPagesPerDay = Math.max(1, pageChunks.length);

    pagesHtml = daysToPrint
      .map((printDay) => {
        const daySlots = slotsFor(printDay, schedule);
        const dayTitle = `Department Timetable — ${DAY_FULL[printDay]}`;

        const numSlots = daySlots.length;
        const isShortDay = numSlots <= 8;
        const nameWeight = isShortDay ? 1.4 : 1.3;
        const fixedWeight = 0.72;
        const lessonWeight = 1.05;

        const totalWeight = nameWeight + daySlots.reduce((acc, s) => acc + (s.type === 'fixed' ? fixedWeight : lessonWeight), 0);
        const nameColPct = ((nameWeight / totalWeight) * 100).toFixed(2);
        const colGroupHtml = `
          <colgroup>
            <col style="width: ${nameColPct}%;" />
            ${daySlots
              .map((s) => {
                const w = s.type === 'fixed' ? fixedWeight : lessonWeight;
                const pct = ((w / totalWeight) * 100).toFixed(2);
                return `<col style="width: ${pct}%;" />`;
              })
              .join('')}
          </colgroup>
        `;

        const dayTableHeaderHtml = `
          <tr>
            <th class="name-header">${isStudents ? 'Student' : 'Staff Member'}</th>
            ${daySlots
              .map(
                (s) => `
              <th class="slot-header">
                <div class="slot-name">${escapeHtml(s.label)}</div>
                <div class="slot-time">${escapeHtml(s.start)}–${escapeHtml(s.end)}</div>
              </th>`
              )
              .join('')}
          </tr>
        `;

        return pageChunks
          .map((chunk, pageIdx) => {
            const startIdx = pageChunks.slice(0, pageIdx).reduce((acc, c) => acc + c.length, 0);
            const endIdx = startIdx + chunk.length;
            const chunkRowHeight = Math.min(24, Math.max(17, Math.floor(142 / Math.max(1, chunk.length)))) + 'mm';

            const pageSubtitle = totalPagesPerDay > 1
              ? `${docSubtitle} · Page ${pageIdx + 1} of ${totalPagesPerDay} (${isStudents ? 'Students' : 'Staff'} ${startIdx + 1}–${endIdx} of ${totalItems})`
              : docSubtitle;

            const chunkRowsHtml = isStudents
              ? chunk
                  .map((student) => {
                    let skip = 0;
                    const cells: string[] = [];

                    daySlots.forEach((s, i) => {
                      if (skip > 0) {
                        skip--;
                        return;
                      }

                      let colspan = 1;
                      const nextSlot = daySlots[i + 1];
                      if (canStudentSlotsMerge(student, printDay, s, nextSlot, entries)) {
                        colspan = 2;
                        skip = 1;
                      }

                      const entry = entryMap.get(`${student}|${printDay}|${s.id}`);
                      const active = getActiveSupport(student, printDay, s.id, entries, assignments, primarySupport, options.staffNotes);
                      const isFixed = isFixedOrRegistrationSlot(s, entry);

                      let cellContent = '';
                      if (entry) {
                        const isWithdrawal = entry.lessonType === 'withdrawal';
                        cellContent = `
                          <div class="cell-subject ${isWithdrawal ? 'withdrawal-text' : ''}">
                            ${escapeHtml(entry.subject)}
                            ${isWithdrawal ? '<span class="badge-w">Withdrawal</span>' : ''}
                          </div>
                          ${
                            entry.teacher || entry.room
                              ? `<div class="cell-meta">${escapeHtml(
                                  [entry.teacher, entry.room ? `Rm ${entry.room}` : ''].filter(Boolean).join(' · ')
                                )}</div>`
                              : ''
                          }
                          ${
                            active && active.lsa && active.lsa !== '__NONE__'
                              ? `<div class="cell-lsa">${escapeHtml(active.lsa)}</div>`
                              : ''
                          }
                        `;
                      } else if (isFixed) {
                        cellContent = `<div class="cell-fixed">${escapeHtml(s.defaultLabel || 'Registration')}</div>`;
                      } else {
                        cellContent = '';
                      }

                      const cellClass =
                        entry?.lessonType === 'withdrawal'
                          ? isFixed
                            ? 'cell-fixed-withdrawal'
                            : 'cell-withdrawal-bg'
                          : isFixed
                          ? 'cell-fixed-slot'
                          : !entry
                          ? 'empty-cell'
                          : '';

                      cells.push(`
                        <td colspan="${colspan}" class="${cellClass}">
                          ${cellContent}
                        </td>
                      `);
                    });

                    return `
                      <tr>
                        <td class="name-cell">${escapeHtml(student)}</td>
                        ${cells.join('')}
                      </tr>
                    `;
                  })
                  .join('')
              : chunk
                  .map((staffName) => {
                    let skip = 0;
                    const cells: string[] = [];

                    daySlots.forEach((s, i) => {
                      if (skip > 0) {
                        skip--;
                        return;
                      }

                      let colspan = 1;
                      const nextSlot = daySlots[i + 1];
                      if (canStaffSlotsMerge(staffName, printDay, s, nextSlot, students, entries, assignments, primarySupport, options.staffNotes)) {
                        colspan = 2;
                        skip = 1;
                      }

                      const cellNotes = (options.staffNotes || []).filter(
                        (n) => n.staffName.toLowerCase() === staffName.toLowerCase() && n.day === printDay && n.slotId === s.id
                      );
                      const coveringNote = (options.staffNotes || []).find(
                        (n) => n.coveredBy?.toLowerCase() === staffName.toLowerCase() && n.day === printDay && n.slotId === s.id && n.isCover
                      );

                      const assigned = assignmentsForLsaSlot(staffName, printDay, s.id, students, entries, assignments, primarySupport);
                      if (assigned.length === 0 && cellNotes.length === 0 && !coveringNote) {
                        cells.push(
                          `<td colspan="${colspan}" class="empty-cell"></td>`
                        );
                      } else {
                        const isStruckThrough = Boolean(coveringNote);
                        const topNotes = cellNotes.filter((cn) => cn.position === 'top' || cn.pinToTop);
                        const bottomNotes = cellNotes.filter((cn) => cn.position !== 'top' && !cn.pinToTop);

                        let itemsHtml = '';
                        topNotes.forEach((cn) => {
                          const noteClass = cn.isCover
                            ? 'note-cover'
                            : cn.highlight
                            ? cn.highlightColor === 'green'
                              ? 'note-highlight-green'
                              : cn.highlightColor === 'blue'
                              ? 'note-highlight-blue'
                              : 'note-highlight'
                            : 'note-plain';

                          itemsHtml += `
                            <div class="note-box ${noteClass}">
                              ${cn.isCover ? `<div class="note-title">COVER: ${escapeHtml(cn.coveredBy || 'Pending')}</div>` : ''}
                              ${cn.text ? `<div class="note-text ${cn.bold ? 'note-bold' : ''}">${escapeHtml(cn.text)}</div>` : ''}
                            </div>
                          `;
                        });

                        itemsHtml += assigned
                          .map((a) => {
                            const e = entryMap.get(`${a.student}|${printDay}|${s.id}`);
                            return `
                              <div class="staff-assignment-item ${isStruckThrough ? 'struck-through' : ''}">
                                <div class="cell-student-name">
                                  ${escapeHtml(a.student)}
                                  ${isStruckThrough ? '<span class="badge-relieved">Relieved</span>' : ''}
                                </div>
                                <div class="cell-meta">
                                  ${escapeHtml(e?.subject || 'Support')}
                                  ${e?.teacher ? `· <span class="badge-teacher">Tch: ${escapeHtml(e.teacher)}</span>` : ''}
                                  ${e?.room ? `· Rm ${escapeHtml(e.room)}` : ''}
                                  ${e?.lessonType === 'withdrawal' ? '<span class="badge-w">W</span>' : ''}
                                </div>
                              </div>
                            `;
                          })
                          .join('');

                        if (coveringNote) {
                          itemsHtml += `
                            <div class="note-box note-cover">
                              <div class="note-title">TAKING OVER SCHEDULE (COVERING: ${escapeHtml(coveringNote.staffName)})</div>
                              ${coveringNote.student ? `<div class="note-student">${escapeHtml(coveringNote.student)}${coveringNote.subject ? ` · ${escapeHtml(coveringNote.subject)}` : ''}${coveringNote.room ? ` (Rm ${escapeHtml(coveringNote.room)})` : ''}</div>` : ''}
                              ${coveringNote.text ? `<div class="note-text ${coveringNote.bold ? 'note-bold' : ''}">${escapeHtml(coveringNote.text)}</div>` : ''}
                            </div>
                          `;
                        }

                        bottomNotes.forEach((cn) => {
                          const noteClass = cn.isCover
                            ? 'note-cover'
                            : cn.highlight
                            ? cn.highlightColor === 'green'
                              ? 'note-highlight-green'
                              : cn.highlightColor === 'blue'
                              ? 'note-highlight-blue'
                              : 'note-highlight'
                            : 'note-plain';

                          itemsHtml += `
                            <div class="note-box ${noteClass}">
                              ${cn.isCover ? `<div class="note-title">COVER: ${escapeHtml(cn.coveredBy || 'Pending')}</div>` : ''}
                              ${cn.text ? `<div class="note-text ${cn.bold ? 'note-bold' : ''}">${escapeHtml(cn.text)}</div>` : ''}
                            </div>
                          `;
                        });

                        const hasW = assigned.some((a) => {
                          const e = entryMap.get(`${a.student}|${printDay}|${s.id}`);
                          return e?.lessonType === 'withdrawal';
                        });
                        const isConflict = hasSlotConflict(assigned, entries);

                        cells.push(`
                          <td colspan="${colspan}" class="${isConflict ? 'cell-conflict-bg' : hasW ? 'cell-withdrawal-bg' : ''}">
                            ${itemsHtml}
                          </td>
                        `);
                      }
                    });

                    const desig = staffDesignationByName.get(staffName.trim().toLowerCase());
                    return `
                      <tr>
                        <td class="name-cell"${desig === 'SEND' ? ' style="color: #1D4ED8 !important;"' : ''}>
                          ${escapeHtml(staffName)}
                        </td>
                        ${cells.join('')}
                      </tr>
                    `;
                  })
                  .join('');

            return `
              <div class="timetable-print-page" style="--row-height: ${chunkRowHeight};">
                <div class="doc-header">
                  <div class="doc-title-box">
                    <h1>${escapeHtml(dayTitle)}</h1>
                    <p>${escapeHtml(pageSubtitle)}</p>
                  </div>
                  <div class="doc-meta-box">
                    <div><strong>Department Timetable</strong></div>
                    <div>Date: ${nowStr}</div>
                    ${totalPagesPerDay > 1 ? `<div>Page ${pageIdx + 1} of ${totalPagesPerDay}</div>` : ''}
                  </div>
                </div>

                <table class="timetable-doc-table all-schedule-doc-table">
                  ${colGroupHtml}
                  <thead>
                    ${dayTableHeaderHtml}
                  </thead>
                  <tbody>
                    ${chunkRowsHtml}
                  </tbody>
                </table>

                <div class="doc-footer">
                  <span>Official School Schedule · Department Timetable</span>
                  <span>${totalPagesPerDay > 1 ? `Page ${pageIdx + 1} of ${totalPagesPerDay}` : 'Department Timetable'}</span>
                </div>
              </div>
            `;
          })
          .join('');
      })
      .join('');
  } else {
    // Individual View
    docTitle = `${indivType === 'student' ? 'Student' : 'Staff'} Timetable — ${escapeHtml(indivName || 'Selected')}`;
    docSubtitle = indivDayView === 'all' ? 'Full Week Schedule (Monday – Friday)' : `${DAY_FULL[indivDayView]} Schedule`;

    const daysToRender = indivDayView === 'all' ? DAYS : [indivDayView];
    const headerSlots = slotsFor(indivDayView === 'all' ? 'Mon' : indivDayView, schedule);
    const isStudentIndiv = indivType === 'student';

    tableHeaderHtml = `
      <tr>
        <th class="name-header" style="${isStudentIndiv ? 'background-color: #D8E2EF !important; color: #0f172a !important;' : ''}">Day</th>
        ${headerSlots
          .map(
            (s) => `
          <th class="slot-header" style="${isStudentIndiv ? 'background-color: #FFEDD5 !important; color: #0f172a !important;' : ''}">
            <div class="slot-name">${escapeHtml(s.label)}</div>
            <div class="slot-time" style="${isStudentIndiv ? 'color: #78350f !important;' : ''}">${escapeHtml(s.start)}–${escapeHtml(s.end)}</div>
          </th>`
          )
          .join('')}
      </tr>
    `;

    const studentEntries =
      indivType === 'student'
        ? entries.filter((e) => e.student === (indivName || '') && e.lessonType !== 'withdrawal')
        : [];
    const subjectColorMap = indivType === 'student' ? buildStudentSubjectColorMap(studentEntries) : undefined;

    const tableBodyHtml = daysToRender
      .map((d) => {
        const daySlots = slotsFor(d, schedule);
        let skip = 0;
        let usedCols = 0;
        const cells: string[] = [];

        daySlots.forEach((s, i) => {
          if (skip > 0) {
            skip--;
            return;
          }

          let colspan = 1;
          const nextSlot = daySlots[i + 1];

          if (indivType === 'student') {
            if (canStudentSlotsMerge(indivName || '', d, s, nextSlot, entries)) {
              colspan = 2;
              skip = 1;
            }
            usedCols += colspan;

            const entry = entryMap.get(`${indivName || ''}|${d}|${s.id}`);
            const isFixed = isFixedOrRegistrationSlot(s, entry);

            let cellContent = '';
            let cellBgStyle = '';
            let cellClass = '';

            if (entry) {
              const isWithdrawal = entry.lessonType === 'withdrawal';
              if (isFixed) {
                cellClass = isWithdrawal ? 'cell-fixed-withdrawal' : 'cell-fixed-slot';
              } else {
                const fill = isWithdrawal ? WITHDRAWAL_FILL : getStudentSubjectFill(entry.subject, subjectColorMap);
                cellBgStyle = `background-color: ${fill.hex} !important;`;
              }
              cellContent = `
                <div class="cell-subject ${isWithdrawal ? 'withdrawal-text' : ''}">
                  ${escapeHtml(entry.subject)}
                  ${isWithdrawal ? '<span class="badge-w">Withdrawal</span>' : ''}
                </div>
                ${
                  entry.teacher || entry.room
                    ? `<div class="cell-meta">${escapeHtml(
                        [entry.teacher, entry.room ? `Rm ${entry.room}` : ''].filter(Boolean).join(' · ')
                      )}</div>`
                    : ''
                }
              `;
            } else if (isFixed) {
              cellClass = 'cell-fixed-slot';
              cellContent = `<div class="cell-fixed">${escapeHtml(s.defaultLabel || 'Registration')}</div>`;
            } else {
              cellClass = 'empty-cell';
              cellContent = '';
            }

            cells.push(`
              <td colspan="${colspan}" class="${cellClass}" ${cellBgStyle ? `style="${cellBgStyle}"` : ''}>
                ${cellContent}
              </td>
            `);
          } else {
            // Staff individual
            if (canStaffSlotsMerge(indivName || '', d, s, nextSlot, students, entries, assignments, primarySupport, options.staffNotes)) {
              colspan = 2;
              skip = 1;
            }
            usedCols += colspan;

            const cellNotes = (options.staffNotes || []).filter(
              (n) => n.staffName.toLowerCase() === (indivName || '').toLowerCase() && n.day === d && n.slotId === s.id
            );
            const coveringNote = (options.staffNotes || []).find(
              (n) => n.coveredBy?.toLowerCase() === (indivName || '').toLowerCase() && n.day === d && n.slotId === s.id && n.isCover
            );

            const assigned = assignmentsForLsaSlot(indivName || '', d, s.id, students, entries, assignments, primarySupport);
            if (assigned.length === 0 && cellNotes.length === 0 && !coveringNote) {
              cells.push(
                `<td colspan="${colspan}" class="empty-cell"></td>`
              );
            } else {
              const isStruckThrough = Boolean(coveringNote);
              const topNotes = cellNotes.filter((cn) => cn.position === 'top' || cn.pinToTop);
              const bottomNotes = cellNotes.filter((cn) => cn.position !== 'top' && !cn.pinToTop);

              let itemsHtml = '';
              topNotes.forEach((cn) => {
                const noteClass = cn.isCover
                  ? 'note-cover'
                  : cn.highlight
                  ? cn.highlightColor === 'green'
                    ? 'note-highlight-green'
                    : cn.highlightColor === 'blue'
                    ? 'note-highlight-blue'
                    : 'note-highlight'
                  : 'note-plain';

                itemsHtml += `
                  <div class="note-box ${noteClass}">
                    ${cn.isCover ? `<div class="note-title">COVER: ${escapeHtml(cn.coveredBy || 'Pending')}</div>` : ''}
                    ${cn.text ? `<div class="note-text ${cn.bold ? 'note-bold' : ''}">${formatNoteMentionHTML(cn.text)}</div>` : ''}
                  </div>
                `;
              });

              const consolidated = consolidateStaffSlotAssignments(assigned, d, s.id, entries);
              itemsHtml += consolidated
                .map((c) => {
                  if (c.isClass) {
                    return `
                      <div class="staff-assignment-item ${isStruckThrough ? 'struck-through' : ''}">
                        <div class="cell-student-name">
                          ${escapeHtml(c.subject)}
                          <span class="badge-tag" style="background:#e0e7ff; color:#3730a3; border-color:#c7d2fe; margin-left: 3px;">Class (${c.students.length})</span>
                          ${isStruckThrough ? '<span class="badge-relieved">Relieved</span>' : ''}
                        </div>
                        <div class="cell-meta">
                          ${c.teacher ? `Teacher: ${escapeHtml(c.teacher)}` : ''}
                          ${c.room ? `· Rm ${escapeHtml(c.room)}` : ''}
                          ${c.lessonType === 'withdrawal' ? '<span class="badge-w">Withdrawal</span>' : ''}
                        </div>
                        <div class="cell-meta" style="color: #334155; font-weight: 500;">
                          Students: ${escapeHtml(c.students.join(', '))}
                        </div>
                      </div>
                    `;
                  }
                  const e = entryMap.get(`${c.students[0]}|${d}|${s.id}`);
                  return `
                    <div class="staff-assignment-item ${isStruckThrough ? 'struck-through' : ''}">
                      <div class="cell-student-name">
                        ${escapeHtml(c.students[0])}
                        ${isStruckThrough ? '<span class="badge-relieved">Relieved</span>' : ''}
                      </div>
                      <div class="cell-meta">
                        ${escapeHtml(e?.subject || 'Support')}
                        ${e?.teacher ? `· <span class="badge-teacher">Tch: ${escapeHtml(e.teacher)}</span>` : ''}
                        ${e?.room ? `· Rm ${escapeHtml(e.room)}` : ''}
                        ${e?.lessonType === 'withdrawal' ? '<span class="badge-w">Withdrawal</span>' : ''}
                      </div>
                    </div>
                  `;
                })
                .join('');

              if (coveringNote) {
                itemsHtml += `
                  <div class="note-box note-cover">
                    <div class="note-title">TAKING OVER SCHEDULE (COVERING: ${escapeHtml(coveringNote.staffName)})</div>
                    ${coveringNote.student ? `<div class="note-student">${escapeHtml(coveringNote.student)}${coveringNote.subject ? ` · ${escapeHtml(coveringNote.subject)}` : ''}${coveringNote.room ? ` (Rm ${escapeHtml(coveringNote.room)})` : ''}</div>` : ''}
                    ${coveringNote.text ? `<div class="note-text ${coveringNote.bold ? 'note-bold' : ''}">${formatNoteMentionHTML(coveringNote.text)}</div>` : ''}
                  </div>
                `;
              }

              bottomNotes.forEach((cn) => {
                const noteClass = cn.isCover
                  ? 'note-cover'
                  : cn.highlight
                  ? cn.highlightColor === 'green'
                    ? 'note-highlight-green'
                    : cn.highlightColor === 'blue'
                    ? 'note-highlight-blue'
                    : 'note-highlight'
                  : 'note-plain';

                itemsHtml += `
                  <div class="note-box ${noteClass}">
                    ${cn.isCover ? `<div class="note-title">COVER: ${escapeHtml(cn.coveredBy || 'Pending')}</div>` : ''}
                    ${cn.text ? `<div class="note-text ${cn.bold ? 'note-bold' : ''}">${formatNoteMentionHTML(cn.text)}</div>` : ''}
                  </div>
                `;
              });

              const hasW = assigned.some((a) => {
                const e = entryMap.get(`${a.student}|${d}|${s.id}`);
                return e?.lessonType === 'withdrawal';
              });
              const isConflict = hasSlotConflict(assigned, entries);

              cells.push(`
                <td colspan="${colspan}" class="${isConflict ? 'cell-conflict-bg' : hasW ? 'cell-withdrawal-bg' : ''}">
                  ${itemsHtml}
                </td>
              `);
            }
          }
        });

        // Friday early finish padding
        if (indivDayView === 'all' && d === 'Fri' && headerSlots.length > usedCols) {
          cells.push(`
            <td colspan="${headerSlots.length - usedCols}" class="empty-cell" style="text-align: center; vertical-align: middle; font-style: italic; color: #64748b; font-size: 8pt; background-color: #f8fafc;">
              Early finish (11:30)
            </td>
          `);
        }

        let fridayHeaderHtml = '';
        if (indivDayView === 'all' && d === 'Fri') {
          const friSlots = slotsFor('Fri', schedule);
          fridayHeaderHtml = `
            <tr class="friday-header-row">
              <th class="name-header" style="${isStudentIndiv ? 'background-color: #D8E2EF !important; color: #0f172a !important; font-weight: 700;' : 'background-color: #e2e8f0; font-weight: 700;'}">Friday Schedule</th>
              ${friSlots
                .map(
                  (s) => `
                <th class="slot-header" style="${isStudentIndiv ? 'background-color: #FFEDD5 !important; color: #0f172a !important;' : 'background-color: #e2e8f0;'}">
                  <div class="slot-name">${escapeHtml(s.label)}</div>
                  <div class="slot-time" style="${isStudentIndiv ? 'color: #78350f !important;' : ''}">${escapeHtml(s.start)}–${escapeHtml(s.end)}</div>
                </th>`
                )
                .join('')}
              ${
                headerSlots.length > friSlots.length
                  ? `
                <th colspan="${headerSlots.length - friSlots.length}" class="slot-header" style="${isStudentIndiv ? 'background-color: #FFEDD5 !important; color: #78350f !important; font-style: italic;' : 'background-color: #f1f5f9; color: #64748b; font-style: italic;'}">
                  <div class="slot-name">Early Finish</div>
                  <div class="slot-time" style="${isStudentIndiv ? 'color: #78350f !important;' : ''}">11:30</div>
                </th>`
                  : ''
              }
            </tr>
          `;
        }

        return `
          ${fridayHeaderHtml}
          <tr>
            <td class="name-cell" style="${isStudentIndiv ? 'background-color: #D8E2EF !important; font-weight: 700; color: #0f172a !important;' : ''}">${DAY_FULL[d]}</td>
            ${cells.join('')}
          </tr>
        `;
      })
      .join('');

    pagesHtml = `
      <div class="timetable-print-page individual-page">
        <div class="doc-header">
          <div class="doc-title-box">
            <h1>${escapeHtml(docTitle)}</h1>
            <p>${escapeHtml(docSubtitle)}</p>
          </div>
          <div class="doc-meta-box">
            <div><strong>Department Timetable</strong></div>
            <div>Date: ${nowStr}</div>
          </div>
        </div>

        <table class="timetable-doc-table individual-doc-table ${options.indivType === 'student' ? 'student-individual' : ''}">
          <thead>
            ${tableHeaderHtml}
          </thead>
          <tbody>
            ${tableBodyHtml}
          </tbody>
        </table>

        <div class="doc-footer">
          <span>Official School Schedule</span>
          <span>Department Timetable</span>
        </div>
      </div>
    `;
  }

  const expansion = options.rowExpansion || 'standard';
  let individualRowHeight = '21mm';
  if (indivDayView === 'all') {
    if (expansion === 'compact') individualRowHeight = '18mm';
    else if (expansion === 'expanded') individualRowHeight = '24mm';
    else individualRowHeight = '21mm';
  } else {
    if (expansion === 'compact') individualRowHeight = '65mm';
    else if (expansion === 'expanded') individualRowHeight = '85mm';
    else individualRowHeight = '75mm';
  }

  const stylesCss = `
    @page {
      size: landscape;
      margin: 6mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 8pt;
      line-height: 1.3;
    }
    .document-container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 8pt;
      line-height: 1.3;
    }
    .timetable-print-page {
      width: 100%;
      box-sizing: border-box;
      display: block;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
      margin: 0;
      padding: 0;
    }
    .timetable-print-page:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
    @media screen {
      body {
        background: #f1f5f9;
        padding: 16px;
      }
      .timetable-print-page {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        padding: 6mm 6mm;
        margin: 0 auto 20px auto;
        max-width: 285mm;
        width: 285mm;
        border-radius: 4px;
      }
    }
    @media print {
      html, body {
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      .document-container {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .timetable-print-page {
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        height: auto !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .timetable-print-page:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
    }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #1c2333;
      padding-bottom: 5px;
      margin-bottom: 6px;
    }
    .doc-title-box h1 {
      margin: 0;
      font-size: 13pt;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.2px;
    }
    .doc-title-box p {
      margin: 2px 0 0 0;
      font-size: 8.5pt;
      color: #475569;
    }
    .doc-meta-box {
      text-align: right;
      font-size: 7.5pt;
      color: #64748b;
      line-height: 1.35;
    }
    .badge-tag {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 7pt;
      font-weight: 600;
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    table.timetable-doc-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      border: 1px solid #64748b;
    }
    table.timetable-doc-table th,
    table.timetable-doc-table td {
      border: 1px solid #94a3b8;
      padding: 3px 4px;
      vertical-align: top;
      text-align: left;
    }
    table.timetable-doc-table th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 600;
    }
    th.name-header, td.name-cell {
      width: 100px;
      min-width: 90px;
      max-width: 120px;
      font-weight: 600;
      background-color: #f8fafc;
      color: #0f172a;
    }
    th.slot-header {
      font-size: 7.5pt;
      text-align: center;
    }
    .slot-name {
      font-weight: 700;
      color: #0f172a;
    }
    .slot-time {
      font-size: 6.5pt;
      color: #475569;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      margin-top: 1px;
    }
    .cell-subject {
      font-weight: 700;
      font-size: 8pt;
      color: #0f172a;
      line-height: 1.2;
    }
    .withdrawal-text {
      color: #0284c7;
    }
    .cell-withdrawal-bg {
      background-color: #DCEEFB !important;
    }
    .cell-fixed-slot {
      background-color: #ffffff !important;
      background-image: repeating-linear-gradient(135deg, #ffffff, #ffffff 6px, #e2e8f0 6px, #e2e8f0 12px) !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .cell-fixed-withdrawal {
      background-color: #DCEEFB !important;
      background-image: repeating-linear-gradient(135deg, #DCEEFB, #DCEEFB 6px, #c9e2f5 6px, #c9e2f5 12px) !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .badge-w {
      display: inline-block;
      font-size: 6pt;
      font-weight: 700;
      text-transform: uppercase;
      padding: 0 3px;
      border-radius: 2px;
      background: #bae6fd;
      color: #0369a1;
      margin-left: 2px;
      vertical-align: middle;
    }
    .cell-meta {
      font-size: 6.8pt;
      color: #475569;
      margin-top: 1px;
      line-height: 1.2;
    }
    .cell-lsa {
      display: inline-block;
      font-size: 6.8pt;
      font-weight: 700;
      padding: 1.5px 6px;
      border-radius: 9999px;
      background-color: #fef08a !important;
      color: #58228c !important;
      border: 1px solid #eab308;
      margin-top: 2px;
      line-height: 1.2;
    }
    .cell-conflict-bg {
      background-color: #fbe6e4 !important;
    }
    .cell-fixed {
      font-style: italic;
      color: #64748b;
      font-size: 7.2pt;
    }
    .cell-student-name {
      font-weight: 600;
      color: #0f172a;
      font-size: 7.8pt;
    }
    .staff-assignment-item {
      margin-bottom: 2px;
      padding-bottom: 1.5px;
      border-bottom: 1px dotted #cbd5e1;
    }
    .staff-assignment-item:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
    .struck-through {
      text-decoration: line-through !important;
      color: #64748b !important;
      text-decoration-color: #dc2626 !important;
      opacity: 0.75;
    }
    .badge-relieved {
      font-size: 6pt;
      font-weight: 700;
      color: #dc2626;
      background-color: #fee2e2;
      padding: 0.5px 3px;
      border-radius: 2px;
      margin-left: 3px;
      text-decoration: none !important;
      display: inline-block;
      border: 1px solid #fecaca;
    }
    .note-box {
      margin-top: 2px;
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 6.8pt;
      line-height: 1.2;
      text-align: left;
    }
    .note-cover, .note-highlight {
      background-color: #fef08a !important;
      color: #dc2626 !important;
      border: 1px solid #facc15;
    }
    .note-highlight-green {
      background-color: #86efac !important;
      color: #dc2626 !important;
      border: 1px solid #22c55e;
    }
    .note-highlight-blue {
      background-color: #7dd3fc !important;
      color: #dc2626 !important;
      border: 1px solid #0284c7;
    }
    .note-plain {
      color: #dc2626 !important;
    }
    .note-title {
      font-weight: 700;
      font-size: 6pt;
      text-transform: uppercase;
      color: #dc2626 !important;
      margin-bottom: 1px;
    }
    .note-student {
      font-weight: 600;
      font-size: 6.8pt;
      color: #1c2333;
    }
    .note-text {
      font-weight: 400;
      color: #dc2626 !important;
    }
    .note-bold {
      font-weight: 700 !important;
    }
    .empty-cell {
      background-color: #ffffff !important;
    }
    .empty-dash {
      display: none;
    }
    .doc-footer {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #cbd5e1;
      margin-top: 6px;
      padding-top: 4px;
      font-size: 6.8pt;
      color: #64748b;
    }

    /* All Students & All Staff Timetable Print & Document layout */
    table.all-schedule-doc-table {
      width: 100% !important;
      border-collapse: collapse;
      table-layout: fixed !important;
      border: 1px solid #64748b;
    }
    table.all-schedule-doc-table thead tr {
      height: 6.5mm !important;
    }
    table.all-schedule-doc-table thead th {
      height: 6.5mm !important;
      padding: 1px 1.5px !important;
      word-break: break-word !important;
      text-align: center;
      vertical-align: middle;
    }
    table.all-schedule-doc-table tbody tr {
      height: var(--row-height, 20mm);
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    table.all-schedule-doc-table td {
      padding: 2px 2.5px !important;
      vertical-align: top;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }
    table.all-schedule-doc-table th.name-header {
      min-width: 0 !important;
      max-width: none !important;
      text-align: center;
      vertical-align: middle;
      font-size: 7.8pt !important;
      font-weight: 700;
      padding: 1.5px 2px !important;
      word-break: break-word !important;
      background-color: #f1f5f9;
      color: #0f172a;
      line-height: 1.2;
    }
    table.all-schedule-doc-table th.slot-header {
      min-width: 0 !important;
      font-size: 7.0pt !important;
      padding: 1px 1px !important;
      word-break: break-word !important;
      line-height: 1.15;
    }
    table.all-schedule-doc-table .slot-name {
      font-size: 7.2pt !important;
      font-weight: 700;
      line-height: 1.15;
    }
    table.all-schedule-doc-table .slot-time {
      font-size: 5.8pt !important;
      margin-top: 0.5px;
      line-height: 1.1;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #475569;
    }
    table.all-schedule-doc-table td.name-cell {
      min-width: 0 !important;
      max-width: none !important;
      font-size: 8.0pt !important;
      font-weight: 700;
      text-align: center;
      vertical-align: middle;
      background-color: #f8fafc;
      color: #0f172a;
      padding: 2px 2px !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
      line-height: 1.2;
    }
    table.all-schedule-doc-table .cell-subject {
      font-size: 7.2pt !important;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.15;
      margin-bottom: 0.5px;
      word-break: break-word;
    }
    table.all-schedule-doc-table .cell-meta {
      font-size: 6.0pt !important;
      color: #475569;
      line-height: 1.15;
      margin-top: 0.5px;
      word-break: break-word;
    }
    table.all-schedule-doc-table .cell-lsa {
      font-size: 6.0pt !important;
      font-weight: 700;
      padding: 0.5px 3.5px !important;
      margin-top: 1px;
      display: inline-block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      border-radius: 9999px;
    }
    table.all-schedule-doc-table .cell-student-name {
      font-size: 7.2pt !important;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 1px;
      line-height: 1.15;
      word-break: break-word;
    }
    table.all-schedule-doc-table .staff-assignment-item {
      padding: 1px 0 !important;
      margin-bottom: 1px !important;
      border-bottom: 1px dotted #cbd5e1;
    }
    table.all-schedule-doc-table .staff-assignment-item:last-child {
      border-bottom: none;
      margin-bottom: 0 !important;
      padding-bottom: 0 !important;
    }

    /* Individual Timetable View & Print */
    table.individual-doc-table {
      width: 100% !important;
      table-layout: fixed !important;
      height: auto;
    }
    table.individual-doc-table thead tr,
    tr.friday-header-row {
      height: 7mm !important;
    }
    table.individual-doc-table thead th,
    tr.friday-header-row th {
      height: 7mm !important;
      padding: 2px 2.5px !important;
    }
    table.individual-doc-table tbody tr {
      height: ${individualRowHeight};
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    table.individual-doc-table th.name-header {
      width: 85px;
      min-width: 80px;
      text-align: center;
      vertical-align: middle;
      font-size: 8.5pt;
    }
    table.individual-doc-table th.slot-header {
      font-size: 7.8pt;
      padding: 3px 2.5px;
    }
    table.individual-doc-table .slot-name {
      font-size: 8.2pt;
    }
    table.individual-doc-table .slot-time {
      font-size: 6.8pt;
    }
    table.individual-doc-table td {
      padding: ${expansion === 'compact' ? '2.5px 3.5px' : expansion === 'expanded' ? '4.5px 5.5px' : '3.5px 4.5px'};
      vertical-align: top;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    table.individual-doc-table td.name-cell {
      width: 85px;
      font-size: 9pt;
      font-weight: 700;
      text-align: center;
      vertical-align: middle;
      background-color: #f8fafc;
      color: #0f172a;
    }
    table.individual-doc-table .cell-subject {
      font-size: ${expansion === 'compact' ? '8.2pt' : expansion === 'expanded' ? '9.2pt' : '8.6pt'};
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
      margin-bottom: 1px;
    }
    table.individual-doc-table .cell-meta {
      font-size: ${expansion === 'compact' ? '6.8pt' : expansion === 'expanded' ? '7.6pt' : '7.2pt'};
      color: #475569;
      line-height: 1.2;
      margin-top: 1px;
    }
    table.individual-doc-table .cell-student-name {
      font-size: ${expansion === 'compact' ? '8.0pt' : expansion === 'expanded' ? '9.0pt' : '8.5pt'};
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 1px;
    }
    table.individual-doc-table .staff-assignment-item {
      padding: ${expansion === 'compact' ? '1px 0' : '2px 0'};
      margin-bottom: ${expansion === 'compact' ? '1.5px' : '2.5px'};
      border-bottom: 1px dotted #cbd5e1;
    }
    table.individual-doc-table .staff-assignment-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    table.individual-doc-table .cell-fixed {
      font-size: 7.5pt;
      color: #64748b;
      font-style: italic;
    }
    table.individual-doc-table.student-individual th.slot-header {
      background-color: #FFEDD5 !important;
      color: #0f172a !important;
    }
    table.individual-doc-table.student-individual th.slot-header .slot-time {
      color: #78350f !important;
    }
    table.individual-doc-table.student-individual th.name-header {
      background-color: #D8E2EF !important;
      color: #0f172a !important;
    }
    table.individual-doc-table.student-individual td.name-cell {
      background-color: #D8E2EF !important;
      color: #0f172a !important;
      font-weight: 700;
    }
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(docTitle)}</title>
  <style>${stylesCss}</style>
</head>
<body>
  <div class="document-container">
    ${pagesHtml}
  </div>
</body>
</html>
  `;
}

export function printTimetableDocument(options: PrintTimetableDocumentOptions): void {
  const fullHtml = generateTimetableDocumentHTML(options);

  try {
    let printMount = document.getElementById('timetable-print-mount');
    if (!printMount) {
      printMount = document.createElement('div');
      printMount.id = 'timetable-print-mount';
      document.body.appendChild(printMount);
    }

    // Extract <style> and <div class="document-container"> so we can mount directly in the main document
    const styleMatch = fullHtml.match(/<style>([\s\S]*?)<\/style>/i);
    const bodyMatch = fullHtml.match(/<body>([\s\S]*?)<\/body>/i);

    const styleContent = styleMatch ? styleMatch[1] : '';
    const bodyContent = bodyMatch ? bodyMatch[1] : fullHtml;

    printMount.innerHTML = `<style>${styleContent}</style>${bodyContent}`;
    document.body.classList.add('printing-timetable-doc');

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      document.body.classList.remove('printing-timetable-doc');
      if (printMount) {
        printMount.innerHTML = '';
      }
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup, { once: true });

    // Call window.print() synchronously inside the user click handler for instant printer dialog connection
    window.print();

    // In most browsers window.print() blocks until the dialog closes; run cleanup right after + safety fallback
    setTimeout(cleanup, 500);
  } catch (err) {
    console.warn('Print mount error, falling back to window.print()', err);
    document.body.classList.remove('printing-timetable-doc');
    window.print();
  }
}

