import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  TimetableStore,
  TimetableEntry,
  UserRole,
  MainSection,
  TimetableView,
  StaffFilter,
  IndividualType,
  DayOfWeek,
  ParsedImportRow,
  ScheduleOverrides,
  StaffSlotNote,
  MilestoneCheckpointInfo,
  AccessStatus,
  StaffMember,
  StaffDesignation,
} from '../types';
import { INITIAL_TIMETABLE_STORE } from '../data/initialData';
import {
  filterActiveAnnouncements,
  filterActiveStaffNotes,
  calculateNoteExpiration,
  canMerge,
  entriesMatch,
  getGroupSiblingId,
  slotsFor,
  getCurrentOrNextSchoolDay,
  getEffectiveDayForNote,
  normalizeFridayEntries,
  sanitizeWithdrawalEntries,
  sortStaffPool,
} from '../utils/timetable';
import {
  auth,
  db,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  testConnection,
  sanitizeForFirestore,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOut,
  onAuthStateChanged,
  ADMIN_EMAIL,
  normalizeEmail,
  isAdminEmail,
  isGemsWisEmail,
  isValidEmailFormat,
  type User,
} from '../lib/firebase';

const STORAGE_KEY = 'dept-timetable-store';
const MILESTONE_KEY = 'dept-timetable-milestone-checkpoint';
const LAST_HEALTHY_KEY = 'dept-timetable-last-healthy-backup';

interface TimetableContextType {
  user: User | null;
  accessStatus: AccessStatus;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  isSigningIn: boolean;
  isAutoAdmin: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  refreshAccess: () => Promise<void>;
  store: TimetableStore;
  role: UserRole;
  setRole: (role: UserRole) => void;
  currentSection: MainSection;
  setCurrentSection: (section: MainSection) => void;
  currentDay: DayOfWeek;
  setCurrentDay: (day: DayOfWeek) => void;
  timetableView: TimetableView;
  setTimetableView: (view: TimetableView) => void;
  staffFilter: StaffFilter;
  setStaffFilter: (filter: StaffFilter) => void;
  indivType: IndividualType;
  setIndivType: (type: IndividualType) => void;
  indivName: string | null;
  setIndivName: (name: string | null) => void;
  syncStatus: string;
  forceSyncToCloud: () => Promise<boolean>;
  isAdminLoginOpen: boolean;
  setIsAdminLoginOpen: (open: boolean) => void;
  openAdminLogin: () => void;

  // Actions
  addStudent: (name: string) => void;
  renameStudent: (oldName: string, newName: string) => void;
  removeStudent: (name: string) => void;
  addStaff: (name: string, email?: string, designation?: StaffDesignation) => void;
  renameStaff: (oldName: string, newName: string) => void;
  updateStaffMember: (oldName: string, newName: string, email?: string, designation?: StaffDesignation) => void;
  updateStaffDesignation: (name: string, designation: StaffDesignation) => void;
  removeStaff: (name: string) => void;
  addApprovedEmail: (email: string) => void;
  removeApprovedEmail: (email: string) => void;
  upsertEntry: (
    student: string,
    day: DayOfWeek,
    slotId: string,
    subject: string,
    teacher?: string,
    room?: string,
    lessonType?: 'lesson' | 'withdrawal',
    split?: boolean
  ) => void;
  deleteEntry: (student: string, day: DayOfWeek, slotId: string, withSibling?: boolean) => void;
  splitEntry: (student: string, day: DayOfWeek, slotId: string) => void;
  mergeEntry: (student: string, day: DayOfWeek, slotId: string) => void;
  setPrimarySupport: (student: string, subject: string, lsa: string) => void;
  setSecondarySupport: (student: string, day: DayOfWeek, slotId: string, lsa: string) => void;
  assignLsa: (student: string, day: DayOfWeek, slotId: string, lsa: string) => void;
  unassignLsa: (student: string, day: DayOfWeek, slotId: string) => void;
  saveLessonAndSupport: (
    student: string,
    day: DayOfWeek,
    slotId: string,
    data: {
      subject: string;
      teacher?: string;
      room?: string;
      lessonType?: 'lesson' | 'withdrawal';
      split?: boolean;
      applyToDoublePeriod?: boolean;
      primaryStaff?: string;
      secondaryStaff?: string;
      assignedStaff?: string;
      applyToSubject?: boolean;
      originalSubject?: string;
      applySubjectToWeek?: boolean;
      applyTeacherToWeek?: boolean;
      applyRoomToWeek?: boolean;
      classId?: string;
      className?: string;
    }
  ) => void;
  saveStaffClass: (data: {
    teacherStaff: string;
    day: DayOfWeek;
    slotId: string;
    students: string[];
    subject: string;
    room?: string;
    lessonType?: 'lesson' | 'withdrawal';
    supportStaff?: string;
    applyToDoublePeriod?: boolean;
    classId?: string;
  }) => void;
  assignSupportDirectly: (
    student: string,
    day: DayOfWeek,
    slotId: string,
    staffName: string,
    applyToDoublePeriod?: boolean
  ) => void;
  applyImportRows: (rows: ParsedImportRow[]) => void;
  setAdminPasscode: (passcode: string) => void;
  postAnnouncement: (text: string) => void;
  removeAnnouncement: (id: string) => void;
  saveScheduleOverrides: (overrides: ScheduleOverrides) => void;
  saveStaffNote: (note: Omit<StaffSlotNote, 'id' | 'createdAt'> & { id?: string }) => void;
  saveStaffNotesBatch: (notes: (Omit<StaffSlotNote, 'id' | 'createdAt'> & { id?: string })[]) => void;
  deleteStaffNote: (staffName: string, day: DayOfWeek, slotId: string, noteId?: string) => void;
  deleteStaffNoteById: (noteId: string) => void;
  deleteStaffNotesBatch: (targets: { staffName: string; day: DayOfWeek; slotId: string; noteId?: string }[]) => void;
  cleanupExpiredNotes: () => void;
  clearAllEntries: () => void;
  resetToSampleData: () => void;

  // Milestone & Anti-Wipe Protection
  milestoneInfo: MilestoneCheckpointInfo | null;
  saveMilestoneCheckpoint: (customLabel?: string) => Promise<{ success: boolean; message: string }>;
  restoreMilestoneCheckpoint: () => Promise<{ success: boolean; message: string }>;
  downloadCheckpointJSON: () => void;
}

const TimetableContext = createContext<TimetableContextType | null>(null);

function createUniqueId(): string {
  return 'id_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
}

export const TimetableProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [store, setStore] = useState<TimetableStore>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const activeNotes = filterActiveStaffNotes(parsed.staffNotes || []);
        const sched = parsed.schedule || { weekday: {}, friday: {} };
        const repaired = normalizeFridayEntries(
          parsed.entries || [],
          parsed.lsaAssignments || [],
          sched
        );
        return {
          ...INITIAL_TIMETABLE_STORE,
          ...parsed,
          entries: sanitizeWithdrawalEntries(repaired.entries),
          lsaAssignments: repaired.assignments,
          schedule: sched,
          primarySupport: parsed.primarySupport || INITIAL_TIMETABLE_STORE.primarySupport || [],
          staffNotes: activeNotes,
        };
      }
    } catch {
      // ignore
    }
    return {
      ...INITIAL_TIMETABLE_STORE,
      entries: sanitizeWithdrawalEntries(INITIAL_TIMETABLE_STORE.entries),
    };
  });

  const [user, setUser] = useState<User | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('loading');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);

  const [role, setRoleState] = useState<UserRole>('staff');

  const isAutoAdmin = useMemo(() => isAdminEmail(user?.email), [user?.email]);

  const setRole = useCallback(
    (newRole: UserRole) => {
      if (newRole === 'admin' && !isAutoAdmin) {
        return;
      }
      setRoleState(newRole);
      try {
        sessionStorage.setItem('timetable_role', newRole);
        localStorage.removeItem('timetable_role');
      } catch {
        // ignore
      }
    },
    [isAutoAdmin]
  );

  const [currentSection, setCurrentSection] = useState<MainSection>('timetable');
  const [currentDay, setCurrentDay] = useState<DayOfWeek>(() => getCurrentOrNextSchoolDay());
  const [timetableView, setTimetableView] = useState<TimetableView>('students');
  const [staffFilter, setStaffFilter] = useState<StaffFilter>('all');
  const [indivType, setIndivType] = useState<IndividualType>('student');
  const [indivName, setIndivName] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('saved to this workspace');
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState<boolean>(false);
  const [milestoneInfo, setMilestoneInfo] = useState<MilestoneCheckpointInfo | null>(null);

  const lastSavedAtRef = useRef<string>('');
  const isCloudReadyRef = useRef<boolean>(false);
  const isExplicitResetRef = useRef<boolean>(false);
  const maxKnownEntriesCountRef = useRef<number>(store.entries?.length || 0);
  const maxKnownStudentsCountRef = useRef<number>(store.students?.length || 0);
  const lastAllowedSyncSigRef = useRef<string>('');
  const roleRef = useRef<UserRole>(role);
  const isAutoAdminRef = useRef<boolean>(isAutoAdmin);
  const userEmailRef = useRef<string>('');

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    isAutoAdminRef.current = isAutoAdmin;
  }, [isAutoAdmin]);

  useEffect(() => {
    userEmailRef.current = normalizeEmail(user?.email);
  }, [user?.email]);

  const openAdminLogin = useCallback(() => {
    if (isAutoAdmin) {
      setRole('admin');
      return;
    }
    setIsAdminLoginOpen(true);
  }, [isAutoAdmin, setRole]);

  const evaluateUserAccess = useCallback(async (firebaseUser: User): Promise<void> => {
    const email = normalizeEmail(firebaseUser.email);
    if (!email || !firebaseUser.emailVerified) {
      await signOut(auth).catch(() => {});
      setAuthError('Access restricted.');
      setAccessStatus('unauthenticated');
      setRoleState('staff');
      return;
    }

    if (isAdminEmail(email)) {
      setAuthError(null);
      setAccessStatus('authorized');
      setRoleState('admin');
      return;
    }

    try {
      const allowedRef = doc(db, 'allowedUsers', email);
      const allowedSnap = await getDoc(allowedRef);
      const allowedData = allowedSnap.exists() ? allowedSnap.data() : null;
      const inWisDomain = isGemsWisEmail(email);

      if (!inWisDomain && !allowedSnap.exists()) {
        await signOut(auth).catch(() => {});
        setAuthError('Access restricted.');
        setAccessStatus('unauthenticated');
        setRoleState('staff');
        return;
      }

      if (allowedData?.canViewTimetable === true || allowedData?.role === 'admin') {
        setAuthError(null);
        setAccessStatus('authorized');
        setRoleState(allowedData?.role === 'admin' ? 'admin' : 'staff');
      } else {
        setAuthError(null);
        setAccessStatus('pending_registration');
        setRoleState('staff');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
        await signOut(auth).catch(() => {});
        setAuthError('Access restricted.');
        setAccessStatus('unauthenticated');
        setRoleState('staff');
        return;
      }
      if (isGemsWisEmail(email)) {
        setAccessStatus('pending_registration');
        setRoleState('staff');
      } else {
        await signOut(auth).catch(() => {});
        setAuthError('Access restricted.');
        setAccessStatus('unauthenticated');
        setRoleState('staff');
      }
    }
  }, []);

  // Auth state listener + live registration listener for signed-in non-admin users
  useEffect(() => {
    let unsubscribeAllowedDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeAllowedDoc) {
        unsubscribeAllowedDoc();
        unsubscribeAllowedDoc = null;
      }

      if (!firebaseUser) {
        setUser(null);
        setAccessStatus('unauthenticated');
        setRoleState('staff');
        setCurrentSection('timetable');
        isCloudReadyRef.current = false;
        return;
      }

      setUser(firebaseUser);
      await evaluateUserAccess(firebaseUser);

      const email = normalizeEmail(firebaseUser.email);
      if (email && firebaseUser.emailVerified && !isAdminEmail(email)) {
        const allowedRef = doc(db, 'allowedUsers', email);
        unsubscribeAllowedDoc = onSnapshot(
          allowedRef,
          (snap) => {
            if (!snap.exists()) {
              if (!isGemsWisEmail(email)) {
                signOut(auth).catch(() => {});
                setAuthError('Access restricted.');
                setAccessStatus('unauthenticated');
                setRoleState('staff');
              } else {
                setAccessStatus('pending_registration');
                setRoleState('staff');
              }
              return;
            }
            const data = snap.data();
            if (data?.canViewTimetable === true || data?.role === 'admin') {
              setAccessStatus('authorized');
              setRoleState(data?.role === 'admin' ? 'admin' : 'staff');
            } else {
              setAccessStatus('pending_registration');
              setRoleState('staff');
            }
          },
          (err) => {
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.includes('permission-denied')) {
              console.warn('Allowed user listener notice:', msg);
            }
          }
        );
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeAllowedDoc) {
        unsubscribeAllowedDoc();
      }
    };
  }, [evaluateUserAccess]);

  const signIn = useCallback(async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError(null);
      } else if (code === 'auth/popup-blocked') {
        setAuthError('Pop-up was blocked by your browser. Please allow pop-ups for this site and try again.');
      } else {
        setAuthError(err?.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthError(null);
    setIsAdminLoginOpen(false);
    setCurrentSection('timetable');
    await signOut(auth);
  }, []);

  const refreshAccess = useCallback(async () => {
    if (auth.currentUser) {
      await evaluateUserAccess(auth.currentUser);
    }
  }, [evaluateUserAccess]);

  // Query milestone checkpoint info when authorized
  useEffect(() => {
    if (accessStatus !== 'authorized') return;
    try {
      const local = localStorage.getItem(MILESTONE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        setMilestoneInfo({
          exists: true,
          savedAt: parsed.checkpointSavedAt || parsed.updatedAt,
          label: parsed.milestoneName || 'Milestone Checkpoint',
          studentCount: parsed.studentCount || parsed.students?.length || 0,
          entryCount: parsed.entryCount || parsed.entries?.length || 0,
          staffCount: parsed.staffCount || parsed.lsaPool?.length || 0,
          noteCount: parsed.noteCount || parsed.staffNotes?.length || 0,
        });
      }
    } catch {}

    const checkpointRef = doc(db, 'workspaces', 'milestone_checkpoint');
    getDoc(checkpointRef)
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setMilestoneInfo({
            exists: true,
            savedAt: d.checkpointSavedAt || d.updatedAt,
            label: d.milestoneName || 'Milestone Checkpoint',
            studentCount: d.studentCount || d.students?.length || 0,
            entryCount: d.entryCount || d.entries?.length || 0,
            staffCount: d.staffCount || d.lsaPool?.length || 0,
            noteCount: d.noteCount || d.staffNotes?.length || 0,
          });
        }
      })
      .catch((err) => {
        console.warn('Milestone checkpoint query notice:', err);
      });
  }, [accessStatus]);

  // Persistence to localStorage & Firestore with Anti-Wipe Shield
  const saveToStorage = useCallback((updatedStore: TimetableStore) => {
    const currentEntriesCount = updatedStore.entries?.length || 0;
    const currentStudentsCount = updatedStore.students?.length || 0;

    // Anti-Wipe / Anti-Decimation Storage Guard:
    // If the timetable previously held substantial data (>= 50 entries),
    // reject any background or unconfirmed write that drops entries down to near-zero.
    if (
      !isExplicitResetRef.current &&
      maxKnownEntriesCountRef.current >= 50 &&
      currentEntriesCount < 50
    ) {
      console.warn(
        `[Anti-Wipe Shield] Blocked attempted wipe: attempted to save ${currentEntriesCount} entries, but known valid timetable has ${maxKnownEntriesCountRef.current} entries.`
      );
      setSyncStatus('Anti-Wipe Shield protected');
      return Promise.resolve(false);
    }

    if (currentEntriesCount >= 50) {
      maxKnownEntriesCountRef.current = Math.max(maxKnownEntriesCountRef.current, currentEntriesCount);
      maxKnownStudentsCountRef.current = Math.max(maxKnownStudentsCountRef.current, currentStudentsCount);
    }

    setSyncStatus('saving…');
    const nowIso = new Date().toISOString();
    lastSavedAtRef.current = nowIso;
    const cleanStore = sanitizeForFirestore(updatedStore);
    const payload = {
      ...cleanStore,
      updatedAt: nowIso,
      updatedBy: userEmailRef.current || 'local-workspace',
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      if (currentEntriesCount >= 50) {
        localStorage.setItem(LAST_HEALTHY_KEY, JSON.stringify(payload));
      }
      setSyncStatus('saved to this workspace');
    } catch {
      setSyncStatus('storage unavailable');
    }

    if (roleRef.current !== 'admin' && !isAutoAdminRef.current) {
      return Promise.resolve(false);
    }

    const workspaceRef = doc(db, 'workspaces', 'main');
    return setDoc(workspaceRef, payload)
      .then(() => {
        setSyncStatus('synced with cloud');
        return true;
      })
      .catch((err) => {
        console.warn('Firestore sync notice:', err);
        setSyncStatus('saved locally');
        return false;
      });
  }, []);

  const forceSyncToCloud = useCallback(async (): Promise<boolean> => {
    setSyncStatus('saving…');
    const nowIso = new Date().toISOString();
    lastSavedAtRef.current = nowIso;
    const cleanStore = sanitizeForFirestore(store);
    const payload = {
      ...cleanStore,
      updatedAt: nowIso,
      updatedBy: 'manual-sync',
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      if (store.entries?.length >= 50) {
        localStorage.setItem(LAST_HEALTHY_KEY, JSON.stringify(payload));
        maxKnownEntriesCountRef.current = Math.max(maxKnownEntriesCountRef.current, store.entries.length);
      }
      const workspaceRef = doc(db, 'workspaces', 'main');
      await setDoc(workspaceRef, payload);
      setSyncStatus('synced with cloud');
      return true;
    } catch (err) {
      console.warn('Manual cloud sync failed:', err);
      setSyncStatus('saved locally');
      return false;
    }
  }, [store]);

  // Connection check
  useEffect(() => {
    testConnection().catch((err) => {
      console.warn('Firebase connection check:', err);
    });
  }, []);

  // Real-time Firestore synchronizer with Anti-Wipe Ingestion Guard (ONLY when authorized)
  useEffect(() => {
    if (accessStatus !== 'authorized') {
      isCloudReadyRef.current = false;
      return;
    }

    const canWriteCloud = isAutoAdmin || role === 'admin';
    const workspaceRef = doc(db, 'workspaces', 'main');
    const unsubscribeSnapshot = onSnapshot(
      workspaceRef,
      (snapshot) => {
        // Ignore local optimistic mutations to avoid race conditions and premature state reverts
        if (snapshot.metadata.hasPendingWrites) {
          return;
        }

        // Check what we have locally in localStorage
        let localTimestamp = lastSavedAtRef.current || '';
        let hasCustomLocalData = false;
        try {
          const rawLocal = localStorage.getItem(STORAGE_KEY);
          if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            if (parsed.updatedAt && !localTimestamp) {
              localTimestamp = parsed.updatedAt;
              lastSavedAtRef.current = parsed.updatedAt;
            }
            if (
              parsed.students &&
              (parsed.students.length >= 10 ||
                parsed.entries?.length >= 50 ||
                parsed.updatedBy === 'local-workspace' ||
                parsed.updatedBy === 'manual-sync')
            ) {
              hasCustomLocalData = true;
            }
          }
        } catch {
          // ignore
        }

        if (snapshot.exists()) {
          const remote = snapshot.data() as Partial<TimetableStore> & { updatedAt?: string; updatedBy?: string };
          const remoteEntriesCount = remote.entries?.length || 0;

          // Cloud is responding: mark cloud handshake ready
          isCloudReadyRef.current = true;

          // Anti-Wipe Ingestion Guard (only admin auto-heals cloud):
          if (
            canWriteCloud &&
            !isExplicitResetRef.current &&
            maxKnownEntriesCountRef.current >= 50 &&
            remoteEntriesCount < 50
          ) {
            console.warn(
              `[Anti-Wipe Shield] Remote snapshot returned only ${remoteEntriesCount} entries while ${maxKnownEntriesCountRef.current} entries are known. Preventing wipe and auto-healing cloud…`
            );
            setStore((currentStore) => {
              if ((currentStore.entries?.length || 0) >= 50) {
                saveToStorage(currentStore);
                return currentStore;
              }
              saveToStorage(INITIAL_TIMETABLE_STORE);
              return INITIAL_TIMETABLE_STORE;
            });
            return;
          }

          // If remote is just initial/empty placeholder, but local has real customized data, push local up (admin only)
          if (
            canWriteCloud &&
            hasCustomLocalData &&
            (remote.updatedBy === 'initial' ||
              remote.updatedBy === 'test' ||
              !remote.students ||
              remote.students.length === 0)
          ) {
            setStore((currentStore) => {
              saveToStorage(currentStore);
              return currentStore;
            });
            return;
          }

          // If local has a newer timestamp than remote and has equal/greater entries, don't revert to older remote (admin only)
          if (
            canWriteCloud &&
            remote.updatedAt &&
            localTimestamp &&
            remote.updatedAt < localTimestamp &&
            maxKnownEntriesCountRef.current >= remoteEntriesCount
          ) {
            setStore((currentStore) => {
              saveToStorage(currentStore);
              return currentStore;
            });
            return;
          }

          // Remote is up-to-date and healthy: load it!
          const remoteSched = remote.schedule || { weekday: {}, friday: {} };
          const repaired = normalizeFridayEntries(
            remote.entries || [],
            remote.lsaAssignments || [],
            remoteSched
          );
          const nextStore: TimetableStore = {
            students: remote.students || [],
            entries: sanitizeWithdrawalEntries(repaired.entries),
            lsaPool: remote.lsaPool || [],
            lsaAssignments: repaired.assignments,
            primarySupport: remote.primarySupport || [],
            schedule: remoteSched,
            settings: { ...INITIAL_TIMETABLE_STORE.settings, ...(remote.settings || {}) },
            announcements: remote.announcements || [],
            staffNotes: filterActiveStaffNotes(remote.staffNotes || []),
          };
          lastSavedAtRef.current = remote.updatedAt || '';

          if (nextStore.entries.length >= 50) {
            maxKnownEntriesCountRef.current = Math.max(maxKnownEntriesCountRef.current, nextStore.entries.length);
            maxKnownStudentsCountRef.current = Math.max(maxKnownStudentsCountRef.current, nextStore.students.length);
          }

          try {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ ...nextStore, updatedAt: remote.updatedAt, updatedBy: 'cloud-sync' })
            );
            if (nextStore.entries.length >= 50) {
              localStorage.setItem(LAST_HEALTHY_KEY, JSON.stringify(nextStore));
            }
          } catch {}
          setStore(nextStore);
          if (repaired.changed && canWriteCloud) {
            saveToStorage(nextStore);
          } else {
            setSyncStatus('synced with cloud');
          }
        } else {
          // Document does not exist in Firestore yet!
          isCloudReadyRef.current = true;
          if (canWriteCloud) {
            setStore((currentStore) => {
              const healthyStore = (currentStore.entries?.length || 0) >= 50 ? currentStore : INITIAL_TIMETABLE_STORE;
              saveToStorage(healthyStore);
              return healthyStore;
            });
          }
        }
      },
      (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
          handleFirestoreError(error, OperationType.GET, 'workspaces/main');
        }
        console.warn('Firestore snapshot notice (operating in local/offline mode):', msg);
        setSyncStatus('saved locally');
      }
    );

    return () => unsubscribeSnapshot();
  }, [accessStatus, isAutoAdmin, role, saveToStorage]);

  // Synchronize Staff Emails & Approved Sign-In Emails to Firestore /allowedUsers collection (Admin only)
  useEffect(() => {
    if (accessStatus !== 'authorized' || (!isAutoAdmin && role !== 'admin')) {
      return;
    }

    const poolEmails = (store.lsaPool || [])
      .filter((m) => m.email && isValidEmailFormat(m.email))
      .map((m) => ({ email: normalizeEmail(m.email), name: m.name.trim().slice(0, 128) }));

    const approvedList = (store.settings?.approvedEmails || [])
      .filter((e) => isValidEmailFormat(e))
      .map((e) => normalizeEmail(e));

    const sig = JSON.stringify({ poolEmails, approvedList });
    if (sig === lastAllowedSyncSigRef.current) {
      return;
    }
    lastAllowedSyncSigRef.current = sig;

    const actorEmail = userEmailRef.current || ADMIN_EMAIL;

    const syncAllowed = async () => {
      try {
        const desiredMap = new Map<
          string,
          { email: string; staffName: string; role: 'staff' | 'admin'; canViewTimetable: boolean }
        >();

        for (const item of poolEmails) {
          desiredMap.set(item.email, {
            email: item.email,
            staffName: item.name,
            role: isAdminEmail(item.email) ? 'admin' : 'staff',
            canViewTimetable: true,
          });
        }

        for (const email of approvedList) {
          if (!desiredMap.has(email)) {
            desiredMap.set(email, {
              email,
              staffName: '',
              role: isAdminEmail(email) ? 'admin' : 'staff',
              canViewTimetable: false,
            });
          }
        }

        const existingSnap = await getDocs(collection(db, 'allowedUsers'));
        const existingMap = new Map<string, any>();
        existingSnap.forEach((docSnap) => {
          existingMap.set(docSnap.id, docSnap.data());
        });

        const nowIso = new Date().toISOString();

        for (const [emailKey, target] of desiredMap.entries()) {
          const prev = existingMap.get(emailKey);
          const changed =
            !prev ||
            prev.email !== target.email ||
            (prev.staffName || '') !== target.staffName ||
            prev.role !== target.role ||
            prev.canViewTimetable !== target.canViewTimetable;
          if (changed) {
            await setDoc(doc(db, 'allowedUsers', emailKey), {
              email: target.email,
              staffName: target.staffName,
              role: target.role,
              canViewTimetable: target.canViewTimetable,
              addedBy: actorEmail,
              updatedAt: nowIso,
            });
          }
        }

        for (const [existingId, prevData] of existingMap.entries()) {
          if (!desiredMap.has(existingId) && !isAdminEmail(existingId) && prevData?.role !== 'admin') {
            await deleteDoc(doc(db, 'allowedUsers', existingId));
          }
        }
      } catch (err) {
        console.warn('Allowed users sync notice:', err);
      }
    };

    syncAllowed();
  }, [accessStatus, isAutoAdmin, role, store.lsaPool, store.settings?.approvedEmails]);

  // Update store helper
  const updateStore = useCallback(
    (updater: (prev: TimetableStore) => TimetableStore) => {
      setStore((prev) => {
        const next = updater(prev);
        saveToStorage(next);
        return next;
      });
    },
    [saveToStorage]
  );

  // Sync with other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setStore((prev) => ({
            ...prev,
            ...parsed,
            schedule: parsed.schedule || { weekday: {}, friday: {} },
            staffNotes: filterActiveStaffNotes(parsed.staffNotes || []),
          }));
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Periodic announcement expiry cleanup (admin writes to cloud)
  // SHIELD: Only runs after isCloudReadyRef is true to prevent premature mount overwrites
  useEffect(() => {
    const cleanup = () => {
      if (!isCloudReadyRef.current) return;
      setStore((prev) => {
        const active = filterActiveAnnouncements(prev.announcements || []);
        if (active.length !== (prev.announcements || []).length) {
          const updated = { ...prev, announcements: active };
          if (roleRef.current === 'admin' || isAutoAdminRef.current) {
            saveToStorage(updated);
          }
          return updated;
        }
        return prev;
      });
    };
    const timer = setInterval(cleanup, 60000);
    return () => clearInterval(timer);
  }, [saveToStorage]);

  // Automated End-of-Day Cleanup for Staff Notes and Covers (admin writes to cloud)
  // SHIELD: Only runs after isCloudReadyRef is true to prevent premature mount overwrites
  useEffect(() => {
    const runNotesCleanup = () => {
      if (!isCloudReadyRef.current) return;
      setStore((prev) => {
        const currentNotes = prev.staffNotes || [];
        if (currentNotes.length === 0) return prev;
        const activeNotes = filterActiveStaffNotes(currentNotes);
        if (activeNotes.length !== currentNotes.length) {
          const updated = {
            ...prev,
            staffNotes: activeNotes,
          };
          if (roleRef.current === 'admin' || isAutoAdminRef.current) {
            saveToStorage(updated);
          }
          return updated;
        }
        return prev;
      });
    };

    const timer = setInterval(runNotesCleanup, 10000); // Check every 10 seconds
    return () => clearInterval(timer);
  }, [saveToStorage]);

  // Milestone Save, Restore & Export Actions
  const saveMilestoneCheckpoint = useCallback(
    async (customLabel?: string): Promise<{ success: boolean; message: string }> => {
      try {
        const cleanStore = sanitizeForFirestore(store);
        const nowIso = new Date().toISOString();
        const meta = {
          milestoneName: customLabel?.trim() || 'Milestone Checkpoint',
          checkpointSavedAt: nowIso,
          studentCount: store.students.length,
          entryCount: store.entries.length,
          staffCount: store.lsaPool.length,
          noteCount: (store.staffNotes || []).length,
        };
        const checkpointPayload = {
          ...cleanStore,
          ...meta,
          updatedAt: nowIso,
          updatedBy: 'milestone-checkpoint',
        };

        // 1. Save locally
        try {
          localStorage.setItem(MILESTONE_KEY, JSON.stringify(checkpointPayload));
        } catch (e) {
          console.warn('Local milestone storage notice:', e);
        }

        // 2. Save to Firestore
        const checkpointRef = doc(db, 'workspaces', 'milestone_checkpoint');
        await setDoc(checkpointRef, checkpointPayload);

        setMilestoneInfo({
          exists: true,
          savedAt: nowIso,
          label: meta.milestoneName,
          studentCount: meta.studentCount,
          entryCount: meta.entryCount,
          staffCount: meta.staffCount,
          noteCount: meta.noteCount,
        });

        return {
          success: true,
          message: `Milestone checkpoint permanently saved (${meta.studentCount} students, ${meta.entryCount} entries, ${meta.staffCount} staff).`,
        };
      } catch (err: any) {
        console.error('Failed to save milestone checkpoint:', err);
        return {
          success: false,
          message: err?.message || 'Failed to save milestone checkpoint to cloud.',
        };
      }
    },
    [store]
  );

  const restoreMilestoneCheckpoint = useCallback(
    async (): Promise<{ success: boolean; message: string }> => {
      try {
        let restoredData: TimetableStore | null = null;
        let sourceName = 'cloud checkpoint';

        // 1. Read from Firestore
        try {
          const checkpointRef = doc(db, 'workspaces', 'milestone_checkpoint');
          const snap = await getDoc(checkpointRef);
          if (snap.exists()) {
            restoredData = snap.data() as TimetableStore;
          }
        } catch (cloudErr) {
          console.warn('Could not read milestone from cloud, checking local:', cloudErr);
        }

        // 2. Fallback to localStorage milestone
        if (!restoredData) {
          const localSaved = localStorage.getItem(MILESTONE_KEY);
          if (localSaved) {
            restoredData = JSON.parse(localSaved);
            sourceName = 'local checkpoint backup';
          }
        }

        // 3. Fallback to built-in milestone master
        if (!restoredData) {
          restoredData = INITIAL_TIMETABLE_STORE;
          sourceName = 'built-in milestone master';
        }

        const sched = restoredData.schedule || { weekday: {}, friday: {} };
        const repaired = normalizeFridayEntries(
          restoredData.entries || [],
          restoredData.lsaAssignments || [],
          sched
        );

        const targetStore: TimetableStore = {
          students: restoredData.students || [],
          entries: repaired.entries,
          lsaPool: restoredData.lsaPool || [],
          lsaAssignments: repaired.assignments,
          primarySupport: restoredData.primarySupport || [],
          schedule: sched,
          settings: { ...INITIAL_TIMETABLE_STORE.settings, ...(restoredData.settings || {}) },
          announcements: restoredData.announcements || [],
          staffNotes: filterActiveStaffNotes(restoredData.staffNotes || []),
        };

        // Allow write through Anti-Wipe Shield
        isExplicitResetRef.current = true;
        maxKnownEntriesCountRef.current = Math.max(maxKnownEntriesCountRef.current, targetStore.entries.length);
        maxKnownStudentsCountRef.current = Math.max(maxKnownStudentsCountRef.current, targetStore.students.length);

        setStore(targetStore);
        await saveToStorage(targetStore);

        setTimeout(() => {
          isExplicitResetRef.current = false;
        }, 3000);

        return {
          success: true,
          message: `Milestone restored from ${sourceName} (${targetStore.students.length} students, ${targetStore.entries.length} entries)!`,
        };
      } catch (err: any) {
        isExplicitResetRef.current = false;
        console.error('Failed to restore milestone checkpoint:', err);
        return {
          success: false,
          message: err?.message || 'Failed to restore milestone checkpoint.',
        };
      }
    },
    [saveToStorage]
  );

  const downloadCheckpointJSON = useCallback(() => {
    const dataToExport = {
      exportedAt: new Date().toISOString(),
      milestoneName: 'SEN Department Timetable Milestone',
      studentCount: store.students.length,
      entryCount: store.entries.length,
      staffCount: store.lsaPool.length,
      timetable: store,
    };
    const jsonStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateTag = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `SEN_Timetable_Milestone_${dateTag}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [store]);

  // Actions
  const addStudent = useCallback(
    (name: string) => {
      if (role !== 'admin') return;
      const trimmed = name.trim();
      if (!trimmed) return;
      updateStore((prev) => {
        if (prev.students.includes(trimmed)) return prev;
        const nextStudents = [...prev.students, trimmed].sort();
        return { ...prev, students: nextStudents };
      });
    },
    [updateStore, role]
  );

  const renameStudent = useCallback(
    (oldName: string, newName: string) => {
      if (role !== 'admin') return;
      const trimmed = newName.trim();
      if (!trimmed || trimmed === oldName) return;
      updateStore((prev) => {
        const remaining = prev.students.filter((s) => s !== oldName);
        if (!remaining.includes(trimmed)) remaining.push(trimmed);
        remaining.sort();

        const updatedEntries = prev.entries.map((e) => (e.student === oldName ? { ...e, student: trimmed } : e));
        const updatedAssignments = prev.lsaAssignments.map((a) => (a.student === oldName ? { ...a, student: trimmed } : a));
        const updatedPrimary = (prev.primarySupport || []).map((p) => (p.student === oldName ? { ...p, student: trimmed } : p));

        return {
          ...prev,
          students: remaining,
          entries: updatedEntries,
          lsaAssignments: updatedAssignments,
          primarySupport: updatedPrimary,
        };
      });
      if (indivType === 'student' && indivName === oldName) {
        setIndivName(trimmed);
      }
    },
    [updateStore, indivType, indivName, role]
  );

  const removeStudent = useCallback(
    (name: string) => {
      if (role !== 'admin') return;
      updateStore((prev) => ({
        ...prev,
        students: prev.students.filter((s) => s !== name),
        entries: prev.entries.filter((e) => e.student !== name),
        lsaAssignments: prev.lsaAssignments.filter((a) => a.student !== name),
        primarySupport: (prev.primarySupport || []).filter((p) => p.student !== name),
      }));
      if (indivType === 'student' && indivName === name) {
        setIndivName(null);
      }
    },
    [updateStore, indivType, indivName, role]
  );

  const addStaff = useCallback(
    (name: string, email?: string, designation: StaffDesignation = 'LSA') => {
      if (role !== 'admin') return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const cleanEmail = email && isValidEmailFormat(email) ? normalizeEmail(email) : undefined;
      const resolvedDesignation: StaffDesignation = designation === 'SEND' ? 'SEND' : 'LSA';
      updateStore((prev) => {
        if (prev.lsaPool.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) return prev;
        const member: StaffMember = {
          id: createUniqueId(),
          name: trimmed,
          designation: resolvedDesignation,
          ...(cleanEmail ? { email: cleanEmail } : {}),
        };
        const newPool = sortStaffPool([...prev.lsaPool, member]);
        return { ...prev, lsaPool: newPool };
      });
    },
    [updateStore, role]
  );

  const updateStaffMember = useCallback(
    (oldName: string, newName: string, email?: string, designation?: StaffDesignation) => {
      if (role !== 'admin') return;
      const trimmed = newName.trim();
      if (!trimmed) return;
      const cleanEmail = email && isValidEmailFormat(email) ? normalizeEmail(email) : undefined;
      updateStore((prev) => {
        const updatedPool = sortStaffPool(
          prev.lsaPool.map((p) => {
            if (p.name !== oldName) return p;
            const resolvedDesignation: StaffDesignation =
              designation !== undefined
                ? designation === 'SEND'
                  ? 'SEND'
                  : 'LSA'
                : p.designation === 'SEND'
                ? 'SEND'
                : 'LSA';
            const nextMember: StaffMember = {
              id: p.id,
              name: trimmed,
              designation: resolvedDesignation,
            };
            if (cleanEmail) nextMember.email = cleanEmail;
            return nextMember;
          })
        );

        if (trimmed === oldName) {
          return { ...prev, lsaPool: updatedPool };
        }

        const updatedAssignments = prev.lsaAssignments.map((a) =>
          a.lsa === oldName ? { ...a, lsa: trimmed } : a
        );
        const updatedPrimary = (prev.primarySupport || []).map((p) =>
          p.lsa === oldName ? { ...p, lsa: trimmed } : p
        );
        const updatedEntries = prev.entries.map((e) =>
          e.teacher && e.teacher.trim().toLowerCase() === oldName.trim().toLowerCase()
            ? { ...e, teacher: trimmed }
            : e
        );

        return {
          ...prev,
          lsaPool: updatedPool,
          lsaAssignments: updatedAssignments,
          primarySupport: updatedPrimary,
          entries: updatedEntries,
        };
      });
      if (indivType === 'staff' && indivName === oldName && trimmed !== oldName) {
        setIndivName(trimmed);
      }
    },
    [updateStore, indivType, indivName, role]
  );

  const updateStaffDesignation = useCallback(
    (name: string, designation: StaffDesignation) => {
      if (role !== 'admin') return;
      const resolvedDesignation: StaffDesignation = designation === 'SEND' ? 'SEND' : 'LSA';
      updateStore((prev) => ({
        ...prev,
        lsaPool: sortStaffPool(
          prev.lsaPool.map((p) =>
            p.name === name ? { ...p, designation: resolvedDesignation } : p
          )
        ),
      }));
    },
    [updateStore, role]
  );

  const renameStaff = useCallback(
    (oldName: string, newName: string) => {
      const existing = store.lsaPool.find((p) => p.name === oldName);
      updateStaffMember(oldName, newName, existing?.email, existing?.designation);
    },
    [store.lsaPool, updateStaffMember]
  );

  const removeStaff = useCallback(
    (name: string) => {
      if (role !== 'admin') return;
      updateStore((prev) => ({
        ...prev,
        lsaPool: prev.lsaPool.filter((p) => p.name !== name),
        lsaAssignments: prev.lsaAssignments.filter((a) => a.lsa !== name),
        primarySupport: (prev.primarySupport || []).filter((p) => p.lsa !== name),
      }));
      if (indivType === 'staff' && indivName === name) {
        setIndivName(null);
      }
    },
    [updateStore, indivType, indivName, role]
  );

  const addApprovedEmail = useCallback(
    (email: string) => {
      if (role !== 'admin') return;
      if (!isValidEmailFormat(email)) return;
      const clean = normalizeEmail(email);
      updateStore((prev) => {
        const current = prev.settings?.approvedEmails || [];
        if (current.some((e) => normalizeEmail(e) === clean)) return prev;
        return {
          ...prev,
          settings: {
            ...prev.settings,
            approvedEmails: [...current, clean].sort(),
          },
        };
      });
    },
    [updateStore, role]
  );

  const removeApprovedEmail = useCallback(
    (email: string) => {
      if (role !== 'admin') return;
      const clean = normalizeEmail(email);
      updateStore((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          approvedEmails: (prev.settings?.approvedEmails || []).filter(
            (e) => normalizeEmail(e) !== clean
          ),
        },
      }));
    },
    [updateStore, role]
  );

  const upsertEntry = useCallback(
    (
      student: string,
      day: DayOfWeek,
      slotId: string,
      subject: string,
      teacher?: string,
      room?: string,
      lessonType: 'lesson' | 'withdrawal' = 'lesson',
      split = false
    ) => {
      updateStore((prev) => {
        const nextStudents = prev.students.includes(student) ? prev.students : [...prev.students, student].sort();
        const existingIdx = prev.entries.findIndex((e) => e.student === student && e.day === day && e.slotId === slotId);
        const nextEntries = [...prev.entries];

        if (!subject) {
          if (existingIdx > -1) nextEntries.splice(existingIdx, 1);
        } else {
          const prevEntry = existingIdx > -1 ? prev.entries[existingIdx] : undefined;
          const entryData: TimetableEntry = {
            id: prevEntry ? prevEntry.id : createUniqueId(),
            student,
            day,
            slotId,
            subject,
            teacher: teacher || '',
            room: room || '',
            lessonType,
            split,
            ...(prevEntry?.classId ? { classId: prevEntry.classId } : {}),
            ...(prevEntry?.className ? { className: prevEntry.className } : {}),
          };
          if (existingIdx > -1) {
            nextEntries[existingIdx] = entryData;
          } else {
            nextEntries.push(entryData);
          }
        }
        return { ...prev, students: nextStudents, entries: nextEntries };
      });
    },
    [updateStore]
  );

  const deleteEntry = useCallback(
    (student: string, day: DayOfWeek, slotId: string, withSibling = false) => {
      updateStore((prev) => {
        const siblingId = withSibling ? getGroupSiblingId(day, slotId, prev.schedule) : null;
        let nextEntries = prev.entries.filter((e) => {
          if (e.student !== student || e.day !== day) return true;
          if (e.slotId === slotId) return false;
          if (siblingId && e.slotId === siblingId) return false;
          return true;
        });
        // If deleting only one slot in a pair, ensure remaining sibling is marked split: true
        if (!withSibling) {
          const sib = getGroupSiblingId(day, slotId, prev.schedule);
          if (sib) {
            nextEntries = nextEntries.map((e) => {
              if (e.student === student && e.day === day && e.slotId === sib) {
                return { ...e, split: true };
              }
              return e;
            });
          }
        }
        const nextAssignments = prev.lsaAssignments.filter((a) => {
          if (a.student !== student || a.day !== day) return true;
          if (a.slotId === slotId) return false;
          if (siblingId && a.slotId === siblingId) return false;
          return true;
        });
        return { ...prev, entries: nextEntries, lsaAssignments: nextAssignments };
      });
    },
    [updateStore]
  );

  const splitEntry = useCallback(
    (student: string, day: DayOfWeek, slotId: string) => {
      updateStore((prev) => {
        const siblingId = getGroupSiblingId(day, slotId, prev.schedule);
        const nextEntries = prev.entries.map((e) => {
          if (e.student === student && e.day === day && (e.slotId === slotId || e.slotId === siblingId)) {
            return { ...e, split: true };
          }
          return e;
        });
        return { ...prev, entries: nextEntries };
      });
    },
    [updateStore]
  );

  const mergeEntry = useCallback(
    (student: string, day: DayOfWeek, slotId: string) => {
      updateStore((prev) => {
        const siblingId = getGroupSiblingId(day, slotId, prev.schedule);
        const thisEntry = prev.entries.find((e) => e.student === student && e.day === day && e.slotId === slotId);
        const thisAssignment = prev.lsaAssignments.find((a) => a.student === student && a.day === day && a.slotId === slotId);

        let nextEntries = prev.entries.map((e) => {
          if (e.student === student && e.day === day && (e.slotId === slotId || e.slotId === siblingId)) {
            return { ...e, split: false };
          }
          return e;
        });

        // If this entry exists, copy its details to the sibling so they match perfectly
        if (thisEntry && siblingId) {
          const sibIdx = nextEntries.findIndex((e) => e.student === student && e.day === day && e.slotId === siblingId);
          if (sibIdx > -1) {
            nextEntries[sibIdx] = {
              ...nextEntries[sibIdx],
              subject: thisEntry.subject,
              teacher: thisEntry.teacher,
              room: thisEntry.room,
              lessonType: thisEntry.lessonType,
              split: false,
              ...(thisEntry.classId ? { classId: thisEntry.classId } : {}),
              ...(thisEntry.className ? { className: thisEntry.className } : {}),
            };
          } else {
            nextEntries.push({
              id: createUniqueId(),
              student,
              day,
              slotId: siblingId,
              subject: thisEntry.subject,
              teacher: thisEntry.teacher,
              room: thisEntry.room,
              lessonType: thisEntry.lessonType,
              split: false,
              ...(thisEntry.classId ? { classId: thisEntry.classId } : {}),
              ...(thisEntry.className ? { className: thisEntry.className } : {}),
            });
          }
        }

        // Sync assignment
        let nextAssignments = [...prev.lsaAssignments];
        if (thisAssignment && siblingId) {
          const sibAssIdx = nextAssignments.findIndex((a) => a.student === student && a.day === day && a.slotId === siblingId);
          if (sibAssIdx > -1) {
            nextAssignments[sibAssIdx] = { ...nextAssignments[sibAssIdx], lsa: thisAssignment.lsa };
          } else {
            nextAssignments.push({
              id: createUniqueId(),
              student,
              day,
              slotId: siblingId,
              lsa: thisAssignment.lsa,
            });
          }
        }

        return { ...prev, entries: nextEntries, lsaAssignments: nextAssignments };
      });
    },
    [updateStore]
  );

  const setPrimarySupport = useCallback(
    (student: string, subject: string, lsa: string) => {
      if (role !== 'admin') return;
      const trimmedSubject = subject.trim();
      if (!trimmedSubject) return;
      updateStore((prev) => {
        const existingIdx = (prev.primarySupport || []).findIndex(
          (p) => p.student === student && p.subject.toLowerCase() === trimmedSubject.toLowerCase()
        );
        const nextPrimary = [...(prev.primarySupport || [])];
        if (!lsa) {
          if (existingIdx > -1) nextPrimary.splice(existingIdx, 1);
        } else {
          if (existingIdx > -1) {
            nextPrimary[existingIdx] = { ...nextPrimary[existingIdx], lsa };
          } else {
            nextPrimary.push({
              id: createUniqueId(),
              student,
              subject: trimmedSubject,
              lsa,
            });
          }
        }

        // Clean up any stale overrides (like __NONE__ or old overrides) for this student + subject
        // so that all lessons of this subject immediately inherit this primary support
        const matchingSlotKeys = new Set(
          prev.entries
            .filter(
              (e) =>
                e.student === student &&
                e.subject.trim().toLowerCase() === trimmedSubject.toLowerCase()
            )
            .map((e) => `${e.day}_${e.slotId}`)
        );

        const nextAssignments = prev.lsaAssignments.filter((a) => {
          if (a.student !== student) return true;
          return !matchingSlotKeys.has(`${a.day}_${a.slotId}`);
        });

        return { ...prev, primarySupport: nextPrimary, lsaAssignments: nextAssignments };
      });
    },
    [updateStore, role]
  );

  const setSecondarySupport = useCallback(
    (student: string, day: DayOfWeek, slotId: string, lsa: string) => {
      updateStore((prev) => {
        const existingIdx = prev.lsaAssignments.findIndex(
          (a) => a.student === student && a.day === day && a.slotId === slotId
        );
        const nextAssignments = [...prev.lsaAssignments];
        if (!lsa) {
          if (existingIdx > -1) nextAssignments.splice(existingIdx, 1);
        } else {
          if (existingIdx > -1) {
            nextAssignments[existingIdx] = { ...nextAssignments[existingIdx], lsa };
          } else {
            nextAssignments.push({
              id: createUniqueId(),
              student,
              day,
              slotId,
              lsa,
            });
          }
        }
        return { ...prev, lsaAssignments: nextAssignments };
      });
    },
    [updateStore]
  );

  const assignLsa = useCallback(
    (student: string, day: DayOfWeek, slotId: string, lsa: string) => {
      setSecondarySupport(student, day, slotId, lsa);
    },
    [setSecondarySupport]
  );

  const unassignLsa = useCallback(
    (student: string, day: DayOfWeek, slotId: string) => {
      setSecondarySupport(student, day, slotId, '');
    },
    [setSecondarySupport]
  );

  // Atomic method to save lesson details and support assignment together
  const saveLessonAndSupport = useCallback(
    (
      student: string,
      day: DayOfWeek,
      slotId: string,
      data: {
        subject: string;
        teacher?: string;
        room?: string;
        lessonType?: 'lesson' | 'withdrawal';
        split?: boolean;
        applyToDoublePeriod?: boolean;
        primaryStaff?: string;
        secondaryStaff?: string;
        assignedStaff?: string;
        applyToSubject?: boolean;
        originalSubject?: string;
        applySubjectToWeek?: boolean;
        applyTeacherToWeek?: boolean;
        applyRoomToWeek?: boolean;
        classId?: string;
        className?: string;
      }
    ) => {
      const studentName = student.trim();
      const trimmedSubject = data.subject.trim() || (data.assignedStaff || data.secondaryStaff || data.primaryStaff ? 'Support' : '');
      const lessonType = data.lessonType || 'lesson';
      const teacher = data.teacher ? data.teacher.trim() : '';
      const room = data.room ? data.room.trim() : '';
      const split = data.split ?? false;
      const applyToDoublePeriod = data.applyToDoublePeriod;

      updateStore((prev) => {
        // 1. Ensure student is present
        const nextStudents = prev.students.includes(studentName)
          ? prev.students
          : [...prev.students, studentName].sort();

        // 2. Ensure all referenced staff are registered in lsaPool
        let nextLsaPool = [...prev.lsaPool];
        const staffToCheck: string[] = [];
        if (data.primaryStaff && data.primaryStaff.trim() && data.primaryStaff.trim() !== '__NONE__') {
          staffToCheck.push(data.primaryStaff.trim());
        }
        if (data.secondaryStaff && data.secondaryStaff.trim() && data.secondaryStaff.trim() !== '__NONE__') {
          staffToCheck.push(data.secondaryStaff.trim());
        }
        if (data.assignedStaff && data.assignedStaff.trim() && data.assignedStaff.trim() !== '__NONE__') {
          staffToCheck.push(data.assignedStaff.trim());
        }

        for (const name of staffToCheck) {
          if (!nextLsaPool.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
            nextLsaPool.push({ id: createUniqueId(), name, designation: 'LSA' });
          }
        }
        nextLsaPool = sortStaffPool(nextLsaPool);

        // 3. Determine if slot has a paired sibling for double periods
        const siblingId = getGroupSiblingId(day, slotId, prev.schedule);
        const nextEntries = [...prev.entries];
        const nextAssignments = [...prev.lsaAssignments];
        const nextPrimary = [...(prev.primarySupport || [])];

        const targetSlotIds = [slotId];
        let effectiveSplit = split;

        // ONLY target sibling if explicitly requested (applyToDoublePeriod === true),
        // OR if undefined and BOTH slots were ALREADY existing and merged together!
        if (applyToDoublePeriod === true && siblingId) {
          targetSlotIds.push(siblingId);
          effectiveSplit = false;
        } else if (applyToDoublePeriod === false) {
          effectiveSplit = siblingId ? true : false;
          // When explicitly saving to a single 40-minute slot, ensure the sibling entry is also marked split: true
          if (siblingId) {
            const sibIdx = nextEntries.findIndex((e) => e.student === studentName && e.day === day && e.slotId === siblingId);
            if (sibIdx > -1) {
              nextEntries[sibIdx] = { ...nextEntries[sibIdx], split: true };
            }
          }
        } else if (siblingId && !split) {
          const existingTarget = prev.entries.find(
            (e) => e.student === studentName && e.day === day && e.slotId === slotId
          );
          const existingSibling = prev.entries.find(
            (e) => e.student === studentName && e.day === day && e.slotId === siblingId
          );
          // Only sync if both existed, were non-split, and matched! Never auto-sync empty slots!
          if (
            existingTarget &&
            existingSibling &&
            !existingTarget.split &&
            !existingSibling.split &&
            entriesMatch(existingTarget, existingSibling)
          ) {
            targetSlotIds.push(siblingId);
            effectiveSplit = false;
          } else {
            effectiveSplit = siblingId ? true : false;
          }
        }

        // 4. Update entry for targeted slot(s)
        for (const sid of targetSlotIds) {
          const eIdx = nextEntries.findIndex((e) => e.student === studentName && e.day === day && e.slotId === sid);
          if (trimmedSubject) {
            const prevEntry = eIdx > -1 ? nextEntries[eIdx] : undefined;
            // A withdrawal class only applies to more than one student!
            // Individual withdrawal lessons must NEVER inherit an old classId or be marked as a class.
            const effectiveClassId =
              lessonType === 'withdrawal'
                ? undefined
                : data.classId !== undefined
                ? data.classId
                : prevEntry?.classId;
            const effectiveClassName =
              lessonType === 'withdrawal'
                ? undefined
                : data.className !== undefined
                ? data.className
                : prevEntry?.className;
            const entry: TimetableEntry = {
              id: prevEntry ? prevEntry.id : createUniqueId(),
              student: studentName,
              day,
              slotId: sid,
              subject: trimmedSubject,
              teacher,
              room,
              lessonType,
              split: effectiveSplit,
              ...(effectiveClassId ? { classId: effectiveClassId } : {}),
              ...(effectiveClassName ? { className: effectiveClassName } : {}),
            };
            if (eIdx > -1) {
              nextEntries[eIdx] = entry;
            } else {
              nextEntries.push(entry);
            }
          }
        }

        // 4b. Propagate Subject, Teacher, and/or Room changes across all lessons of the same subject for the whole week
        const origSub = data.originalSubject ? data.originalSubject.trim() : '';
        if (origSub && (data.applySubjectToWeek || data.applyTeacherToWeek || data.applyRoomToWeek)) {
          const origSubLower = origSub.toLowerCase();
          for (let i = 0; i < nextEntries.length; i++) {
            const e = nextEntries[i];
            if (e.student === studentName && e.subject.trim().toLowerCase() === origSubLower) {
              nextEntries[i] = {
                ...e,
                subject: data.applySubjectToWeek && trimmedSubject ? trimmedSubject : e.subject,
                lessonType: data.applySubjectToWeek ? lessonType : e.lessonType,
                teacher: data.applyTeacherToWeek ? teacher : e.teacher,
                room: data.applyRoomToWeek ? room : e.room,
              };
            }
          }

          // If the subject was renamed for the whole week, migrate any existing Primary Support record from originalSubject to trimmedSubject
          if (data.applySubjectToWeek && trimmedSubject && origSubLower !== trimmedSubject.toLowerCase()) {
            const oldPrimIdx = nextPrimary.findIndex(
              (p) => p.student === studentName && p.subject.trim().toLowerCase() === origSubLower
            );
            if (oldPrimIdx > -1) {
              const newPrimIdx = nextPrimary.findIndex(
                (p) => p.student === studentName && p.subject.trim().toLowerCase() === trimmedSubject.toLowerCase()
              );
              if (newPrimIdx === -1) {
                nextPrimary[oldPrimIdx] = { ...nextPrimary[oldPrimIdx], subject: trimmedSubject };
              } else {
                nextPrimary.splice(oldPrimIdx, 1);
              }
            }
          }
        }

        // 5. Update Primary Support (Default LSA for this student + subject across the timetable)
        const effectivePrimaryStaff =
          data.primaryStaff !== undefined
            ? data.primaryStaff.trim()
            : data.applyToSubject && data.assignedStaff !== undefined
            ? data.assignedStaff.trim()
            : undefined;

        if (effectivePrimaryStaff !== undefined && trimmedSubject) {
          const pIdx = nextPrimary.findIndex(
            (p) => p.student === studentName && p.subject.toLowerCase() === trimmedSubject.toLowerCase()
          );
          if (effectivePrimaryStaff) {
            if (pIdx > -1) {
              nextPrimary[pIdx] = { ...nextPrimary[pIdx], lsa: effectivePrimaryStaff };
            } else {
              nextPrimary.push({
                id: createUniqueId(),
                student: studentName,
                subject: trimmedSubject,
                lsa: effectivePrimaryStaff,
              });
            }
          } else {
            // Cleared primary support
            if (pIdx > -1) nextPrimary.splice(pIdx, 1);
          }
        }

        // When applying primary support to a subject, only clear stale '__NONE__' placeholders on other lessons
        // of this subject if a primary staff member was explicitly assigned, preserving any specific secondary LSA overrides on other days.
        if (data.applyToSubject && trimmedSubject && effectivePrimaryStaff) {
          const matchingSlotKeys = new Set(
            nextEntries
              .filter(
                (e) =>
                  e.student === studentName &&
                  e.subject.trim().toLowerCase() === trimmedSubject.toLowerCase()
              )
              .map((e) => `${e.day}_${e.slotId}`)
          );

          for (let i = nextAssignments.length - 1; i >= 0; i--) {
            const a = nextAssignments[i];
            if (
              a.student === studentName &&
              a.lsa === '__NONE__' &&
              matchingSlotKeys.has(`${a.day}_${a.slotId}`)
            ) {
              nextAssignments.splice(i, 1);
            }
          }
        }

        // 6. Update Secondary Support (Slot-specific override: '' = inherit primary, '__NONE__' = force independent, or staff name)
        let effectiveSecondaryVal: string | undefined = undefined;
        if (data.secondaryStaff !== undefined) {
          effectiveSecondaryVal = data.secondaryStaff.trim();
        } else if (data.assignedStaff !== undefined) {
          if (data.applyToSubject) {
            effectiveSecondaryVal = ''; // inherit primary
          } else {
            effectiveSecondaryVal = data.assignedStaff.trim() || '__NONE__';
          }
        }

        if (effectiveSecondaryVal !== undefined) {
          for (const sid of targetSlotIds) {
            const aIdx = nextAssignments.findIndex(
              (a) => a.student === studentName && a.day === day && a.slotId === sid
            );

            if (effectiveSecondaryVal === '') {
              // '' means remove slot override so it inherits primary support
              if (aIdx > -1) nextAssignments.splice(aIdx, 1);
            } else {
              // either '__NONE__' or a specific staff member
              if (aIdx > -1) {
                nextAssignments[aIdx] = { ...nextAssignments[aIdx], lsa: effectiveSecondaryVal };
              } else {
                nextAssignments.push({
                  id: createUniqueId(),
                  student: studentName,
                  day,
                  slotId: sid,
                  lsa: effectiveSecondaryVal,
                });
              }
            }
          }
        }

        return {
          ...prev,
          students: nextStudents,
          lsaPool: nextLsaPool,
          entries: nextEntries,
          lsaAssignments: nextAssignments,
          primarySupport: nextPrimary,
        };
      });
    },
    [updateStore]
  );

  // Save or update a multi-student Class where a staff member is assigned as the Teacher
  // Within this class (shared classId), neither the teacher nor the support staff triggers a double-booking conflict.
  const saveStaffClass = useCallback(
    (data: {
      teacherStaff: string;
      day: DayOfWeek;
      slotId: string;
      students: string[];
      subject: string;
      room?: string;
      lessonType?: 'lesson' | 'withdrawal';
      supportStaff?: string;
      applyToDoublePeriod?: boolean;
      classId?: string;
    }) => {
      const teacherName = data.teacherStaff.trim();
      const cleanStudents = Array.from(
        new Set(data.students.map((s) => s.trim()).filter(Boolean))
      );
      if (!teacherName || cleanStudents.length === 0 || !data.slotId) return;

      const lessonType = data.lessonType || 'lesson';
      const trimmedSubject =
        data.subject.trim() ||
        (lessonType === 'withdrawal' ? 'Withdrawal Class' : 'Class Lesson');
      const room = data.room ? data.room.trim() : '';
      const supportStaff = data.supportStaff !== undefined ? data.supportStaff.trim() : undefined;

      updateStore((prev) => {
        // 1. Ensure all students exist in store.students
        const studentSet = new Set(prev.students);
        cleanStudents.forEach((stu) => studentSet.add(stu));
        const nextStudents = Array.from(studentSet).sort();

        // 2. Ensure teacherStaff and supportStaff exist in lsaPool
        const nextLsaPool = [...prev.lsaPool];
        const staffToEnsure = [teacherName];
        if (supportStaff && supportStaff !== '__NONE__') {
          staffToEnsure.push(supportStaff);
        }
        for (const st of staffToEnsure) {
          if (!nextLsaPool.some((p) => p.name.toLowerCase() === st.toLowerCase())) {
            nextLsaPool.push({ id: createUniqueId(), name: st, designation: 'LSA' });
          }
        }
        const sortedLsaPool = sortStaffPool(nextLsaPool);
        nextLsaPool.length = 0;
        nextLsaPool.push(...sortedLsaPool);

        // 3. Determine target slots (single 40m or paired 80m double period)
        const siblingId = getGroupSiblingId(data.day, data.slotId, prev.schedule);
        const targetSlotIds =
          data.applyToDoublePeriod && siblingId ? [data.slotId, siblingId] : [data.slotId];
        const effectiveSplit =
          data.applyToDoublePeriod && siblingId ? false : siblingId ? true : false;

        let nextEntries = [...prev.entries];
        let nextAssignments = [...prev.lsaAssignments];

        // 4. Determine or reuse classId
        // A withdrawal class only applies to more than one student!
        const isSingleStudentWithdrawal = lessonType === 'withdrawal' && cleanStudents.length <= 1;
        let effectiveClassId: string | undefined = undefined;
        if (!isSingleStudentWithdrawal) {
          effectiveClassId = data.classId?.trim();
          if (!effectiveClassId) {
            const existingClassEntry = nextEntries.find(
              (e) =>
                e.day === data.day &&
                e.slotId === data.slotId &&
                e.classId &&
                e.teacher?.trim().toLowerCase() === teacherName.toLowerCase() &&
                e.subject.trim().toLowerCase() === trimmedSubject.toLowerCase()
            );
            effectiveClassId = existingClassEntry?.classId || `class_${createUniqueId()}`;
          }
        }

        // If updating an existing class (data.classId was passed), remove students who were removed from this class in targetSlotIds
        if (data.classId) {
          const cleanLowerSet = new Set(cleanStudents.map((s) => s.toLowerCase()));
          const removedStudents = new Set<string>();
          nextEntries = nextEntries.filter((e) => {
            if (
              e.day === data.day &&
              targetSlotIds.includes(e.slotId) &&
              e.classId === data.classId &&
              !cleanLowerSet.has(e.student.trim().toLowerCase())
            ) {
              removedStudents.add(e.student);
              return false;
            }
            return true;
          });
          if (removedStudents.size > 0) {
            nextAssignments = nextAssignments.filter(
              (a) =>
                !(
                  a.day === data.day &&
                  targetSlotIds.includes(a.slotId) &&
                  removedStudents.has(a.student)
                )
            );
          }
        }

        // 5. Upsert TimetableEntry and LsaAssignment for each student in the class
        for (const stu of cleanStudents) {
          if (effectiveSplit && siblingId) {
            const sibIdx = nextEntries.findIndex(
              (e) => e.student === stu && e.day === data.day && e.slotId === siblingId
            );
            if (sibIdx > -1) {
              nextEntries[sibIdx] = { ...nextEntries[sibIdx], split: true };
            }
          }

          for (const sid of targetSlotIds) {
            const eIdx = nextEntries.findIndex(
              (e) => e.student === stu && e.day === data.day && e.slotId === sid
            );
            const entryObj: TimetableEntry = {
              id: eIdx > -1 ? nextEntries[eIdx].id : createUniqueId(),
              student: stu,
              day: data.day,
              slotId: sid,
              subject: trimmedSubject,
              teacher: teacherName,
              room,
              lessonType,
              split: effectiveSplit,
              ...(effectiveClassId ? { classId: effectiveClassId, className: trimmedSubject } : {}),
            };
            if (eIdx > -1) {
              nextEntries[eIdx] = entryObj;
            } else {
              nextEntries.push(entryObj);
            }

            if (supportStaff !== undefined) {
              const aIdx = nextAssignments.findIndex(
                (a) => a.student === stu && a.day === data.day && a.slotId === sid
              );
              const lsaVal = supportStaff && supportStaff !== '__NONE__' ? supportStaff : '__NONE__';
              if (aIdx > -1) {
                nextAssignments[aIdx] = { ...nextAssignments[aIdx], lsa: lsaVal };
              } else {
                nextAssignments.push({
                  id: createUniqueId(),
                  student: stu,
                  day: data.day,
                  slotId: sid,
                  lsa: lsaVal,
                });
              }
            }
          }
        }

        return {
          ...prev,
          students: nextStudents,
          lsaPool: nextLsaPool,
          entries: nextEntries,
          lsaAssignments: nextAssignments,
        };
      });
    },
    [updateStore]
  );

  // Direct 1-click slot support assignment
  const assignSupportDirectly = useCallback(
    (
      student: string,
      day: DayOfWeek,
      slotId: string,
      staffName: string,
      applyToDoublePeriod?: boolean
    ) => {
      const studentName = student.trim();
      const staff = staffName.trim();
      if (!studentName) return;

      updateStore((prev) => {
        const nextStudents = prev.students.includes(studentName)
          ? prev.students
          : [...prev.students, studentName].sort();
        let nextLsaPool = prev.lsaPool;
        if (staff && !prev.lsaPool.some((p) => p.name.toLowerCase() === staff.toLowerCase())) {
          nextLsaPool = sortStaffPool([...prev.lsaPool, { id: createUniqueId(), name: staff, designation: 'LSA' }]);
        }

        const siblingId = getGroupSiblingId(day, slotId, prev.schedule);
        const nextEntries = [...prev.entries];
        const nextAssignments = [...prev.lsaAssignments];
        const targetSlotIds = [slotId];

        if (applyToDoublePeriod === true && siblingId) {
          targetSlotIds.push(siblingId);
        } else if (applyToDoublePeriod === false && siblingId) {
          // Explicitly assigning to a single 40m slot: mark sibling as split if it exists
          const sibIdx = nextEntries.findIndex(
            (e) => e.student === studentName && e.day === day && e.slotId === siblingId
          );
          if (sibIdx > -1) {
            nextEntries[sibIdx] = { ...nextEntries[sibIdx], split: true };
          }
        } else if (siblingId) {
          const entry = prev.entries.find((e) => e.student === studentName && e.day === day && e.slotId === slotId);
          const siblingEntry = prev.entries.find(
            (e) => e.student === studentName && e.day === day && e.slotId === siblingId
          );
          // Only sync to sibling if BOTH entries already exist, are non-split, and have matching subject
          if (
            entry &&
            !entry.split &&
            siblingEntry &&
            !siblingEntry.split &&
            entry.subject.trim().toLowerCase() === siblingEntry.subject.trim().toLowerCase()
          ) {
            targetSlotIds.push(siblingId);
          }
        }

        const isMergedDouble = targetSlotIds.length > 1;
        // Find a template entry from either paired slot if merging 80-min so both slots share identical subject/teacher/room/lessonType and merge cleanly
        const templateEntry = isMergedDouble
          ? nextEntries.find(
              (e) => e.student === studentName && e.day === day && targetSlotIds.includes(e.slotId)
            )
          : undefined;

        for (const sid of targetSlotIds) {
          const eIdx = nextEntries.findIndex((e) => e.student === studentName && e.day === day && e.slotId === sid);
          if (eIdx === -1) {
            nextEntries.push({
              id: createUniqueId(),
              student: studentName,
              day,
              slotId: sid,
              subject: templateEntry?.subject || 'Support',
              teacher: templateEntry?.teacher || '',
              room: templateEntry?.room || '',
              lessonType: templateEntry?.lessonType || 'lesson',
              split: isMergedDouble ? false : siblingId ? true : false,
              ...(templateEntry?.classId ? { classId: templateEntry.classId } : {}),
              ...(templateEntry?.className ? { className: templateEntry.className } : {}),
            });
          } else if (isMergedDouble && templateEntry) {
            nextEntries[eIdx] = {
              ...nextEntries[eIdx],
              subject: templateEntry.subject,
              teacher: templateEntry.teacher,
              room: templateEntry.room,
              lessonType: templateEntry.lessonType,
              split: false,
            };
          } else if (!isMergedDouble && siblingId) {
            nextEntries[eIdx] = {
              ...nextEntries[eIdx],
              split: true,
            };
          }

          const aIdx = nextAssignments.findIndex(
            (a) => a.student === studentName && a.day === day && a.slotId === sid
          );
          if (staff) {
            if (aIdx > -1) {
              nextAssignments[aIdx] = { ...nextAssignments[aIdx], lsa: staff };
            } else {
              nextAssignments.push({
                id: createUniqueId(),
                student: studentName,
                day,
                slotId: sid,
                lsa: staff,
              });
            }
          } else {
            // Explicitly unassign for this slot so primary support doesn't re-populate it
            if (aIdx > -1) {
              nextAssignments[aIdx] = { ...nextAssignments[aIdx], lsa: '__NONE__' };
            } else {
              nextAssignments.push({
                id: createUniqueId(),
                student: studentName,
                day,
                slotId: sid,
                lsa: '__NONE__',
              });
            }
          }
        }

        return {
          ...prev,
          students: nextStudents,
          lsaPool: nextLsaPool,
          entries: nextEntries,
          lsaAssignments: nextAssignments,
        };
      });
    },
    [updateStore]
  );

  const applyImportRows = useCallback(
    (rows: ParsedImportRow[]) => {
      updateStore((prev) => {
        const studentSet = new Set<string>();
        const entryMap = new Map<string, TimetableEntry>();

        rows.forEach((r) => {
          const sName = r.student ? r.student.trim() : '';
          if (sName) {
            studentSet.add(sName);
          }
          r.slotIds.forEach((sid) => {
            const key = `${sName}__${r.day}__${sid}`;
            entryMap.set(key, {
              id: createUniqueId(),
              student: sName,
              day: r.day,
              slotId: sid,
              subject: r.subject,
              teacher: r.teacher || '',
              room: r.room || '',
              lessonType: r.lessonType || 'lesson',
              split: false,
            });
          });
        });

        const nextStudents = Array.from(studentSet).sort();
        const rawEntries = Array.from(entryMap.values());
        const repaired = normalizeFridayEntries(rawEntries, [], prev.schedule);

        return {
          ...prev,
          students: nextStudents,
          entries: repaired.entries,
          lsaAssignments: [],
          primarySupport: [],
          staffNotes: [],
          // Staff roster (lsaPool) is strictly preserved!
        };
      });

      setIndivName((prev) => (indivType === 'student' ? null : prev));
    },
    [updateStore, indivType]
  );

  const setAdminPasscode = useCallback(
    (passcode: string) => {
      updateStore((prev) => ({
        ...prev,
        settings: { ...prev.settings, adminPasscode: passcode },
      }));
    },
    [updateStore]
  );

  const postAnnouncement = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      updateStore((prev) => ({
        ...prev,
        announcements: [
          ...(prev.announcements || []),
          { id: createUniqueId(), text: trimmed, date: new Date().toISOString() },
        ],
      }));
    },
    [updateStore]
  );

  const removeAnnouncement = useCallback(
    (id: string) => {
      updateStore((prev) => ({
        ...prev,
        announcements: (prev.announcements || []).filter((a) => a.id !== id),
      }));
    },
    [updateStore]
  );

  const saveScheduleOverrides = useCallback(
    (overrides: ScheduleOverrides) => {
      updateStore((prev) => {
        const validWeekdayIds = new Set(slotsFor('Mon', overrides).map((s) => s.id));
        const validFridayIds = new Set(slotsFor('Fri', overrides).map((s) => s.id));
        const isSlotValid = (day: DayOfWeek, slotId: string) =>
          day === 'Fri' ? validFridayIds.has(slotId) : validWeekdayIds.has(slotId);

        return {
          ...prev,
          schedule: overrides,
          entries: prev.entries.filter((e) => isSlotValid(e.day, e.slotId)),
          lsaAssignments: prev.lsaAssignments.filter((a) => isSlotValid(a.day, a.slotId)),
          staffNotes: (prev.staffNotes || []).filter((n) => isSlotValid(n.day, n.slotId)),
        };
      });
    },
    [updateStore]
  );

  const saveStaffNote = useCallback(
    (noteData: Omit<StaffSlotNote, 'id' | 'createdAt'> & { id?: string }) => {
      updateStore((prev) => {
        const existingList = prev.staffNotes || [];
        const createdAt = new Date();
        const { effectiveDay } = getEffectiveDayForNote(noteData.day, createdAt);
        const expiresAt = calculateNoteExpiration(effectiveDay, createdAt);

        if (noteData.id && existingList.some((n) => n.id === noteData.id)) {
          // Update existing note by ID
          const updated = existingList.map((n) => {
            if (n.id === noteData.id) {
              const shouldKeepIndefinitely =
                noteData.keepIndefinitely !== undefined
                  ? Boolean(noteData.keepIndefinitely)
                  : Boolean(n.keepIndefinitely);
              const rawNote = {
                ...n,
                ...noteData,
                day: effectiveDay,
                keepIndefinitely: shouldKeepIndefinitely,
                expiresAt: shouldKeepIndefinitely ? undefined : expiresAt.toISOString(),
              };
              return Object.fromEntries(
                Object.entries(rawNote).filter(([_, v]) => v !== undefined)
              ) as unknown as StaffSlotNote;
            }
            return n;
          });
          return {
            ...prev,
            staffNotes: updated,
          };
        } else {
          // Create new individual note
          const noteId = noteData.id || createUniqueId();
          const shouldKeepIndefinitely = Boolean(noteData.keepIndefinitely);
          const rawNote = {
            ...noteData,
            day: effectiveDay,
            id: noteId,
            createdAt: createdAt.toISOString(),
            keepIndefinitely: shouldKeepIndefinitely,
            expiresAt: shouldKeepIndefinitely ? undefined : expiresAt.toISOString(),
          };
          const newNote: StaffSlotNote = Object.fromEntries(
            Object.entries(rawNote).filter(([_, v]) => v !== undefined)
          ) as unknown as StaffSlotNote;

          // If this is a cover note, replace any previous cover note for this slot while keeping all other notes
          const filtered = newNote.isCover
            ? existingList.filter(
                (n) =>
                  !(
                    n.staffName.toLowerCase() === noteData.staffName.toLowerCase() &&
                    n.day === effectiveDay &&
                    n.slotId === noteData.slotId &&
                    n.isCover
                  )
              )
            : existingList;

          return {
            ...prev,
            staffNotes: [...filtered, newNote],
          };
        }
      });
    },
    [updateStore]
  );

  const saveStaffNotesBatch = useCallback(
    (notesList: (Omit<StaffSlotNote, 'id' | 'createdAt'> & { id?: string })[]) => {
      updateStore((prev) => {
        let currentNotes = [...(prev.staffNotes || [])];
        const createdAt = new Date();
        for (const noteData of notesList) {
          const { effectiveDay } = getEffectiveDayForNote(noteData.day, createdAt);
          const expiresAt = calculateNoteExpiration(effectiveDay, createdAt);

          if (noteData.id && currentNotes.some((n) => n.id === noteData.id)) {
            currentNotes = currentNotes.map((n) => {
              if (n.id === noteData.id) {
                const shouldKeepIndefinitely =
                  noteData.keepIndefinitely !== undefined
                    ? Boolean(noteData.keepIndefinitely)
                    : Boolean(n.keepIndefinitely);
                const rawNote = {
                  ...n,
                  ...noteData,
                  day: effectiveDay,
                  keepIndefinitely: shouldKeepIndefinitely,
                  expiresAt: shouldKeepIndefinitely ? undefined : expiresAt.toISOString(),
                };
                return Object.fromEntries(
                  Object.entries(rawNote).filter(([_, v]) => v !== undefined)
                ) as unknown as StaffSlotNote;
              }
              return n;
            });
          } else {
            const noteId = noteData.id || createUniqueId();
            const shouldKeepIndefinitely = Boolean(noteData.keepIndefinitely);
            const rawNote = {
              ...noteData,
              day: effectiveDay,
              id: noteId,
              createdAt: createdAt.toISOString(),
              keepIndefinitely: shouldKeepIndefinitely,
              expiresAt: shouldKeepIndefinitely ? undefined : expiresAt.toISOString(),
            };
            const newNote: StaffSlotNote = Object.fromEntries(
              Object.entries(rawNote).filter(([_, v]) => v !== undefined)
            ) as unknown as StaffSlotNote;

            if (newNote.isCover) {
              currentNotes = currentNotes.filter(
                (n) =>
                  !(
                    n.staffName.toLowerCase() === noteData.staffName.toLowerCase() &&
                    n.day === effectiveDay &&
                    n.slotId === noteData.slotId &&
                    n.isCover
                  )
              );
            }
            currentNotes.push(newNote);
          }
        }
        return {
          ...prev,
          staffNotes: currentNotes,
        };
      });
    },
    [updateStore]
  );

  const deleteStaffNote = useCallback(
    (staffName: string, day: DayOfWeek, slotId: string, noteId?: string) => {
      updateStore((prev) => {
        const existingList = prev.staffNotes || [];
        const filtered = existingList.filter((n) => {
          if (noteId) {
            return n.id !== noteId;
          }
          return !(n.staffName.toLowerCase() === staffName.toLowerCase() && n.day === day && n.slotId === slotId);
        });
        return {
          ...prev,
          staffNotes: filtered,
        };
      });
    },
    [updateStore]
  );

  const deleteStaffNoteById = useCallback(
    (noteId: string) => {
      updateStore((prev) => {
        const existingList = prev.staffNotes || [];
        const filtered = existingList.filter((n) => n.id !== noteId);
        return {
          ...prev,
          staffNotes: filtered,
        };
      });
    },
    [updateStore]
  );

  const deleteStaffNotesBatch = useCallback(
    (targets: { staffName: string; day: DayOfWeek; slotId: string; noteId?: string }[]) => {
      updateStore((prev) => {
        let currentNotes = [...(prev.staffNotes || [])];
        for (const t of targets) {
          currentNotes = currentNotes.filter((n) => {
            if (t.noteId) {
              return n.id !== t.noteId;
            }
            return !(n.staffName.toLowerCase() === t.staffName.toLowerCase() && n.day === t.day && n.slotId === t.slotId);
          });
        }
        return {
          ...prev,
          staffNotes: currentNotes,
        };
      });
    },
    [updateStore]
  );

  const cleanupExpiredNotes = useCallback(() => {
    updateStore((prev) => {
      const currentNotes = prev.staffNotes || [];
      const activeNotes = filterActiveStaffNotes(currentNotes);
      if (activeNotes.length === currentNotes.length) return prev;
      return {
        ...prev,
        staffNotes: activeNotes,
      };
    });
  }, [updateStore]);

  const clearAllEntries = useCallback(() => {
    isExplicitResetRef.current = true;
    updateStore((prev) => ({
      ...prev,
      students: [],
      entries: [],
      lsaAssignments: [],
      primarySupport: [],
      staffNotes: [],
      // Staff roster (lsaPool) is kept!
    }));
    setIndivName((prev) => (indivType === 'student' ? null : prev));
    setTimeout(() => {
      isExplicitResetRef.current = false;
    }, 3000);
  }, [updateStore, indivType]);

  const resetToSampleData = useCallback(() => {
    isExplicitResetRef.current = true;
    maxKnownEntriesCountRef.current = Math.max(maxKnownEntriesCountRef.current, INITIAL_TIMETABLE_STORE.entries.length);
    maxKnownStudentsCountRef.current = Math.max(maxKnownStudentsCountRef.current, INITIAL_TIMETABLE_STORE.students.length);
    updateStore(() => INITIAL_TIMETABLE_STORE);
    setTimeout(() => {
      isExplicitResetRef.current = false;
    }, 3000);
  }, [updateStore]);

  const value = useMemo(
    () => ({
      user,
      accessStatus,
      authError,
      setAuthError,
      isSigningIn,
      isAutoAdmin,
      signIn,
      logout,
      refreshAccess,
      store,
      role,
      setRole,
      currentSection,
      setCurrentSection,
      currentDay,
      setCurrentDay,
      timetableView,
      setTimetableView,
      staffFilter,
      setStaffFilter,
      indivType,
      setIndivType,
      indivName,
      setIndivName,
      syncStatus,
      forceSyncToCloud,
      isAdminLoginOpen,
      setIsAdminLoginOpen,
      openAdminLogin,
      addStudent,
      renameStudent,
      removeStudent,
      addStaff,
      renameStaff,
      updateStaffMember,
      updateStaffDesignation,
      removeStaff,
      addApprovedEmail,
      removeApprovedEmail,
      upsertEntry,
      deleteEntry,
      splitEntry,
      mergeEntry,
      setPrimarySupport,
      setSecondarySupport,
      assignLsa,
      unassignLsa,
      saveLessonAndSupport,
      saveStaffClass,
      assignSupportDirectly,
      applyImportRows,
      setAdminPasscode,
      postAnnouncement,
      removeAnnouncement,
      saveScheduleOverrides,
      saveStaffNote,
      saveStaffNotesBatch,
      deleteStaffNote,
      deleteStaffNoteById,
      deleteStaffNotesBatch,
      cleanupExpiredNotes,
      clearAllEntries,
      resetToSampleData,
      milestoneInfo,
      saveMilestoneCheckpoint,
      restoreMilestoneCheckpoint,
      downloadCheckpointJSON,
    }),
    [
      user,
      accessStatus,
      authError,
      isSigningIn,
      isAutoAdmin,
      signIn,
      logout,
      refreshAccess,
      store,
      role,
      setRole,
      currentSection,
      currentDay,
      timetableView,
      staffFilter,
      indivType,
      indivName,
      syncStatus,
      forceSyncToCloud,
      isAdminLoginOpen,
      openAdminLogin,
      addStudent,
      renameStudent,
      removeStudent,
      addStaff,
      renameStaff,
      updateStaffMember,
      updateStaffDesignation,
      removeStaff,
      addApprovedEmail,
      removeApprovedEmail,
      upsertEntry,
      deleteEntry,
      splitEntry,
      mergeEntry,
      setPrimarySupport,
      setSecondarySupport,
      assignLsa,
      unassignLsa,
      saveLessonAndSupport,
      saveStaffClass,
      assignSupportDirectly,
      applyImportRows,
      setAdminPasscode,
      postAnnouncement,
      removeAnnouncement,
      saveScheduleOverrides,
      saveStaffNote,
      saveStaffNotesBatch,
      deleteStaffNote,
      deleteStaffNoteById,
      deleteStaffNotesBatch,
      cleanupExpiredNotes,
      clearAllEntries,
      resetToSampleData,
      milestoneInfo,
      saveMilestoneCheckpoint,
      restoreMilestoneCheckpoint,
      downloadCheckpointJSON,
    ]
  );

  return <TimetableContext.Provider value={value}>{children}</TimetableContext.Provider>;
};

export const useTimetable = () => {
  const context = useContext(TimetableContext);
  if (!context) {
    throw new Error('useTimetable must be used within a TimetableProvider');
  }
  return context;
};
