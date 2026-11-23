import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  sub?: string;
  message: string;
  confirmLabel: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  sub,
  message,
  confirmLabel,
  isDanger = true,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-[#141620]/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg w-full max-w-sm p-6 shadow-xl border border-[#DCDFE4]">
        <div className="flex items-center gap-2 mb-1">
          {isDanger && (
            <div className="w-8 h-8 rounded-full bg-[#FBE6E4] flex items-center justify-center text-[#B23A31] shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
          )}
          <div>
            <h3 className="text-[16px] font-bold text-[#1C2333] m-0">{title}</h3>
            {sub && <div className="text-xs text-[#4A5268] font-mono mt-0.5">{sub}</div>}
          </div>
        </div>

        <p className="text-[13px] text-[#4A5268] leading-relaxed my-4">{message}</p>

        <div className="flex justify-end gap-2 pt-2 border-t border-[#EAECEF]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold rounded border border-[#DCDFE4] text-[#1C2333] hover:bg-[#F5F6F8] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-1.5 text-xs font-semibold rounded text-white cursor-pointer shadow-xs ${
              isDanger ? 'bg-[#B23A31] hover:bg-[#972f27]' : 'bg-[#2F6F4E] hover:bg-[#255c40]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
