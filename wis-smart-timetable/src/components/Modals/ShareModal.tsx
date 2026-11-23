import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Compute public shared application URL (ais-pre-)
  const currentOrigin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://ais-dev-lqnvyxag3womdesdcqiwbv-873796930200.europe-west2.run.app';
  
  // ais-pre- is the standalone shared app URL; ais-dev- is the private AI Studio development container
  const publicOrigin = currentOrigin.includes('ais-dev-')
    ? currentOrigin.replace('ais-dev-', 'ais-pre-')
    : currentOrigin;

  // Staff link with explicit mode=staff parameter
  const staffLink = `${publicOrigin}?mode=staff`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(staffLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const input = document.getElementById('staff-share-url-input') as HTMLInputElement;
      if (input) {
        input.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
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
      <div className="bg-white rounded-lg w-full max-w-md p-5 shadow-xl border border-[#DCDFE4]">
        {/* Header */}
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-[15px] font-bold text-[#1C2333]">Share Staff Link</h3>
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#1C2333] p-1 rounded hover:bg-[#F5F6F8] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Link Input & Copy */}
        <div className="space-y-1.5 mb-3.5">
          <div className="flex items-center gap-2">
            <input
              id="staff-share-url-input"
              type="text"
              readOnly
              value={staffLink}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 text-xs px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded text-[#1C2333] font-mono select-all focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 text-xs font-semibold rounded bg-[#2F6F4E] hover:bg-[#255c40] text-white cursor-pointer shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          {copied && (
            <p className="text-[11.5px] font-medium text-[#15803D]">
              ✓ Link copied to clipboard
            </p>
          )}
        </div>

        {/* Minimal Instructions */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-3 mb-4 text-[12px] text-[#475569] space-y-1.5 leading-relaxed">
          <p className="flex items-start gap-1.5 text-[#1C2333]">
            <span className="text-[#2F6F4E] font-bold">✓</span>
            <span>Opens directly in view-only <strong>Staff Mode</strong> (editing is locked).</span>
          </p>
          <p className="flex items-start gap-1.5 text-[#92400E]">
            <span className="font-bold">⚠️</span>
            <span>Set <strong>General Access</strong> to <strong>&ldquo;Anyone with the link&rdquo;</strong> in AI Studio&apos;s top Share menu so staff can open it.</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#EAECEF]">
          <a
            href={staffLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-[#2F6F4E] hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open link in new tab</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
