import React, { useState } from 'react';
import { useTimetable } from '../context/TimetableContext';
import { ParsedImportRow } from '../types';
import {
  normalizeDay,
  normalizePeriod,
  normalizeStudentName,
  generateCsvTemplate,
  downloadCSVFile,
  isBreakOrFixedSubject,
} from '../utils/timetable';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { UploadCloud, Link as LinkIcon, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { ConfirmModal } from './Modals/ConfirmModal';

export const ImportSection: React.FC = () => {
  const { store, applyImportRows, forceSyncToCloud } = useTimetable();
  const [sheetUrl, setSheetUrl] = useState('');
  const [previewRows, setPreviewRows] = useState<ParsedImportRow[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [sourceLabel, setSourceLabel] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);

  const handleParsedRows = (rawRows: any[]) => {
    const clean: ParsedImportRow[] = [];
    const errs: string[] = [];

    rawRows.forEach((r, i) => {
      const student = normalizeStudentName(
        r.Student || r.student || r['Student Name'] || r['student name'] || r['Student name'] || ''
      );
      const dayRaw = r.Day || r.day || '';
      const periodRaw =
        r.Period ||
        r.period ||
        r['Lesson Time'] ||
        r['lesson time'] ||
        r['Period Time'] ||
        r['Time'] ||
        r['time'] ||
        '';
      const subject = (r.Subject || r.subject || '').toString().trim();
      const teacher = (r.Teacher || r.teacher || '').toString().trim();
      const room = (
        r.Room ||
        r.room ||
        r['Room Number'] ||
        r['Room number'] ||
        r['room number'] ||
        r['Class Area'] ||
        r['Class area'] ||
        ''
      )
        .toString()
        .trim();
      const lessonTypeRaw = (r['Lesson Type'] || r['lesson type'] || r['Type'] || r['type'] || '')
        .toString()
        .trim()
        .toLowerCase();
      const lessonType = lessonTypeRaw.includes('withdraw') ? 'withdrawal' : 'lesson';

      if (!student || !dayRaw || !periodRaw || !subject) {
        errs.push(`Row ${i + 2}: Missing student, day, period, or subject`);
        return;
      }

      const day = normalizeDay(dayRaw);
      if (!day) {
        errs.push(`Row ${i + 2}: Unrecognised day "${dayRaw}"`);
        return;
      }

      const slotIds = normalizePeriod(day, periodRaw, store.schedule);
      if (!slotIds || slotIds.length === 0) {
        errs.push(`Row ${i + 2}: Unrecognised period "${periodRaw}" for ${day}`);
        return;
      }

      clean.push({
        student,
        day,
        slotIds,
        subject,
        teacher,
        room,
        lessonType,
      });
    });

    // Post-process Friday rows: if a student's last lesson on Friday was mapped to 'brk' (or only 'l3a'/'l3b')
    // because the source sheet used Mon–Thu Break column headers, place it into ['l3a', 'l3b'] when L3 is otherwise empty.
    const friRowsByStudent = new Map<string, ParsedImportRow[]>();
    clean.forEach((r) => {
      if (r.day === 'Fri') {
        const list = friRowsByStudent.get(r.student) || [];
        list.push(r);
        friRowsByStudent.set(r.student, list);
      }
    });

    friRowsByStudent.forEach((studentFriRows) => {
      const hasExplicitL3 = studentFriRows.some(
        (r) =>
          (r.slotIds.includes('l3a') || r.slotIds.includes('l3b')) &&
          !isBreakOrFixedSubject(r.subject)
      );

      if (!hasExplicitL3) {
        studentFriRows.forEach((r) => {
          if (
            (r.slotIds.includes('brk') || r.slotIds.includes('brk1') || r.slotIds.includes('brk2')) &&
            !isBreakOrFixedSubject(r.subject)
          ) {
            r.slotIds = ['l3a', 'l3b'];
          }
        });
      } else {
        // If only l3a or only l3b was populated by a single Br1/Br2 column for a full lesson, expand to ['l3a', 'l3b']
        const l3aRow = studentFriRows.find((r) => r.slotIds.includes('l3a') && !isBreakOrFixedSubject(r.subject));
        const l3bRow = studentFriRows.find((r) => r.slotIds.includes('l3b') && !isBreakOrFixedSubject(r.subject));
        if (l3aRow && !l3bRow) {
          l3aRow.slotIds = Array.from(new Set([...l3aRow.slotIds, 'l3a', 'l3b']));
        } else if (l3bRow && !l3aRow) {
          l3bRow.slotIds = Array.from(new Set([...l3bRow.slotIds, 'l3a', 'l3b']));
        }
      }
    });

    setPreviewRows(clean);
    setErrors(errs);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage(null);
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = evt.target?.result;
          const wb = XLSX.read(data, { type: 'array' });
          const firstSheetName = wb.SheetNames[0];
          const sheet = wb.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          setSourceLabel(`File: ${file.name} (sheet "${firstSheetName}")`);
          handleParsedRows(rows);
        } catch {
          setStatusMessage({
            type: 'err',
            text: 'Could not read that Excel file. Please ensure it has valid headers: Student, Day, Period, Subject, Teacher.',
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          setSourceLabel(`File: ${file.name}`);
          handleParsedRows(res.data);
        },
        error: () => {
          setStatusMessage({ type: 'err', text: 'Could not read CSV file.' });
        },
      });
    }
  };

  const handleFetchGoogleSheet = async () => {
    const url = sheetUrl.trim();
    if (!url) {
      setStatusMessage({ type: 'err', text: 'Please paste a published Google Sheet CSV URL first.' });
      return;
    }

    setIsFetching(true);
    setStatusMessage(null);

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Failed to load sheet');
      const text = await resp.text();
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          setSourceLabel('Published Google Sheet');
          handleParsedRows(res.data);
          setIsFetching(false);
        },
        error: () => {
          setStatusMessage({
            type: 'err',
            text: 'Could not parse response from Google Sheet. Ensure it is published as CSV.',
          });
          setIsFetching(false);
        },
      });
    } catch {
      setStatusMessage({
        type: 'err',
        text: "Couldn't fetch that link. Make sure the Google Sheet is published as CSV (File → Share → Publish to web → CSV), or upload the CSV file directly.",
      });
      setIsFetching(false);
    }
  };

  const handleApply = () => {
    if (!previewRows || previewRows.length === 0) return;
    const count = studentCount;
    const rowCount = previewRows.length;
    applyImportRows(previewRows);
    setPreviewRows(null);
    setShowImportConfirm(false);
    setStatusMessage({
      type: 'ok',
      text: `Timetable overridden! Applied ${rowCount} lesson slots for ${count} students. Syncing to Cloud for all staff…`,
    });
    setTimeout(async () => {
      const synced = await forceSyncToCloud();
      if (synced) {
        setStatusMessage({
          type: 'ok',
          text: `Timetable successfully overridden and synced to the Cloud! All staff opening the share link will immediately see these ${count} students and schedules.`,
        });
      }
    }, 150);
  };

  const handleApplyClick = () => {
    if (!previewRows || previewRows.length === 0) return;
    if (store.entries.length > 0 || store.students.length > 0) {
      setShowImportConfirm(true);
    } else {
      handleApply();
    }
  };

  const handleDownloadTemplate = () => {
    const templateContent = generateCsvTemplate();
    const rows = Papa.parse(templateContent, { header: false }).data as string[][];
    downloadCSVFile('timetable_template.csv', rows);
  };

  const studentCount = previewRows ? new Set(previewRows.map((r) => r.student)).size : 0;

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-[17px] font-bold text-[#1C2333] mb-1">Import Student Timetables</h2>
        <p className="text-[13px] text-[#4A5268] leading-relaxed">
          Upload a CSV/Excel file, or link a published Google Sheet. Review the preview below, then click Override & Import Timetable — importing will completely override previous uploaded data, automatically erasing all student lessons, notes, withdrawals, covers, and the student roster, while preserving the staff roster.
        </p>
      </div>

      <div className="bg-white border border-[#DCDFE4] rounded-md p-5 shadow-xs">
        <h3 className="text-[14px] font-bold text-[#1C2333] mb-3 flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-[#2F6F4E]" />
          1 · Get data in
        </h3>

        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#4A5268] mb-1.5">
              Upload CSV or Excel file (.csv, .xlsx, .xls)
            </label>
            <input
              id="file-upload-input"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#1C2333] file:text-white hover:file:bg-[#2b3348] cursor-pointer"
            />
          </div>

          <div className="text-xs text-[#4A5268] font-semibold pt-4">or</div>

          <div className="flex-1 min-w-[280px]">
            <label className="block text-xs font-semibold text-[#4A5268] mb-1.5 flex items-center gap-1">
              <LinkIcon className="w-3 h-3 text-[#4A5268]" /> Published Google Sheet CSV link
            </label>
            <div className="flex gap-2">
              <input
                id="google-sheet-url-input"
                type="url"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/…/pub?output=csv"
                className="flex-1 text-xs px-3 py-2 border border-[#DCDFE4] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
              />
              <button
                id="fetch-sheet-btn"
                onClick={handleFetchGoogleSheet}
                disabled={isFetching}
                className="px-3.5 py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] bg-white text-[#1C2333] hover:bg-[#F5F6F8] cursor-pointer shrink-0 disabled:opacity-50"
              >
                {isFetching ? 'Fetching…' : 'Fetch sheet'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#EAECEF] text-xs text-[#4A5268] leading-relaxed">
          <p>
            Required columns: <code className="font-mono bg-[#F5F6F8] px-1 py-0.5 rounded border border-[#EAECEF]">Student</code>,{' '}
            <code className="font-mono bg-[#F5F6F8] px-1 py-0.5 rounded border border-[#EAECEF]">Day</code>,{' '}
            <code className="font-mono bg-[#F5F6F8] px-1 py-0.5 rounded border border-[#EAECEF]">Period</code>,{' '}
            <code className="font-mono bg-[#F5F6F8] px-1 py-0.5 rounded border border-[#EAECEF]">Subject</code>,{' '}
            <code className="font-mono bg-[#F5F6F8] px-1 py-0.5 rounded border border-[#EAECEF]">Teacher</code>.
            Optional:{' '}
            <code className="font-mono bg-[#F5F6F8] px-1 py-0.5 rounded border border-[#EAECEF]">Room</code>,{' '}
            <code className="font-mono bg-[#F5F6F8] px-1 py-0.5 rounded border border-[#EAECEF]">Lesson Type</code> (write &quot;Withdrawal&quot; for interventions — anything else defaults to in-class).{' '}
            <button
              onClick={handleDownloadTemplate}
              className="text-[#2F6F4E] font-semibold underline hover:text-[#255c40] cursor-pointer inline-flex items-center gap-1 ml-1"
            >
              <FileSpreadsheet className="w-3 h-3 inline" /> Download a template CSV
            </button>
          </p>
        </div>

        {statusMessage && (
          <div
            className={`mt-3 p-3 rounded text-xs flex items-center gap-2 ${
              statusMessage.type === 'ok'
                ? 'bg-[#E4F0EA] text-[#2F6F4E] border border-[#c3dfd1]'
                : 'bg-[#FBE6E4] text-[#B23A31] border border-[#f5c6cb]'
            }`}
          >
            {statusMessage.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {previewRows && (
        <div className="bg-white border border-[#DCDFE4] rounded-md p-5 shadow-xs">
          <h3 className="text-[14px] font-bold text-[#1C2333] mb-2 flex items-center justify-between">
            <span>2 · Review parsed timetable</span>
            <span className="text-xs font-mono font-normal text-[#4A5268]">
              {sourceLabel} — <strong>{previewRows.length}</strong> rows across <strong>{studentCount}</strong> student(s)
            </span>
          </h3>

          {errors.length > 0 && (
            <div className="bg-[#FBE6E4] text-[#B23A31] text-xs p-2.5 rounded my-2 border border-[#f5c6cb]">
              <strong>{errors.length} row(s) skipped:</strong> {errors.slice(0, 5).join('; ')}
              {errors.length > 5 && '…'}
            </div>
          )}

          <div className="overflow-x-auto border border-[#EAECEF] rounded my-3 max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F5F6F8] text-[#1C2333] sticky top-0 border-b border-[#DCDFE4]">
                <tr>
                  <th className="p-2 border-r border-[#EAECEF]">Student</th>
                  <th className="p-2 border-r border-[#EAECEF]">Day</th>
                  <th className="p-2 border-r border-[#EAECEF]">Period(s)</th>
                  <th className="p-2 border-r border-[#EAECEF]">Subject</th>
                  <th className="p-2 border-r border-[#EAECEF]">Teacher</th>
                  <th className="p-2 border-r border-[#EAECEF]">Room</th>
                  <th className="p-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 25).map((r, idx) => (
                  <tr key={idx} className="border-b border-[#EAECEF] hover:bg-[#F5F6F8]/50">
                    <td className="p-2 font-medium text-[#1C2333] border-r border-[#EAECEF]">{r.student}</td>
                    <td className="p-2 border-r border-[#EAECEF]">{r.day}</td>
                    <td className="p-2 font-mono text-[11px] border-r border-[#EAECEF]">{r.slotIds.join(', ')}</td>
                    <td className="p-2 font-semibold text-[#1C2333] border-r border-[#EAECEF]">{r.subject}</td>
                    <td className="p-2 text-[#4A5268] border-r border-[#EAECEF]">{r.teacher || '—'}</td>
                    <td className="p-2 font-mono text-[11px] text-[#4A5268] border-r border-[#EAECEF]">
                      {r.room || '—'}
                    </td>
                    <td className="p-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10.5px] font-semibold ${
                          r.lessonType === 'withdrawal'
                            ? 'bg-[#DCEEFB] text-[#2A6FA8]'
                            : 'bg-[#E4F0EA] text-[#2F6F4E]'
                        }`}
                      >
                        {r.lessonType === 'withdrawal' ? 'Withdrawal' : 'In-class'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {previewRows.length > 25 && (
            <p className="text-xs text-[#4A5268] italic mb-3">…and {previewRows.length - 25} more rows.</p>
          )}

          <div className="flex items-center gap-3 pt-3 border-t border-[#EAECEF]">
            <button
              id="btn-apply-import"
              onClick={handleApplyClick}
              disabled={previewRows.length === 0}
              className="px-4 py-2 text-xs font-semibold rounded bg-[#2F6F4E] text-white hover:bg-[#255c40] flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <ArrowRight className="w-4 h-4" /> Override & Import Timetable
            </button>
            <span className="text-xs text-[#4A5268]">
              Overrides all previous uploaded data (lessons, notes, withdrawals, covers, student roster). Staff roster is preserved.
            </span>
          </div>
        </div>
      )}

      {showImportConfirm && previewRows && (
        <ConfirmModal
          isOpen={true}
          title="Override all previous timetable data?"
          sub={`${previewRows.length} lesson slots across ${studentCount} student(s)`}
          message="Importing this file will completely override and erase all previous timetable data (including student lessons, notes, withdrawals, covers, and student roster). Only the staff roster will be kept."
          confirmLabel="Override & Import"
          isDanger={true}
          onConfirm={handleApply}
          onClose={() => setShowImportConfirm(false)}
        />
      )}
    </div>
  );
};
