import React, { useState } from 'react';
import { useTimetable } from '../../context/TimetableContext';
import { Lock, ShieldCheck } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose }) => {
  const { store, setAdminPasscode, setRole } = useTimetable();
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const hasPasscode = Boolean(store.settings?.adminPasscode);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!hasPasscode) {
      if (!passcode || passcode.trim().length < 4) {
        setError('Passcode must be at least 4 characters long.');
        return;
      }
      if (passcode !== confirmPasscode) {
        setError('Passcodes do not match.');
        return;
      }
      setAdminPasscode(passcode.trim());
      setRole('admin');
      onClose();
    } else {
      if (passcode === store.settings.adminPasscode) {
        setRole('admin');
        onClose();
      } else {
        setError('Incorrect passcode. Please try again.');
      }
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
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-[#E4F0EA] flex items-center justify-center text-[#2F6F4E]">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="text-[16px] font-bold text-[#1C2333]">Admin Access</h3>
        </div>
        <p className="text-xs text-[#4A5268] font-mono mb-4">
          Enter your department passcode to unlock schedule editing
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#4A5268] mb-1">Passcode</label>
            <input
              id="admin-passcode-input"
              type="password"
              autoFocus={hasPasscode}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode"
              className="w-full text-[13.5px] px-3 py-2 border border-[#DCDFE4] rounded focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
            />
          </div>

          {!hasPasscode && (
            <div>
              <label className="block text-xs font-semibold text-[#4A5268] mb-1">Confirm Passcode</label>
              <input
                id="admin-passcode-confirm"
                type="password"
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                placeholder="Re-enter passcode"
                className="w-full text-[13.5px] px-3 py-2 border border-[#DCDFE4] rounded focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
              />
            </div>
          )}

          {error && (
            <div className="bg-[#FBE6E4] text-[#B23A31] text-xs p-2.5 rounded border border-[#f5c6cb]">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold rounded border border-[#DCDFE4] text-[#1C2333] hover:bg-[#F5F6F8] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded bg-[#2F6F4E] text-white hover:bg-[#255c40] cursor-pointer shadow-xs"
            >
              {hasPasscode ? 'Unlock with Passcode' : 'Set & Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
