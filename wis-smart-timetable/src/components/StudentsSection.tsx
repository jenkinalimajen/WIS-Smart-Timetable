import React, { useState } from 'react';
import { useTimetable } from '../context/TimetableContext';
import { ConfirmModal } from './Modals/ConfirmModal';
import { assignmentsForLsaSlot, slotsFor, DAY_FULL } from '../utils/timetable';
import { GraduationCap, UserPlus, Trash2, Pencil, Check, X, ChevronDown, ChevronUp, UserCheck, Lock, KeyRound, AlertTriangle } from 'lucide-react';

export const StudentsSection: React.FC = () => {
  const { store, role, isAutoAdmin, openAdminLogin, addStudent, renameStudent, removeStudent, setPrimarySupport } = useTimetable();
  const [newStudentName, setNewStudentName] = useState('');
  const [studentToRemove, setStudentToRemove] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  const canEdit = role === 'admin';

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    addStudent(newStudentName);
    setNewStudentName('');
  };

  const startEditing = (student: string) => {
    setEditingStudent(student);
    setEditStudentName(student);
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingStudent(null);
    setEditStudentName('');
    setEditError(null);
  };

  const handleSaveEdit = (originalName: string) => {
    const trimmed = editStudentName.trim();
    if (!trimmed) {
      setEditError('Student name cannot be empty');
      return;
    }
    if (trimmed !== originalName && store.students.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setEditError(`A student named "${trimmed}" already exists`);
      return;
    }
    renameStudent(originalName, trimmed);
    setEditingStudent(null);
    setEditStudentName('');
    setEditError(null);
  };

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <h2 className="text-[17px] font-bold text-[#1C2333] mb-1">Student Roster</h2>
        <p className="text-[13px] text-[#4A5268] leading-relaxed">
          {role === 'admin'
            ? 'Add, edit, or remove students. Renaming a student automatically updates all of their scheduled lessons and staff support assignments.'
            : 'Enrolled students currently scheduled on the timetable. Student roster editing is locked in Staff Mode.'}
        </p>
      </div>

      {role !== 'admin' && (
        <div className="p-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md flex items-center justify-between text-xs text-[#334155] shadow-xs">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#64748B] shrink-0" />
            <div>
              <span className="font-semibold text-[#0F172A]">Student Roster Locked</span>
              <p className="text-[11px] text-[#64748B]">Adding, renaming, and removing students is locked in Staff Mode.</p>
            </div>
          </div>
          {isAutoAdmin && (
            <button
              type="button"
              onClick={openAdminLogin}
              className="text-xs font-semibold px-2.5 py-1 rounded bg-[#2F6F4E] text-white hover:bg-[#255c40] flex items-center gap-1 cursor-pointer transition-colors shadow-xs shrink-0"
            >
              <KeyRound className="w-3 h-3" /> Return to Admin
            </button>
          )}
        </div>
      )}

      <div className="bg-white border border-[#DCDFE4] rounded-md p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-bold text-[#1C2333] flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-[#2F6F4E]" />
            {role === 'admin' ? 'Add a student' : 'Enrolled Students'}
          </h3>
          {role !== 'admin' && (
            <span className="text-[11px] font-semibold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded border border-[#E2E8F0] flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#94A3B8]" /> Locked (Staff Mode)
            </span>
          )}
        </div>

        {role === 'admin' && (
          <form onSubmit={handleAdd} className="flex gap-2 mb-4">
            <input
              id="new-student-name-input"
              type="text"
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              placeholder="Student full name (e.g. Liam Taylor 9B)"
              className="flex-1 text-xs px-3 py-2 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
            />
            <button
              type="submit"
              id="btn-add-student"
              className="px-3.5 py-1.5 text-xs font-semibold rounded bg-[#2F6F4E] text-white hover:bg-[#255c40] flex items-center gap-1 cursor-pointer shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add
            </button>
          </form>
        )}

        <ul className="divide-y divide-[#EAECEF] border-t border-[#EAECEF] pt-1">
          {store.students.length === 0 ? (
            <li className="py-4 text-center text-xs text-[#4A5268] italic">No students registered yet.</li>
          ) : (
            store.students.map((student) => {
              const lessonCount = store.entries.filter((e) => e.student === student).length;
              const isEditing = role === 'admin' && editingStudent === student;

              return (
                <li key={student} className="py-3">
                  {isEditing ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          id={`edit-student-input-${student}`}
                          type="text"
                          value={editStudentName}
                          onChange={(e) => {
                            setEditStudentName(e.target.value);
                            if (editError) setEditError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(student);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          className="flex-1 text-xs px-3 py-1.5 border border-[#2F6F4E] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E] font-medium"
                          autoFocus
                        />
                        <button
                          id={`btn-save-student-${student}`}
                          onClick={() => handleSaveEdit(student)}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded bg-[#2F6F4E] text-white hover:bg-[#255c40] flex items-center gap-1 cursor-pointer shadow-xs"
                          title="Save changes (Enter)"
                        >
                          <Check className="w-3.5 h-3.5" /> Save
                        </button>
                        <button
                          id={`btn-cancel-student-${student}`}
                          onClick={cancelEditing}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] text-[#4A5268] hover:bg-[#F5F6F8] flex items-center gap-1 cursor-pointer"
                          title="Cancel editing (Esc)"
                        >
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      </div>
                      {editError && <div className="text-[11px] text-[#B23A31] font-medium pl-1">{editError}</div>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[13.5px] font-semibold text-[#1C2333]">{student}</span>
                          <span className="ml-2 text-xs text-[#4A5268]">
                            {lessonCount} lesson{lessonCount !== 1 ? 's' : ''} scheduled
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            id={`btn-toggle-support-${student}`}
                            onClick={() => setExpandedStudent(expandedStudent === student ? null : student)}
                            className={`text-xs font-semibold px-2.5 py-1 rounded border flex items-center gap-1 cursor-pointer transition-colors ${
                              expandedStudent === student
                                ? 'bg-[#2F6F4E] text-white border-[#2F6F4E]'
                                : 'bg-[#E4F0EA] text-[#2F6F4E] border-[#c4e0d2] hover:bg-[#d5e9df]'
                            }`}
                            title={`Manage support staff allocation for ${student}`}
                          >
                            <UserCheck className="w-3 h-3" /> Support
                            {expandedStudent === student ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                          {role === 'admin' ? (
                            <>
                              <button
                                id={`btn-edit-student-${student}`}
                                onClick={() => startEditing(student)}
                                className="text-xs font-semibold px-2.5 py-1 rounded border border-[#DCDFE4] text-[#1C2333] hover:bg-[#F5F6F8] flex items-center gap-1 cursor-pointer transition-colors"
                                title={`Edit ${student}'s name`}
                              >
                                <Pencil className="w-3 h-3 text-[#4A5268]" /> Edit
                              </button>
                              <button
                                id={`btn-remove-student-${student}`}
                                onClick={() => setStudentToRemove(student)}
                                className="text-xs font-semibold px-2.5 py-1 rounded border border-[#B23A31] text-[#B23A31] hover:bg-[#FBE6E4] flex items-center gap-1 cursor-pointer transition-colors"
                                title="Remove student and all their timetable entries"
                              >
                                <Trash2 className="w-3 h-3" /> Remove
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={openAdminLogin}
                              className="text-[11.5px] font-medium px-2 py-1 rounded bg-[#F8FAFC] text-[#64748B] hover:text-[#1C2333] border border-[#E2E8F0] hover:border-[#CBD5E1] flex items-center gap-1 transition-colors cursor-pointer"
                              title="Editing locked in Staff Mode. Click to unlock Admin Mode."
                            >
                              <Lock className="w-3 h-3 text-[#94A3B8]" /> Locked
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Support Staff Assignment Box */}
                      {expandedStudent === student && (
                        <div className="p-3.5 bg-[#F9FAFC] border border-[#DCDFE4] rounded-md space-y-3 mt-1 animate-in fade-in duration-100">
                          <div className="flex items-center justify-between border-b border-[#EAECEF] pb-2">
                            <h4 className="text-xs font-bold text-[#1C2333] flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-[#2F6F4E]" />
                              Support Allocation for {student}
                            </h4>
                            <span className="text-[11px] text-[#4A5268]">
                              {canEdit ? 'Changes take effect instantly' : 'View only (Login as admin to change)'}
                            </span>
                          </div>

                          {/* Distinct subjects taken by this student */}
                          {(() => {
                            const studentEntries = store.entries.filter((e) => e.student === student && e.subject);
                            const uniqueSubjects: string[] = Array.from(
                              new Set(studentEntries.map((e) => e.subject.trim()))
                            ).filter((s): s is string => Boolean(s));

                            if (uniqueSubjects.length === 0) {
                              return (
                                <p className="text-xs text-[#4A5268] italic py-1">
                                  No timetable lessons scheduled for {student} yet. Add lessons on the Timetable grid to assign support staff.
                                </p>
                              );
                            }

                            return (
                              <div className="space-y-2">
                                <div className="text-[11.5px] text-[#4A5268]">
                                  Assign default LSA support staff per subject:
                                </div>
                                <div className="space-y-1.5">
                                  {uniqueSubjects.map((subj) => {
                                    const primaryMatch = (store.primarySupport || []).find(
                                      (p) =>
                                        p.student === student &&
                                        p.subject.trim().toLowerCase() === subj.toLowerCase()
                                    );
                                    const currentAssignedLsa = primaryMatch?.lsa || '';
                                    const subjectSlots = studentEntries.filter(
                                      (e) => e.subject.trim().toLowerCase() === subj.toLowerCase()
                                    );

                                    const getStaffConflictsForSubject = (staffName: string) => {
                                      if (!staffName) return [];
                                      const list: string[] = [];
                                      subjectSlots.forEach((e) => {
                                        const overlaps = assignmentsForLsaSlot(
                                          staffName,
                                          e.day,
                                          e.slotId,
                                          store.students,
                                          store.entries,
                                          store.lsaAssignments,
                                          store.primarySupport || []
                                        ).filter((a) => a.student !== student);
                                        if (overlaps.length > 0) {
                                          const sObj = slotsFor(e.day, store.schedule).find((s) => s.id === e.slotId);
                                          list.push(
                                            `${DAY_FULL[e.day]} ${sObj?.label || e.slotId} (${overlaps.map((o) => o.student).join(', ')})`
                                          );
                                        }
                                      });
                                      return list;
                                    };

                                    const activeConflicts = getStaffConflictsForSubject(currentAssignedLsa);

                                    return (
                                      <div
                                        key={subj}
                                        className={`p-2 bg-white rounded border text-xs space-y-1.5 ${
                                          activeConflicts.length > 0 ? 'border-[#f5c6cb] bg-[#FBE6E4]/30' : 'border-[#EAECEF]'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="font-medium text-[#1C2333] truncate">{subj}</div>
                                          {canEdit ? (
                                            <select
                                              id={`select-support-${student}-${subj}`}
                                              value={currentAssignedLsa}
                                              onChange={(e) => setPrimarySupport(student, subj, e.target.value)}
                                              className="text-xs px-2.5 py-1 border border-[#DCDFE4] rounded bg-white font-medium focus:ring-2 focus:ring-[#2F6F4E] cursor-pointer"
                                            >
                                              <option value="">None (Independent)</option>
                                              {store.lsaPool.map((staff) => {
                                                const staffConflicts = getStaffConflictsForSubject(staff.name);
                                                return (
                                                  <option key={staff.id} value={staff.name}>
                                                    {staff.name}
                                                    {staffConflicts.length > 0 ? ` · Conflict (${staffConflicts.length})` : ''}
                                                  </option>
                                                );
                                              })}
                                            </select>
                                          ) : (
                                            <span className="font-medium text-[#4A5268]">
                                              {currentAssignedLsa || 'None'}
                                            </span>
                                          )}
                                        </div>
                                        {activeConflicts.length > 0 && (
                                          <div className="text-[11px] text-[#B23A31] flex items-start gap-1.5 pt-0.5">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                            <span>
                                              <strong>Double-booked:</strong> {activeConflicts.join('; ')}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>

      {studentToRemove && (
        <ConfirmModal
          isOpen={true}
          title="Remove student?"
          sub={studentToRemove}
          message={`This removes ${studentToRemove} and all of their scheduled lessons and staff support assignments.`}
          confirmLabel="Remove Student"
          isDanger={true}
          onConfirm={() => {
            removeStudent(studentToRemove);
            setStudentToRemove(null);
          }}
          onClose={() => setStudentToRemove(null)}
        />
      )}
    </div>
  );
};
