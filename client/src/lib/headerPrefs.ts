/**
 * Shared Header Preferences Utility
 * Manages show/hide, order, label/icon/color overrides, and custom toggles
 * for IntelPlatform, ORBIT, and SIGINT headers.
 * Stored in localStorage per page key.
 */

// ── Custom toggle (user-created link button) ──────────────────────────────────
export type CustomToggle = {
  id: string;           // unique, e.g. "custom_abc123"
  label: string;
  link: string;
  isExternal: boolean;
  hasBorder: boolean;
  borderRadius: boolean; // true = rounded, false = square
  borderColor: string;   // CSS color string
  textColor: string;
  bgColor: string;
  visible: boolean;
  order: number;
  isCustom: true;
};

// ── Built-in item (platform-defined, can be styled/relabelled) ────────────────
export type BuiltinItem = {
  id: string;
  label: string;           // default label (shown in CMS)
  visible: boolean;
  order: number;
  isCustom?: false;
  // Optional style overrides applied on top of the default rendering
  labelOverride?: string;  // replaces the default button text
  textColor?: string;      // overrides default text/icon color
  bgColor?: string;        // overrides default background
  hasBorder?: boolean;     // override border visibility
  borderColor?: string;    // override border color
  borderRadius?: boolean;  // override rounded corners
};

export type HeaderItem = BuiltinItem | CustomToggle;

// ── Default configs per page ────────────────────────────────────────────────
export const INTEL_DEFAULTS: BuiltinItem[] = [
  { id: "datetime",      label: "Date / Time",        visible: true, order: 0 },
  { id: "articles",      label: "Article Stats",       visible: true, order: 1 },
  { id: "threatcon",     label: "THREATCON Level",     visible: true, order: 2 },
  { id: "region",        label: "Region Filter",       visible: true, order: 3 },
  { id: "globe",         label: "Globe Selector",      visible: true, order: 4 },
  { id: "crawl",         label: "CRAWL Button",        visible: true, order: 5 },
  { id: "notifs",        label: "Notifications",       visible: true, order: 6 },
  { id: "fullscreen",    label: "Fullscreen",          visible: true, order: 7 },
  { id: "upgrade",       label: "Upgrade Button",      visible: true, order: 8 },
  { id: "docs",          label: "DOCS Link",           visible: true, order: 9 },
  { id: "theme",         label: "Theme Toggle",        visible: true, order: 10 },
];

export const ORBIT_DEFAULTS: BuiltinItem[] = [
  { id: "satcounts",  label: "Satellite Counts",          visible: true, order: 0 },
  { id: "tabs",       label: "Globe/Surv/Intel/Miss Tabs", visible: true, order: 1 },
  { id: "aoi",        label: "AOI Button",                visible: true, order: 2 },
  { id: "poly",       label: "POLY Button",               visible: true, order: 3 },
  { id: "cmp",        label: "CMP Button",                visible: true, order: 4 },
  { id: "nightmode",  label: "Night Mode",                visible: true, order: 5 },
  { id: "live",       label: "LIVE/PAUSED Toggle",        visible: true, order: 6 },
  { id: "upgrade",    label: "Upgrade Button",            visible: true, order: 7 },
  { id: "docs",       label: "DOCS Link",                 visible: true, order: 8 },
  { id: "fullscreen", label: "Fullscreen",                visible: true, order: 9 },
  { id: "theme",      label: "Theme Toggle",              visible: true, order: 10 },
  { id: "back",       label: "← INTEL Back Link",         visible: true, order: 11 },
];

export const SIGINT_DEFAULTS: BuiltinItem[] = [
  { id: "stats",      label: "Signal Stats Bar",   visible: true, order: 0 },
  { id: "viewmode",   label: "Map/Globe Toggle",   visible: true, order: 1 },
  { id: "live",       label: "LIVE/PAUSED Toggle", visible: true, order: 2 },
  { id: "upgrade",    label: "Upgrade Button",     visible: true, order: 3 },
  { id: "docs",       label: "DOCS Link",          visible: true, order: 4 },
  { id: "fullscreen", label: "Fullscreen",         visible: true, order: 5 },
  { id: "theme",      label: "Theme Toggle",       visible: true, order: 6 },
  { id: "back",       label: "← INTEL Back Link",  visible: true, order: 7 },
];

// ── Storage keys ─────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  intel:  "header_prefs_intel",
  orbit:  "header_prefs_orbit",
  sigint: "header_prefs_sigint",
} as const;

export type PageKey = keyof typeof STORAGE_KEYS;

const DEFAULTS: Record<PageKey, BuiltinItem[]> = {
  intel:  INTEL_DEFAULTS,
  orbit:  ORBIT_DEFAULTS,
  sigint: SIGINT_DEFAULTS,
};

// ── Load / save ───────────────────────────────────────────────────────────────
export function loadPrefs(page: PageKey): HeaderItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[page]);
    if (!raw) return [...DEFAULTS[page]];
    const saved: HeaderItem[] = JSON.parse(raw);
    // Merge: keep saved overrides for known builtins, add any new defaults
    const defaults = DEFAULTS[page];
    const savedIds = new Set(saved.map(s => s.id));
    const merged: HeaderItem[] = [...saved];
    defaults.forEach((d, i) => {
      if (!savedIds.has(d.id)) {
        merged.push({ ...d, order: merged.length + i });
      }
    });
    return merged.sort((a, b) => a.order - b.order);
  } catch {
    return [...DEFAULTS[page]];
  }
}

export function savePrefs(page: PageKey, items: HeaderItem[]): void {
  localStorage.setItem(STORAGE_KEYS[page], JSON.stringify(items));
  // Use CustomEvent for same-tab broadcasting (StorageEvent only fires for cross-tab writes)
  window.dispatchEvent(new CustomEvent("headerPrefsChanged", { detail: { page, key: STORAGE_KEYS[page] } }));
}

export function resetPrefs(page: PageKey): HeaderItem[] {
  const defaults = [...DEFAULTS[page]];
  savePrefs(page, defaults);
  return defaults;
}

// ── Helpers for page components ───────────────────────────────────────────────
export function isVisible(items: HeaderItem[], id: string): boolean {
  const item = items.find(i => i.id === id);
  return item ? item.visible : true;
}

export function orderedIds(items: HeaderItem[]): string[] {
  return [...items].sort((a, b) => a.order - b.order).map(i => i.id);
}

export function customToggles(items: HeaderItem[]): CustomToggle[] {
  return items.filter((i): i is CustomToggle => !!i.isCustom && i.visible)
    .sort((a, b) => a.order - b.order);
}

/** Get style overrides for a built-in item */
export function getItemOverrides(items: HeaderItem[], id: string): Partial<BuiltinItem> | null {
  const item = items.find(i => i.id === id);
  if (!item || item.isCustom) return null;
  const { labelOverride, textColor, bgColor, hasBorder, borderColor, borderRadius } = item;
  if (!labelOverride && !textColor && !bgColor && hasBorder === undefined && !borderColor && borderRadius === undefined) return null;
  return { labelOverride, textColor, bgColor, hasBorder, borderColor, borderRadius };
}

// ── Legacy compat for IntelPlatform ──────────────────────────────────────────
// IntelPlatform.tsx previously used its own inline types/functions.
// We keep those names as aliases pointing to the shared lib.
export type HeaderItemConfig = BuiltinItem;
export const HEADER_ITEMS_DEFAULT = INTEL_DEFAULTS;
export const HEADER_PREFS_KEY = STORAGE_KEYS.intel;

export function loadHeaderPrefs(): HeaderItem[] {
  return loadPrefs("intel");
}

export function saveHeaderPrefs(items: HeaderItem[]): void {
  savePrefs("intel", items);
}
