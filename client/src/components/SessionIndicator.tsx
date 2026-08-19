/**
 * SessionIndicator — Floating auth badge that shows session status.
 * Appears in the top-right of the platform for authenticated users.
 * When clicked, shows session time remaining and de-authenticate option.
 */
import { useState, useEffect, useCallback } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Shield, Clock, LogOut, X, RefreshCw } from "lucide-react";

export default function SessionIndicator() {
  const { user, isAnalyst, logout } = useAuthContext();
  const [expanded, setExpanded] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");

  // Get session info
  const { data: session, refetch: refetchSession } = trpc.cms.getUserSession.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 60000, // refresh every minute
  });

  // Create session on first auth if none exists
  const createSession = trpc.cms.createUserSession.useMutation({
    onSuccess: () => refetchSession(),
  });

  // Extend session (heartbeat)
  const extendSession = trpc.cms.extendSession.useMutation({
    onSuccess: () => refetchSession(),
  });

  // Deauthenticate
  const deauth = trpc.cms.deauthenticate.useMutation({
    onSuccess: () => {
      logout();
    },
  });

  // Create session if authenticated but no active session
  useEffect(() => {
    if (user && session === null && !createSession.isPending) {
      createSession.mutate({ durationMinutes: 180 });
    }
  }, [user, session]);

  // Update countdown timer
  useEffect(() => {
    if (!session?.expiresAt) {
      setTimeLeft("");
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const expires = new Date(session.expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft("EXPIRED");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session?.expiresAt]);

  // Don't render if not authenticated
  if (!isAnalyst || !user) return null;

  // Determine status color
  const getStatusColor = () => {
    if (!session?.expiresAt) return "#4ade80"; // green = active
    const diff = new Date(session.expiresAt).getTime() - Date.now();
    if (diff <= 0) return "#ef4444"; // red = expired
    if (diff < 15 * 60 * 1000) return "#f59e0b"; // amber = <15 min
    return "#4ade80"; // green = healthy
  };

  const statusColor = getStatusColor();

  return (
    <>
      {/* Floating Badge */}
      <button
        onClick={() => setExpanded(!expanded)}
        title="Session Status"
        className="fixed bottom-20 right-6 z-[9989] flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all hover:scale-105"
        style={{
          background: "rgba(10,15,30,0.92)",
          border: `1px solid ${statusColor}55`,
          boxShadow: `0 0 12px ${statusColor}33`,
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: statusColor,
            boxShadow: `0 0 6px ${statusColor}`,
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
        <Shield size={12} style={{ color: statusColor }} />
        <span
          className="text-[10px] font-mono font-bold tracking-wider"
          style={{ color: statusColor }}
        >
          AUTH
        </span>
      </button>

      {/* Expanded Panel */}
      {expanded && (
        <>
          <div className="fixed inset-0 z-[9988]" onClick={() => setExpanded(false)} />
          <div
            className="fixed bottom-36 right-6 z-[9989] w-72 rounded-lg overflow-hidden"
            style={{
              background: "rgba(10,12,20,0.97)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              backdropFilter: "blur(12px)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2">
                <Shield size={14} style={{ color: statusColor }} />
                <span className="text-xs font-mono font-bold tracking-wider" style={{ color: statusColor }}>
                  SESSION ACTIVE
                </span>
              </div>
              <button onClick={() => setExpanded(false)} className="text-gray-500 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>

            {/* Session Info */}
            <div className="px-4 py-3 space-y-3">
              {/* User */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-900/50 to-gray-900 border border-red-800/30 flex items-center justify-center">
                  <span className="text-[10px] font-mono font-bold text-red-400">
                    {(user.name || user.email || "U").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-mono text-white">{user.name || user.email}</div>
                  <div className="text-[10px] font-mono text-gray-500 uppercase">{user.role}</div>
                </div>
              </div>

              {/* Time Remaining */}
              <div className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <Clock size={12} style={{ color: statusColor }} />
                <div className="flex-1">
                  <div className="text-[10px] font-mono text-gray-500 uppercase">Time Remaining</div>
                  <div className="text-sm font-mono font-bold" style={{ color: statusColor }}>
                    {timeLeft || "Calculating..."}
                  </div>
                </div>
                <button
                  onClick={() => extendSession.mutate()}
                  disabled={extendSession.isPending}
                  className="p-1.5 rounded hover:bg-white/5 transition-colors"
                  title="Extend session"
                >
                  <RefreshCw size={12} className={`text-gray-400 hover:text-green-400 ${extendSession.isPending ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* Session Duration */}
              {session?.sessionDurationMinutes && (
                <div className="text-[10px] font-mono text-gray-600 px-1">
                  Session duration: {session.sessionDurationMinutes} minutes
                </div>
              )}

              {/* De-authenticate Button */}
              <button
                onClick={() => {
                  if (confirm("De-authenticate? You will return to public access only.")) {
                    deauth.mutate();
                  }
                }}
                disabled={deauth.isPending}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded text-xs font-mono uppercase tracking-wider transition-all"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#ef4444",
                }}
              >
                <LogOut size={12} />
                {deauth.isPending ? "DE-AUTHENTICATING..." : "DE-AUTHENTICATE"}
              </button>
              <p className="text-[9px] font-mono text-gray-600 text-center">
                Returns you to public access. No data is lost.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
