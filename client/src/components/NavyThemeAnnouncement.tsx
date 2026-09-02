import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Sparkles, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const ANNOUNCEMENT_KEY = "redroom_navy_theme_announcement_seen";
const DISCLAIMER_KEY = "redroom_disclaimer_accepted";
const ANNOUNCEMENT_DELAY_MS = 120_000;

type Anchor = { top: number; left: number; width: number };

/** One-time, browser-local feature announcement displayed after a user enters Intel. */
export function NavyThemeAnnouncement() {
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  useEffect(() => {
    try {
      if (
        localStorage.getItem(ANNOUNCEMENT_KEY) ||
        localStorage.getItem(DISCLAIMER_KEY) !== "true"
      ) return;
    } catch {
      return;
    }

    const timer = window.setTimeout(() => {
      if (!document.querySelector(".dashboard-header .theme-selector")) return;
      setOpen(true);
    }, ANNOUNCEMENT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const selector = document.querySelector<HTMLElement>(".dashboard-header .theme-selector");
    if (!selector) return;
    const updateAnchor = () => {
      const rect = selector?.getBoundingClientRect();
      if (rect) setAnchor({ top: rect.bottom + 12, left: rect.right - 300, width: rect.width });
    };

    updateAnchor();
    window.addEventListener("resize", updateAnchor);
    document.body.classList.add("navy-theme-announcement-active");
    selector.classList.add("theme-selector--spotlight");
    return () => {
      window.removeEventListener("resize", updateAnchor);
      document.body.classList.remove("navy-theme-announcement-active");
      selector.classList.remove("theme-selector--spotlight");
    };
  }, [open]);

  const dismiss = () => {
    try { localStorage.setItem(ANNOUNCEMENT_KEY, "true"); } catch {}
    setOpen(false);
  };

  if (!open || !anchor) return null;

  const left = Math.max(16, Math.min(anchor.left, window.innerWidth - 316));
  return createPortal(
    <>
      <div className="navy-theme-announcement-scrim" aria-hidden="true" />
      <section
        className="navy-theme-announcement"
        role="dialog"
        aria-modal="false"
        aria-labelledby="navy-theme-announcement-title"
        style={{ top: anchor.top, left }}
      >
        <button className="navy-theme-announcement-close" type="button" onClick={dismiss} aria-label="Dismiss Navy theme announcement">
          <X size={14} />
        </button>
        <div className="navy-theme-announcement-icon"><Sparkles size={16} /></div>
        <div className="navy-theme-announcement-copy">
          <p className="navy-theme-announcement-eyebrow">NEW INTERFACE</p>
          <h2 id="navy-theme-announcement-title">Navy Theme added</h2>
          <p>New Navy Theme was added. Try it now.</p>
        </div>
        <div className="navy-theme-announcement-actions">
          <button type="button" className="navy-theme-announcement-primary" onClick={() => { setTheme?.("navy"); dismiss(); }}>
            <Check size={13} /> Try Navy
          </button>
          <button type="button" className="navy-theme-announcement-later" onClick={dismiss}>Later</button>
        </div>
      </section>
    </>,
    document.body,
  );
}
