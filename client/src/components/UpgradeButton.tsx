import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";

type Portal = "intel" | "orbit" | "sigint" | "contribute";

interface UpgradeButtonProps {
  portal: Portal;
  /** compact = icon + text, icon-only = just the star */
  variant?: "compact" | "icon-only";
  className?: string;
}

const PREMIUM_FEATURES = [
  { icon: "🛰️", label: "Air-Gapped Deployment", desc: "Fully isolated sovereign instance" },
  { icon: "⚡", label: "Real-Time SIGINT Feed", desc: "Live signals intelligence stream" },
  { icon: "🔗", label: "C4ISR Integration", desc: "Direct command & control wiring" },
  { icon: "🧠", label: "Custom AI Models", desc: "Fine-tuned on your threat landscape" },
  { icon: "🔒", label: "SLA & 24/7 Support", desc: "Dedicated analyst support channel" },
  { icon: "📡", label: "Custom Source Expansion", desc: "Proprietary & classified feeds" },
];

export function UpgradeButton({ portal, variant = "compact", className = "" }: UpgradeButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackClick = trpc.upgrade.trackClick.useMutation();

  // Cleanup timer on unmount
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  const handleMouseEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(true), 120);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(false), 200);
  };

  const handleClick = () => {
    setClicked(true);
    setTimeout(() => setClicked(false), 600);
    // Fire-and-forget click tracking
    trackClick.mutate({
      portal,
      referrer: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
    // Open the upgrade page
    window.open("https://owlink.ai/redroom", "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── The button itself ── */}
      <button
        onClick={handleClick}
        title="Upgrade to Enterprise — owlink.ai/redroom"
        className="relative flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[10px] border transition-all duration-200 overflow-hidden select-none"
        style={{
          background: clicked
            ? "rgba(180,130,20,0.35)"
            : hovered
            ? "rgba(180,130,20,0.22)"
            : "rgba(180,130,20,0.12)",
          borderColor: hovered ? "rgba(251,191,36,0.90)" : "rgba(251,191,36,0.55)",
          color: hovered ? "rgba(253,224,71,1)" : "rgba(251,191,36,0.95)",
          boxShadow: hovered
            ? "0 0 14px rgba(251,191,36,0.50), 0 0 5px rgba(251,191,36,0.30)"
            : "0 0 7px rgba(251,191,36,0.18)",
          transform: clicked ? "scale(0.95)" : hovered ? "scale(1.04)" : "scale(1)",
          textDecoration: "none",
        }}
      >
        {/* Animated shimmer sweep */}
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)",
            backgroundSize: "200% 100%",
            animation: "upgradeShimmer 2.4s ease-in-out infinite",
            opacity: hovered ? 1 : 0.5,
            transition: "opacity 0.3s",
          }}
        />
        {/* Star icon */}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        {variant === "compact" && (
          <span className="hidden sm:inline tracking-widest">UPGRADE</span>
        )}
      </button>

      {/* ── Hover preview card ── */}
      {hovered && (
        <div
          className="absolute z-[9999] right-0 top-full mt-2 w-72 rounded-xl border overflow-hidden"
          style={{
            background: "rgba(8,4,4,0.97)",
            borderColor: "rgba(251,191,36,0.40)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 30px rgba(251,191,36,0.15)",
            backdropFilter: "blur(12px)",
            animation: "upgradeCardIn 0.18s ease-out",
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Card header */}
          <div
            className="px-4 py-3 border-b"
            style={{
              borderColor: "rgba(220,38,38,0.25)",
              background: "linear-gradient(135deg, rgba(180,130,20,0.20) 0%, rgba(0,0,0,0) 100%)",
            }}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(251,191,36,1)" stroke="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="font-mono text-[11px] font-bold tracking-widest" style={{ color: "rgba(251,191,36,1)" }}>
                ENTERPRISE ACCESS
              </span>
            </div>
            <p className="font-mono text-[10px]" style={{ color: "rgba(156,163,175,0.8)" }}>
              Unlock the full intelligence stack — owlink.ai/redroom
            </p>
          </div>

          {/* Features list */}
          <div className="px-4 py-3 space-y-2">
            {PREMIUM_FEATURES.map((f) => (
              <div key={f.label} className="flex items-start gap-2.5">
                <span className="text-[13px] flex-shrink-0 mt-px">{f.icon}</span>
                <div>
                  <div className="font-mono text-[10px] font-semibold tracking-wide" style={{ color: "rgba(229,231,235,0.95)" }}>
                    {f.label}
                  </div>
                  <div className="font-mono text-[9px]" style={{ color: "rgba(107,114,128,0.9)" }}>
                    {f.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div
            className="px-4 py-3 border-t"
            style={{ borderColor: "rgba(220,38,38,0.20)" }}
          >
            <div
              className="w-full text-center font-mono text-[10px] font-bold tracking-widest py-2 rounded-lg cursor-pointer transition-all"
            style={{
              background: "linear-gradient(135deg, rgba(180,130,20,0.90) 0%, rgba(133,100,10,0.95) 100%)",
              color: "rgba(253,224,71,1)",
              boxShadow: "0 4px 12px rgba(251,191,36,0.35)",
            }}
              onClick={handleClick}
            >
              GET ENTERPRISE ACCESS →
            </div>
            <p className="text-center font-mono text-[9px] mt-1.5" style={{ color: "rgba(107,114,128,0.7)" }}>
              Universities &amp; Research Centers — free
            </p>
          </div>
        </div>
      )}

      {/* ── Keyframe styles injected once ── */}
      <style>{`
        @keyframes upgradeShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes upgradeCardIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}
