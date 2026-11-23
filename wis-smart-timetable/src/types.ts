export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';

export interface TimeSlot {
  id: string;
  label: string;
  start: string;
  end: string;
  type: 'fixed' | 'lesson';
  group?: string;
  defaultLabel?: string;
}

export interface TimetableEntry {
  id: string;
  student: string;
  day: DayOfWeek;
  slotId: string;
  subject: string;
  teacher?: string;
  room?: string;
  lessonType: 'lesson' | 'withdrawal';
  split?: boolean;
  classId?: string;
  className?: string;
}

export interface LsaAssignment {
  id: string;
  student: string;
  day: DayOfWeek;
  slotId: string;
  lsa: string;
}

export interface PrimarySupportAssignment {
  id: string;
  student: string;
  subject: string;
  lsa: string;
}

export interface ActiveSupport {
  lsa: string;
  type: 'primary' | 'secondary' | 'cover' | 'relieved';
  originalLsa?: string;
  coveringFor?: string;
}

export interface StaffAssignmentDetail {
  student: string;
  day: DayOfWeek;
  slotId: string;
  lsa: string;
  type: 'primary' | 'secondary' | 'cover' | 'relieved' | 'teacher';
  classId?: string;
  className?: string;
  subject?: string;
  teacher?: string;
  room?: string;
}

export type StaffDesignation = 'LSA' | 'SEND';

export interface StaffMember {
  id: string;
  name: string;
  email?: string;
  designation?: StaffDesignation;
}

export type NoteHighlightColor = 'yellow' | 'green' | 'blue';

export interface StaffSlotNote {
  id: string;
  staffName: string;
  day: DayOfWeek;
  slotId: string;
  text: string;
  highlight: boolean; // whether highlighted
  highlightColor?: NoteHighlightColor; // yellow (default), bright green, or sky blue
  isCover: boolean; // whether this note is a cover assignment
  coveredBy?: string; // name of staff member providing cover
  confirmedConflict?: boolean; // true if assigned to a staff with active lesson after confirmation
  student?: string; // student being supported
  subject?: string; // subject of the lesson
  teacher?: string; // teacher of the lesson
  room?: string; // room of the lesson
  createdAt?: string;
  expiresAt?: string; // calculated expiration timestamp: 3:10PM Mon-Thu, 12:00PM Fri
  bold?: boolean; // bold font option
  position?: 'top' | 'bottom'; // note position in slot: 'top' renders above lessons, 'bottom' renders below
  pinToTop?: boolean; // true if placed at top of slot
  keepIndefinitely?: boolean; // true to keep note indefinitely without auto-deleting at end of day
  mentionedStaff?: string[]; // list of staff members mentioned via @ in this note
  isMention?: boolean; // true if this note was linked/created due to an @mention
  sourceStaffName?: string; // original author of the note if different
}

export interface Announcement {
  id: string;
  text: string;
  date: string;
}

export interface AppSettings {
  adminPasscode?: string;
  approvedEmails?: string[];
}

export interface ScheduleOverrides {
  weekday: Record<string, Partial<TimeSlot>>;
  friday: Record<string, Partial<TimeSlot>>;
  weekdaySlots?: TimeSlot[];
  fridaySlots?: TimeSlot[];
}

export interface MilestoneCheckpointInfo {
  exists: boolean;
  savedAt?: string;
  label?: string;
  studentCount?: number;
  entryCount?: number;
  staffCount?: number;
  noteCount?: number;
}

export interface TimetableStore {
  students: string[];
  entries: TimetableEntry[];
  lsaPool: StaffMember[];
  lsaAssignments: LsaAssignment[]; // Secondary support (lesson-specific override)
  primarySupport: PrimarySupportAssignment[]; // Primary support (per student per subject)
  staffNotes?: StaffSlotNote[];
  settings: AppSettings;
  announcements: Announcement[];
  schedule: ScheduleOverrides;
}

export type UserRole = 'staff' | 'admin';
export type AccessStatus = 'loading' | 'unauthenticated' | 'pending_registration' | 'authorized';
export type MainSection = 'import' | 'timetable' | 'staff' | 'students' | 'settings';
export type TimetableView = 'students' | 'staff' | 'individual';
export type StaffFilter = 'all' | 'free' | 'withdrawal' | 'lesson' | 'conflict';
export type IndividualType = 'student' | 'staff';

export interface ParsedImportRow {
  student: string;
  day: DayOfWeek;
  slotIds: string[];
  subject: string;
  teacher: string;
  room: string;
  lessonType: 'lesson' | 'withdrawal';
}

export interface ConflictItem {
  day: DayOfWeek;
  lsa: string;
  students: string[];
  slotLabel: string;
  slotIds: string[];
}
