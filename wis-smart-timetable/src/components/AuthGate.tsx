import React from 'react';
import { useTimetable } from '../context/TimetableContext';

const LOGO_URL = '/assets/aistudio/wistt-favicon.png_58b6a382.png';

export const AuthGate: React.FC = () => {
  const {
    accessStatus,
    authError,
    isSigningIn,
    signIn,
    logout,
  } = useTimetable();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F6F8] px-4 py-10 text-[#1C2333]">
      <div className="w-full max-w-sm bg-white border border-[#DCDFE4] rounded-xl shadow-md p-8 text-center space-y-6">
        {/* Centerpiece Logo */}
        <div className="flex justify-center">
          <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-white p-1.5 shadow-sm border border-[#E2E8F0] flex items-center justify-center">
            <img
              src={LOGO_URL}
              alt="WIS Smart Timetable Logo"
              className="w-full h-full object-contain rounded-full"
            />
          </div>
        </div>

        {accessStatus === 'loading' && (
          <div className="py-2 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#2F6F4E] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {accessStatus === 'unauthenticated' && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-[#1C2333]">
              Sign in with Google to view the timetable.
            </p>

            {authError && (
              <div className="py-2 px-3 rounded-lg bg-[#FBE6E4] border border-[#f5c6cb] text-[#B23A31] text-xs font-semibold">
                {authError}
              </div>
            )}

            <button
              type="button"
              id="btn-google-signin"
              onClick={signIn}
              disabled={isSigningIn}
              className="w-full py-2.5 px-4 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] active:bg-[#F1F5F9] text-[#1C2333] font-semibold text-sm shadow-xs flex items-center justify-center gap-3 cursor-pointer transition-colors disabled:opacity-60"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>{isSigningIn ? 'Signing in…' : 'Sign in with Google'}</span>
            </button>
          </div>
        )}

        {accessStatus === 'pending_registration' && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-[#1C2333] leading-relaxed">
              Welcome, contact your administrator to view the timetable.
            </p>
            <div>
              <button
                type="button"
                id="btn-pending-signout"
                onClick={logout}
                className="text-[11px] text-[#94A3B8] hover:text-[#475569] underline cursor-pointer transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
