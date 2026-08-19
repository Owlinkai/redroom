/**
 * AuthGate — wraps any write-gated feature.
 *
 * When the user is NOT authenticated:
 *   - Shows the children with a semi-transparent overlay
 *   - On hover: reveals a lock icon + "Authorised users only" message + "Request Access" CTA
 *   - Clicking anywhere on the overlay opens the WaitingListModal
 *
 * When the user IS authenticated: renders children as-is.
 */
import { useState } from "react";
import { Lock } from "lucide-react";
import { WaitingListModal } from "./WaitingListModal";

interface AuthGateProps {
  /** Whether the current user is authenticated/authorised */
  isAuthorised: boolean;
  /** Content to gate */
  children: React.ReactNode;
  /** Optional label shown in the lock overlay (default: "Authorised users only") */
  label?: string;
  /** Optional sub-label (default: "Registration coming soon") */
  sublabel?: string;
  /** If true, render as inline (span) rather than block (div) */
  inline?: boolean;
  /** Extra className on the wrapper */
  className?: string;
}

export function AuthGate({
  isAuthorised,
  children,
  label = "Only authorised users can use this feature.",
  sublabel = "Registration is coming soon.",
  inline = false,
  className = "",
}: AuthGateProps) {
  const [hovered, setHovered] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  if (isAuthorised) {
    return <>{children}</>;
  }

  const Tag = inline ? "span" : "div";

  return (
    <>
      <Tag
        className={`relative select-none ${className}`}
        style={{ display: inline ? "inline-block" : "block" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setModalOpen(true)}
      >
        {/* Children rendered but visually dimmed */}
        <Tag
          style={{
            pointerEvents: "none",
            opacity: hovered ? 0.25 : 0.45,
            transition: "opacity 0.2s",
            display: inline ? "inline-block" : "block",
          }}
        >
          {children}
        </Tag>

        {/* Lock overlay — always present, fully visible on hover */}
        <Tag
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            cursor: "pointer",
            opacity: hovered ? 1 : 0,
            transition: "opacity 0.2s",
            background: hovered
              ? "linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(10,15,26,0.85) 100%)"
              : "transparent",
            borderRadius: "6px",
            border: hovered ? "1px solid rgba(0,200,255,0.25)" : "none",
            backdropFilter: hovered ? "blur(2px)" : "none",
            padding: "12px",
            zIndex: 10,
          }}
        >
          <Lock
            style={{
              width: "20px",
              height: "20px",
              color: "rgba(0,200,255,0.8)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "rgba(255,255,255,0.85)",
              textAlign: "center",
              letterSpacing: "0.02em",
              lineHeight: 1.4,
            }}
          >
            {label}
          </span>
          {sublabel && (
            <span
              style={{
                fontSize: "10px",
                color: "rgba(255,255,255,0.45)",
                textAlign: "center",
              }}
            >
              {sublabel}
            </span>
          )}
          <span
            style={{
              marginTop: "4px",
              fontSize: "10px",
              fontWeight: 600,
              color: "rgba(0,200,255,0.85)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "3px 10px",
              borderRadius: "4px",
              background: "rgba(0,200,255,0.12)",
              border: "1px solid rgba(0,200,255,0.3)",
            }}
          >
            Join Waiting List →
          </span>
        </Tag>
      </Tag>

      <WaitingListModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

/**
 * AuthLockButton — a simple locked button variant.
 * Shows the lock icon + label, opens WaitingListModal on click.
 */
export function AuthLockButton({
  label = "Only authorised users can use this feature.",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={`flex items-center gap-2 px-4 py-2 rounded border transition-all group ${className}`}
        style={{
          background: "rgba(0,200,255,0.04)",
          borderColor: "rgba(0,200,255,0.2)",
          color: "rgba(0,200,255,0.6)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(0,200,255,0.1)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,200,255,0.4)";
          (e.currentTarget as HTMLElement).style.color = "rgba(0,200,255,0.9)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(0,200,255,0.04)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,200,255,0.2)";
          (e.currentTarget as HTMLElement).style.color = "rgba(0,200,255,0.6)";
        }}
      >
        <Lock className="w-3.5 h-3.5 shrink-0" />
        <span className="text-xs font-medium">{label}</span>
      </button>
      <WaitingListModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
