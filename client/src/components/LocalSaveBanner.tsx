/**
 * LocalSaveBanner — Subtle notification shown when data is saved to browser storage.
 * Informs anonymous users that their data is local and offers registration to sync.
 */

import { HardDrive, X } from "lucide-react";
import { useState } from "react";

interface LocalSaveBannerProps {
  onRegister?: () => void;
}

export function LocalSaveBanner({ onRegister }: LocalSaveBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9000] max-w-xs bg-[#0f0f18] border border-cyan-900/50 rounded-lg shadow-lg shadow-cyan-900/10 p-3 animate-in slide-in-from-bottom-2 duration-300">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-gray-600 hover:text-gray-400"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded bg-cyan-900/30 border border-cyan-800/40 flex items-center justify-center flex-shrink-0">
          <HardDrive className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <p className="text-xs font-mono text-cyan-200 font-bold">SAVED LOCALLY</p>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5 leading-relaxed">
            Data stored in your browser. Create an account to sync across devices.
          </p>
          {onRegister && (
            <button
              onClick={onRegister}
              className="mt-2 text-[10px] font-mono text-red-400 hover:text-red-300 underline underline-offset-2"
            >
              Create free account →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
