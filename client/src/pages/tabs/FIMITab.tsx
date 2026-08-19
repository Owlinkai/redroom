import { useState } from "react";
import { Lock, Shield, AlertTriangle, Eye, Radio, Globe, Info } from "lucide-react";

export default function FIMITab() {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-hidden items-center justify-center p-8" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <div
        className="relative max-w-lg w-full rounded-xl border border-dashed transition-all duration-300 p-8 text-center"
        style={{
          background: hovered
            ? "oklch(from var(--card) l c h / 0.8)"
            : "oklch(from var(--card) l c h / 0.4)",
          borderColor: hovered ? "oklch(from var(--foreground) l c h / 0.25)" : "oklch(from var(--foreground) l c h / 0.12)",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Lock icon */}
        <div
          className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300"
          style={{
            background: hovered ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.06)",
            border: `1px solid ${hovered ? "rgba(239,68,68,0.4)" : "rgba(239,68,68,0.2)"}`,
          }}
        >
          <Lock
            size={28}
            style={{ color: hovered ? "#ef4444" : "#ef444480" }}
            className="transition-all duration-300"
          />
        </div>

        {/* Title */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-xl font-black tracking-widest text-foreground/80">FIMI</span>
          <Lock size={14} className="text-red-500/70" />
        </div>
        <div className="text-[10px] font-bold tracking-widest text-muted-foreground/50 mb-5 uppercase">
          Foreign Information Manipulation & Interference
        </div>

        {/* Hover description */}
        <div
          className="transition-all duration-300 overflow-hidden"
          style={{ maxHeight: hovered ? "400px" : "0px", opacity: hovered ? 1 : 0 }}
        >
          <div className="border-t border-border/40 pt-5 space-y-4 text-left">
            {/* What is FIMI */}
            <div>
              <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Info size={8} /> What is FIMI?
              </div>
              <p className="text-[11px] text-foreground/70 leading-relaxed">
                <strong className="text-foreground/90">Foreign Information Manipulation and Interference (FIMI)</strong> refers to patterns of behaviour that threaten or have the potential to negatively impact values, procedures, and political processes. Such activity is manipulative in character, conducted in an intentional and coordinated manner by foreign state or non-state actors.
              </p>
            </div>

            {/* Key pillars */}
            <div>
              <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Shield size={8} /> Module Scope
              </div>
              <div className="space-y-2">
                {[
                  { icon: Globe, label: "State-sponsored disinformation campaigns", desc: "Attribution, TTPs, and cross-border amplification networks" },
                  { icon: Radio, label: "Coordinated inauthentic behaviour", desc: "Bot networks, sockpuppet farms, and astroturfing operations" },
                  { icon: Eye, label: "Narrative injection & laundering", desc: "How fringe narratives enter mainstream media ecosystems" },
                  { icon: AlertTriangle, label: "Election & democratic process interference", desc: "Voter suppression, candidate smearing, and institutional delegitimisation" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-2 p-2 rounded-md" style={{ background: "oklch(from var(--foreground) l c h / 0.04)" }}>
                    <Icon size={10} className="text-red-400/60 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] font-bold text-foreground/70">{label}</div>
                      <div className="text-[9px] text-muted-foreground/50">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="rounded-md p-3 border border-dashed border-red-500/20" style={{ background: "rgba(239,68,68,0.05)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Lock size={10} className="text-red-400/70" />
                <span className="text-[10px] font-bold text-red-400/80">Under Development</span>
              </div>
              <p className="text-[9px] text-muted-foreground/50 leading-relaxed">
                The FIMI module is currently under active development and classified investigation. It will integrate with the Narratives module, SIGINT feeds, and external threat intelligence databases (EEAS EUDISINFO, DFRLab, Stanford Internet Observatory) to provide a comprehensive FIMI detection and attribution capability. Access will be role-gated upon release.
              </p>
            </div>
          </div>
        </div>

        {/* Static hint when not hovered */}
        {!hovered && (
          <p className="text-[10px] text-muted-foreground/40 mt-2">
            Hover for module description
          </p>
        )}
      </div>

      {/* Classification footer */}
      <div className="mt-6 text-[8px] text-muted-foreground/25 tracking-widest uppercase text-center">
        FIMI MODULE — RESTRICTED ACCESS — UNDER DEVELOPMENT
      </div>
    </div>
  );
}
