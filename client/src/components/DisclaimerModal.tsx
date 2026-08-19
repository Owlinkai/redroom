import { useState, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { WaitingListModal } from "./WaitingListModal";
import { UpgradeButton } from "./UpgradeButton";

const DISCLAIMER_KEY = "redroom_disclaimer_accepted";
const LAST_REMINDER_KEY = "redroom_last_reminder";
const REMINDER_INTERVAL_KEY = "redroom_reminder_interval";
const DEFAULT_REMINDER_MS = 30 * 60 * 1000; // 30 minutes

type Tab = "howto" | "disclaimer" | "contribute" | "enroll";

// ─── Default values used when CMS has no override ────────────────────────────
const DEFAULTS: Record<string, string> = {
  // ── Floating button ──────────────────────────────────────────────────────
  "disclaimer.visible": "true",
  "disclaimer.button.tooltip": "Responsible Use Agreement",

  // ── Header ───────────────────────────────────────────────────────────────
  "disclaimer.header.title": "REDROOM",
  "disclaimer.header.subtitle": "OPEN SOURCE INTELLIGENCE PLATFORM — RESPONSIBLE USE AGREEMENT",
  "disclaimer.footer.version": "REDROOM V2.4 · OWLINK.AI · OPEN SOURCE · MIT LICENSE · © ALEXSAI",

  // ── Tab labels & visibility ───────────────────────────────────────────────
  "disclaimer.tab.howto.visible": "true",
  "disclaimer.tab.howto.label": "📖 HOW TO USE",
  "disclaimer.tab.disclaimer.visible": "true",
  "disclaimer.tab.disclaimer.label": "⚠ DISCLAIMER & TERMS",
  "disclaimer.tab.contribute.visible": "true",
  "disclaimer.tab.contribute.label": "🤝 CONTRIBUTE",
  "disclaimer.tab.enroll.visible": "true",
  "disclaimer.tab.enroll.label": "🎓 ENROLL",

  // ── HOW TO USE tab ────────────────────────────────────────────────────────
  "howto.intro": "Redroom is designed as a professional OSINT research workstation — a single platform that aggregates publicly available global intelligence signals for analysts, journalists, and researchers.",

  // SIGINT Map section
  "howto.sigint.title": "SIGINT Map Portal",
  "howto.sigint.icon": "🌍",
  "howto.sigint.tips": JSON.stringify([
    "Enable layers selectively to avoid information overload",
    "Use the country filter (F) to focus on a specific region",
    "Draw a polygon to isolate a geographic area of interest",
    "Click any marker to access detailed intelligence including route data, vessel metadata, and camera feeds",
    "Use Surveillance Mode (SVM) to monitor up to 10 specific items simultaneously",
  ]),
  "howto.sigint.signals": JSON.stringify([
    { label: "✈ Live Aircraft", count: "10,000+" },
    { label: "🚢 AIS Vessels", count: "15,000+" },
    { label: "📷 CCTV Cameras", count: "12,000+" },
    { label: "🌋 Seismic Events", count: "USGS M2.5+" },
    { label: "🔥 Active Fires", count: "NASA FIRMS" },
    { label: "⛈ Weather Events", count: "NASA EONET" },
  ]),

  // Orbit section
  "howto.orbit.title": "Orbit Portal (Space Intelligence)",
  "howto.orbit.icon": "📡",
  "howto.orbit.body": "The Orbit portal provides real-time satellite tracking, orbital mechanics visualization, and space weather monitoring. Track active satellites, predict passes over specific locations, and monitor solar weather events that may affect communications infrastructure.",
  "howto.orbit.tips": JSON.stringify([
    "Use for monitoring satellite constellations relevant to your research area",
    "Track ISS and other research platforms for academic purposes",
    "Click any launch site or ground station to see all linked satellites",
    "Monitor solar weather for communications infrastructure research",
    "Correlate satellite passes with ground events for investigative research",
  ]),

  // Main Intel Portal section
  "howto.intel.title": "Main Intelligence Portal",
  "howto.intel.icon": "🗞️",
  "howto.intel.body": "The main portal aggregates geopolitical news from 100+ global sources, performs entity extraction, sentiment analysis, and relationship mapping. Use it to track narratives, identify information patterns, and build evidence-based research reports.",
  "howto.intel.tips": JSON.stringify([
    "Use the Compare tab to analyze how different sources cover the same event",
    "Use the Explore tab to map relationships between entities, organizations, and events",
    "Save investigations for longitudinal research and pattern tracking",
    "Cross-reference news events with SIGINT map data for multi-domain analysis",
  ]),

  // Use Cases section
  "howto.usecases.title": "Recommended Use Cases",
  "howto.usecases.icon": "🔬",
  "howto.usecases.items": JSON.stringify([
    { role: "Investigative Journalist", use: "Track vessel movements near conflict zones, correlate flight patterns with news events, verify claims using open data" },
    { role: "Academic Researcher", use: "Study geopolitical patterns, analyze media bias across sources, research conflict dynamics using real-time data" },
    { role: "OSINT Analyst", use: "Multi-domain correlation, entity relationship mapping, pattern-of-life analysis using only public sources" },
    { role: "Policy Researcher", use: "Monitor global events, track humanitarian crises, analyze regional stability indicators" },
    { role: "Security Researcher", use: "Study publicly visible infrastructure, analyze open-source threat intelligence, defensive research only" },
    { role: "Educator", use: "Demonstrate real-world data aggregation, teach open-source research methodology, illustrate geopolitical concepts" },
  ]),

  // Ethical OSINT section
  "howto.ethics.title": "Ethical OSINT Principles",
  "howto.ethics.icon": "⚠️",
  "howto.ethics.items": JSON.stringify([
    "Minimize harm: only collect and analyze data necessary for your stated research purpose",
    "Verify before publishing: independently confirm all findings before sharing publicly",
    "Protect privacy: avoid identifying or exposing private individuals even if data is technically public",
    "Transparent methodology: document your data sources and analytical methods",
    "Respect legal boundaries: understand the laws of your jurisdiction regarding data collection and use",
    "Secure your research: protect sensitive findings and sources from unauthorized access",
  ]),

  // ── DISCLAIMER & TERMS tab ────────────────────────────────────────────────
  "disclaimer.intro": "REDROOM is a fully open-source intelligence (OSINT) research platform developed for lawful, ethical, and academic purposes only. By accessing this platform, you acknowledge and agree to the following terms in their entirety.",
  "disclaimer.s1.title": "§1 — OPEN SOURCE DECLARATION",
  "disclaimer.s1.body": "This platform and all its components, source code, data pipelines, and visualizations are fully open source and publicly available for review. The project is developed with complete transparency and has no affiliation with any government, intelligence agency, military organization, or commercial surveillance entity. The platform aggregates only publicly available data from open sources.",
  "disclaimer.s2.title": "§2 — PERMITTED USES",
  "disclaimer.s2.items": JSON.stringify([
    "Academic and scientific research in geopolitics, international relations, and conflict studies",
    "Investigative journalism and fact-checking using publicly available data",
    "OSINT (Open Source Intelligence) training and methodology development",
    "Non-profit humanitarian monitoring and crisis awareness",
    "Educational demonstrations of publicly available data aggregation techniques",
    "Security research and vulnerability awareness (defensive purposes only)",
    "Policy analysis and think-tank research",
  ]),
  "disclaimer.s3.title": "§3 — STRICTLY PROHIBITED USES",
  "disclaimer.s3.items": JSON.stringify([
    "Any activity that causes physical, psychological, financial, or reputational harm to individuals, groups, or organizations",
    "Unauthorized surveillance, stalking, tracking, or monitoring of private individuals without their consent",
    "Hacking, unauthorized system access, cyberattacks, or any form of digital intrusion",
    "Facilitating, planning, or executing acts of terrorism, extremism, or political violence",
    "Targeted harassment, doxxing, or coordinated abuse campaigns against any person or group",
    "Disinformation campaigns, propaganda creation, or manipulation of public opinion",
    "Violation of any applicable local, national, or international law or regulation",
    "Commercial surveillance, profiling, or data brokerage activities",
    "Any use that violates the privacy rights of individuals under GDPR, CCPA, or equivalent legislation",
    "Military targeting, weapons development, or offensive intelligence operations",
    "Discrimination based on race, religion, gender, nationality, sexual orientation, or any protected characteristic",
  ]),
  "disclaimer.s4.title": "§4 — DATA SOURCES & ACCURACY",
  "disclaimer.s4.body": "All data displayed on this platform is sourced from publicly available APIs and open datasets (adsb.lol, aisstream.io, USGS, NASA FIRMS, NASA EONET, and others). The platform makes no guarantee of data accuracy, completeness, or timeliness. Data must not be used as the sole basis for any decision that could affect human safety or welfare. Users are responsible for independently verifying all information before acting upon it.",
  "disclaimer.s5.title": "§5 — NO LIABILITY",
  "disclaimer.s5.body": "The developers and contributors of Redroom platform accept no liability for any misuse, damage, harm, or legal consequences arising from the use of this platform or its data. Users assume full responsibility for their actions and compliance with all applicable laws. The platform is provided \"as is\" without warranty of any kind.",
  "disclaimer.s6.title": "§6 — RESPONSIBLE DISCLOSURE",
  "disclaimer.s6.body": "If you identify any data that appears to compromise individual privacy, national security, or public safety, you are obligated to report it immediately to the platform maintainers and refrain from sharing or acting upon such data.",
  "disclaimer.s6.email": "responsible@redroom.live",
  "disclaimer.s7.title": "§7 — MIT LICENSE & ATTRIBUTION",
  "disclaimer.s7.body": "MIT License\nCopyright © 2024–2026 Alexsai · Owlink.ai\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND.",
  "disclaimer.s8.title": "§8 — AGREEMENT",
  "disclaimer.s8.body": "By accepting these terms, you confirm that you are at least 18 years of age, that you have read and understood all clauses above, and that you will use this platform solely for lawful, ethical, and constructive purposes. This agreement is binding and your continued use of the platform constitutes ongoing acceptance of these terms.",

  // Checkboxes
  "disclaimer.checkbox.noHarm": "I confirm I will not use this platform to harm, harass, stalk, or surveil any individual or group",
  "disclaimer.checkbox.noHack": "I confirm I will not use this platform for unauthorized access, hacking, cyberattacks, or any illegal activity",
  "disclaimer.checkbox.researchOnly": "I confirm my use is strictly for research, journalism, education, or other lawful and ethical purposes",
  "disclaimer.checkbox.noAbuse": "I understand that misuse of this platform may result in legal consequences and I accept full personal responsibility",

  // Accept button
  "disclaimer.btn.accept": "I ACCEPT — ENTER REDROOM",
  "disclaimer.btn.notReady": "CHECK ALL BOXES TO CONTINUE",
  "disclaimer.btn.readDisclaimer": "→ READ DISCLAIMER",
  "disclaimer.btn.backToHowTo": "← BACK TO HOW TO USE",

  // Reminder modal
  "reminder.title": "RESPONSIBLE USE REMINDER",
  "reminder.body": "You have been using Redroom. Please take a moment to confirm that your current activities remain within the bounds of ethical, lawful, and responsible OSINT research.",
  "reminder.questions": JSON.stringify([
    "Am I using this data only for lawful research purposes?",
    "Am I avoiding harm to any individual or group?",
    "Am I respecting the privacy of private individuals?",
    "Would I be comfortable explaining my current activity publicly?",
  ]),
  "reminder.btn.confirm": "YES, I AM BEING RESPONSIBLE",
  "reminder.btn.review": "REVIEW TERMS",

  // ── CONTRIBUTE tab ────────────────────────────────────────────────────────
  "contribute.intro": "Redroom is a community-driven open source project built by and for OSINT researchers, journalists, and analysts.",
  "contribute.star.title": "Star & Share the Repository",
  "contribute.star.icon": "⭐",
  "contribute.star.body": "The single most impactful thing you can do is star the GitHub repository and share it with your network. Stars help the project gain visibility in the OSINT and security research community, attract contributors, and signal that the tool is valuable and actively used.",
  "contribute.github.url": "https://github.com/Owlinkai/redroom",
  "contribute.github.label": "github.com/Owlinkai/redroom",
  "contribute.github.sublabel": "Star · Fork · Contribute",
  "contribute.code.title": "How to Contribute Code",
  "contribute.code.icon": "🛠",
  "contribute.code.steps": JSON.stringify([
    "Fork the repository and create a feature branch",
    "Add new data layers, improve existing visualizations, or fix bugs",
    "Submit a Pull Request with a clear description of your changes",
    "Follow the existing code style (TypeScript, tRPC, React 19, Tailwind 4)",
    "All contributions must align with the ethical use principles in the Disclaimer",
  ]),
  "contribute.ideas.title": "Ideas & Feature Requests",
  "contribute.ideas.icon": "💡",
  "contribute.ideas.body": "Have an idea for a new data layer, visualization, or analysis feature? Open a GitHub Issue with the label feature-request. The most upvoted ideas are prioritized in the development roadmap. Current high-priority requests include: additional satellite feeds, dark web monitoring integration, and enhanced entity relationship graphs.",
  "contribute.spread.title": "Spread the Word",
  "contribute.spread.icon": "📣",
  "contribute.spread.items": JSON.stringify([
    { action: "Share on Twitter/X", detail: "Tag #RedRoomOSINT — helps researchers discover the tool" },
    { action: "Write a blog post", detail: "Document how you use Redroom in your research workflow" },
    { action: "Mention in academic work", detail: "Cite the platform in papers, reports, or presentations" },
    { action: "Recommend to colleagues", detail: "Share with journalists, analysts, and researchers in your network" },
  ]),
  "contribute.follow.title": "Follow Alexsai",
  "contribute.follow.icon": "🔗",
  "contribute.linkedin.url": "https://www.linkedin.com/company/alexsai",
  "contribute.linkedin.label": "LinkedIn · Alexsai",
  "contribute.twitter.url": "https://twitter.com/alexsai_com",
  "contribute.twitter.label": "Twitter/X · @alexsai_com",
  "contribute.website.url": "https://alexsai.com",
  "contribute.website.label": "Alexsai.com",
  "contribute.website.sublabel": "AI Research & Intelligence Tools",
  "contribute.upgrade.url": "https://owlink.ai/redroom",
  "contribute.upgrade.body": "Go beyond the open-source tier — get managed cloud deployment, priority source expansion, custom alert rules, full API access, dedicated support, and C4ISR integration. Enterprise and Sovereign tiers available for governments, newsrooms, and security teams.",
  "contribute.copyright": "© 2024–2026 Alexsai · Owlink.ai — Stealth Intelligence for Gov and People",
  "contribute.license": "Redroom V2.4 · Released under the MIT License · Open Source · Built with ❤ for the OSINT community",

  // ── ENROLL tab ────────────────────────────────────────────────────────────
  "enroll.hero.badge": "UPCOMING FREE TRAINING",
  "enroll.hero.title": "Discovering Redroom Intelligence",
  "enroll.hero.subtitle": "A free, hands-on training by Alexsai on the best use of Redroom — from first principles to advanced OSINT tradecraft.",
  "enroll.cta.url": "https://forms.alexsai.com/12356",
  "enroll.cta.label": "🎓 REGISTER YOUR INTEREST",
  "enroll.cta.note": "forms.alexsai.com/12356 · Free · No commitment",
  "enroll.modules.title": "Training Modules",
  "enroll.modules.icon": "📚",
  "enroll.modules": JSON.stringify([
    { num: "01", title: "How It Started", desc: "The origin story of Redroom — why it was built, what problem it solves, and the vision behind a fully open-source global intelligence platform." },
    { num: "02", title: "Why Now?", desc: "The geopolitical and technological context that makes OSINT more important than ever. The rise of open data, AI, and the democratization of intelligence." },
    { num: "03", title: "The Technology Stack", desc: "Deep dive into the architecture: real-time data pipelines, ADS-B, AIS, USGS, NASA APIs, tRPC, React 19, Leaflet, Three.js, and the LLM integration layer." },
    { num: "04", title: "Data & Sources", desc: "Understanding the 10,000+ live aircraft, 15,000+ vessels, 12,000+ CCTV cameras, seismic feeds, fire data, and news aggregation from 100+ global sources." },
    { num: "05", title: "Investigation Workflows", desc: "Hands-on walkthroughs: tracking a vessel of interest, correlating flight patterns with news events, building entity relationship maps, and saving investigations." },
    { num: "06", title: "Best Use Cases", desc: "Real-world scenarios from investigative journalism, academic research, humanitarian monitoring, policy analysis, and security research." },
    { num: "07", title: "Hidden Features & Secrets", desc: "Reveal the advanced features most users never discover: SVM surveillance mode, polygon drawing, cross-layer alerts, time-lapse heatmaps, and keyboard shortcuts." },
    { num: "08", title: "New Features Reveal", desc: "Exclusive preview of upcoming features and the development roadmap. What's next for Redroom and how the community shapes it." },
    { num: "09", title: "Secrets of LLMs for Builders", desc: "How to use LLMs to build something similar — prompt engineering for intelligence extraction, structured JSON outputs, entity recognition, and sentiment analysis at scale." },
    { num: "10", title: "Numbers & Figures", desc: "The data behind the data: signal volumes, refresh rates, API limits, data freshness, accuracy benchmarks, and how to interpret what you see on the map." },
  ]),
  "enroll.bestfor.title": "Best For",
  "enroll.bestfor.icon": "🎯",
  "enroll.bestfor.roles": JSON.stringify([
    "Tech Geeks", "LLM Engineers", "News Agencies",
    "Researchers", "Engineers", "Governments",
    "NGOs", "OSINT Advocates", "Responsible AI Advocates",
    "Investigative Journalists", "Policy Analysts", "Security Researchers",
    "Educators & Academics", "Individuals Curious About AI & Tech", "Startup Founders",
  ]),
  "enroll.connected.title": "STAY CONNECTED",
  "enroll.linkedin.url": "https://www.linkedin.com/company/alexsai",
  "enroll.twitter.url": "https://twitter.com/alexsai_com",
  "enroll.website.url": "https://alexsai.com",
};

// ─── Helper: parse JSON array safely ─────────────────────────────────────────
function parseArr<T>(val: string, fallback: T[] = []): T[] {
  try { return JSON.parse(val) as T[]; } catch { return fallback; }
}

function DisclaimerModal() {
  const [open, setOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [waitingListOpen, setWaitingListOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("howto");
  const [accepted, setAccepted] = useState(false);
  const [checkboxes, setCheckboxes] = useState({
    noHarm: false,
    noHack: false,
    researchOnly: false,
    noAbuse: false,
  });
  const [reminderInterval, setReminderInterval] = useState<number>(() => {
    const stored = localStorage.getItem(REMINDER_INTERVAL_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_REMINDER_MS;
  });

  // Fetch CMS content overrides
  const { data: cmsRows } = trpc.cms.getSiteContent.useQuery({ section: undefined });
  const cms = useMemo(() => {
    const map: Record<string, string> = { ...DEFAULTS };
    if (cmsRows) {
      for (const row of cmsRows) {
        map[row.key] = row.value;
      }
    }
    return map;
  }, [cmsRows]);
  const c = (key: string) => cms[key] ?? DEFAULTS[key] ?? "";
  const visible = (key: string) => c(key) !== "false";

  // Show on first visit
  useEffect(() => {
    const hasAccepted = localStorage.getItem(DISCLAIMER_KEY);
    if (!hasAccepted) {
      setOpen(true);
      setActiveTab("howto");
    }
  }, []);

  // Responsible-use reminder at chosen interval.
  // Uses a 10-second startup delay so the disclaimer/how-to modal always
  // appears before the reminder. Never fires if LAST_REMINDER_KEY is 0
  // (i.e. the user just accepted for the first time — clock starts fresh).
  useEffect(() => {
    const hasAccepted = localStorage.getItem(DISCLAIMER_KEY);
    if (!hasAccepted) return;

    let intervalTimer: ReturnType<typeof setInterval> | null = null;

    const checkReminder = () => {
      const lastReminder = parseInt(localStorage.getItem(LAST_REMINDER_KEY) || "0", 10);
      const now = Date.now();
      const interval = parseInt(localStorage.getItem(REMINDER_INTERVAL_KEY) || String(DEFAULT_REMINDER_MS), 10);
      // If never set (0), initialise the clock and skip this cycle
      if (lastReminder === 0) {
        localStorage.setItem(LAST_REMINDER_KEY, String(now));
        return;
      }
      if (now - lastReminder >= interval) {
        setReminderOpen(true);
        localStorage.setItem(LAST_REMINDER_KEY, String(now));
      }
    };

    // 10-second startup delay — disclaimer/how-to always loads first
    const startupDelay = setTimeout(() => {
      checkReminder();
      intervalTimer = setInterval(checkReminder, 60 * 1000);
    }, 10000);

    return () => {
      clearTimeout(startupDelay);
      if (intervalTimer) clearInterval(intervalTimer);
    };
  }, [accepted, reminderInterval]);

  const allChecked = Object.values(checkboxes).every(Boolean);

  const handleAccept = useCallback(() => {
    if (!allChecked) return;
    localStorage.setItem(DISCLAIMER_KEY, "1");
    localStorage.setItem(LAST_REMINDER_KEY, String(Date.now()));
    setAccepted(true);
    setOpen(false);
  }, [allChecked]);

  const handleReminderAck = useCallback(() => {
    localStorage.setItem(LAST_REMINDER_KEY, String(Date.now()));
    setReminderOpen(false);
  }, []);

  const openDisclaimer = useCallback(() => {
    setActiveTab("howto");
    setOpen(true);
  }, []);

  const handleReminderChange = (ms: number) => {
    setReminderInterval(ms);
    localStorage.setItem(REMINDER_INTERVAL_KEY, String(ms));
  };

  const TABS: { key: Tab; label: string; show: boolean }[] = (
    [
      { key: "howto" as Tab, label: c("disclaimer.tab.howto.label"), show: visible("disclaimer.tab.howto.visible") },
      { key: "disclaimer" as Tab, label: c("disclaimer.tab.disclaimer.label"), show: visible("disclaimer.tab.disclaimer.visible") },
      { key: "contribute" as Tab, label: c("disclaimer.tab.contribute.label"), show: visible("disclaimer.tab.contribute.visible") },
      { key: "enroll" as Tab, label: c("disclaimer.tab.enroll.label"), show: visible("disclaimer.tab.enroll.visible") },
    ] as { key: Tab; label: string; show: boolean }[]
  ).filter(t => t.show);

  return (
    <>
      {/* ── Full Disclaimer Modal ── */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)" }}
        >
          <div
            className="relative w-full max-w-3xl mx-4 rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: "linear-gradient(135deg, #0a0f1e 0%, #0d1a2e 50%, #0a0f1e 100%)",
              border: "1px solid rgba(239,68,68,0.4)",
              boxShadow: "0 0 60px rgba(239,68,68,0.15), 0 0 120px rgba(6,182,212,0.08)",
              maxHeight: "90vh",
            }}
          >
            {/* Header */}
            <div
              className="flex-shrink-0 px-8 pt-8 pb-4"
              style={{ borderBottom: "1px solid rgba(239,68,68,0.2)" }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center justify-center w-10 h-10 rounded-full" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="rgba(239,68,68,0.3)" stroke="#ef4444" strokeWidth="1.5"/>
                    <path d="M12 8v4M12 16h.01" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-widest" style={{ color: "#ef4444", fontFamily: "'Orbitron', monospace" }}>
                    {c("disclaimer.header.title")}
                  </h1>
                  <p className="text-xs tracking-widest" style={{ color: "rgba(239,68,68,0.6)", fontFamily: "monospace" }}>
                    {c("disclaimer.header.subtitle")}
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mt-4 flex-wrap">
                {TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className="px-4 py-2 text-xs font-bold tracking-widest rounded-t transition-all"
                    style={{
                      fontFamily: "monospace",
                      background: activeTab === key ? "rgba(239,68,68,0.15)" : "transparent",
                      color: activeTab === key ? "#ef4444" : "rgba(255,255,255,0.4)",
                      borderTop: activeTab === key ? "1px solid rgba(239,68,68,0.4)" : "1px solid transparent",
                      borderLeft: activeTab === key ? "1px solid rgba(239,68,68,0.4)" : "1px solid transparent",
                      borderRight: activeTab === key ? "1px solid rgba(239,68,68,0.4)" : "1px solid transparent",
                      borderBottom: "none",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(239,68,68,0.3) transparent" }}>

              {/* ── HOW TO USE ── */}
              {activeTab === "howto" && (
                <div className="space-y-5">
                  <div className="p-4 rounded-lg" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.25)" }}>
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                      {c("howto.intro")}
                    </p>
                  </div>

                  <HowToSection icon={c("howto.sigint.icon")} title={c("howto.sigint.title")}>
                    <p className="mb-2">The SIGINT portal provides a real-time global intelligence map combining:</p>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {parseArr<{ label: string; count: string }>(c("howto.sigint.signals")).map(({ label, count }) => (
                        <div key={label} className="flex items-center justify-between px-3 py-1.5 rounded" style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)" }}>
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>{label}</span>
                          <span className="text-xs font-bold" style={{ color: "#06b6d4" }}>{count}</span>
                        </div>
                      ))}
                    </div>
                    <ul className="space-y-1">
                      {parseArr<string>(c("howto.sigint.tips")).map((tip, i) => (
                        <li key={i} className="text-xs flex gap-2" style={{ color: "rgba(255,255,255,0.7)" }}>
                          <span style={{ color: "#06b6d4" }}>→</span>{tip}
                        </li>
                      ))}
                    </ul>
                  </HowToSection>

                  <HowToSection icon={c("howto.orbit.icon")} title={c("howto.orbit.title")}>
                    {c("howto.orbit.body")}
                    <ul className="mt-3 space-y-1">
                      {parseArr<string>(c("howto.orbit.tips")).map((tip, i) => (
                        <li key={i} className="text-xs flex gap-2" style={{ color: "rgba(255,255,255,0.7)" }}>
                          <span style={{ color: "#06b6d4" }}>→</span>{tip}
                        </li>
                      ))}
                    </ul>
                  </HowToSection>

                  <HowToSection icon={c("howto.intel.icon")} title={c("howto.intel.title")}>
                    {c("howto.intel.body")}
                    <ul className="mt-3 space-y-1">
                      {parseArr<string>(c("howto.intel.tips")).map((tip, i) => (
                        <li key={i} className="text-xs flex gap-2" style={{ color: "rgba(255,255,255,0.7)" }}>
                          <span style={{ color: "#06b6d4" }}>→</span>{tip}
                        </li>
                      ))}
                    </ul>
                  </HowToSection>

                  <HowToSection icon={c("howto.usecases.icon")} title={c("howto.usecases.title")}>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      {parseArr<{ role: string; use: string }>(c("howto.usecases.items")).map(({ role, use }) => (
                        <div key={role} className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <div className="text-xs font-bold mb-1" style={{ color: "#06b6d4" }}>{role}</div>
                          <div className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{use}</div>
                        </div>
                      ))}
                    </div>
                  </HowToSection>

                  <HowToSection icon={c("howto.ethics.icon")} title={c("howto.ethics.title")}>
                    <ul className="mt-2 space-y-2">
                      {parseArr<string>(c("howto.ethics.items")).map((principle, i) => (
                        <li key={i} className="flex gap-2 text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                          <span style={{ color: "#f59e0b", flexShrink: 0 }}>◆</span>
                          {principle}
                        </li>
                      ))}
                    </ul>
                  </HowToSection>
                </div>
              )}

              {/* ── DISCLAIMER & TERMS ── */}
              {activeTab === "disclaimer" && (
                <div className="space-y-5">
                  <div className="p-4 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                      <span className="font-bold" style={{ color: "#ef4444" }}>{c("disclaimer.header.title")}</span>{" "}
                      {c("disclaimer.intro")}
                    </p>
                  </div>

                  <Section title={c("disclaimer.s1.title")}>{c("disclaimer.s1.body")}</Section>

                  <Section title={c("disclaimer.s2.title")}>
                    <ul className="space-y-2 mt-2">
                      {parseArr<string>(c("disclaimer.s2.items")).map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                          <span style={{ color: "#06b6d4", flexShrink: 0 }}>✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </Section>

                  <Section title={c("disclaimer.s3.title")}>
                    <div className="p-3 rounded mt-2" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <ul className="space-y-2">
                        {parseArr<string>(c("disclaimer.s3.items")).map((item, i) => (
                          <li key={i} className="flex gap-2 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                            <span style={{ color: "#ef4444", flexShrink: 0 }}>✗</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Section>

                  <Section title={c("disclaimer.s4.title")}>{c("disclaimer.s4.body")}</Section>
                  <Section title={c("disclaimer.s5.title")}>{c("disclaimer.s5.body")}</Section>

                  <Section title={c("disclaimer.s6.title")}>
                    {c("disclaimer.s6.body")}{" "}
                    Contact: <span style={{ color: "#06b6d4" }}>{c("disclaimer.s6.email")}</span>
                  </Section>

                  <Section title={c("disclaimer.s7.title")}>
                    <div className="p-3 rounded mt-2 font-mono text-xs" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {c("disclaimer.s7.body")}
                    </div>
                  </Section>

                  <Section title={c("disclaimer.s8.title")}>{c("disclaimer.s8.body")}</Section>

                  {/* Reminder interval selector */}
                  <div className="p-4 rounded-lg" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <div className="text-xs font-bold tracking-widest mb-3" style={{ color: "#f59e0b", fontFamily: "monospace" }}>
                      ⏱ RESPONSIBLE USE REMINDER INTERVAL
                    </div>
                    <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>
                      Redroom will periodically remind you to use the platform responsibly. Choose your preferred reminder frequency:
                    </p>
                    <div className="flex gap-2">
                      {[
                        { label: "15 MIN", ms: 15 * 60 * 1000 },
                        { label: "30 MIN", ms: 30 * 60 * 1000 },
                        { label: "60 MIN", ms: 60 * 60 * 1000 },
                      ].map(({ label, ms }) => (
                        <button
                          key={ms}
                          onClick={() => handleReminderChange(ms)}
                          className="flex-1 py-2 rounded text-xs font-bold tracking-widest transition-all"
                          style={{
                            fontFamily: "monospace",
                            background: reminderInterval === ms ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)",
                            border: reminderInterval === ms ? "1px solid rgba(245,158,11,0.5)" : "1px solid rgba(255,255,255,0.1)",
                            color: reminderInterval === ms ? "#f59e0b" : "rgba(255,255,255,0.4)",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-3 pt-2">
                    {(["noHarm", "noHack", "researchOnly", "noAbuse"] as const).map((key) => (
                      <label key={key} className="flex items-start gap-3 cursor-pointer group">
                        <div
                          className="flex-shrink-0 w-5 h-5 rounded mt-0.5 flex items-center justify-center transition-all"
                          style={{
                            background: checkboxes[key] ? "rgba(6,182,212,0.3)" : "rgba(255,255,255,0.05)",
                            border: checkboxes[key] ? "1px solid #06b6d4" : "1px solid rgba(255,255,255,0.2)",
                          }}
                          onClick={() => setCheckboxes(prev => ({ ...prev, [key]: !prev[key] }))}
                        >
                          {checkboxes[key] && (
                            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#06b6d4" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
                          )}
                        </div>
                        <span className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                          {c(`disclaimer.checkbox.${key}`)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* ── CONTRIBUTE ── */}
              {activeTab === "contribute" && (
                <div className="space-y-5">
                  <div className="p-4 rounded-lg" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.25)" }}>
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                      {c("contribute.intro")}
                    </p>
                  </div>

                  <HowToSection icon={c("contribute.star.icon")} title={c("contribute.star.title")}>
                    {c("contribute.star.body")}
                    <div className="mt-3 flex flex-col gap-2">
                      <a
                        href={c("contribute.github.url")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:opacity-90"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", textDecoration: "none" }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
                        <div>
                          <div className="text-xs font-bold" style={{ color: "#06b6d4" }}>{c("contribute.github.label")}</div>
                          <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{c("contribute.github.sublabel")}</div>
                        </div>
                      </a>
                    </div>
                  </HowToSection>

                  <HowToSection icon={c("contribute.code.icon")} title={c("contribute.code.title")}>
                    <ul className="mt-2 space-y-2">
                      {parseArr<string>(c("contribute.code.steps")).map((step, i) => (
                        <li key={i} className="flex gap-2 text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                          <span style={{ color: "#06b6d4", flexShrink: 0 }}>{i + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </HowToSection>

                  <HowToSection icon={c("contribute.ideas.icon")} title={c("contribute.ideas.title")}>
                    {c("contribute.ideas.body")}
                  </HowToSection>

                  <HowToSection icon={c("contribute.spread.icon")} title={c("contribute.spread.title")}>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      {parseArr<{ action: string; detail: string }>(c("contribute.spread.items")).map(({ action, detail }) => (
                        <div key={action} className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <div className="text-xs font-bold mb-1" style={{ color: "#06b6d4" }}>{action}</div>
                          <div className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{detail}</div>
                        </div>
                      ))}
                    </div>
                  </HowToSection>

                  {/* Follow Alexsai */}
                  <HowToSection icon={c("contribute.follow.icon")} title={c("contribute.follow.title")}>
                    <div className="flex flex-col gap-3 mt-3">
                      <a href={c("contribute.linkedin.url")} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:opacity-90"
                        style={{ background: "rgba(10,102,194,0.12)", border: "1px solid rgba(10,102,194,0.35)", textDecoration: "none" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#0a66c2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        <div>
                          <div className="text-xs font-bold" style={{ color: "#0a66c2" }}>{c("contribute.linkedin.label")}</div>
                          <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{c("contribute.linkedin.url").replace("https://","")}</div>
                        </div>
                      </a>
                      <a href={c("contribute.twitter.url")} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:opacity-90"
                        style={{ background: "rgba(29,161,242,0.08)", border: "1px solid rgba(29,161,242,0.3)", textDecoration: "none" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#1da1f2"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        <div>
                          <div className="text-xs font-bold" style={{ color: "#1da1f2" }}>{c("contribute.twitter.label")}</div>
                          <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{c("contribute.twitter.url").replace("https://","")}</div>
                        </div>
                      </a>
                      <a href={c("contribute.website.url")} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:opacity-90"
                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", textDecoration: "none" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
                        <div>
                          <div className="text-xs font-bold" style={{ color: "#ef4444" }}>{c("contribute.website.label")}</div>
                          <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{c("contribute.website.sublabel")}</div>
                        </div>
                      </a>
                    </div>
                  </HowToSection>

                  {/* Request Access / Waiting List */}
                  <div className="p-4 rounded-lg" style={{ background: "rgba(0,200,255,0.06)", border: "1px solid rgba(0,200,255,0.25)" }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,200,255,0.12)", border: "1px solid rgba(0,200,255,0.3)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,200,255,0.8)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                      </div>
                      <div>
                        <div className="text-xs font-bold" style={{ color: "rgba(0,200,255,0.9)" }}>Request Analyst Access</div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Join the waiting list to become an authorised contributor</div>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>
                      Authorised analysts gain access to advanced intelligence features including the Narrative Checker, verified source submission, and the full OSINT pipeline. Registration is coming soon — join the waiting list to be considered.
                    </p>
                    <button
                      onClick={() => setWaitingListOpen(true)}
                      className="w-full py-2.5 rounded-lg text-xs font-bold transition-all"
                      style={{ background: "rgba(0,200,255,0.12)", border: "1px solid rgba(0,200,255,0.35)", color: "rgba(0,200,255,0.9)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,200,255,0.2)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,200,255,0.12)"; }}
                    >
                      🔐 Join the Waiting List →
                    </button>
                  </div>

                  {/* Upgrade to Enterprise */}
                  <div className="p-4 rounded-lg" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.35)" }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.4)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(248,113,113,0.9)" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      </div>
                      <div>
                        <div className="text-xs font-bold" style={{ color: "rgba(248,113,113,0.95)" }}>Upgrade to Enterprise</div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Unlock the full Owlink · Redroom intelligence suite</div>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.65)" }}>
                      {c("contribute.upgrade.body")}
                    </p>
                    <div className="flex justify-center">
                      <UpgradeButton portal="contribute" variant="compact" className="w-full" />
                    </div>
                  </div>

                  {/* Copyright */}
                  <div className="p-4 rounded-lg text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="text-xs font-bold mb-1" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>
                      {c("contribute.copyright")}
                    </div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>
                      {c("contribute.license")}
                    </div>
                  </div>
                </div>
              )}

              {/* ── ENROLL ── */}
              {activeTab === "enroll" && (
                <div className="space-y-5">
                  {/* Hero */}
                  <div className="p-5 rounded-xl text-center" style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(6,182,212,0.08) 100%)", border: "1px solid rgba(239,68,68,0.3)" }}>
                    <div className="text-xs font-bold tracking-widest mb-2" style={{ color: "rgba(239,68,68,0.7)", fontFamily: "monospace" }}>{c("enroll.hero.badge")}</div>
                    <h2 className="text-lg font-bold tracking-wider mb-1" style={{ color: "#fff", fontFamily: "'Orbitron', monospace" }}>
                      {c("enroll.hero.title")}
                    </h2>
                    <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>
                      {c("enroll.hero.subtitle")}
                    </p>
                    <a
                      href={c("enroll.cta.url")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-bold tracking-widest transition-all hover:opacity-90"
                      style={{
                        background: "linear-gradient(135deg, rgba(239,68,68,0.3) 0%, rgba(239,68,68,0.15) 100%)",
                        border: "1px solid rgba(239,68,68,0.6)",
                        color: "#ef4444",
                        textDecoration: "none",
                        boxShadow: "0 0 20px rgba(239,68,68,0.2)",
                        fontFamily: "monospace",
                      }}
                    >
                      {c("enroll.cta.label")}
                    </a>
                    <div className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>{c("enroll.cta.note")}</div>
                  </div>

                  {/* Modules */}
                  <HowToSection icon={c("enroll.modules.icon")} title={c("enroll.modules.title")}>
                    <div className="grid grid-cols-1 gap-2 mt-3">
                      {parseArr<{ num: string; title: string; desc: string }>(c("enroll.modules")).map(({ num, title, desc }) => (
                        <div key={num} className="flex gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                          <div className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-xs font-bold" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontFamily: "monospace" }}>{num}</div>
                          <div>
                            <div className="text-xs font-bold mb-0.5" style={{ color: "#06b6d4" }}>{title}</div>
                            <div className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </HowToSection>

                  {/* Best For */}
                  <HowToSection icon={c("enroll.bestfor.icon")} title={c("enroll.bestfor.title")}>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {parseArr<string>(c("enroll.bestfor.roles")).map((role) => (
                        <div key={role} className="px-2 py-1.5 rounded text-center text-xs" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", color: "rgba(255,255,255,0.7)" }}>
                          {role}
                        </div>
                      ))}
                    </div>
                  </HowToSection>

                  {/* CTA + Follow */}
                  <div className="p-4 rounded-xl" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <div className="text-xs font-bold tracking-widest mb-3" style={{ color: "#ef4444", fontFamily: "monospace" }}>{c("enroll.connected.title")}</div>
                    <div className="flex flex-col gap-2">
                      <a href={c("enroll.cta.url")} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold tracking-widest transition-all hover:opacity-90"
                        style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#ef4444", textDecoration: "none", fontFamily: "monospace" }}>
                        {c("enroll.cta.label")} — {c("enroll.cta.note")}
                      </a>
                      <a href={c("enroll.linkedin.url")} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold tracking-widest transition-all hover:opacity-90"
                        style={{ background: "rgba(10,102,194,0.1)", border: "1px solid rgba(10,102,194,0.3)", color: "#0a66c2", textDecoration: "none", fontFamily: "monospace" }}>
                        💼 Follow on LinkedIn · {c("enroll.linkedin.url").replace("https://","")}
                      </a>
                      <a href={c("enroll.twitter.url")} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold tracking-widest transition-all hover:opacity-90"
                        style={{ background: "rgba(29,161,242,0.08)", border: "1px solid rgba(29,161,242,0.25)", color: "#1da1f2", textDecoration: "none", fontFamily: "monospace" }}>
                        🐦 Follow on Twitter/X · {c("enroll.twitter.url").replace("https://","")}
                      </a>
                      <a href={c("enroll.website.url")} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold tracking-widest transition-all hover:opacity-90"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", textDecoration: "none", fontFamily: "monospace" }}>
                        🌐 Visit {c("enroll.website.url").replace("https://","")}
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-8 py-5 flex items-center justify-between" style={{ borderTop: "1px solid rgba(239,68,68,0.2)" }}>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
                {c("disclaimer.footer.version")}
              </div>
              <div className="flex gap-3">
                {activeTab === "howto" ? (
                  <button
                    onClick={() => setActiveTab("disclaimer")}
                    className="px-6 py-2.5 rounded-lg text-sm font-bold tracking-widest transition-all"
                    style={{ fontFamily: "monospace", background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.4)", color: "#06b6d4" }}
                  >
                    {c("disclaimer.btn.readDisclaimer")}
                  </button>
                ) : activeTab === "contribute" || activeTab === "enroll" ? (
                  <button
                    onClick={() => setActiveTab("howto")}
                    className="px-6 py-2.5 rounded-lg text-sm font-bold tracking-widest transition-all"
                    style={{ fontFamily: "monospace", background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)", color: "#06b6d4" }}
                  >
                    {c("disclaimer.btn.backToHowTo")}
                  </button>
                ) : (
                  <button
                    onClick={handleAccept}
                    disabled={!allChecked}
                    className="px-6 py-2.5 rounded-lg text-sm font-bold tracking-widest transition-all"
                    style={{
                      fontFamily: "monospace",
                      background: allChecked ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.05)",
                      border: allChecked ? "1px solid rgba(239,68,68,0.6)" : "1px solid rgba(255,255,255,0.1)",
                      color: allChecked ? "#ef4444" : "rgba(255,255,255,0.25)",
                      cursor: allChecked ? "pointer" : "not-allowed",
                      boxShadow: allChecked ? "0 0 20px rgba(239,68,68,0.2)" : "none",
                    }}
                  >
                    {allChecked ? c("disclaimer.btn.accept") : c("disclaimer.btn.notReady")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Responsible Use Reminder ── */}
      {reminderOpen && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="w-full max-w-md mx-4 rounded-2xl p-8"
            style={{
              background: "linear-gradient(135deg, #0a0f1e 0%, #0d1a2e 100%)",
              border: "1px solid rgba(245,158,11,0.4)",
              boxShadow: "0 0 40px rgba(245,158,11,0.15)",
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#f59e0b" strokeWidth="1.5"/>
                  <path d="M12 7v5l3 3" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold tracking-widest" style={{ color: "#f59e0b", fontFamily: "'Orbitron', monospace" }}>
                  {c("reminder.title")}
                </div>
                <div className="text-xs" style={{ color: "rgba(245,158,11,0.6)", fontFamily: "monospace" }}>
                  {reminderInterval === 15 * 60 * 1000 ? "15" : reminderInterval === 60 * 60 * 1000 ? "60" : "30"}-MINUTE CHECK-IN
                </div>
              </div>
            </div>

            <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.8)" }}>
              {c("reminder.body")}
            </p>

            <div className="space-y-2 mb-6">
              {parseArr<string>(c("reminder.questions")).map((q, i) => (
                <div key={i} className="flex gap-2 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                  <span style={{ color: "#f59e0b", flexShrink: 0 }}>?</span>
                  {q}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReminderAck}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold tracking-widest transition-all"
                style={{ fontFamily: "monospace", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", color: "#f59e0b" }}
              >
                {c("reminder.btn.confirm")}
              </button>
              <button
                onClick={() => { setReminderOpen(false); setOpen(true); setActiveTab("disclaimer"); }}
                className="px-4 py-2.5 rounded-lg text-xs transition-all"
                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}
              >
                {c("reminder.btn.review")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Shield Icon ── */}
      {!open && visible("disclaimer.visible") && (
        <button
          onClick={openDisclaimer}
          title={c("disclaimer.button.tooltip")}
          className="fixed bottom-6 right-6 z-[9990] w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{
            background: "rgba(10,15,30,0.9)",
            border: "1px solid rgba(239,68,68,0.4)",
            boxShadow: "0 0 20px rgba(239,68,68,0.2)",
            backdropFilter: "blur(8px)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth="1.5"/>
            <path d="M12 8v4M12 16h.01" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      )}
      <WaitingListModal open={waitingListOpen} onClose={() => setWaitingListOpen(false)} />
    </>
  );
}

// Helper sub-components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold tracking-widest mb-2" style={{ color: "#ef4444", fontFamily: "monospace" }}>
        {title}
      </h3>
      <div className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>
        {children}
      </div>
    </div>
  );
}

function HowToSection({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <h3 className="text-sm font-bold tracking-wider mb-2 flex items-center gap-2" style={{ color: "#06b6d4", fontFamily: "monospace" }}>
        <span>{icon}</span>
        {title}
      </h3>
      <div className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>
        {children}
      </div>
    </div>
  );
}

export default DisclaimerModal;
