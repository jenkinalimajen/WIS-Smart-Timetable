import React from 'react';
import { useTimetable } from '../../context/TimetableContext';
import { DayOfWeek } from '../../types';
import { DAY_FULL, slotsFor, getActiveSupport, filterActiveStaffNotes, getGroupSiblingId } from '../../utils/timetable';
import { BookOpen, User, MapPin, Users, X, KeyRound, Lock, Pin } from 'lucide-react';

interface LessonDetailModalProps {
  isOpen: boolean;
  student: string;
  day: DayOfWeek;
  slotId: string;
  onClose: () => void;
  onOpenAdminEdit?: () => void;
}

export const LessonDetailModal: React.FC<LessonDetailModalProps> = ({
  isOpen,
  student,
  day,
  slotId,
  onClose,
  onOpenAdminEdit,
}) => {
  const { store, role, setRole, openAdminLogin } = useTimetable();
  if (!isOpen) return null;

  const slots = slotsFor(day, store.schedule);
  const slot = slots.find((s) => s.id === slotId);
  const siblingId = getGroupSiblingId(day, slotId, store.schedule);
  const entry = store.entries.find((e) => e.student === student && e.day === day && e.slotId === slotId);
  const activeSupport = getActiveSupport(
    student,
    day,
    slotId,
    store.entries,
    store.lsaAssignments,
    store.primarySupport || [],
    filterActiveStaffNotes(store.staffNotes || [])
  );
  const isWithdrawal = entry?.lessonType === 'withdrawal';

  const activeStaffNotes = filterActiveStaffNotes(store.staffNotes || []);
  const relatedNotes = activeSupport
    ? activeStaffNotes.filter(
        (n) =>
          n.staffName.toLowerCase() === activeSupport.lsa.toLowerCase() &&
          n.day === day &&
          (n.slotId === slotId || (siblingId && n.slotId === siblingId))
      )
    : [];

  const handleEditClick = () => {
    if (role === 'admin') {
      onClose();
      if (onOpenAdminEdit) onOpenAdminEdit();
    } else {
      onClose();
      openAdminLogin();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-[#141620]/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg w-full max-w-sm p-6 shadow-xl border border-[#DCDFE4]">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-[17px] font-bold text-[#1C2333]">{student}</h3>
            <div className="text-xs text-[#4A5268] font-mono mt-0.5">
              {DAY_FULL[day]} · {slot?.label} · {slot?.start}–{slot?.end}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#4A5268] hover:text-[#1C2333] p-1 rounded hover:bg-[#F5F6F8] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {entry ? (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#2F6F4E] shrink-0" />
              <div>
                <span className="text-[15px] font-semibold text-[#1C2333]">{entry.subject}</span>
                {isWithdrawal && (
                  <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#DCEEFB] text-[#2A6FA8] border border-[#b8dbf7]">
                    Withdrawal Lesson
                  </span>
                )}
              </div>
            </div>

            {entry.teacher && (
              <div className="flex items-center gap-2 text-[13px] text-[#4A5268]">
                <User className="w-4 h-4 text-[#4A5268] shrink-0" />
                <span>Teacher: <strong className="text-[#1C2333]">{entry.teacher}</strong></span>
              </div>
            )}

            {entry.room && (
              <div className="flex items-center gap-2 text-[13px] text-[#4A5268]">
                <MapPin className="w-4 h-4 text-[#4A5268] shrink-0" />
                <span className="font-mono">Room: <strong className="text-[#1C2333]">{entry.room}</strong></span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-[#EAECEF] flex-wrap">
              <Users className="w-4 h-4 text-[#58228C] shrink-0" />
              {activeSupport ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full shadow-xs inline-flex items-center gap-1.5 ${
                      activeSupport.type === 'cover'
                        ? 'bg-[#FEF08A] text-[#B91C1C] border border-[#FACC15]'
                        : activeSupport.type === 'relieved'
                        ? 'bg-[#FEE2E2] text-[#991B1B] line-through decoration-[#DC2626]'
                        : activeSupport.type === 'secondary'
                        ? 'bg-[#4C1D95] text-white'
                        : 'bg-[#58228C] text-white'
                    }`}
                  >
                    <span>{activeSupport.lsa}</span>
                    {activeSupport.type === 'cover' && (
                      <span className="text-[10px] font-bold uppercase">(Cover)</span>
                    )}
                    {activeSupport.type === 'relieved' && (
                      <span className="text-[10px] font-bold uppercase no-underline">(Relieved)</span>
                    )}
                  </span>
                  {activeSupport.type === 'secondary' && (
                    <span className="text-[11px] font-semibold text-purple-800 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-full">
                      Secondary Support
                    </span>
                  )}
                  {activeSupport.type === 'primary' && (
                    <span className="text-[11px] text-[#4A5268]">
                      (Primary Support)
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-[#4A5268] italic">No support staff assigned</span>
              )}
            </div>

            {/* Note or cover remarks */}
            {relatedNotes.length > 0 && (
              <div className="space-y-1.5">
                {relatedNotes.map((rn) => {
                  const isGreen = rn.highlight && rn.highlightColor === 'green';
                  const isBlue = rn.highlight && rn.highlightColor === 'blue';
                  const cardBg = rn.isCover
                    ? 'bg-[#FEF9C3] border-[#FDE047]'
                    : isGreen
                    ? 'bg-[#DCFCE7] border-[#86EFAC]'
                    : isBlue
                    ? 'bg-[#E0F2FE] border-[#7DD3FC]'
                    : rn.highlight
                    ? 'bg-[#FEF9C3] border-[#FDE047]'
                    : 'bg-slate-50 border-slate-200';

                  const titleColor = 'text-[#DC2626]';
                  const textColor = 'text-[#DC2626]';

                  return (
                    <div key={rn.id} className={`p-2.5 rounded border text-xs space-y-1 ${cardBg}`}>
                      <div className={`font-semibold ${titleColor} flex items-center justify-between`}>
                        <span>{rn.isCover ? `Cover: ${rn.coveredBy || 'Cover Staff'}` : 'Note:'}</span>
                        <div className="flex items-center gap-1.5">
                          {rn.highlight && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                isGreen
                                  ? 'bg-[#86EFAC] text-[#DC2626] border-[#22C55E]'
                                  : isBlue
                                  ? 'bg-[#7DD3FC] text-[#DC2626] border-[#0284C7]'
                                  : 'bg-[#FEF08A] text-[#DC2626] border-[#FACC15]'
                              }`}
                            >
                              {isGreen ? 'Bright Green' : isBlue ? 'Sky Blue' : 'Yellow'}
                            </span>
                          )}
                          {rn.bold && (
                            <span className="text-[10px] font-bold text-[#DC2626] bg-red-50 px-1.5 py-0.2 rounded border border-red-200">
                              Bold
                            </span>
                          )}
                          {rn.keepIndefinitely && (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-300 flex items-center gap-0.5" title="Kept indefinitely">
                              <Pin className="w-2.5 h-2.5 text-emerald-700" /> Kept
                            </span>
                          )}
                        </div>
                      </div>
                      {rn.text && <div className={`${textColor} ${rn.bold ? 'font-bold not-italic' : 'italic'}`}>{rn.text}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="py-4">
            <p className="text-xs text-[#4A5268] italic mb-2">Nothing scheduled for this period.</p>
            {activeSupport && (
              <div className="flex items-center gap-2 pt-2 border-t border-[#EAECEF]">
                <Users className="w-4 h-4 text-[#58228C] shrink-0" />
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full shadow-xs inline-flex items-center gap-1.5 ${
                    activeSupport.type === 'cover'
                      ? 'bg-[#FEF08A] text-[#B91C1C] border border-[#FACC15]'
                      : activeSupport.type === 'relieved'
                      ? 'bg-[#FEE2E2] text-[#991B1B] line-through decoration-[#DC2626]'
                      : 'bg-[#58228C] text-white'
                  }`}
                >
                  <span>Support: {activeSupport.lsa}</span>
                  {activeSupport.type === 'cover' && (
                    <span className="text-[10px] font-bold uppercase">(Cover)</span>
                  )}
                </span>
              </div>
            )}
            {relatedNotes.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {relatedNotes.map((rn) => {
                  const isGreen = rn.highlight && rn.highlightColor === 'green';
                  const isBlue = rn.highlight && rn.highlightColor === 'blue';
                  const cardBg = rn.isCover
                    ? 'bg-[#FEF9C3] border-[#FDE047]'
                    : isGreen
                    ? 'bg-[#DCFCE7] border-[#86EFAC]'
                    : isBlue
                    ? 'bg-[#E0F2FE] border-[#7DD3FC]'
                    : rn.highlight
                    ? 'bg-[#FEF9C3] border-[#FDE047]'
                    : 'bg-slate-50 border-slate-200';

                  const titleColor = 'text-[#DC2626]';
                  const textColor = 'text-[#DC2626]';

                  return (
                    <div key={rn.id} className={`p-2 rounded border text-xs space-y-1 ${cardBg}`}>
                      <div className={`font-semibold ${titleColor} flex items-center justify-between`}>
                        <span>{rn.isCover ? `Cover: ${rn.coveredBy || 'Cover Staff'}` : 'Note:'}</span>
                        <div className="flex items-center gap-1.5">
                          {rn.highlight && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                isGreen
                                  ? 'bg-[#86EFAC] text-[#DC2626] border-[#22C55E]'
                                  : isBlue
                                  ? 'bg-[#7DD3FC] text-[#DC2626] border-[#0284C7]'
                                  : 'bg-[#FEF08A] text-[#DC2626] border-[#FACC15]'
                              }`}
                            >
                              {isGreen ? 'Bright Green' : isBlue ? 'Sky Blue' : 'Yellow'}
                            </span>
                          )}
                          {rn.bold && (
                            <span className="text-[10px] font-bold text-[#DC2626] bg-red-50 px-1.5 py-0.2 rounded border border-red-200">
                              Bold
                            </span>
                          )}
                          {rn.keepIndefinitely && (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-300 flex items-center gap-0.5" title="Kept indefinitely">
                              <Pin className="w-2.5 h-2.5 text-emerald-700" /> Kept
                            </span>
                          )}
                        </div>
                      </div>
                      {rn.text && <div className={`${textColor} ${rn.bold ? 'font-bold not-italic' : 'italic'}`}>{rn.text}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between items-center pt-4 mt-4 border-t border-[#EAECEF]">
          {role === 'admin' ? (
            <button
              type="button"
              onClick={handleEditClick}
              className="px-3.5 py-1.5 text-xs font-semibold rounded bg-[#2F6F4E] text-white hover:bg-[#255c40] cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Edit & Assign Staff</span>
            </button>
          ) : (
            <div />
          )}
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
