/**
 * AdminRequired — Overlay shown when a user attempts an admin-only operation.
 * Styled to match Redroom aesthetic.
 */

import { X, ShieldAlert, Lock } from "lucide-react";

interface AdminRequiredProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin?: () => void;
  featureName?: string;
}

export function AdminRequired({ isOpen, onClose, onLogin, featureName }: AdminRequiredProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-sm mx-4 bg-[#0a0a0f] border border-amber-900/50 rounded-lg shadow-2xl shadow-amber-900/20 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-amber-900/30">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-900/30 border border-amber-700/50 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-amber-200 tracking-wide font-mono">
                RESTRICTED
              </h2>
              <p className="text-xs text-gray-500 font-mono">ADMINISTRATOR ACCESS REQUIRED</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-950/20 border border-amber-900/30 rounded">
            <Lock className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-300 font-mono leading-relaxed">
              {featureName ? (
                <>
                  <span className="text-amber-300 font-bold">{featureName}</span> requires
                  administrator privileges.
                </>
              ) : (
                <>This operation requires administrator privileges.</>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500 font-mono leading-relaxed">
            This is a protected operation that modifies platform data. If you are the platform
            operator, sign in with your admin account. Otherwise, you can clone the{" "}
            <a
              href="https://github.com/Owlinkai/redroom"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline"
            >
              open-source repository
            </a>{" "}
            and run your own instance with full access.
          </p>

          <div className="flex gap-3">
            {onLogin && (
              <button
                onClick={() => { onClose(); onLogin(); }}
                className="flex-1 py-2.5 bg-red-900/50 hover:bg-red-800/60 border border-red-700/50 rounded text-white font-mono text-xs font-bold tracking-wider uppercase transition-all"
              >
                SIGN IN AS ADMIN
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 rounded text-gray-300 font-mono text-xs font-bold tracking-wider uppercase transition-all"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
