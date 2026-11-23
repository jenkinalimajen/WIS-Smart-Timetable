import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTimetable } from '../context/TimetableContext';
import { DayOfWeek, TimeSlot, StaffAssignmentDetail, StaffSlotNote, StaffDesignation } from '../types';
import {
  DAYS,
  DAY_FULL,
  slotsFor,
  MAX_ROWS,
  computeConflicts,
  getDayConflicts,
  getAllWeekConflicts,
  canStudentSlotsMerge as canStudentSlotsMergeUtil,
  canStaffSlotsMerge as canStaffSlotsMergeUtil,
  subjectColor,
  exportGridCSV,
  exportGridPDF,
  exportIndividualCSV,
  exportIndividualPDF,
  getActiveSupport,
  assignmentsForLsaSlot,
  activeSupportForDay,
  printTimetableDocument,
  getStudentSubjectFill,
  buildStudentSubjectColorMap,
  isFixedOrRegistrationSlot,
  filterActiveStaffNotes,
  hasSlotConflict,
  isStaffMentionedInNote,
  consolidateStaffSlotAssignments,
  sortStaffPool,
  getStaffDesignation,
} from '../utils/timetable';
import { FormattedNoteText } from './FormattedNoteText';
import { useTimetableSwipe } from '../utils/useTimetableSwipe';
import { LessonModal } from './Modals/LessonModal';
import { LessonDetailModal } from './Modals/LessonDetailModal';
import { StaffCellModal } from './Modals/StaffCellModal';
import { AddStaffLessonModal } from './Modals/AddStaffLessonModal';
import {
  FileDown,
  FileText,
  Printer,
  AlertTriangle,
  Users,
  KeyRound,
  Rows,
  Lock,
  Plus,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  Info,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Pin,
  Minimize2,
  Maximize2,
  AtSign,
} from 'lucide-react';

export const TimetableGrid: React.FC = () => {
  const {
    store,
    role,
    isAutoAdmin,
    openAdminLogin,
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
  } = useTimetable();

  // Individual view day filter: 'all' (Mon-Fri) or specific day
  const [indivDayView, setIndivDayView] = useState<'all' | DayOfWeek>('all');
  // All Students / All Staff view day mode: single day (currentDay) or 'all' (Mon-Fri)
  const [allScheduleDayMode, setAllScheduleDayMode] = useState<'single' | 'all'>('single');
  // Row expansion control for individual timetable ('compact' | 'standard' | 'expanded')
  const [indivRowExpansion, setIndivRowExpansion] = useState<'compact' | 'standard' | 'expanded'>('standard');

  // Compress timetable to fit all to the screen without horizontal scrolling
  const [isCompressedFit, setIsCompressedFit] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('timetable_fit_screen');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleCompressedFit = () => {
    setIsCompressedFit((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('timetable_fit_screen', String(next));
      } catch {}
      return next;
    });
  };

  // Frozen bottom bar state & synchronized side-scroll
  const primaryContainerRef = useRef<HTMLDivElement | null>(null);
  const allContainersRef = useRef<Set<HTMLDivElement>>(new Set());
  const bottomTrackRef = useRef<HTMLDivElement | null>(null);
  const bottomThumbRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef(false);
  const isDraggingThumbRef = useRef(false);
  const dragThumbStartXRef = useRef(0);
  const dragThumbStartScrollLeftRef = useRef(0);
  const scrollHoldIntervalRef = useRef<number | null>(null);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);

  // Minimal state that ONLY updates when boundary buttons change state
  const [scrollButtonsState, setScrollButtonsState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
    hasOverflow: false,
  });

  // Direct DOM update for bottom scrollbar thumb - ZERO React re-renders during panning!
  const updateBottomThumbDOM = useCallback((scrollLeft?: number) => {
    const container = primaryContainerRef.current;
    const track = bottomTrackRef.current;
    const thumb = bottomThumbRef.current;
    if (!container || !track || !thumb) return;

    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    const maxScroll = scrollWidth - clientWidth;
    const trackWidth = track.clientWidth;

    if (maxScroll <= 0 || trackWidth <= 0) {
      thumb.style.display = 'none';
      return;
    }
    thumb.style.display = 'block';

    const currentLeft = scrollLeft !== undefined ? scrollLeft : container.scrollLeft;
    const visibleRatio = Math.min(1, clientWidth / scrollWidth);
    const thumbWidth = Math.max(40, Math.min(trackWidth, Math.round(trackWidth * visibleRatio)));
    const maxThumbTravel = trackWidth - thumbWidth;
    const scrollFraction = Math.max(0, Math.min(1, currentLeft / maxScroll));
    const thumbLeft = Math.round(scrollFraction * maxThumbTravel);

    thumb.style.width = `${thumbWidth}px`;
    thumb.style.transform = `translateX(${thumbLeft}px)`;
  }, []);

  const updateScrollState = useCallback(() => {
    const el = primaryContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const canScrollLeft = scrollLeft > 3;
    const canScrollRight = scrollLeft < scrollWidth - clientWidth - 3;
    const hasOverflow = scrollWidth > clientWidth + 3;

    updateBottomThumbDOM(scrollLeft);

    setScrollButtonsState((prev) => {
      if (
        prev.canScrollLeft === canScrollLeft &&
        prev.canScrollRight === canScrollRight &&
        prev.hasOverflow === hasOverflow
      ) {
        return prev;
      }
      return {
        canScrollLeft,
        canScrollRight,
        hasOverflow,
      };
    });
  }, [updateBottomThumbDOM]);

  const registerTableContainer = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        allContainersRef.current.add(node);
        primaryContainerRef.current = node;
        updateScrollState();
      }
    },
    [updateScrollState]
  );

  const syncAllContainers = useCallback((sourceNode: HTMLDivElement | null, newScrollLeft: number) => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;

    allContainersRef.current.forEach((c) => {
      if (c && c !== sourceNode && Math.abs(c.scrollLeft - newScrollLeft) > 0.5) {
        c.scrollLeft = newScrollLeft;
      }
    });

    updateBottomThumbDOM(newScrollLeft);

    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  }, [updateBottomThumbDOM]);

  const handleTableScroll = (sourceNode: HTMLDivElement) => {
    syncAllContainers(sourceNode, sourceNode.scrollLeft);
    updateScrollState();
  };

  const swipeHandlers = useTimetableSwipe({
    onScrollSync: (newLeft) => {
      updateBottomThumbDOM(newLeft);
      updateScrollState();
    },
    getSyncTargets: () => Array.from(allContainersRef.current),
  });

  const scrollStep = (direction: 'left' | 'right' | 'start' | 'end') => {
    const el = primaryContainerRef.current;
    if (!el) return;
    const delta = direction === 'left' ? -280 : 280;
    allContainersRef.current.forEach((container) => {
      if (direction === 'start') {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else if (direction === 'end') {
        container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: delta, behavior: 'smooth' });
      }
    });
    setTimeout(() => updateScrollState(), 300);
  };

  const startContinuousScroll = (direction: 'left' | 'right') => {
    scrollStep(direction);
    if (scrollHoldIntervalRef.current) clearInterval(scrollHoldIntervalRef.current);
    scrollHoldIntervalRef.current = window.setInterval(() => {
      const delta = direction === 'left' ? -40 : 40;
      allContainersRef.current.forEach((c) => {
        c.scrollLeft += delta;
      });
      const primary = primaryContainerRef.current;
      if (primary) {
        updateBottomThumbDOM(primary.scrollLeft);
      }
    }, 25);
  };

  const stopContinuousScroll = () => {
    if (scrollHoldIntervalRef.current) {
      clearInterval(scrollHoldIntervalRef.current);
      scrollHoldIntervalRef.current = null;
    }
    updateScrollState();
  };

  // Interactive Bottom Thumb dragging
  const handleThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const container = primaryContainerRef.current;
    if (!container) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    isDraggingThumbRef.current = true;
    dragThumbStartXRef.current = e.clientX;
    dragThumbStartScrollLeftRef.current = container.scrollLeft;
  };

  const handleThumbPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingThumbRef.current) return;
    const container = primaryContainerRef.current;
    const track = bottomTrackRef.current;
    const thumb = bottomThumbRef.current;
    if (!container || !track || !thumb) return;

    const trackWidth = track.clientWidth;
    const thumbWidth = thumb.clientWidth;
    const maxTravel = trackWidth - thumbWidth;
    if (maxTravel <= 0) return;

    const deltaX = e.clientX - dragThumbStartXRef.current;
    const maxScroll = container.scrollWidth - container.clientWidth;
    const scrollDelta = (deltaX / maxTravel) * maxScroll;
    const targetScroll = Math.max(0, Math.min(maxScroll, dragThumbStartScrollLeftRef.current + scrollDelta));

    container.scrollLeft = targetScroll;
    syncAllContainers(container, targetScroll);
  };

  const handleThumbPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingThumbRef.current) return;
    isDraggingThumbRef.current = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}
    updateScrollState();
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === bottomThumbRef.current || bottomThumbRef.current?.contains(e.target as Node)) {
      return;
    }
    const container = primaryContainerRef.current;
    const track = bottomTrackRef.current;
    if (!container || !track) return;

    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const trackWidth = rect.width;
    const maxScroll = container.scrollWidth - container.clientWidth;
    const targetScroll = Math.max(0, Math.min(maxScroll, (clickX / trackWidth) * maxScroll));

    allContainersRef.current.forEach((el) => {
      el.scrollTo({ left: targetScroll, behavior: 'smooth' });
    });
    setTimeout(() => updateScrollState(), 300);
  };

  useEffect(() => {
    const el = primaryContainerRef.current;
    if (!el) return;

    updateScrollState();

    const handleResize = () => {
      updateScrollState();
    };

    const observer = new ResizeObserver(() => {
      updateScrollState();
    });

    observer.observe(el);
    if (bottomTrackRef.current) {
      observer.observe(bottomTrackRef.current);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [timetableView, currentDay, indivDayView, indivType, indivName, store, updateScrollState]);

  // Selected cell state for modals
  const [selectedStudentCell, setSelectedStudentCell] = useState<{
    student: string;
    day: DayOfWeek;
    slotId: string;
  } | null>(null);
  const [isEditingSelectedCell, setIsEditingSelectedCell] = useState(false);

  const [selectedStaffCell, setSelectedStaffCell] = useState<{
    staffName: string;
    day: DayOfWeek;
    slotId: string;
  } | null>(null);

  // Dedicated Add Lesson to Staff modal state from All Staff Timetable
  const [isAddStaffLessonModalOpen, setIsAddStaffLessonModalOpen] = useState(false);
  const [addStaffLessonPrefill, setAddStaffLessonPrefill] = useState<{
    staffName?: string;
    day?: DayOfWeek;
    slotId?: string;
    lessonType?: 'withdrawal' | 'lesson';
    mode?: 'lesson' | 'class';
  } | null>(null);

  // Active non-expired staff notes and covers
  // Ensures timetable immediately reverts to normal when cutoff arrives
  const activeStaffNotes = useMemo(
    () => filterActiveStaffNotes(store.staffNotes || []),
    [store.staffNotes]
  );

  // Redirect to author staff member's slot when purple mention card is clicked
  const handleNavigateToMention = (sn: StaffSlotNote, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (!sn.staffName) return;

    if (timetableView === 'individual') {
      setIndivType('staff');
      setIndivName(sn.staffName);
      if (indivDayView !== 'all' && indivDayView !== sn.day) {
        setIndivDayView(sn.day);
      }
    } else {
      setCurrentDay(sn.day);
    }

    setSelectedStaffCell({
      staffName: sn.staffName,
      day: sn.day,
      slotId: sn.slotId,
    });
  };

  // Staff ordered by designation: all LSAs together first, then SENDs
  const orderedStaffPool = useMemo(() => sortStaffPool(store.lsaPool), [store.lsaPool]);
  const orderedStaffNames = useMemo(() => orderedStaffPool.map((p) => p.name), [orderedStaffPool]);
  const staffDesignationMap = useMemo(() => {
    const map = new Map<string, StaffDesignation>();
    orderedStaffPool.forEach((p) => {
      map.set(p.name.trim().toLowerCase(), getStaffDesignation(p));
    });
    return map;
  }, [orderedStaffPool]);

  // Print helper - prints clean formatted timetable document
  const handlePrint = () => {
    printTimetableDocument({
      view: timetableView,
      day: currentDay,
      allDays: timetableView !== 'individual' && allScheduleDayMode === 'all',
      students: store.students,
      staffList: orderedStaffNames,
      staffPool: orderedStaffPool,
      entries: store.entries,
      assignments: store.lsaAssignments,
      primarySupport: store.primarySupport || [],
      schedule: store.schedule,
      indivType,
      indivName,
      indivDayView,
      rowExpansion: indivRowExpansion,
      staffNotes: activeStaffNotes,
    });
  };

  const handleDownloadGridCSV = () => {
    if (timetableView === 'individual') return;
    const effectiveGridDay: DayOfWeek | 'all' = allScheduleDayMode === 'all' ? 'all' : currentDay;
    exportGridCSV(
      timetableView,
      effectiveGridDay,
      store.students,
      orderedStaffNames,
      store.entries,
      store.lsaAssignments,
      store.primarySupport || [],
      store.schedule
    );
  };

  const handleDownloadGridPDF = () => {
    if (timetableView === 'individual') return;
    exportGridPDF(
      timetableView,
      currentDay,
      store.students,
      orderedStaffNames,
      store.entries,
      store.lsaAssignments,
      store.primarySupport || [],
      store.schedule,
      activeStaffNotes,
      orderedStaffPool
    );
  };

  const handleDownloadIndivCSV = () => {
    if (!indivName) return;
    exportIndividualCSV(
      indivType,
      indivName,
      store.entries,
      store.lsaAssignments,
      store.primarySupport || [],
      store.students,
      store.schedule,
      indivDayView
    );
  };

  const handleDownloadIndivPDF = () => {
    if (!indivName) return;
    exportIndividualPDF(
      indivType,
      indivName,
      store.entries,
      store.lsaAssignments,
      store.primarySupport || [],
      store.students,
      store.schedule,
      indivDayView,
      indivRowExpansion,
      activeStaffNotes
    );
  };

  const activeDayAssignments = useMemo(() => {
    return activeSupportForDay(
      currentDay,
      store.students,
      store.entries,
      store.lsaAssignments,
      store.primarySupport || [],
      store.schedule,
      store.lsaPool
    );
  }, [currentDay, store.students, store.entries, store.lsaAssignments, store.primarySupport, store.schedule, store.lsaPool]);

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
          store.schedule,
          store.lsaPool
        )
      );
    });
    return list;
  }, [store.students, store.entries, store.lsaAssignments, store.primarySupport, store.schedule, store.lsaPool]);

  const dayConflicts = getDayConflicts(currentDay, activeDayAssignments, store.schedule, store.entries);
  const weekConflicts = getAllWeekConflicts(activeWeekAssignments, store.schedule, store.entries);
  const indivConflicts = indivName
    ? weekConflicts.filter((c) =>
        indivType === 'staff'
          ? c.lsa.trim().toLowerCase() === indivName.trim().toLowerCase()
          : c.students.some((stu) => stu.trim().toLowerCase() === indivName.trim().toLowerCase())
      )
    : [];

  const conflictMap = computeConflicts(currentDay, activeDayAssignments, store.schedule, store.entries);

  // Helper to determine if two staff slots in an 80-minute block can merge
  const canStaffSlotsMerge = (
    staffName: string,
    day: DayOfWeek,
    s: TimeSlot,
    nextSlot?: TimeSlot
  ): boolean => {
    return canStaffSlotsMergeUtil(
      staffName,
      day,
      s,
      nextSlot,
      store.students,
      store.entries,
      store.lsaAssignments,
      store.primarySupport || [],
      activeStaffNotes
    );
  };

  // Helper to determine if two student slots in an 80-minute block can merge
  const canStudentSlotsMerge = (
    studentName: string,
    day: DayOfWeek,
    s: TimeSlot,
    nextSlot?: TimeSlot
  ): boolean => {
    return canStudentSlotsMergeUtil(
      studentName,
      day,
      s,
      nextSlot,
      store.entries,
      store.lsaAssignments,
      store.primarySupport || [],
      activeStaffNotes
    );
  };

  // Render individual table (matching the exact grid format of All Students & All Staff)
  const renderIndividualTable = () => {
    if (!indivName) {
      return (
        <div className="bg-white border border-[#DCDFE4] rounded-md p-10 text-center text-[#4A5268] text-sm">
          Please select a {indivType === 'student' ? 'student' : 'staff member'} above to view their timetable.
        </div>
      );
    }

    const daysToRender = indivDayView === 'all' ? DAYS : [indivDayView];
    const headerDay = indivDayView === 'all' ? 'Mon' : indivDayView;
    const headerSlots = slotsFor(headerDay, store.schedule);
    const friSlots = slotsFor('Fri', store.schedule);

    const indivStudentEntries =
      indivType === 'student'
        ? store.entries.filter((e) => e.student === indivName && e.lessonType !== 'withdrawal')
        : [];
    const indivSubjectColorMap = indivType === 'student' ? buildStudentSubjectColorMap(indivStudentEntries) : undefined;

    const density = isCompressedFit
      ? {
          cell: 'p-1 min-h-[48px] min-w-0 overflow-hidden',
          dayCell: 'p-1 text-xs min-w-0',
          subject: 'text-[10.5px] leading-tight truncate',
          meta: 'text-[9px] leading-tight truncate',
          badge: 'text-[8px] px-1 py-0.2',
          lsaBadge: 'text-[8.5px] px-1.5 py-0.2 mt-0.5 max-w-full truncate',
          staffSpacing: 'space-y-0.5',
          staffStudent: 'text-[10.5px] leading-tight truncate',
          staffMeta: 'text-[9px] leading-tight truncate',
          friEarly: 'p-1 text-[10px]',
        }
      : {
          compact: {
            cell: 'p-1.5 min-h-[50px]',
            dayCell: 'p-1.5 text-xs',
            subject: 'text-[11.5px]',
            meta: 'text-[10px]',
            badge: 'text-[8.5px] px-1 py-0.2',
            lsaBadge: 'text-[9px] px-1.5 py-0.5 mt-1',
            staffSpacing: 'space-y-0.5',
            staffStudent: 'text-[11px]',
            staffMeta: 'text-[9.5px]',
            friEarly: 'p-1.5 text-xs',
          },
          standard: {
            cell: 'p-2.5 min-h-[70px]',
            dayCell: 'p-2.5 text-xs',
            subject: 'text-[12.5px]',
            meta: 'text-[11px]',
            badge: 'text-[9.5px] px-1.5 py-0.5',
            lsaBadge: 'text-[10.5px] px-2.5 py-0.5 mt-1.5',
            staffSpacing: 'space-y-1',
            staffStudent: 'text-[12px]',
            staffMeta: 'text-[10.5px]',
            friEarly: 'p-2.5 text-xs',
          },
          expanded: {
            cell: 'p-3.5 min-h-[92px]',
            dayCell: 'p-3 text-sm',
            subject: 'text-[13px]',
            meta: 'text-[11.5px]',
            badge: 'text-[10px] px-2 py-0.5',
            lsaBadge: 'text-[11px] px-3 py-1 mt-2',
            staffSpacing: 'space-y-1.5',
            staffStudent: 'text-[12.5px]',
            staffMeta: 'text-[11px]',
            friEarly: 'p-3.5 text-xs',
          },
        }[indivRowExpansion];

    return (
      <div className="space-y-3">
        {indivConflicts.length > 0 && (
          <div className="bg-[#FBE6E4] text-[#B23A31] text-xs p-3 rounded border border-[#f5c6cb] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <strong>{indivConflicts.length} scheduling conflict{indivConflicts.length > 1 ? 's' : ''}</strong> affecting{' '}
              {indivName}:{' '}
              {indivConflicts
                .map((c) => `${c.lsa} on ${DAY_FULL[c.day]} (${c.slotLabel} with ${c.students.join(', ')})`)
                .join('; ')}
            </span>
          </div>
        )}

        <div
          ref={registerTableContainer}
          onScroll={(e) => handleTableScroll(e.currentTarget)}
          onPointerDown={swipeHandlers.onPointerDown}
          onPointerMove={swipeHandlers.onPointerMove}
          onPointerUp={swipeHandlers.onPointerUp}
          onPointerCancel={swipeHandlers.onPointerCancel}
          onClickCapture={swipeHandlers.onClickCapture}
          className={`border border-[#64748B] rounded-md bg-white shadow-xs select-none ${
            isCompressedFit
              ? 'w-full max-w-full overflow-hidden'
              : 'timetable-scroll-container cursor-grab active:cursor-grabbing'
          }`}
        >
          <table className={`w-full border-separate [border-spacing:0] text-left individual-timetable-grid ${
            isCompressedFit ? 'timetable-fit-screen table-fixed text-[11px]' : 'text-[12.5px]'
          }`}>
            <thead>
              <tr className="text-[#0F172A]">
                <th className={`font-bold sticky left-0 bg-[#D8E2EF] z-20 border-r border-b border-[#64748B] freeze-col-header text-center align-middle ${
                  isCompressedFit ? 'p-1 min-w-0 w-[8.5%] text-xs' : 'p-3 min-w-[130px]'
                }`}>
                  Day
                </th>
                {headerSlots.map((s) => {
                  const isShortSlot = s.type === 'fixed' || s.id.startsWith('brk') || s.id === 'reg';
                  const slotWidth = indivDayView === 'Fri'
                    ? (isShortSlot ? 'w-[7.5%]' : 'w-[14.8%]')
                    : (isShortSlot ? 'w-[5%]' : 'w-[7.65%]');
                  return (
                    <th
                      key={s.id}
                      className={`font-semibold border-r border-b border-[#64748B] bg-[#FFEDD5] text-[#0F172A] ${
                        isCompressedFit
                          ? `p-1 min-w-0 ${slotWidth} text-center`
                          : 'p-2.5 min-w-[130px] whitespace-nowrap'
                      }`}
                    >
                      <div className={`font-bold text-[#1C2333] ${isCompressedFit ? 'text-[10px] leading-tight truncate' : ''}`} title={s.label}>
                        {s.label}
                      </div>
                      <span className={`block font-mono font-medium text-[#78350F] ${isCompressedFit ? 'text-[8.5px] leading-none mt-0.5' : 'text-[10.5px] mt-0.5'}`}>
                        {s.start}–{s.end}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {daysToRender.map((day, dayIdx) => {
                const daySlots = slotsFor(day, store.schedule);
                let skipCols = 0;
                let usedCols = 0;
                const isLastRow = dayIdx === daysToRender.length - 1;
                const rowBorderB = isLastRow ? '' : 'border-b border-[#64748B]';
                const renderFridayHeader = indivDayView === 'all' && day === 'Fri';

                return (
                  <React.Fragment key={day}>
                    {renderFridayHeader && (
                      <tr className="text-[#0F172A] border-t-2 border-b border-[#64748B]">
                        <th className={`font-bold sticky left-0 bg-[#D8E2EF] z-20 border-r border-[#64748B] freeze-col-header text-center align-middle text-xs tracking-tight ${
                          isCompressedFit ? 'p-1 min-w-0 w-[8.5%] text-[10px] leading-tight' : 'p-2.5 min-w-[130px]'
                        }`}>
                          Friday Schedule
                        </th>
                        {friSlots.map((fs) => {
                          const isShortSlot = fs.type === 'fixed' || fs.id.startsWith('brk') || fs.id === 'reg';
                          const slotWidth = isShortSlot ? 'w-[5%]' : 'w-[7.65%]';
                          return (
                            <th
                              key={`fri-hdr-${fs.id}`}
                              className={`font-semibold border-r border-[#64748B] text-left bg-[#FFEDD5] text-[#0F172A] ${
                                isCompressedFit ? `p-1 min-w-0 ${slotWidth} text-center` : 'p-2 min-w-[130px] whitespace-nowrap'
                              }`}
                            >
                              <div className={`font-bold text-[#1C2333] ${isCompressedFit ? 'text-[10px] leading-tight truncate' : 'text-xs'}`} title={fs.label}>
                                {fs.label}
                              </div>
                              <span className={`block font-mono font-medium text-[#78350F] ${isCompressedFit ? 'text-[8.5px] leading-none mt-0.5' : 'text-[10px] mt-0.5'}`}>
                                {fs.start}–{fs.end}
                              </span>
                            </th>
                          );
                        })}
                        {headerSlots.length > friSlots.length && (
                          <th
                            colSpan={headerSlots.length - friSlots.length}
                            className={`p-1 font-semibold border-r border-[#64748B] text-center bg-[#FFEDD5] text-[#78350F] text-xs italic ${
                              isCompressedFit ? 'min-w-0 text-[10px] leading-tight' : ''
                            }`}
                          >
                            Early Finish (11:30)
                          </th>
                        )}
                      </tr>
                    )}
                    <tr>
                      <td className={`font-bold sticky left-0 bg-[#D8E2EF] z-10 text-[#0F172A] border-r border-[#64748B] ${rowBorderB} freeze-col-cell text-center align-middle ${density.dayCell} ${
                        isCompressedFit ? 'break-words min-w-0 px-1 py-1 text-xs' : 'whitespace-nowrap'
                      }`}>
                        {DAY_FULL[day]}
                      </td>

                      {daySlots.map((s, i) => {
                        if (skipCols > 0) {
                          skipCols--;
                          return null;
                        }

                        let colspan = 1;
                        let siblingId: string | null = null;
                        const nextSlot = daySlots[i + 1];

                        if (indivType === 'student') {
                          if (canStudentSlotsMerge(indivName, day, s, nextSlot)) {
                            colspan = 2;
                            skipCols = 1;
                            siblingId = nextSlot ? nextSlot.id : null;
                          }

                          usedCols += colspan;

                          const entry = store.entries.find((e) => e.student === indivName && e.day === day && e.slotId === s.id);
                          const active = getActiveSupport(
                            indivName,
                            day,
                            s.id,
                            store.entries,
                            store.lsaAssignments,
                            store.primarySupport || [],
                            activeStaffNotes
                          );
                          const isW = entry?.lessonType === 'withdrawal';
                          const isFixed = isFixedOrRegistrationSlot(s, entry);

                          const isCellConflict =
                            active &&
                            indivConflicts.some(
                              (c) =>
                                c.day === day &&
                                (c.slotIds.includes(s.id) || (siblingId && c.slotIds.includes(siblingId)))
                            );

                          const subjectFill =
                            entry && !isW && !isFixed
                              ? getStudentSubjectFill(entry.subject, indivSubjectColorMap)
                              : null;
                          const cellBg = isCellConflict
                            ? '#FBE6E4'
                            : isFixed
                            ? undefined
                            : isW
                            ? '#DCEEFB'
                            : subjectFill
                            ? subjectFill.hex
                            : '#FFFFFF';

                          return (
                            <td
                              key={s.id}
                              colSpan={colspan}
                              onClick={() => setSelectedStudentCell({ student: indivName, day, slotId: s.id })}
                              style={cellBg ? { backgroundColor: cellBg } : undefined}
                              className={`align-top border-r border-[#64748B] ${rowBorderB} cursor-pointer hover:ring-1 hover:ring-[#1C2333] hover:ring-inset relative transition-all ${density.cell} ${
                                !isCellConflict && isFixed && isW
                                  ? 'bg-fixed-withdrawal'
                                  : !isCellConflict && isFixed && !isW
                                  ? 'bg-fixed-slot'
                                  : ''
                              }`}
                            >
                              {isCellConflict && (
                                <span className="absolute top-2 right-2 text-[#B23A31] font-bold text-xs" title="Conflict">
                                  !
                                </span>
                              )}
                              {entry ? (
                                <div className="min-w-0 overflow-hidden">
                                  <div
                                    className={`font-bold leading-snug mb-0.5 ${density.subject} ${
                                      isW ? 'text-[#0284C7]' : 'text-[#0F172A]'
                                    }`}
                                    title={entry.subject}
                                  >
                                    {entry.subject}
                                    {isW && (
                                      <span className={`ml-1 font-bold uppercase rounded bg-[#BAE6FD] text-[#0369A1] ${density.badge}`}>
                                        Withdrawal
                                      </span>
                                    )}
                                  </div>
                                  {entry.teacher && <div className={`${density.meta} text-[#4A5268] truncate`} title={entry.teacher}>{entry.teacher}</div>}
                                  {entry.room && <div className={`${density.meta} font-mono text-[#4A5268] truncate`}>Rm {entry.room}</div>}
                                  {active && (
                                    <span
                                      className={`inline-flex items-center gap-1 font-semibold rounded-full shadow-xs tracking-tight print:hidden max-w-full overflow-hidden ${
                                        active.type === 'cover'
                                          ? 'bg-[#FEF08A] text-[#B91C1C] border border-[#FACC15]'
                                          : active.type === 'relieved'
                                          ? 'bg-[#FEE2E2] text-[#991B1B] line-through decoration-[#DC2626]'
                                          : active.type === 'secondary'
                                          ? 'bg-[#4C1D95] text-white ring-1 ring-purple-300'
                                          : 'bg-[#58228C] text-white'
                                      } ${density.lsaBadge}`}
                                      title={
                                        active.type === 'cover'
                                          ? `Covering for ${active.originalLsa || 'support staff'}`
                                          : active.type === 'relieved'
                                          ? 'Relieved to cover another lesson'
                                          : active.type === 'secondary'
                                          ? `Secondary Support: ${active.lsa}`
                                          : `Primary Support: ${active.lsa}`
                                      }
                                    >
                                      <Users className={`w-2.5 h-2.5 shrink-0 ${active.type === 'cover' ? 'text-[#B91C1C]' : active.type === 'relieved' ? 'text-[#DC2626]' : 'text-white/90'}`} />
                                      <span className="truncate">{active.lsa}</span>
                                      {active.type === 'cover' && <span className="text-[8.5px] font-bold uppercase shrink-0">(Cover)</span>}
                                      {active.type === 'relieved' && <span className="text-[8.5px] font-bold uppercase no-underline shrink-0">(Relieved)</span>}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-[#A9B0C3] italic">{s.defaultLabel || '+ add'}</span>
                              )}
                            </td>
                          );
                        } else {
                        // Individual Staff
                        if (canStaffSlotsMerge(indivName, day, s, nextSlot)) {
                          colspan = 2;
                          skipCols = 1;
                          siblingId = nextSlot ? nextSlot.id : null;
                        }

                        usedCols += colspan;

                        const assigns = assignmentsForLsaSlot(
                          indivName,
                          day,
                          s.id,
                          store.students,
                          store.entries,
                          store.lsaAssignments,
                          store.primarySupport || []
                        );
                        let isCellConflict = hasSlotConflict(assigns, store.entries);
                        if (!isCellConflict && siblingId) {
                          const nextAssigns = assignmentsForLsaSlot(
                            indivName,
                            day,
                            siblingId,
                            store.students,
                            store.entries,
                            store.lsaAssignments,
                            store.primarySupport || []
                          );
                          if (hasSlotConflict(nextAssigns, store.entries)) isCellConflict = true;
                        }

                        const rawSlotNotes = activeStaffNotes.filter(
                          (n) =>
                            (n.staffName.toLowerCase() === indivName.toLowerCase() ||
                              isStaffMentionedInNote(n, indivName)) &&
                            n.day === day &&
                            (n.slotId === s.id || (colspan === 2 && siblingId && n.slotId === siblingId))
                        );
                        const seenNoteKeys = new Set<string>();
                        const slotNotes = rawSlotNotes.filter((n) => {
                          const k = `${n.text}|${n.isCover}|${n.coveredBy || ''}|${Boolean(n.bold)}`;
                          if (seenNoteKeys.has(k)) return false;
                          seenNoteKeys.add(k);
                          return true;
                        });
                        const coveringNotes = activeStaffNotes.filter(
                          (n) => n.coveredBy?.toLowerCase() === indivName.toLowerCase() && n.day === day && (n.slotId === s.id || (siblingId && n.slotId === siblingId)) && n.isCover
                        );
                        const hasCoveringDuty = coveringNotes.length > 0;

                        const topNotes = slotNotes.filter((n) => n.position === 'top' || n.pinToTop);
                        const bottomNotes = slotNotes.filter((n) => n.position !== 'top' && !n.pinToTop);

                        const isFree = assigns.length === 0 && !hasCoveringDuty;
                        const isFixed = s.type === 'fixed';
                        const hasWithdrawal = assigns.some((a) => {
                          const e = store.entries.find((x) => x.student === a.student && x.day === day && x.slotId === s.id);
                          return e?.lessonType === 'withdrawal';
                        });

                        return (
                          <td
                            key={s.id}
                            colSpan={colspan}
                            onClick={() => setSelectedStaffCell({ staffName: indivName, day, slotId: s.id })}
                            className={`align-top border-r border-[#64748B] ${rowBorderB} cursor-pointer hover:ring-1 hover:ring-[#1C2333] hover:ring-inset relative transition-all min-w-0 overflow-hidden ${density.cell} ${
                              isCellConflict
                                ? 'bg-[#FBE6E4]'
                                : hasWithdrawal
                                ? isFixed
                                ? 'bg-fixed-withdrawal'
                                : 'bg-[#DCEEFB]'
                                : isFixed
                                ? 'bg-fixed-slot'
                                : 'bg-white'
                            }`}
                          >
                            {isCellConflict && (
                              <span className="absolute top-2 right-2 text-[#B23A31] font-bold text-xs" title="Double booked">
                                !
                              </span>
                            )}
                            {isFree && slotNotes.length === 0 && !hasCoveringDuty ? (
                              <span className="text-[11px] text-[#A9B0C3]">—</span>
                            ) : (
                              <div className={`${density.staffSpacing} min-w-0 overflow-hidden`}>
                                {/* Top Notes (placed at the top of the selected slot, above students name) */}
                                {topNotes.map((sn) => {
                                  const isMention = isStaffMentionedInNote(sn, indivName);
                                  if (isMention) {
                                    return (
                                      <div
                                        key={sn.id}
                                        onClick={(e) => handleNavigateToMention(sn, e)}
                                        title={`Mention from ${sn.staffName} — Click to view ${sn.staffName}'s slot`}
                                        className="mb-1 p-1.5 rounded bg-[#F3E8FF] border border-[#D8B4FE] text-[#581C87] text-[9.5px] leading-tight shadow-2xs cursor-pointer hover:bg-[#EDE9FE] hover:border-[#C084FC] hover:shadow-xs transition-all group"
                                      >
                                        <div className="font-bold text-[8.5px] uppercase tracking-wide text-[#6B21A8] flex items-center justify-between">
                                          <span className="flex items-center gap-1 group-hover:text-[#581C87]">
                                            <AtSign className="w-2.5 h-2.5 text-[#7E22CE]" /> Mention from {sn.staffName}
                                          </span>
                                          <div className="flex items-center gap-1">
                                            <span className="text-[8px] lowercase tracking-normal text-[#9333EA] opacity-0 group-hover:opacity-100 font-semibold transition-opacity">
                                              jump to slot →
                                            </span>
                                            {sn.keepIndefinitely && <Pin className="w-2.5 h-2.5 text-emerald-700 shrink-0" title="Kept indefinitely" />}
                                          </div>
                                        </div>
                                        {sn.text && (
                                          <div className={`mt-0.5 text-[#4C1D95] ${sn.bold ? 'font-bold' : ''}`}>
                                            <FormattedNoteText text={sn.text} />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }

                                  if (sn.isCover) {
                                    return (
                                      <div key={sn.id} className="mb-1 p-1 rounded bg-[#FEF08A] border border-[#FACC15] text-[#DC2626] font-light text-[9.5px] leading-tight">
                                        <div className="font-semibold text-[8.5px] uppercase tracking-wide text-[#B91C1C] flex items-center justify-between">
                                          <span>Cover: {sn.coveredBy || 'Pending'} {colspan === 2 ? '(80 min)' : '(40 min)'}</span>
                                          <div className="flex items-center gap-1">
                                            {sn.keepIndefinitely && <Pin className="w-2.5 h-2.5 text-emerald-700 shrink-0" title="Kept indefinitely" />}
                                          </div>
                                        </div>
                                        {sn.text && (
                                          <div className={`mt-0.5 text-[#DC2626] ${sn.bold ? 'font-bold' : ''}`}>
                                            <FormattedNoteText text={sn.text} />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={sn.id}
                                      className={`mb-1 p-1 rounded text-[9.5px] leading-snug text-[#DC2626] ${
                                        sn.bold ? 'font-bold' : 'font-light'
                                      } ${
                                        sn.highlight
                                          ? sn.highlightColor === 'green'
                                            ? 'bg-[#86EFAC] border border-[#22C55E]'
                                            : sn.highlightColor === 'blue'
                                            ? 'bg-[#7DD3FC] border border-[#0284C7]'
                                            : 'bg-[#FEF08A] border border-[#FACC15]'
                                          : ''
                                      }`}
                                    >
                                      <span className="flex items-center justify-between gap-1">
                                        <span><FormattedNoteText text={sn.text} /></span>
                                        {sn.keepIndefinitely && (
                                          <span className="flex items-center gap-1 shrink-0">
                                            <Pin className="w-2.5 h-2.5 text-emerald-700 shrink-0" title="Kept indefinitely" />
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  );
                                })}

                                {consolidateStaffSlotAssignments(assigns, day, s.id, store.entries).map((item) => {
                                  const isStruckThrough = hasCoveringDuty;
                                  const isW = item.lessonType === 'withdrawal';

                                  if (item.isClass) {
                                    return (
                                      <div
                                        key={item.id}
                                        className={`pb-1 border-b border-[#E2E8F0] last:border-0 last:pb-0 min-w-0 overflow-hidden ${
                                          isStruckThrough ? 'opacity-85' : ''
                                        }`}
                                      >
                                        <div
                                          className={`font-semibold flex items-center justify-between flex-wrap gap-1 ${
                                            isStruckThrough
                                              ? 'line-through decoration-[#DC2626] decoration-2 text-[#64748B]'
                                              : 'text-[#1C2333]'
                                          } ${density.staffStudent}`}
                                        >
                                          <span className="truncate">{item.subject}</span>
                                          <div className="flex items-center gap-1 shrink-0">
                                            {isStruckThrough && (
                                              <span className="text-[8.5px] font-bold text-[#DC2626] bg-[#FEE2E2] px-1 py-0.2 rounded no-underline tracking-normal inline-block border border-[#FECACA]">
                                                Relieved
                                              </span>
                                            )}
                                            <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                                              Class ({item.students.length})
                                            </span>
                                            {item.type === 'teacher' && (
                                              <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                                                Teacher
                                              </span>
                                            )}
                                            <span
                                              className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                                                isW
                                                  ? 'bg-[#DCEEFB] text-[#2A6FA8] border border-[#b8dbf7]'
                                                  : 'bg-[#E4F0EA] text-[#2F6F4E] border border-[#c3dfd1]'
                                              }`}
                                            >
                                              {isW ? 'Withdrawal' : 'In-Class'}
                                            </span>
                                          </div>
                                        </div>
                                        {item.teacher && (
                                          <div
                                            className={`${density.staffMeta} font-medium text-[#1E293B] truncate ${
                                              isStruckThrough
                                                ? 'line-through decoration-[#DC2626] decoration-2 text-[#94A3B8]'
                                                : ''
                                            }`}
                                            title={item.teacher}
                                          >
                                            Teacher: {item.teacher}
                                          </div>
                                        )}
                                        {item.room && (
                                          <div
                                            className={`${density.staffMeta} font-mono truncate ${
                                              isStruckThrough
                                                ? 'line-through decoration-[#DC2626] decoration-2 text-[#94A3B8]'
                                                : 'text-[#4A5268]'
                                            }`}
                                          >
                                            Rm {item.room}
                                          </div>
                                        )}
                                        <div
                                          className={`mt-0.5 leading-tight ${
                                            isCompressedFit ? 'text-[9px] line-clamp-2 break-words' : 'text-[10.5px] font-medium'
                                          } ${
                                            isStruckThrough
                                              ? 'line-through decoration-[#DC2626] text-[#94A3B8]'
                                              : 'text-[#334155]'
                                          }`}
                                        >
                                          <span className="font-semibold text-[#1C2333]">Students:</span>{' '}
                                          {item.students.join(', ')}
                                        </div>
                                      </div>
                                    );
                                  }

                                  const singleStu = item.students[0];
                                  return (
                                    <div
                                      key={item.id}
                                      className={`pb-1 border-b border-[#E2E8F0] last:border-0 last:pb-0 min-w-0 overflow-hidden ${
                                        isStruckThrough ? 'opacity-85' : ''
                                      }`}
                                    >
                                      <div
                                        className={`font-semibold flex items-center justify-between flex-wrap gap-1 ${
                                          isStruckThrough
                                            ? 'line-through decoration-[#DC2626] decoration-2 text-[#64748B]'
                                            : 'text-[#1C2333]'
                                        } ${density.staffStudent}`}
                                      >
                                        <span className="truncate">{singleStu}</span>
                                        {isStruckThrough && (
                                          <span className="text-[8.5px] font-bold text-[#DC2626] bg-[#FEE2E2] px-1 py-0.2 rounded no-underline tracking-normal inline-block border border-[#FECACA] shrink-0">
                                            Relieved
                                          </span>
                                        )}
                                      </div>
                                      <div
                                        className={`${density.staffMeta} truncate ${
                                          isStruckThrough
                                            ? 'line-through decoration-[#DC2626] decoration-2 text-[#94A3B8]'
                                            : 'text-[#4A5268]'
                                        }`}
                                      >
                                        {item.subject} {isW && '· Withdrawal'} {item.type === 'teacher' && '· Teacher'}
                                      </div>
                                      {item.teacher && (
                                        <div
                                          className={`${density.staffMeta} font-medium text-[#1E293B] truncate ${
                                            isStruckThrough
                                              ? 'line-through decoration-[#DC2626] decoration-2 text-[#94A3B8]'
                                              : ''
                                          }`}
                                          title={item.teacher}
                                        >
                                          Teacher: {item.teacher}
                                        </div>
                                      )}
                                      {item.room && (
                                        <div
                                          className={`${density.staffMeta} font-mono truncate ${
                                            isStruckThrough
                                              ? 'line-through decoration-[#DC2626] decoration-2 text-[#94A3B8]'
                                              : 'text-[#4A5268]'
                                          }`}
                                        >
                                          Rm {item.room}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* Automatically Added Lesson Cover to Slots of Covering Staff */}
                                {(() => {
                                  const displayedCoverNotes =
                                    colspan === 2 && coveringNotes.length > 1
                                      ? coveringNotes.every(
                                          (cn) =>
                                            cn.staffName === coveringNotes[0].staffName &&
                                            cn.student === coveringNotes[0].student &&
                                            cn.subject === coveringNotes[0].subject
                                        )
                                        ? [{ ...coveringNotes[0], is80Min: true }]
                                        : coveringNotes
                                      : coveringNotes;

                                  return displayedCoverNotes.map((cn) => {
                                    const coveredStudent = cn.student || (store.entries.find(
                                      (e) => e.day === day && (e.slotId === s.id || (siblingId && e.slotId === siblingId)) && (
                                        (store.primarySupport || []).some(p => p.lsa.toLowerCase() === cn.staffName.toLowerCase() && p.student === e.student) ||
                                        store.lsaAssignments.some(asg => asg.lsa.toLowerCase() === cn.staffName.toLowerCase() && asg.student === e.student && asg.day === day && (asg.slotId === s.id || (siblingId && asg.slotId === siblingId)))
                                      )
                                    )?.student);
                                    const coveredEntry = store.entries.find(
                                      (e) => (coveredStudent ? e.student === coveredStudent : true) && e.day === day && (e.slotId === s.id || (siblingId && e.slotId === siblingId))
                                    );
                                    const subjectDisplay = cn.subject || coveredEntry?.subject || 'Cover Support';
                                    const teacherDisplay = cn.teacher || coveredEntry?.teacher;
                                    const roomDisplay = cn.room || coveredEntry?.room;
                                    const isWithdrawal = coveredEntry?.lessonType === 'withdrawal';
                                    const is80mBlock = colspan === 2 || (cn as unknown as { is80Min?: boolean }).is80Min;

                                    return (
                                      <div
                                        key={cn.id}
                                        className="mt-1 p-2 rounded-md bg-[#FEF9C3] border-2 border-[#EAB308] text-[#1C2333] shadow-xs"
                                      >
                                        <div className="flex items-center justify-between gap-1 mb-1">
                                          <span className="font-bold text-[9.5px] uppercase tracking-wider text-[#991C1C] bg-[#FEE2E2] px-1.5 py-0.5 rounded border border-[#FECACA]">
                                            Covering {cn.staffName}
                                          </span>
                                          <span className="text-[9px] font-bold text-[#B91C1C] uppercase">
                                            {is80mBlock ? '(80 min Cover)' : '(40 min Cover)'}
                                          </span>
                                        </div>
                                        {coveredStudent && (
                                          <div className={`font-bold text-[#0F172A] ${density.staffStudent}`}>
                                            {coveredStudent}
                                          </div>
                                        )}
                                        <div className={`${density.staffMeta} font-semibold text-[#854D0E]`}>
                                          {subjectDisplay} {isWithdrawal && <span className="font-normal text-[#991B1B]">· Withdrawal</span>}
                                        </div>
                                        {teacherDisplay && (
                                          <div className={`${density.staffMeta} text-[#713F12]`}>
                                            Teacher: {teacherDisplay}
                                          </div>
                                        )}
                                        {roomDisplay && (
                                          <div className={`${density.staffMeta} font-mono text-[#78350F]`}>
                                            Rm {roomDisplay}
                                          </div>
                                        )}
                                        {cn.text && (
                                          <div className="mt-1 text-[9px] text-[#DC2626] italic bg-white/80 px-1.5 py-0.5 rounded border border-[#FDE047]">
                                            "<FormattedNoteText text={cn.text} />"
                                          </div>
                                        )}
                                      </div>
                                    );
                                  });
                                })()}

                                {/* Bottom Notes / Cover notices / @ Mentions */}
                                {bottomNotes.map((sn) => {
                                  const isMention = isStaffMentionedInNote(sn, indivName);
                                  if (isMention) {
                                    return (
                                      <div
                                        key={sn.id}
                                        onClick={(e) => handleNavigateToMention(sn, e)}
                                        title={`Mention from ${sn.staffName} — Click to view ${sn.staffName}'s slot`}
                                        className="mt-1 p-1.5 rounded bg-[#F3E8FF] border border-[#D8B4FE] text-[#581C87] text-[9.5px] leading-tight shadow-2xs cursor-pointer hover:bg-[#EDE9FE] hover:border-[#C084FC] hover:shadow-xs transition-all group"
                                      >
                                        <div className="font-bold text-[8.5px] uppercase tracking-wide text-[#6B21A8] flex items-center justify-between">
                                          <span className="flex items-center gap-1 group-hover:text-[#581C87]">
                                            <AtSign className="w-2.5 h-2.5 text-[#7E22CE]" /> Mention from {sn.staffName}
                                          </span>
                                          <div className="flex items-center gap-1">
                                            <span className="text-[8px] lowercase tracking-normal text-[#9333EA] opacity-0 group-hover:opacity-100 font-semibold transition-opacity">
                                              jump to slot →
                                            </span>
                                            {sn.keepIndefinitely && <Pin className="w-2.5 h-2.5 text-emerald-700 shrink-0" title="Kept indefinitely" />}
                                          </div>
                                        </div>
                                        {sn.text && (
                                          <div className={`mt-0.5 text-[#4C1D95] ${sn.bold ? 'font-bold' : ''}`}>
                                            <FormattedNoteText text={sn.text} />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }

                                  if (sn.isCover) {
                                    return (
                                      <div key={sn.id} className="mt-1 p-1 rounded bg-[#FEF08A] border border-[#FACC15] text-[#DC2626] font-light text-[9.5px] leading-tight">
                                        <div className="font-semibold text-[8.5px] uppercase tracking-wide text-[#B91C1C] flex items-center justify-between">
                                          <span>Cover: {sn.coveredBy || 'Pending'} {colspan === 2 ? '(80 min)' : '(40 min)'}</span>
                                          {sn.keepIndefinitely && <Pin className="w-2.5 h-2.5 text-emerald-700 shrink-0" title="Kept indefinitely" />}
                                        </div>
                                        {sn.text && (
                                          <div className={`mt-0.5 text-[#DC2626] ${sn.bold ? 'font-bold' : ''}`}>
                                            <FormattedNoteText text={sn.text} />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={sn.id}
                                      className={`mt-1 p-1 rounded text-[9.5px] leading-snug text-[#DC2626] ${
                                        sn.bold ? 'font-bold' : 'font-light'
                                      } ${
                                        sn.highlight
                                          ? sn.highlightColor === 'green'
                                            ? 'bg-[#86EFAC] border border-[#22C55E]'
                                            : sn.highlightColor === 'blue'
                                            ? 'bg-[#7DD3FC] border border-[#0284C7]'
                                            : 'bg-[#FEF08A] border border-[#FACC15]'
                                          : ''
                                      }`}
                                    >
                                      <span className="flex items-center justify-between gap-1">
                                        <span><FormattedNoteText text={sn.text} /></span>
                                        {sn.keepIndefinitely && <Pin className="w-2.5 h-2.5 text-emerald-700 shrink-0" title="Kept indefinitely" />}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      }
                    })}

                    {indivDayView === 'all' && day === 'Fri' && headerSlots.length > usedCols && (
                      <td
                        colSpan={headerSlots.length - usedCols}
                        className={`bg-[#F1F5F9] text-[#475569] text-center italic border-r border-[#64748B] ${rowBorderB} ${density.friEarly}`}
                      >
                        Early finish (11:30)
                      </td>
                    )}
                  </tr>
                </React.Fragment>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render day grid for All Students or All Staff
  const renderDayGrid = () => {
    const daysToRender: DayOfWeek[] = allScheduleDayMode === 'all' ? DAYS : [currentDay];
    const rowNames = timetableView === 'students' ? store.students : orderedStaffNames;

    return (
      <div className="space-y-6">
        {daysToRender.map((gridDay, dayIndex) => {
          const slots = slotsFor(gridDay, store.schedule);
          const isFriday = gridDay === 'Fri';
          const gridDayAssignments = activeSupportForDay(
            gridDay,
            store.students,
            store.entries,
            store.lsaAssignments,
            store.primarySupport || [],
            store.schedule,
            store.lsaPool
          );
          const gridDayConflicts = getDayConflicts(gridDay, gridDayAssignments, store.schedule, store.entries);
          const gridConflictMap = computeConflicts(gridDay, gridDayAssignments, store.schedule, store.entries);

          return (
            <div key={gridDay} className="space-y-3">
              {allScheduleDayMode === 'all' && (
                <div className="flex items-center justify-between bg-[#EAEFF5] px-3.5 py-2 rounded border border-[#CBD5E1]">
                  <span className="font-bold text-xs uppercase tracking-wider text-[#1C2333]">
                    {DAY_FULL[gridDay]} — {timetableView === 'students' ? 'All Students Schedule' : 'All Staff Deployment'}
                  </span>
                  <span className="text-[11px] text-[#475569] font-medium">
                    {isFriday ? 'Registration to Lesson 3b (Early Finish 11:30)' : 'Registration to Lesson 5b (7:40–3:10)'}
                  </span>
                </div>
              )}

              {gridDayConflicts.length > 0 && (
                <div className="bg-[#FBE6E4] text-[#B23A31] text-xs p-3 rounded border border-[#f5c6cb] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>{gridDayConflicts.length} scheduling conflict{gridDayConflicts.length > 1 ? 's' : ''}</strong> on {DAY_FULL[gridDay]}:{' '}
                    {gridDayConflicts
                      .map((c) => `${c.lsa} (${c.slotLabel} with ${c.students.join(', ')})`)
                      .join('; ')}
                  </span>
                </div>
              )}

              <div
                ref={registerTableContainer}
                onScroll={(e) => handleTableScroll(e.currentTarget)}
                onPointerDown={swipeHandlers.onPointerDown}
                onPointerMove={swipeHandlers.onPointerMove}
                onPointerUp={swipeHandlers.onPointerUp}
                onPointerCancel={swipeHandlers.onPointerCancel}
                onClickCapture={swipeHandlers.onClickCapture}
                className={`border border-[#64748B] rounded-md bg-white shadow-xs print:overflow-visible print:border-none print:w-full print:max-w-none select-none ${
                  isCompressedFit
                    ? 'w-full max-w-full overflow-hidden'
                    : 'timetable-scroll-container cursor-grab active:cursor-grabbing'
                }`}
              >
                <table className={`w-full border-separate [border-spacing:0] text-left all-schedule-timetable-grid ${
                  isCompressedFit ? 'timetable-fit-screen table-fixed text-[11px]' : 'text-[12.5px]'
                }`}>
                  <thead>
                    <tr className="bg-[#EAEFF5] text-[#0F172A]">
                      <th className={`font-semibold sticky left-0 bg-[#EAEFF5] z-20 border-r border-b border-[#64748B] freeze-col-header text-center align-middle ${
                        isCompressedFit
                          ? `p-1 min-w-0 ${isFriday ? 'w-[12%]' : 'w-[10.5%]'} text-xs`
                          : 'p-3 min-w-[170px]'
                      }`}>
                        {timetableView === 'students' ? 'Student' : 'Staff Member'}
                      </th>
                      {slots.map((s) => {
                        const isShortSlot = s.type === 'fixed' || s.id.startsWith('brk') || s.id === 'reg';
                        const slotWidth = isFriday
                          ? (isShortSlot ? 'w-[7%]' : 'w-[12.8%]')
                          : (isShortSlot ? 'w-[5.2%]' : 'w-[7.39%]');
                        return (
                          <th
                            key={s.id}
                            className={`font-semibold border-r border-b border-[#64748B] ${
                              isCompressedFit
                                ? `p-1 min-w-0 ${slotWidth} text-center`
                                : 'p-2.5 min-w-[130px] whitespace-nowrap'
                            }`}
                          >
                            <div className={`font-bold text-[#0F172A] ${isCompressedFit ? 'text-[10px] leading-tight truncate' : ''}`} title={s.label}>
                              {s.label}
                            </div>
                            <span className={`block font-mono font-normal text-[#334155] ${isCompressedFit ? 'text-[8.5px] leading-none mt-0.5' : 'text-[10.5px] mt-0.5'}`}>
                              {s.start}–{s.end}
                            </span>
                          </th>
                        );
                      })}
                      {isFriday && (
                        <th className={`font-semibold border-r border-b border-[#64748B] bg-[#F1F5F9] text-[#64748B] italic text-center ${
                          isCompressedFit ? 'p-1 min-w-0 w-[10%] text-xs' : 'p-2.5 min-w-[140px] whitespace-nowrap'
                        }`}>
                          <div className={isCompressedFit ? 'text-[10px] leading-tight' : ''}>Early Finish</div>
                          <span className={`block font-mono font-normal text-[#64748B] ${isCompressedFit ? 'text-[8.5px] leading-none mt-0.5' : 'text-[10.5px] mt-0.5'}`}>
                            11:30 onwards
                          </span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rowNames.length === 0 ? (
                      <tr>
                        <td colSpan={slots.length + (isFriday ? 2 : 1)} className="p-8 text-center text-[#4A5268] text-sm italic">
                          {timetableView === 'students'
                            ? 'No students found. Import timetable data or add a student from the Students tab.'
                            : 'No staff in the pool. Add staff from the Staff tab.'}
                        </td>
                      </tr>
                    ) : (
                      rowNames.map((name, nameIdx) => {
                        let skipCols = 0;
                        const isLastRow = nameIdx === rowNames.length - 1;
                        const isAltRow = nameIdx % 2 === 1;
                        const rowBg = isAltRow ? 'bg-[#F4F6F9]' : 'bg-white';
                        const rowBorderB = isLastRow ? '' : 'border-b border-[#64748B]';
                        const staffDesig =
                          timetableView === 'staff'
                            ? staffDesignationMap.get(name.trim().toLowerCase()) || 'LSA'
                            : null;
                        const prevStaffDesig =
                          timetableView === 'staff' && nameIdx > 0
                            ? staffDesignationMap.get(rowNames[nameIdx - 1].trim().toLowerCase()) || 'LSA'
                            : null;
                        const isFirstSendGroupRow =
                          timetableView === 'staff' && staffDesig === 'SEND' && prevStaffDesig === 'LSA';
                        const groupTopBorder = isFirstSendGroupRow ? 'border-t-2 border-t-[#334155]' : '';

                        return (
                          <tr key={name}>
                            <td className={`font-semibold sticky left-0 ${rowBg} z-10 ${
                              staffDesig === 'SEND' ? 'text-[#1D4ED8]' : 'text-[#0F172A]'
                            } border-r border-[#64748B] ${rowBorderB} ${groupTopBorder} freeze-col-cell text-center align-middle ${
                              isCompressedFit ? 'p-1 text-xs min-w-0 max-w-[110px] break-words' : 'p-3 whitespace-nowrap'
                            }`}>
                              <span className={`${isCompressedFit ? 'text-[11px] leading-tight line-clamp-2 block break-words' : 'text-[13px] block'}`} title={name}>
                                {name}
                              </span>
                            </td>

                            {slots.map((s, i) => {
                              if (skipCols > 0) {
                                skipCols--;
                                return null;
                              }

                              if (timetableView === 'students') {
                                // Student Cell
                                let colspan = 1;
                                let siblingId: string | null = null;
                                const nextSlot = slots[i + 1];

                                if (canStudentSlotsMerge(name, gridDay, s, nextSlot)) {
                                  colspan = 2;
                                  skipCols = 1;
                                  siblingId = nextSlot ? nextSlot.id : null;
                                }

                                const entry = store.entries.find((e) => e.student === name && e.day === gridDay && e.slotId === s.id);
                                const active = getActiveSupport(
                                  name,
                                  gridDay,
                                  s.id,
                                  store.entries,
                                  store.lsaAssignments,
                                  store.primarySupport || [],
                                  activeStaffNotes
                                );

                                let isCellConflict =
                                  active &&
                                  ((gridConflictMap[`${active.lsa}|${s.id}`] || 0) > 1 ||
                                    (gridConflictMap[`${active.lsa.trim().toLowerCase()}|${s.id}`] || 0) > 1);
                                if (!isCellConflict && active && siblingId) {
                                  isCellConflict =
                                    (gridConflictMap[`${active.lsa}|${siblingId}`] || 0) > 1 ||
                                    (gridConflictMap[`${active.lsa.trim().toLowerCase()}|${siblingId}`] || 0) > 1;
                                }

                                const isW = entry?.lessonType === 'withdrawal';
                                const isFixed = isFixedOrRegistrationSlot(s, entry);

                                return (
                                  <td
                                    key={s.id}
                                    colSpan={colspan}
                                    onClick={() => setSelectedStudentCell({ student: name, day: gridDay, slotId: s.id })}
                                    className={`align-top border-r border-[#64748B] ${rowBorderB} cursor-pointer hover:ring-1 hover:ring-[#1C2333] hover:ring-inset relative transition-all min-w-0 overflow-hidden ${
                                      isCompressedFit ? 'p-1 min-h-[48px]' : 'p-3 min-h-[84px]'
                                    } ${
                                      isCellConflict
                                        ? 'bg-[#FBE6E4]'
                                        : isW
                                        ? isFixed
                                          ? 'bg-fixed-withdrawal'
                                          : 'bg-[#DCEEFB]'
                                        : isFixed
                                        ? isAltRow
                                          ? 'bg-fixed-slot-alt'
                                          : 'bg-fixed-slot'
                                        : rowBg
                                    }`}
                                  >
                                    {isCellConflict && (
                                      <span className="absolute top-1.5 right-1.5 text-[#B23A31] font-bold text-xs" title="Staff double-booked">
                                        !
                                      </span>
                                    )}

                                    {entry ? (
                                      <div className="min-w-0 overflow-hidden">
                                        <div
                                          className={`font-semibold ${
                                            isCompressedFit ? 'text-[10.5px] leading-tight truncate' : 'text-[12.5px] leading-snug mb-0.5'
                                          }`}
                                          style={{ color: subjectColor(entry.subject) }}
                                          title={entry.subject}
                                        >
                                          {entry.subject}
                                        </div>
                                        {entry.teacher && (
                                          <div className={`${isCompressedFit ? 'text-[9px] leading-tight truncate' : 'text-[11px]'} text-[#4A5268]`} title={entry.teacher}>
                                            {entry.teacher}
                                          </div>
                                        )}
                                        {entry.room && (
                                          <div className={`${isCompressedFit ? 'text-[8.5px] leading-tight truncate' : 'text-[10.5px]'} font-mono text-[#4A5268]`}>
                                            Rm {entry.room}
                                          </div>
                                        )}
                                        {active && (
                                          <span
                                            className={`inline-flex items-center gap-1 font-semibold rounded-full shadow-xs tracking-tight max-w-full overflow-hidden ${
                                              isCompressedFit ? 'mt-0.5 text-[8.5px] px-1 py-0.2' : 'mt-1 text-[10px] px-2 py-0.5'
                                            } ${
                                              active.type === 'cover'
                                                ? 'bg-[#FEF08A] text-[#B91C1C] border border-[#FACC15]'
                                                : active.type === 'relieved'
                                                ? 'bg-[#FEE2E2] text-[#991B1B] line-through decoration-[#DC2626]'
                                                : active.type === 'secondary'
                                                ? 'bg-[#4C1D95] text-white ring-1 ring-purple-300'
                                                : 'bg-[#58228C] text-white'
                                            }`}
                                            title={
                                              active.type === 'cover'
                                                ? `Covering for ${active.originalLsa || 'support staff'}`
                                                : active.type === 'relieved'
                                                ? 'Relieved to cover another lesson'
                                                : active.type === 'secondary'
                                                ? `Secondary Support: ${active.lsa}`
                                                : `Primary Support: ${active.lsa}`
                                            }
                                          >
                                            <Users className={`w-2.5 h-2.5 shrink-0 ${active.type === 'cover' ? 'text-[#B91C1C]' : active.type === 'relieved' ? 'text-[#DC2626]' : 'text-white/90'}`} />
                                            <span className="truncate">{active.lsa}</span>
                                            {active.type === 'cover' && <span className="text-[8px] font-bold uppercase shrink-0">(Cover)</span>}
                                            {active.type === 'relieved' && <span className="text-[8px] font-bold uppercase no-underline shrink-0">(Relieved)</span>}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-[#A9B0C3] italic">{s.defaultLabel || '+ add'}</span>
                                    )}
                                  </td>
                                );
                              } else {
                                // Staff Cell
                                let colspan = 1;
                                let siblingId: string | null = null;
                                const nextSlot = slots[i + 1];

                                if (canStaffSlotsMerge(name, gridDay, s, nextSlot)) {
                                  colspan = 2;
                                  skipCols = 1;
                                  siblingId = nextSlot ? nextSlot.id : null;
                                }

                                const allAssigns = assignmentsForLsaSlot(
                                  name,
                                  gridDay,
                                  s.id,
                                  store.students,
                                  store.entries,
                                  store.lsaAssignments,
                                  store.primarySupport || []
                                );
                                let isConflict = hasSlotConflict(allAssigns, store.entries);
                                if (!isConflict && siblingId) {
                                  const nextAssigns = assignmentsForLsaSlot(
                                    name,
                                    gridDay,
                                    siblingId,
                                    store.students,
                                    store.entries,
                                    store.lsaAssignments,
                                    store.primarySupport || []
                                  );
                                  if (hasSlotConflict(nextAssigns, store.entries)) isConflict = true;
                                }

                                const rawSlotNotes = activeStaffNotes.filter(
                                  (n) =>
                                    (n.staffName.toLowerCase() === name.toLowerCase() ||
                                      isStaffMentionedInNote(n, name)) &&
                                    n.day === gridDay &&
                                    (n.slotId === s.id || (colspan === 2 && siblingId && n.slotId === siblingId))
                                );
                                const seenNoteKeys = new Set<string>();
                                const slotNotes = rawSlotNotes.filter((n) => {
                                  const k = `${n.text}|${n.isCover}|${n.coveredBy || ''}|${Boolean(n.bold)}`;
                                  if (seenNoteKeys.has(k)) return false;
                                  seenNoteKeys.add(k);
                                  return true;
                                });
                                const coveringNotes = activeStaffNotes.filter(
                                  (n) => n.coveredBy?.toLowerCase() === name.toLowerCase() && n.day === gridDay && (n.slotId === s.id || (siblingId && n.slotId === siblingId)) && n.isCover
                                );
                                const hasCoveringDuty = coveringNotes.length > 0;

                                const topNotes = slotNotes.filter((n) => n.position === 'top' || n.pinToTop);
                                const bottomNotes = slotNotes.filter((n) => n.position !== 'top' && !n.pinToTop);

                                const isFree = allAssigns.length === 0 && !hasCoveringDuty;
                                const isFixed = s.type === 'fixed';

                                const isWithdrawalLesson = (a: { student: string }) => {
                                  const e = store.entries.find((x) => x.student === a.student && x.day === gridDay && x.slotId === s.id);
                                  return e?.lessonType === 'withdrawal';
                                };

                                let displayed = allAssigns;
                                if (staffFilter === 'lesson') displayed = allAssigns.filter((a) => !isWithdrawalLesson(a));
                                if (staffFilter === 'withdrawal') displayed = allAssigns.filter((a) => isWithdrawalLesson(a));
                                if (staffFilter === 'conflict') displayed = isConflict ? allAssigns : [];

                                if (staffFilter === 'free') {
                                  return (
                                    <td
                                      key={s.id}
                                      colSpan={colspan}
                                      onClick={() => setSelectedStaffCell({ staffName: name, day: gridDay, slotId: s.id })}
                                      className={`align-top border-r border-[#64748B] ${rowBorderB} ${groupTopBorder} cursor-pointer hover:ring-1 hover:ring-[#1C2333] hover:ring-inset relative transition-all min-w-0 overflow-hidden ${isCompressedFit ? 'p-1 min-h-[48px]' : 'p-3 min-h-[84px]'} ${
                                        isFree ? 'bg-[#E4F0EA]' : `opacity-35 ${rowBg}`
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span
                                          className={`text-xs font-semibold ${
                                            isFree ? 'text-[#2F6F4E]' : 'text-[#4A5268]'
                                          }`}
                                        >
                                          {isFree ? 'Free' : 'Busy'}
                                        </span>
                                        {isFree && role === 'admin' && (
                                          <span className="text-[10px] text-[#2F6F4E] font-bold hover:underline flex items-center gap-0.5">
                                            <Plus className="w-3 h-3" /> Add
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  );
                                }

                                const hasW = displayed.some((a) => isWithdrawalLesson(a));
                                const isDim = staffFilter !== 'all' && displayed.length === 0 && slotNotes.length === 0 && !hasCoveringDuty;

                                return (
                                  <td
                                    key={s.id}
                                    colSpan={colspan}
                                    onClick={() => setSelectedStaffCell({ staffName: name, day: gridDay, slotId: s.id })}
                                    className={`align-top border-r border-[#64748B] ${rowBorderB} ${groupTopBorder} cursor-pointer hover:ring-1 hover:ring-[#1C2333] hover:ring-inset relative transition-all min-w-0 overflow-hidden ${isCompressedFit ? 'p-1 min-h-[48px]' : 'p-3 min-h-[84px]'} group ${
                                      isDim
                                        ? `opacity-35 ${rowBg}`
                                        : isConflict
                                        ? 'bg-[#FBE6E4]'
                                        : hasW
                                        ? isFixed
                                          ? 'bg-fixed-withdrawal'
                                          : 'bg-[#DCEEFB]'
                                        : isFixed
                                        ? isAltRow
                                          ? 'bg-fixed-slot-alt'
                                          : 'bg-fixed-slot'
                                        : rowBg
                                    }`}
                                  >
                                    {isConflict && (
                                      <span className="absolute top-2 right-2 text-[#B23A31] font-bold text-xs" title="Double booked">
                                        !
                                      </span>
                                    )}

                                    {displayed.length === 0 && slotNotes.length === 0 && !hasCoveringDuty ? (
                                      role === 'admin' ? (
                                        <div className="flex flex-col items-center justify-center py-2 text-[#94A3B8] group-hover:text-[#2F6F4E] transition-colors">
                                          <span className="text-[11px] font-medium flex items-center gap-1">
                                            <Plus className="w-3.5 h-3.5 text-[#2F6F4E]" />
                                            <span>+ Add lesson</span>
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-[11px] text-[#A9B0C3]">—</span>
                                      )
                                    ) : (
                                      <div className="space-y-1 min-w-0 overflow-hidden">
                                        {/* Top Notes (rendered above the student's name on schedule) */}
                                        {topNotes.map((sn) => {
                                          const isMention = isStaffMentionedInNote(sn, name);
                                          if (isMention) {
                                            return (
                                              <div
                                                key={sn.id}
                                                onClick={(e) => handleNavigateToMention(sn, e)}
                                                title={`Mention from ${sn.staffName} — Click to view ${sn.staffName}'s slot`}
                                                className={`mb-1 rounded bg-[#F3E8FF] border border-[#D8B4FE] text-[#581C87] shadow-2xs cursor-pointer hover:bg-[#EDE9FE] hover:border-[#C084FC] hover:shadow-xs transition-all group min-w-0 overflow-hidden ${
                                                  isCompressedFit ? 'p-1 text-[8.5px] leading-tight' : 'p-1.5 text-[9.5px] leading-tight'
                                                }`}
                                              >
                                                <div className="font-bold text-[8.5px] uppercase tracking-wide text-[#6B21A8] flex items-center justify-between">
                                                  <span className="flex items-center gap-1 group-hover:text-[#581C87]">
                                                    <AtSign className="w-2.5 h-2.5 text-[#7E22CE]" /> Mention from {sn.staffName}
                                                  </span>
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-[8px] lowercase tracking-normal text-[#9333EA] opacity-0 group-hover:opacity-100 font-semibold transition-opacity">
                                                      jump to slot →
                                                    </span>
                                                    {sn.keepIndefinitely && <Pin className="w-2.5 h-2.5 text-emerald-700 shrink-0" title="Kept indefinitely" />}
                                                  </div>
                                                </div>
                                                {sn.text && (
                                                  <div className={`mt-0.5 text-[#4C1D95] ${sn.bold ? 'font-bold' : ''}`}>
                                                    <FormattedNoteText text={sn.text} />
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          }

                                          if (sn.isCover) {
                                            return (
                                              <div
                                                key={sn.id}
                                                className={`mb-1 rounded bg-[#FEF08A] border border-[#FACC15] text-[#DC2626] font-light min-w-0 overflow-hidden ${
                                                  isCompressedFit ? 'p-1 text-[8.5px] leading-tight' : 'p-1 text-[9.5px] leading-tight'
                                                }`}
                                              >
                                                <div className="font-semibold text-[8.5px] uppercase tracking-wide text-[#B91C1C] flex items-center justify-between">
                                                  <span className="truncate">Cover: {sn.coveredBy || 'Pending'} {colspan === 2 ? '(80 min)' : '(40 min)'}</span>
                                                  <div className="flex items-center gap-1">
                                                    {sn.keepIndefinitely && <Pin className="w-2.5 h-2.5 text-emerald-700 shrink-0" title="Kept indefinitely" />}
                                                  </div>
                                                </div>
                                                {sn.text && (
                                                  <div className={`mt-0.5 text-[#DC2626] break-words ${isCompressedFit ? 'line-clamp-2' : ''} ${sn.bold ? 'font-bold' : ''}`}>
                                                    <FormattedNoteText text={sn.text} />
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          }

                                          return (
                                            <div
                                              key={sn.id}
                                              className={`mb-1 rounded leading-snug text-[#DC2626] min-w-0 overflow-hidden ${
                                                isCompressedFit ? 'p-1 text-[8.5px]' : 'p-1 text-[9.5px]'
                                              } ${
                                                sn.bold ? 'font-bold' : 'font-light'
                                              } ${
                                                sn.highlight
                                                  ? sn.highlightColor === 'green'
                                                    ? 'bg-[#86EFAC] border border-[#22C55E]'
                                                    : sn.highlightColor === 'blue'
                                                    ? 'bg-[#7DD3FC] border border-[#0284C7]'
                                                    : 'bg-[#FEF08A] border border-[#FACC15]'
                                                  : ''
                                              }`}
                                            >
                                              <span className="flex items-center justify-between gap-1">
                                                <span className={`break-words ${isCompressedFit ? 'line-clamp-2' : ''}`}><FormattedNoteText text={sn.text} /></span>
                                                {sn.keepIndefinitely && (
                                                  <span className="flex items-center gap-1 shrink-0">
                                                    <Pin className="w-2.5 h-2.5 text-emerald-700 shrink-0" title="Kept indefinitely" />
                                                  </span>
                                                )}
                                              </span>
                                            </div>
                                          );
                                        })}
                                        {consolidateStaffSlotAssignments(displayed, gridDay, s.id, store.entries).map((item) => {
                                          const isStruckThrough = hasCoveringDuty;
                                          const isW = item.lessonType === 'withdrawal';

                                          if (item.isClass) {
                                            return (
                                              <div
                                                key={item.id}
                                                className={`text-xs pb-1 border-b border-[#E2E8F0] last:border-0 last:pb-0 min-w-0 overflow-hidden ${
                                                  isStruckThrough ? 'opacity-85' : ''
                                                }`}
                                              >
                                                <div className="flex items-center justify-between flex-wrap gap-1">
                                                  <span
                                                    className={`font-semibold min-w-0 truncate ${
                                                      isCompressedFit ? 'text-[10.5px] leading-tight' : 'text-xs'
                                                    } ${
                                                      isStruckThrough
                                                        ? 'line-through decoration-[#DC2626] decoration-2 text-[#64748B]'
                                                        : 'text-[#1C2333]'
                                                    }`}
                                                    title={item.subject}
                                                  >
                                                    {item.subject}
                                                  </span>
                                                  <div className="flex items-center gap-1 shrink-0">
                                                    {isStruckThrough && (
                                                      <span className="text-[8.5px] font-bold text-[#DC2626] bg-[#FEE2E2] px-1 py-0.2 rounded no-underline tracking-normal inline-block border border-[#FECACA]">
                                                        Relieved
                                                      </span>
                                                    )}
                                                    <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                      Class ({item.students.length})
                                                    </span>
                                                    {item.type === 'teacher' && (
                                                      <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                                                        Teacher
                                                      </span>
                                                    )}
                                                    <span
                                                      className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                                                        isW
                                                          ? 'bg-[#DCEEFB] text-[#2A6FA8] border border-[#b8dbf7]'
                                                          : 'bg-[#E4F0EA] text-[#2F6F4E] border border-[#c3dfd1]'
                                                      }`}
                                                    >
                                                      {isW ? 'Withdrawal' : 'In-Class'}
                                                    </span>
                                                  </div>
                                                </div>
                                                {item.teacher && (
                                                  <div
                                                    className={`${isCompressedFit ? 'text-[9px] leading-tight truncate' : 'text-[10px]'} font-medium text-[#1E293B] ${
                                                      isStruckThrough
                                                        ? 'line-through decoration-[#DC2626] decoration-2 text-[#94A3B8]'
                                                        : ''
                                                    }`}
                                                    title={item.teacher}
                                                  >
                                                    Teacher: {item.teacher}
                                                  </div>
                                                )}
                                                {item.room && (
                                                  <div
                                                    className={`${isCompressedFit ? 'text-[8.5px] leading-tight truncate' : 'text-[9.5px]'} font-mono ${
                                                      isStruckThrough
                                                        ? 'line-through decoration-[#DC2626] decoration-2 text-[#94A3B8]'
                                                        : 'text-[#4A5268]'
                                                    }`}
                                                  >
                                                    Rm {item.room}
                                                  </div>
                                                )}
                                                <div
                                                  className={`mt-0.5 leading-tight ${
                                                    isCompressedFit ? 'text-[9px] line-clamp-2 break-words' : 'text-[10.5px] font-medium'
                                                  } ${
                                                    isStruckThrough ? 'line-through decoration-[#DC2626] text-[#94A3B8]' : 'text-[#334155]'
                                                  }`}
                                                >
                                                  <span className="font-semibold text-[#1C2333]">Students:</span>{' '}
                                                  {item.students.join(', ')}
                                                </div>
                                              </div>
                                            );
                                          }

                                          const singleStu = item.students[0];
                                          return (
                                            <div
                                              key={item.id}
                                              className={`text-xs pb-1 border-b border-[#E2E8F0] last:border-0 last:pb-0 min-w-0 overflow-hidden ${
                                                isStruckThrough ? 'opacity-85' : ''
                                              }`}
                                            >
                                              <div className="flex items-center justify-between flex-wrap gap-1">
                                                <span
                                                  className={`font-semibold min-w-0 truncate ${
                                                    isCompressedFit ? 'text-[10.5px] leading-tight' : 'text-xs'
                                                  } ${
                                                    isStruckThrough
                                                      ? 'line-through decoration-[#DC2626] decoration-2 text-[#64748B]'
                                                      : 'text-[#1C2333]'
                                                  }`}
                                                  title={singleStu}
                                                >
                                                  {singleStu}
                                                </span>
                                                <div className="flex items-center gap-1 shrink-0">
                                                  {isStruckThrough && (
                                                    <span className="text-[8.5px] font-bold text-[#DC2626] bg-[#FEE2E2] px-1 py-0.2 rounded no-underline tracking-normal inline-block border border-[#FECACA]">
                                                      Relieved
                                                    </span>
                                                  )}
                                                  {item.type === 'teacher' && (
                                                    <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                                                      Teacher
                                                    </span>
                                                  )}
                                                  <span
                                                    className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                                                      isW
                                                        ? 'bg-[#DCEEFB] text-[#2A6FA8] border border-[#b8dbf7]'
                                                        : 'bg-[#E4F0EA] text-[#2F6F4E] border border-[#c3dfd1]'
                                                    }`}
                                                  >
                                                    {isW ? 'Withdrawal' : 'In-Class'}
                                                  </span>
                                                </div>
                                              </div>
                                              <div
                                                className={`${isCompressedFit ? 'text-[9.5px] leading-tight truncate' : 'text-[11px]'} ${
                                                  isStruckThrough
                                                    ? 'line-through decoration-[#DC2626] decoration-2 text-[#94A3B8]'
                                                    : 'text-[#4A5268]'
                                                }`}
                                              >
                                                {item.subject}
                                              </div>
                                              {item.teacher && (
                                                <div
                                                  className={`${isCompressedFit ? 'text-[9px] leading-tight truncate' : 'text-[10px] font-medium'} text-[#1E293B] ${
                                                    isStruckThrough
                                                      ? 'line-through decoration-[#DC2626] decoration-2 text-[#94A3B8]'
                                                      : ''
                                                  }`}
                                                  title={item.teacher}
                                                >
                                                  Teacher: {item.teacher}
                                                </div>
                                              )}
                                              {item.room && (
                                                <div
                                                  className={`${isCompressedFit ? 'text-[8.5px] leading-tight truncate' : 'text-[9.5px]'} font-mono ${
                                                    isStruckThrough
                                                      ? 'line-through decoration-[#DC2626] decoration-2 text-[#94A3B8]'
                                                      : 'text-[#4A5268]'
                                                  }`}
                                                >
                                                  Rm {item.room}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}

                                        {/* Automatically Added Lesson Cover to Slots of Covering Staff */}
                                        {(() => {
                                          const displayedCoverNotes =
                                            colspan === 2 && coveringNotes.length > 1
                                              ? coveringNotes.every(
                                                  (cn) =>
                                                    cn.staffName === coveringNotes[0].staffName &&
                                                    cn.student === coveringNotes[0].student &&
                                                    cn.subject === coveringNotes[0].subject
                                                )
                                                ? [{ ...coveringNotes[0], is80Min: true }]
                                                : coveringNotes
                                              : coveringNotes;

                                          return displayedCoverNotes.map((cn) => {
                                            const coveredStudent = cn.student || (store.entries.find(
                                              (e) => e.day === gridDay && (e.slotId === s.id || (siblingId && e.slotId === siblingId)) && (
                                                (store.primarySupport || []).some(p => p.lsa.toLowerCase() === cn.staffName.toLowerCase() && p.student === e.student) ||
                                                store.lsaAssignments.some(asg => asg.lsa.toLowerCase() === cn.staffName.toLowerCase() && asg.student === e.student && asg.day === gridDay && (asg.slotId === s.id || (siblingId && asg.slotId === siblingId)))
                                              )
                                            )?.student);
                                            const coveredEntry = store.entries.find(
                                              (e) => (coveredStudent ? e.student === coveredStudent : true) && e.day === gridDay && (e.slotId === s.id || (siblingId && e.slotId === siblingId))
                                            );
                                            const subjectDisplay = cn.subject || coveredEntry?.subject || 'Cover Support';
                                            const teacherDisplay = cn.teacher || coveredEntry?.teacher;
                                            const roomDisplay = cn.room || coveredEntry?.room;
                                            const isWithdrawal = coveredEntry?.lessonType === 'withdrawal';
                                            const is80mBlock = colspan === 2 || (cn as unknown as { is80Min?: boolean }).is80Min;

                                            return (
                                              <div
                                                key={cn.id}
                                                className={`mt-1 rounded-md bg-[#FEF9C3] border-2 border-[#EAB308] text-[#1C2333] shadow-xs min-w-0 overflow-hidden ${
                                                  isCompressedFit ? 'p-1 text-[9.5px] leading-tight' : 'p-2'
                                                }`}
                                              >
                                                <div className="flex items-center justify-between gap-1 mb-1">
                                                  <span className="font-bold text-[9.5px] uppercase tracking-wider text-[#991C1C] bg-[#FEE2E2] px-1.5 py-0.5 rounded border border-[#FECACA]">
                                                    Covering {cn.staffName}
                                                  </span>
                                                  <span className="text-[9px] font-bold text-[#B91C1C] uppercase">
                                                    {is80mBlock ? '(80 min Cover)' : '(40 min Cover)'}
                                                  </span>
                                                </div>
                                                {coveredStudent && (
                                                  <div className="font-bold text-[11.5px] text-[#0F172A] leading-snug">
                                                    {coveredStudent}
                                                  </div>
                                                )}
                                                <div className="text-[10.5px] font-semibold text-[#854D0E] mt-0.5">
                                                  {subjectDisplay} {isWithdrawal && <span className="font-normal text-[#991B1B]">· Withdrawal</span>}
                                                </div>
                                                {teacherDisplay && (
                                                  <div className="text-[10px] text-[#713F12]">
                                                    Teacher: {teacherDisplay}
                                                  </div>
                                                )}
                                                {roomDisplay && (
                                                  <div className="text-[9.5px] font-mono text-[#78350F] mt-0.5">
                                                    Rm {roomDisplay}
                                                  </div>
                                                )}
                                                {cn.text && (
                                                  <div className="mt-1 text-[9px] text-[#DC2626] italic bg-white/80 px-1.5 py-0.5 rounded border border-[#FDE047]">
                                                    "<FormattedNoteText text={cn.text} />"
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          });
                                        })()}

                                        {/* Bottom Notes / Cover notices / @ Mentions */}
                                        {bottomNotes.map((sn) => {
                                          const isMention = isStaffMentionedInNote(sn, name);
                                          if (isMention) {
                                            return (
                                              <div
                                                key={sn.id}
                                                onClick={(e) => handleNavigateToMention(sn, e)}
                                                title={`Mention from ${sn.staffName} — Click to view ${sn.staffName}'s slot`}
                                                className={`mt-1 rounded bg-[#F3E8FF] border border-[#D8B4FE] text-[#581C87] shadow-2xs cursor-pointer hover:bg-[#EDE9FE] hover:border-[#C084FC] hover:shadow-xs transition-all group min-w-0 overflow-hidden ${
                                                  isCompressedFit ? 'p-1 text-[8.5px] leading-tight' : 'p-1.5 text-[9.5px] leading-tight'
                                                }`}
                                              >
                                                <div className="font-bold text-[8.5px] uppercase tracking-wide text-[#6B21A8] flex items-center justify-between">
                                                  <span className="flex items-center gap-1 group-hover:text-[#581C87]">
                                                    <AtSign className="w-2.5 h-2.5 text-[#7E22CE]" /> Mention from {sn.staffName}
                                                  </span>
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-[8px] lowercase tracking-normal text-[#9333EA] opacity-0 group-hover:opacity-100 font-semibold transition-opacity">
                                                      jump to slot →
                                                    </span>
                                                    {sn.keepIndefinitely && <Pin className="w-2.5 h-2.5 text-emerald-700 shrink-0" title="Kept indefinitely" />}
                                                  </div>
                                                </div>
                                                {sn.text && (
                                                  <div className={`mt-0.5 text-[#4C1D95] ${sn.bold ? 'font-bold' : ''}`}>
                                                    <FormattedNoteText text={sn.text} />
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          }

                                          if (sn.isCover) {
                                            return (
                                              <div
                                                key={sn.id}
                                                className={`mt-1 rounded bg-[#FEF08A] border border-[#FACC15] text-[#DC2626] font-light min-w-0 overflow-hidden ${
                                                  isCompressedFit ? 'p-1 text-[8.5px] leading-tight' : 'p-1 text-[9.5px] leading-tight'
                                                }`}
                                              >
                                                <div className="font-semibold text-[8.5px] uppercase tracking-wide text-[#B91C1C] flex items-center justify-between">
                                                  <span className="truncate">Cover: {sn.coveredBy || 'Pending'} {colspan === 2 ? '(80 min)' : '(40 min)'}</span>
                                                  {sn.keepIndefinitely && <Pin className="w-2.5 h-2.5 text-emerald-700 shrink-0" title="Kept indefinitely" />}
                                                </div>
                                                {sn.text && (
                                                  <div className={`mt-0.5 text-[#DC2626] break-words ${isCompressedFit ? 'line-clamp-2' : ''} ${sn.bold ? 'font-bold' : ''}`}>
                                                    <FormattedNoteText text={sn.text} />
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          }

                                          return (
                                            <div
                                              key={sn.id}
                                              className={`mt-1 rounded leading-snug text-[#DC2626] min-w-0 overflow-hidden ${
                                                isCompressedFit ? 'p-1 text-[8.5px]' : 'p-1 text-[9.5px]'
                                              } ${
                                                sn.bold ? 'font-bold' : 'font-light'
                                              } ${
                                                sn.highlight
                                                  ? sn.highlightColor === 'green'
                                                    ? 'bg-[#86EFAC] border border-[#22C55E]'
                                                    : sn.highlightColor === 'blue'
                                                    ? 'bg-[#7DD3FC] border border-[#0284C7]'
                                                    : 'bg-[#FEF08A] border border-[#FACC15]'
                                                  : ''
                                              }`}
                                            >
                                              <span className="flex items-center justify-between gap-1">
                                                <span className={`break-words ${isCompressedFit ? 'line-clamp-2' : ''}`}><FormattedNoteText text={sn.text} /></span>
                                                {sn.keepIndefinitely && <Pin className="w-2.5 h-2.5 text-emerald-700 shrink-0" title="Kept indefinitely" />}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </td>
                                );
                              }
                            })}

                            {isFriday && (
                              <td
                                className={`align-middle text-center italic text-[#64748B] ${isAltRow ? 'bg-[#EEF2F6]' : 'bg-[#F8FAFC]'} border-r border-[#64748B] ${rowBorderB} ${groupTopBorder} ${
                                  isCompressedFit ? 'p-1 text-[10px] min-w-0' : 'p-1 text-xs'
                                }`}
                              >
                                Early finish (11:30)
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4 no-print">
        <h2 className="text-[17px] font-bold text-[#1C2333] mb-1">Timetable</h2>
        <p className="text-[13px] text-[#4A5268] max-w-3xl leading-relaxed">
          {role === 'admin'
            ? 'Click any cell — including registration and breaks — to add or edit it, and to attach staff support. Switch between the consolidated student view, the consolidated staff view, or an individual’s own week.'
            : 'Browse the consolidated student view, the consolidated staff view, or an individual’s own week. Click a cell for details, or download/export a timetable below.'}
        </p>
      </div>

      {/* Controls Bar */}
      <div className="flex justify-between items-center gap-3 flex-wrap mb-4 bg-white p-2.5 rounded-md border border-[#DCDFE4] shadow-xs no-print">
        {/* View Switcher */}
        <div className="flex gap-1 bg-[#F5F6F8] p-1 rounded border border-[#DCDFE4]">
          <button
            id="view-tab-students"
            onClick={() => setTimetableView('students')}
            className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors ${
              timetableView === 'students' ? 'bg-[#2F6F4E] text-white shadow-xs' : 'text-[#4A5268] hover:text-[#1C2333]'
            }`}
          >
            All Students
          </button>
          <button
            id="view-tab-staff"
            onClick={() => setTimetableView('staff')}
            className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors ${
              timetableView === 'staff' ? 'bg-[#2F6F4E] text-white shadow-xs' : 'text-[#4A5268] hover:text-[#1C2333]'
            }`}
          >
            All Staff
          </button>
          <button
            id="view-tab-individual"
            onClick={() => setTimetableView('individual')}
            className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors ${
              timetableView === 'individual' ? 'bg-[#2F6F4E] text-white shadow-xs' : 'text-[#4A5268] hover:text-[#1C2333]'
            }`}
          >
            Individual
          </button>
        </div>

        {/* Staff Filter Dropdown (if in All Staff view) */}
        {timetableView === 'staff' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#4A5268]">Filter:</span>
              <select
                id="staff-filter-select"
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value as any)}
                className="text-xs font-medium px-2.5 py-1.5 rounded border border-[#DCDFE4] bg-white text-[#1C2333] focus:outline-none focus:ring-1 focus:ring-[#2F6F4E]"
              >
                <option value="all">Show everything</option>
                <option value="free">Free periods only</option>
                <option value="withdrawal">Withdrawals only</option>
                <option value="lesson">In-class lessons only</option>
                <option value="conflict">Conflicts only</option>
              </select>
            </div>
          </div>
        )}

        {/* Day Selector Tabs & Row Expansion */}
        {timetableView === 'individual' ? (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-[#F5F6F8] p-1 rounded border border-[#DCDFE4]">
              <button
                id="indiv-day-all"
                onClick={() => setIndivDayView('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors ${
                  indivDayView === 'all' ? 'bg-[#1C2333] text-white shadow-xs' : 'text-[#4A5268] hover:text-[#1C2333]'
                }`}
              >
                All Week
              </button>
              {DAYS.map((d) => (
                <button
                  key={d}
                  id={`indiv-day-${d}`}
                  onClick={() => setIndivDayView(d)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors ${
                    indivDayView === d ? 'bg-[#1C2333] text-white shadow-xs' : 'text-[#4A5268] hover:text-[#1C2333]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Row expansion control for individual timetable */}
            <div className="flex items-center gap-1 bg-[#F5F6F8] p-1 rounded border border-[#DCDFE4]">
              <span className="text-[11px] font-semibold text-[#4A5268] px-1.5 flex items-center gap-1">
                <Rows className="w-3.5 h-3.5 text-[#4A5268]" /> Rows:
              </span>
              {(['compact', 'standard', 'expanded'] as const).map((mode) => (
                <button
                  key={mode}
                  id={`indiv-row-${mode}`}
                  type="button"
                  onClick={() => setIndivRowExpansion(mode)}
                  className={`px-2.5 py-1 text-xs font-semibold capitalize rounded cursor-pointer transition-colors ${
                    indivRowExpansion === mode
                      ? 'bg-[#1C2333] text-white shadow-xs'
                      : 'text-[#4A5268] hover:text-[#1C2333]'
                  }`}
                  title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} row expansion (controls row height & 1-page fit)`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex gap-1 bg-[#F5F6F8] p-1 rounded border border-[#DCDFE4]">
            <button
              id="day-tab-all"
              onClick={() => setAllScheduleDayMode('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors ${
                allScheduleDayMode === 'all' ? 'bg-[#1C2333] text-white shadow-xs' : 'text-[#4A5268] hover:text-[#1C2333]'
              }`}
              title="View, print, or download the full week (Mon–Fri)"
            >
              All Week
            </button>
            {DAYS.map((d) => (
              <button
                key={d}
                id={`day-tab-${d}`}
                onClick={() => {
                  setAllScheduleDayMode('single');
                  setCurrentDay(d);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors ${
                  allScheduleDayMode === 'single' && currentDay === d
                    ? 'bg-[#1C2333] text-white shadow-xs'
                    : 'text-[#4A5268] hover:text-[#1C2333]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        )}

        {/* Export & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Fit to Screen toggle button */}
          <button
            id="btn-toggle-fit-screen"
            type="button"
            onClick={toggleCompressedFit}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded border flex items-center gap-1.5 cursor-pointer transition-colors ${
              isCompressedFit
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 shadow-2xs'
                : 'border-[#DCDFE4] text-[#1C2333] hover:bg-[#F5F6F8]'
            }`}
            title={isCompressedFit ? 'Timetable compressed to fit all columns to screen. Click for expanded view.' : 'Click to compress timetable to fit screen'}
          >
            {isCompressedFit ? (
              <Minimize2 className="w-3.5 h-3.5 text-emerald-700" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-[#4A5268]" />
            )}
            <span>{isCompressedFit ? 'Fit Screen: ON' : 'Fit Screen: OFF'}</span>
          </button>

          {timetableView !== 'individual' ? (
            <>
              <button
                id="btn-download-grid-csv"
                onClick={handleDownloadGridCSV}
                className="px-2.5 py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] text-[#1C2333] hover:bg-[#F5F6F8] flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Download table data as CSV"
              >
                <FileDown className="w-3.5 h-3.5 text-[#4A5268]" /> CSV
              </button>
              <button
                id="btn-download-grid-pdf"
                onClick={handleDownloadGridPDF}
                className="px-2.5 py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] text-[#1C2333] hover:bg-[#F5F6F8] flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Download formatted PDF document"
              >
                <FileText className="w-3.5 h-3.5 text-[#4A5268]" /> PDF
              </button>
              <button
                id="btn-print-grid"
                onClick={handlePrint}
                className="px-2.5 py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] text-[#1C2333] hover:bg-[#F5F6F8] flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Print current timetable"
              >
                <Printer className="w-3.5 h-3.5 text-[#4A5268]" /> Print
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                id="indiv-type-select"
                value={indivType}
                onChange={(e) => {
                  setIndivType(e.target.value as any);
                  setIndivName(null);
                }}
                className="text-xs font-semibold px-2.5 py-1.5 rounded border border-[#DCDFE4] bg-white text-[#1C2333]"
              >
                <option value="student">Student</option>
                <option value="staff">Staff</option>
              </select>

              <div className="flex items-center gap-1.5">
                <select
                  id="indiv-name-select"
                  value={indivName || ''}
                  onChange={(e) => setIndivName(e.target.value || null)}
                  className="text-xs font-medium px-3 py-1.5 rounded border border-[#DCDFE4] bg-white text-[#1C2333] min-w-[170px]"
                >
                  <option value="">Select a {indivType}…</option>
                  {indivType === 'student'
                    ? store.students.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))
                    : orderedStaffPool.map((p) => (
                        <option
                          key={p.id}
                          value={p.name}
                          className={getStaffDesignation(p) === 'SEND' ? 'text-[#1D4ED8] font-semibold' : ''}
                        >
                          {p.name}
                        </option>
                      ))}
                </select>
              </div>

              {indivName && (
                <>
                  <button
                    id="btn-download-indiv-csv"
                    onClick={handleDownloadIndivCSV}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] text-[#1C2333] hover:bg-[#F5F6F8] flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5 text-[#4A5268]" /> CSV
                  </button>
                  <button
                    id="btn-download-indiv-pdf"
                    onClick={handleDownloadIndivPDF}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] text-[#1C2333] hover:bg-[#F5F6F8] flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#4A5268]" /> PDF
                  </button>
                  <button
                    id="btn-print-indiv"
                    onClick={handlePrint}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] text-[#1C2333] hover:bg-[#F5F6F8] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#4A5268]" /> Print
                  </button>
                </>
              )}
            </div>
          )}
          {/* Status Indicator for Staff Mode */}
          {role !== 'admin' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded text-[11px] font-medium text-[#475569] shadow-2xs">
              <Lock className="w-3 h-3 text-[#64748B]" />
              <span>Editing Locked (Staff Mode)</span>
              {isAutoAdmin && (
                <button
                  type="button"
                  onClick={openAdminLogin}
                  className="ml-1 text-[#2F6F4E] font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3" /> Return to Admin
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Printable Document Header (shown ONLY when printing directly via browser Ctrl+P) */}
      <div className="hidden print:block mb-2 border-b border-[#1C2333] pb-1">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-base font-bold text-[#0F172A] leading-none">Department Timetable</h1>
            <p className="text-[11px] text-[#475569] mt-0.5 leading-tight">
              {timetableView === 'individual'
                ? `${indivType === 'student' ? 'Student' : 'Staff'} Timetable — ${indivName || 'Selected'} (${
                    indivDayView === 'all' ? 'Full Week Mon–Fri' : DAY_FULL[indivDayView]
                  })`
                : `${DAY_FULL[currentDay]} — ${timetableView === 'students' ? 'All Students' : 'Staff Deployment'}`}
            </p>
          </div>
          <div className="text-right text-[9.5px] text-[#64748B] leading-tight">
            <div>Department Timetable</div>
            <div>Printed: {new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div id="viewBody">{timetableView === 'individual' ? renderIndividualTable() : renderDayGrid()}</div>

      {/* Frozen Bottom Bar (Sticky): Minimalist Side Scroll & Legend */}
      <div
        id="frozen-timetable-bottom"
        className="freeze-timetable-bottom sticky bottom-0 z-30 mt-2 -mx-3 sm:-mx-5 lg:-mx-6 px-3 sm:px-5 lg:px-6 py-1.5 bg-white/95 backdrop-blur-md border-t border-[#CBD5E1] shadow-[0_-3px_12px_rgba(0,0,0,0.07)] no-print transition-all"
      >
        {/* Minimalist Side Scroll Row */}
        <div className="flex items-center gap-1.5 justify-between">
          {isCompressedFit && !scrollButtonsState.hasOverflow ? (
            <div className="flex-1 min-w-0" />
          ) : (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {/* Left Arrow Button (Step click or press & hold) */}
              <button
                type="button"
                id="btn-side-scroll-left"
                onClick={() => scrollStep('left')}
                onMouseDown={() => startContinuousScroll('left')}
                onMouseUp={stopContinuousScroll}
                onMouseLeave={stopContinuousScroll}
                onTouchStart={() => startContinuousScroll('left')}
                onTouchEnd={stopContinuousScroll}
                disabled={!scrollButtonsState.canScrollLeft}
                aria-label="Scroll left"
                className={`p-1 rounded text-xs flex items-center justify-center shrink-0 transition-colors ${
                  scrollButtonsState.canScrollLeft
                    ? 'text-[#334155] hover:text-[#0F172A] hover:bg-[#E2E8F0] active:bg-[#CBD5E1] cursor-pointer'
                    : 'text-[#CBD5E1] cursor-not-allowed'
                }`}
                title="Scroll left (hold to glide)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Ultra-Smooth Interactive Scroll Track with Draggable Thumb */}
              <div
                ref={bottomTrackRef}
                onClick={handleTrackClick}
                className="flex-1 h-2.5 bg-[#E2E8F0] hover:bg-[#CBD5E1] rounded-full relative cursor-pointer select-none transition-colors overflow-hidden mx-1"
                title="Click or drag to smoothly scroll timetable horizontally"
              >
                <div
                  ref={bottomThumbRef}
                  onPointerDown={handleThumbPointerDown}
                  onPointerMove={handleThumbPointerMove}
                  onPointerUp={handleThumbPointerUp}
                  onPointerCancel={handleThumbPointerUp}
                  className="h-full bg-[#64748B] hover:bg-[#475569] active:bg-[#1E293B] rounded-full cursor-grab active:cursor-grabbing absolute top-0 left-0 transition-colors shadow-2xs flex items-center justify-center"
                >
                  <div className="w-2.5 h-0.5 bg-white/70 rounded-full pointer-events-none" />
                </div>
              </div>

              {/* Right Arrow Button (Step click or press & hold) */}
              <button
                type="button"
                id="btn-side-scroll-right"
                onClick={() => scrollStep('right')}
                onMouseDown={() => startContinuousScroll('right')}
                onMouseUp={stopContinuousScroll}
                onMouseLeave={stopContinuousScroll}
                onTouchStart={() => startContinuousScroll('right')}
                onTouchEnd={stopContinuousScroll}
                disabled={!scrollButtonsState.canScrollRight}
                aria-label="Scroll right"
                className={`p-1 rounded text-xs flex items-center justify-center shrink-0 transition-colors ${
                  scrollButtonsState.canScrollRight
                    ? 'text-[#334155] hover:text-[#0F172A] hover:bg-[#E2E8F0] active:bg-[#CBD5E1] cursor-pointer'
                    : 'text-[#CBD5E1] cursor-not-allowed'
                }`}
                title="Scroll right (hold to glide)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Button to Hide or Show Legend */}
          <button
            type="button"
            id="btn-toggle-legend"
            onClick={() => setIsLegendCollapsed(!isLegendCollapsed)}
            className="text-[11px] font-medium text-[#475569] hover:text-[#0F172A] px-2 py-0.5 rounded border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] flex items-center gap-1 cursor-pointer shrink-0 transition-colors ml-1 shadow-2xs"
            title={isLegendCollapsed ? 'Show legend' : 'Hide legend'}
          >
            <Info className="w-3.5 h-3.5 text-[#2F6F4E]" />
            <span>{isLegendCollapsed ? 'Show Legend' : 'Hide Legend'}</span>
            {isLegendCollapsed ? <ChevronUp className="w-3 h-3 text-[#64748B]" /> : <ChevronDown className="w-3 h-3 text-[#64748B]" />}
          </button>
        </div>

        {/* Legend Items */}
        {!isLegendCollapsed && (
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-[11px] text-[#4A5268] pt-1.5 mt-1.5 border-t border-[#EAECEF]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#2F6F4E] inline-block shadow-2xs" />
              <span>Subject (color-coded)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#58228C] inline-block shadow-2xs" />
              <span>Staff support</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#DCEEFB] border border-[#2A6FA8] inline-block shadow-2xs" />
              <span>Withdrawal</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#B23A31] inline-block shadow-2xs" />
              <span>Staff conflict</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-fixed-slot border border-[#CBD5E1] inline-block shadow-2xs" />
              <span>Registration / break</span>
            </span>
          </div>
        )}
      </div>

      {/* Printable Static Legend (visible ONLY when printed via browser print) */}
      <div className="hidden print:flex gap-4 flex-wrap mt-3 text-[10px] text-[#000000] items-center border-t border-[#64748B] pt-2">
        <span className="font-semibold">Legend:</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 border border-[#64748B] inline-block bg-[#2F6F4E]" />
          Subject
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 border border-[#64748B] inline-block bg-[#58228C]" />
          Staff support
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 border border-[#64748B] inline-block bg-[#DCEEFB]" />
          Withdrawal
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 border border-[#64748B] inline-block bg-[#B23A31]" />
          Conflict
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 border border-[#64748B] inline-block bg-[#E2E8F0]" />
          Registration / Break
        </span>
      </div>

      {/* Cell Modals */}
      {selectedStudentCell &&
        (role === 'admin' ? (
          <LessonModal
            isOpen={true}
            student={selectedStudentCell.student}
            day={selectedStudentCell.day}
            slotId={selectedStudentCell.slotId}
            onClose={() => {
              setSelectedStudentCell(null);
              setIsEditingSelectedCell(false);
            }}
          />
        ) : (
          <LessonDetailModal
            isOpen={true}
            student={selectedStudentCell.student}
            day={selectedStudentCell.day}
            slotId={selectedStudentCell.slotId}
            onClose={() => setSelectedStudentCell(null)}
          />
        ))}

      {selectedStaffCell && (
        <StaffCellModal
          isOpen={true}
          staffName={selectedStaffCell.staffName}
          day={selectedStaffCell.day}
          slotId={selectedStaffCell.slotId}
          onClose={() => setSelectedStaffCell(null)}
        />
      )}

      {/* Dedicated Add Lesson to Staff Modal */}
      <AddStaffLessonModal
        isOpen={isAddStaffLessonModalOpen}
        onClose={() => {
          setIsAddStaffLessonModalOpen(false);
          setAddStaffLessonPrefill(null);
        }}
        initialStaffName={addStaffLessonPrefill?.staffName}
        initialDay={addStaffLessonPrefill?.day}
        initialSlotId={addStaffLessonPrefill?.slotId}
        initialLessonType={addStaffLessonPrefill?.lessonType}
        initialMode={addStaffLessonPrefill?.mode}
      />
    </div>
  );
};
