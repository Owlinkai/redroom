import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Moon, Sun, Waves } from "lucide-react";
import { type Theme, useTheme } from "@/contexts/ThemeContext";

const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun; description: string }> = [
  { value: "light", label: "Light", icon: Sun, description: "Layered neutral workspace" },
  { value: "navy", label: "Navy", icon: Waves, description: "Blue operational interface" },
  { value: "dark", label: "Dark", icon: Moon, description: "Low-light intelligence view" },
];

interface ThemeSelectorProps {
  compact?: boolean;
  className?: string;
}

/** Shared global theme control used consistently across every Redroom portal. */
export function ThemeSelector({ compact = false, className = "" }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = OPTIONS.find((option) => option.value === theme) ?? OPTIONS[0];
  const ActiveIcon = active.icon;

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  return (
    <div ref={rootRef} className={`theme-selector ${compact ? "is-compact" : ""} ${className}`}>
      <button
        type="button"
        className="theme-selector-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-label={`Theme: ${active.label}. Open theme selector`}
        aria-expanded={open}
        aria-haspopup="menu"
        title={`Theme: ${active.label}`}
      >
        <ActiveIcon size={13} aria-hidden="true" />
        <span className="theme-selector-label">{active.label}</span>
        <ChevronDown size={11} aria-hidden="true" className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <div className="theme-selector-menu" role="menu" aria-label="Select application theme">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = option.value === theme;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={`theme-selector-option ${selected ? "is-selected" : ""}`}
                onClick={() => {
                  setTheme?.(option.value);
                  setOpen(false);
                }}
              >
                <Icon size={13} aria-hidden="true" />
                <span className="theme-selector-option-copy">
                  <span>{option.label}</span>
                  <small>{option.description}</small>
                </span>
                {selected && <Check size={13} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
