import React, { useMemo } from 'react';
import { useTimetable } from '../context/TimetableContext';
import {
  filterActiveAnnouncements,
  filterActiveStaffNotes,
  slotsFor,
  getGroupSiblingId,
  getCalendarDateForSchoolDay,
  assignmentsForLsaSlot,
} from '../utils/timetable';
import { DayOfWeek } from '../types';
import { Bell, AlertCircle, Calendar } from 'lucide-react';
import { FormattedNoteText } from './FormattedNoteText';

interface ConsolidatedCover {
  id: string;
  day: DayOfWeek;
  dateDisplay: string;
  dateTimestamp: number;
  slotOrder: number;
  lessonHeading: string;
  lessonLabel: string;
  timeRange: string;
  hasLesson: boolean;
  subject: string;
  student: string;
  room: string;
  staffToCover: string;
  staffRelieved: string;
  confirmedConflict?: boolean;
  note?: string;
  is80Min: boolean;
}

function getDateForCover(day: DayOfWeek): { dateDisplay: string; timestamp: number } {
  return getCalendarDateForSchoolDay(day);
}

export const AnnouncementsBanner: React.FC = () => {
  const { store } = useTimetable();

  const activeAnnouncements = useMemo(() => {
    return filterActiveAnnouncements(store.announcements || [])
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 3);
  }, [store.announcements]);

  // Consolidate covers and merge 80-minute lessons
  const consolidatedCovers = useMemo(() => {
    const activeCovers = filterActiveStaffNotes(store.staffNotes || []).filter((n) => n.isCover);
    if (activeCovers.length === 0) return [];

    const processedIds = new Set<string>();
    const list: ConsolidatedCover[] = [];

    activeCovers.forEach((cover) => {
      if (processedIds.has(cover.id)) return;

      const daySlots = slotsFor(cover.day, store.schedule);
      const slot = daySlots.find((s) => s.id === cover.slotId);

      // Check if slot has a double-period sibling
      const siblingId = getGroupSiblingId(cover.day, cover.slotId, store.schedule);
      const siblingSlot = siblingId ? daySlots.find((s) => s.id === siblingId) : null;
      const isPaired = Boolean(siblingId && siblingSlot && slot?.group && siblingSlot.group === slot.group);

      // Check if there is an identical partner cover in the sibling slot
      const partnerCover = isPaired
        ? activeCovers.find(
            (other) =>
              other.id !== cover.id &&
              other.day === cover.day &&
              other.slotId === siblingId &&
              other.staffName === cover.staffName &&
              other.coveredBy &&
              other.coveredBy === cover.coveredBy
          )
        : null;

      if (isPaired && slot && siblingSlot && partnerCover) {
        // Merge 80 min lesson into a single cover notification
        const idxA = daySlots.findIndex((s) => s.id === slot.id);
        const idxB = daySlots.findIndex((s) => s.id === siblingSlot.id);
        const slotA = idxA <= idxB ? slot : siblingSlot;
        const slotB = idxA <= idxB ? siblingSlot : slot;
        const coverA = idxA <= idxB ? cover : partnerCover;
        const coverB = idxA <= idxB ? partnerCover : cover;

        processedIds.add(coverA.id);
        processedIds.add(coverB.id);

        const baseName = slotA.label.replace(/\s*[a-z]$/i, '').trim();
        const lessonHeading =
          baseName && slotB.label.toLowerCase().startsWith(baseName.toLowerCase())
            ? `${baseName} (80 min)`
            : `${slotA.label} & ${slotB.label} (80 min)`;
        const lessonLabel = lessonHeading;

        // Check whether a real lesson exists for the relieved staff
        let student = coverA.student || coverB.student || '';
        let subject = coverA.subject || coverB.subject || '';
        let rawRoom = coverA.room || coverB.room || '';

        if (!student) {
          const assignsA = assignmentsForLsaSlot(
            cover.staffName,
            cover.day,
            slotA.id,
            store.students,
            store.entries,
            store.lsaAssignments,
            store.primarySupport || []
          );
          const assignsB = assignmentsForLsaSlot(
            cover.staffName,
            cover.day,
            slotB.id,
            store.students,
            store.entries,
            store.lsaAssignments,
            store.primarySupport || []
          );
          if (assignsA.length > 0) student = assignsA[0].student;
          else if (assignsB.length > 0) student = assignsB[0].student;
        }

        const primaryEntry = student
          ? store.entries.find(
              (e) =>
                e.student === student &&
                e.day === cover.day &&
                (e.slotId === slotA.id || e.slotId === slotB.id)
            )
          : store.entries.find(
              (e) =>
                e.teacher &&
                e.teacher.trim().toLowerCase() === cover.staffName.trim().toLowerCase() &&
                e.day === cover.day &&
                (e.slotId === slotA.id || e.slotId === slotB.id)
            );

        if (primaryEntry) {
          if (!student && primaryEntry.student) student = primaryEntry.student;
          if (!subject) subject = primaryEntry.subject;
          if (!rawRoom) rawRoom = primaryEntry.room;
        }

        const hasLesson = Boolean(student || subject);
        const room = rawRoom ? (rawRoom.toLowerCase().startsWith('rm') ? rawRoom : `Rm ${rawRoom}`) : '';

        const noteA = coverA.text?.trim() || '';
        const noteB = coverB.text?.trim() || '';
        const note = noteA === noteB ? noteA : [noteA, noteB].filter(Boolean).join(' / ');

        const dateObj = getDateForCover(cover.day);

        list.push({
          id: `${coverA.id}_${coverB.id}`,
          day: cover.day,
          dateDisplay: dateObj.dateDisplay,
          dateTimestamp: dateObj.timestamp,
          slotOrder: Math.min(idxA, idxB),
          lessonHeading,
          lessonLabel,
          timeRange: `${slotA.start}–${slotB.end}`,
          hasLesson,
          subject: subject || 'Support',
          student: student || '',
          room,
          staffToCover: coverA.coveredBy || 'Unassigned',
          staffRelieved: cover.staffName,
          confirmedConflict: coverA.confirmedConflict || coverB.confirmedConflict,
          note: note || undefined,
          is80Min: true,
        });
      } else {
        // Single 40 min lesson cover
        processedIds.add(cover.id);

        const idx = slot ? daySlots.findIndex((s) => s.id === slot.id) : 0;
        const lessonHeading = slot ? slot.label : cover.slotId;
        const lessonLabel = slot ? `${slot.label} (40 min)` : cover.slotId;

        let student = cover.student || '';
        let subject = cover.subject || '';
        let rawRoom = cover.room || '';

        if (!student) {
          const assigns = assignmentsForLsaSlot(
            cover.staffName,
            cover.day,
            cover.slotId,
            store.students,
            store.entries,
            store.lsaAssignments,
            store.primarySupport || []
          );
          if (assigns.length > 0) student = assigns[0].student;
        }

        const primaryEntry = student
          ? store.entries.find(
              (e) => e.student === student && e.day === cover.day && e.slotId === cover.slotId
            )
          : store.entries.find(
              (e) =>
                e.teacher &&
                e.teacher.trim().toLowerCase() === cover.staffName.trim().toLowerCase() &&
                e.day === cover.day &&
                e.slotId === cover.slotId
            );

        if (primaryEntry) {
          if (!student && primaryEntry.student) student = primaryEntry.student;
          if (!subject) subject = primaryEntry.subject;
          if (!rawRoom) rawRoom = primaryEntry.room;
        }

        const hasLesson = Boolean(student || subject);
        const room = rawRoom ? (rawRoom.toLowerCase().startsWith('rm') ? rawRoom : `Rm ${rawRoom}`) : '';

        const note = cover.text?.trim() || undefined;
        const dateObj = getDateForCover(cover.day);

        list.push({
          id: cover.id,
          day: cover.day,
          dateDisplay: dateObj.dateDisplay,
          dateTimestamp: dateObj.timestamp,
          slotOrder: idx,
          lessonHeading,
          lessonLabel,
          timeRange: slot ? `${slot.start}–${slot.end}` : '',
          hasLesson,
          subject: subject || 'Support',
          student: student || '',
          room,
          staffToCover: cover.coveredBy || 'Unassigned',
          staffRelieved: cover.staffName,
          confirmedConflict: cover.confirmedConflict,
          note,
          is80Min: false,
        });
      }
    });

    return list;
  }, [store.staffNotes, store.schedule, store.entries, store.students, store.lsaAssignments, store.primarySupport]);

  // Group covers by date
  const coversByDate = useMemo(() => {
    const groups: Record<string, { dateDisplay: string; dateTimestamp: number; items: ConsolidatedCover[] }> = {};

    consolidatedCovers.forEach((item) => {
      if (!groups[item.dateDisplay]) {
        groups[item.dateDisplay] = {
          dateDisplay: item.dateDisplay,
          dateTimestamp: item.dateTimestamp,
          items: [],
        };
      }
      groups[item.dateDisplay].items.push(item);
    });

    return Object.values(groups)
      .sort((a, b) => a.dateTimestamp - b.dateTimestamp)
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) => a.slotOrder - b.slotOrder),
      }));
  }, [consolidatedCovers]);

  if (activeAnnouncements.length === 0 && consolidatedCovers.length === 0) return null;

  return (
    <div className="bg-[#FEF2F2] border border-[#FECACA] border-l-4 border-l-[#DC2626] rounded-md p-4 mb-4 shadow-xs no-print">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 font-bold text-[13.5px] text-[#991B1B]">
          <span className="w-2 h-2 rounded-full bg-[#DC2626] animate-pulse" />
          <Bell className="w-4 h-4 text-[#DC2626]" />
          <span>Notifications & Staff Cover Alerts</span>
        </div>
        {consolidatedCovers.length > 0 && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#DC2626] text-white">
            {consolidatedCovers.length} Active Cover{consolidatedCovers.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="space-y-4 pl-1 sm:pl-3">
        {/* Consolidated Cover Notices Grouped by Date */}
        {coversByDate.length > 0 && (
          <div className="space-y-3.5">
            {coversByDate.map((group) => (
              <div key={group.dateDisplay} className="space-y-1.5">
                {/* Date Above */}
                <div className="flex items-center gap-1.5 font-bold text-xs text-[#991B1B] pb-1 border-b border-[#FCA5A5]/70">
                  <Calendar className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />
                  <span>{group.dateDisplay}</span>
                </div>

                {/* Cover Items for this Date */}
                <div className="space-y-1.5">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white/95 border border-[#FCA5A5] rounded-md px-3.5 py-2 text-xs text-[#1C2333] shadow-2xs flex flex-wrap items-center justify-between gap-2"
                    >
                      {/* Format:
                          With lesson: Lesson - Subject, Student, Room: Staff to cover (covering for ...) - note
                          Without lesson (notes only): Lesson heading - Note: Staff to cover (covering for ...)
                      */}
                      <div className="flex flex-wrap items-baseline gap-1.5 text-[12.5px] leading-relaxed">
                        {item.hasLesson ? (
                          <>
                            <span className="font-semibold text-[#1C2333]">{item.lessonLabel}</span>
                            <span className="text-[#6B7280]">-</span>
                            <span className="text-[#374151]">
                              {item.subject}{item.student ? `, ${item.student}` : ''}{item.room ? `, ${item.room}` : ''}:
                            </span>
                            <strong className="font-bold text-[#DC2626] ml-0.5">{item.staffToCover}</strong>
                            {item.staffRelieved && (
                              <span className="text-[11px] text-[#6B7280] font-normal">
                                (covering for {item.staffRelieved})
                              </span>
                            )}
                            {item.note && (
                              <span className="text-[#B91C1C] italic text-[11.5px] font-light">
                                - <FormattedNoteText text={item.note} />
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="font-bold text-[#1C2333]">{item.lessonHeading}</span>
                            {item.note ? (
                              <>
                                <span className="text-[#6B7280]">-</span>
                                <span className="text-[#B91C1C] font-semibold text-[12px] bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                                  <FormattedNoteText text={item.note} />
                                </span>
                                <span className="text-[#6B7280]">:</span>
                              </>
                            ) : (
                              <span className="text-[#6B7280]">:</span>
                            )}
                            <strong className="font-bold text-[#DC2626] ml-0.5">{item.staffToCover}</strong>
                            {item.staffRelieved && (
                              <span className="text-[11px] text-[#6B7280] font-normal">
                                (covering for {item.staffRelieved})
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.timeRange && (
                          <span className="text-[10px] font-mono text-[#4B5563] bg-[#F3F4F6] px-1.5 py-0.5 rounded border border-[#E5E7EB]">
                            {item.timeRange}
                          </span>
                        )}
                        {item.confirmedConflict && (
                          <span className="text-[10px] text-[#B91C1C] bg-red-50 border border-red-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                            <AlertCircle className="w-3 h-3 text-[#DC2626]" /> Struck through
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Regular Admin Announcements */}
        {activeAnnouncements.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-[#FEE2E2]">
            <div className="text-[11px] font-bold text-[#991B1B] uppercase tracking-wide">
              General Announcements
            </div>
            {activeAnnouncements.map((ann) => {
              const dateObj = new Date(ann.date);
              const formattedDate = isNaN(dateObj.getTime())
                ? ''
                : dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              return (
                <div key={ann.id} className="text-[12px] leading-relaxed text-[#1C2333] flex items-baseline gap-2">
                  <span className="text-[#991B1B] text-[10px] font-mono shrink-0 bg-[#FEE2E2] px-1.5 py-0.5 rounded border border-[#FECACA]">
                    {formattedDate}
                  </span>
                  <span>{ann.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
