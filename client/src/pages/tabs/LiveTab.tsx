import { useState, useMemo, useEffect, useRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import CountryIntelPanel from "@/components/CountryIntelPanel";
import 'leaflet.heat';
import L from "leaflet";
import { trpc } from "@/lib/trpc";
import AnimatedAttackLines, { type AttackRoute } from "@/components/AnimatedAttackLines";
import {
  Filter, Layers, X, ExternalLink,
  Clock, Search,
  MapPin, Activity, Network, RefreshCw, Newspaper,
  Building2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, CheckCircle2,
  Maximize2, Shield, Zap, Map as MapIcon
} from "lucide-react";

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MENA_CENTER: [number, number] = [28.0, 42.0];
const MENA_ZOOM = 5;

// Region centre coordinates and zoom levels for auto-navigation
const REGION_VIEW: Record<string, { center: [number, number]; zoom: number }> = {
  'MENA':               { center: [28.0,  42.0],  zoom: 4 },
  'Europe':             { center: [54.0,  15.0],  zoom: 4 },
  'East Asia':          { center: [35.0, 115.0],  zoom: 4 },
  'Asia-Pacific':       { center: [-10.0, 130.0], zoom: 3 },
  'South Asia':         { center: [22.0,  78.0],  zoom: 4 },
  'Central Asia':       { center: [45.0,  65.0],  zoom: 4 },
  'Sub-Saharan Africa': { center: [0.0,   25.0],  zoom: 3 },
  'North Africa':       { center: [27.0,  18.0],  zoom: 4 },
  'Americas':           { center: [40.0, -95.0],  zoom: 3 },
  'Latin America':      { center: [-15.0, -60.0], zoom: 3 },
  'Global':             { center: [20.0,  10.0],  zoom: 2 },
};

// ─── COUNTRY BOUNDING BOXES ───────────────────────────────────────────────────
// [south, west, north, east] — used for flyToBounds on country drill-down
const COUNTRY_BOUNDS: Record<string, [[number, number], [number, number]]> = {
  'Saudi Arabia': [[16.3, 34.5], [32.2, 55.7]],
  'Iran':         [[25.0, 44.0], [39.8, 63.3]],
  'Iraq':         [[29.1, 38.8], [37.4, 48.6]],
  'Israel':       [[29.5, 34.2], [33.3, 35.9]],
  'Palestine':    [[31.2, 34.2], [32.6, 35.6]],
  'Gaza':         [[31.2, 34.2], [31.6, 34.6]],
  'West Bank':    [[31.3, 34.9], [32.6, 35.6]],
  'Egypt':        [[22.0, 24.7], [31.7, 37.1]],
  'Turkey':       [[35.8, 25.7], [42.1, 44.8]],
  'UAE':          [[22.6, 51.6], [26.1, 56.4]],
  'Qatar':        [[24.5, 50.7], [26.2, 51.6]],
  'Kuwait':       [[28.5, 46.5], [30.1, 48.4]],
  'Bahrain':      [[25.8, 50.4], [26.3, 50.8]],
  'Oman':         [[16.6, 52.0], [26.4, 59.8]],
  'Yemen':        [[12.1, 42.5], [19.0, 53.1]],
  'Syria':        [[32.3, 35.7], [37.3, 42.4]],
  'Lebanon':      [[33.0, 35.1], [34.7, 36.6]],
  'Jordan':       [[29.2, 34.9], [33.4, 39.3]],
  'Libya':        [[19.5, 9.3],  [33.2, 25.2]],
  'Tunisia':      [[30.2, 7.5],  [37.5, 11.6]],
  'Algeria':      [[18.9, -8.7], [37.1, 12.0]],
  'Morocco':      [[27.7, -13.2],[35.9, -1.0]],
  'Sudan':        [[8.7,  21.8], [22.2, 38.6]],
  'Somalia':      [[-1.7, 40.9], [12.0, 51.4]],
  'Afghanistan':  [[29.4, 60.5], [38.5, 74.9]],
  'Pakistan':     [[23.7, 60.9], [37.1, 77.8]],
  'Russia':       [[41.2, 19.6], [81.9, 190.0]],
  'China':        [[18.2, 73.5], [53.6, 134.8]],
  'USA':          [[24.4, -125.0],[49.4, -66.9]],
  'United States':[[24.4, -125.0],[49.4, -66.9]],
  'UK':           [[49.9, -8.6], [60.9, 1.8]],
  'United Kingdom':[[49.9, -8.6],[60.9, 1.8]],
  'France':       [[41.3, -5.1], [51.1, 9.6]],
  'Germany':      [[47.3, 5.9],  [55.1, 15.0]],
  'Ukraine':      [[44.4, 22.1], [52.4, 40.2]],
  'India':        [[8.1,  68.1], [37.1, 97.4]],
  'Ethiopia':     [[3.4,  33.0], [14.9, 47.9]],
  'Nigeria':      [[4.3,  2.7],  [13.9, 14.7]],
  'South Africa': [[-34.8, 16.5],[-22.1, 32.9]],
};

// ─── NEWS TOPIC DEFINITIONS ────────────────────────────────────────────────────
// Each topic has: id, label, color, and a unique SVG path for its icon
const TOPICS: Array<{
  id: string; label: string; color: string;
  svgPath: string; viewBox?: string;
}> = [
  {
    id: "WAR/CONFLICT", label: "War / Conflict", color: "#ef4444",
    viewBox: "0 0 24 24",
    svgPath: `<path fill="white" d="M12 2L8 6H4l2 4-4 2 4 2-2 4h4l4 4 4-4h4l-2-4 4-2-4-2 2-4h-4L12 2zm0 3.5L14.5 8H17l-1.5 3 3 1.5-3 1.5L17 17h-2.5L12 19.5 9.5 17H7l1.5-3-3-1.5 3-1.5L7 8h2.5L12 5.5z"/>
    <circle cx="12" cy="12" r="2.5" fill="white"/>`
  },
  {
    id: "ECONOMY", label: "Economy", color: "#f59e0b",
    viewBox: "0 0 24 24",
    svgPath: `<path fill="white" d="M3.5 18.5l6-6 4 4L22 6.92 20.59 5.5l-7.09 8-4-4L2 17l1.5 1.5z"/>
    <path fill="white" d="M21 3h-3v2h1.59L15 9.59l-4-4L3 13.41 4.41 14.83 11 8.24l4 4L21.41 6H23V3h-2z" opacity="0.6"/>`
  },
  {
    id: "POLITICS", label: "Politics", color: "#8b5cf6",
    viewBox: "0 0 24 24",
    svgPath: `<path fill="white" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>`
  },
  {
    id: "TECHNOLOGY", label: "Technology", color: "#06b6d4",
    viewBox: "0 0 24 24",
    svgPath: `<path fill="white" d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>`
  },
  {
    id: "ENERGY", label: "Energy", color: "#f97316",
    viewBox: "0 0 24 24",
    svgPath: `<path fill="white" d="M7 2v11h3v9l7-12h-4l4-8z"/>`
  },
  {
    id: "DIPLOMACY", label: "Diplomacy", color: "#10b981",
    viewBox: "0 0 24 24",
    svgPath: `<path fill="white" d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19h.5v3c4.86-2.34 8-7 8-11.5C20 5.81 16.19 2 11.5 2zm1 14.5h-2v-2h2v2zm0-4h-2c0-3.25 3-3 3-5 0-1.1-.9-2-2-2s-2 .9-2 2h-2c0-2.21 1.79-4 4-4s4 1.79 4 4c0 2.5-3 2.75-3 5z"/>`
  },
  {
    id: "SECURITY", label: "Security", color: "#ec4899",
    viewBox: "0 0 24 24",
    svgPath: `<path fill="white" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>`
  },
  {
    id: "HUMANITARIAN", label: "Humanitarian", color: "#84cc16",
    viewBox: "0 0 24 24",
    svgPath: `<path fill="white" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>`
  },
];

const TOPIC_MAP = Object.fromEntries(TOPICS.map(t => [t.id, t]));
const TOPIC_COLORS = Object.fromEntries(TOPICS.map(t => [t.id, t.color]));

// ─── FACILITY TYPE DEFINITIONS ─────────────────────────────────────────────────
// Military-grade tactical icons — each is a standalone SVG rendered at 44px
// Inspired by NATO APP-6D symbology, MILSYM standards, and real-world recognition

// ─── FACILITY TYPES & ICONS ────────────────────────────────────────────────────
// Each icon is a single self-contained SVG drawn on a 64×64 canvas.
// No nested SVGs, no scaling transforms — paths fill the canvas directly.
// Inspired by NATO APP-6D, MILSYM, and real-world military/intelligence iconography.


// ─── FACILITY TYPES ────────────────────────────────────────────────────────────
// Each icon is a compact inline SVG vectorized from the original Gemini-generated PNG.
// No CDN, no network requests — renders instantly at any zoom level.
const FACILITY_TYPES: Array<{
  id: string;
  label: string;
  color: string;
  svgIcon: string; // inline SVG string (viewBox="0 0 128 128")
}> = [
  {
    id: "military",
    label: "Military Base",
    color: "#ef4444",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><!-- Dark olive background --><rect width="128" height="128" rx="14" fill="#1a2010"/><!-- Outer perimeter fence (pentagon-ish) --><polygon points="64,8 118,40 100,105 28,105 10,40" fill="none" stroke="#4a5c2a" stroke-width="2.5"/><!-- Inner compound --><rect x="38" y="38" width="52" height="52" rx="3" fill="#243018" stroke="#3a4a20" stroke-width="1.5"/><!-- Main HQ building (center) --><rect x="50" y="50" width="28" height="28" rx="2" fill="#2e3d1a" stroke="#5a7030" stroke-width="1.5"/><!-- HQ roof detail --><rect x="54" y="54" width="20" height="20" rx="1" fill="#364520" stroke="#6a8040" stroke-width="1"/><!-- Star emblem on HQ --><polygon points="64,56 65.9,62.1 72.4,62.1 67.2,66 69.1,72.1 64,68.2 58.9,72.1 60.8,66 55.6,62.1 62.1,62.1" fill="#c8a820" stroke="#a88010" stroke-width="0.5"/><!-- Barracks (top-left) --><rect x="18" y="46" width="16" height="10" rx="1" fill="#2a3818" stroke="#4a5c28" stroke-width="1"/><line x1="21" y1="46" x2="21" y2="56" stroke="#3a4c22" stroke-width="0.8"/><line x1="24" y1="46" x2="24" y2="56" stroke="#3a4c22" stroke-width="0.8"/><line x1="27" y1="46" x2="27" y2="56" stroke="#3a4c22" stroke-width="0.8"/><line x1="30" y1="46" x2="30" y2="56" stroke="#3a4c22" stroke-width="0.8"/><!-- Barracks (top-right) --><rect x="94" y="46" width="16" height="10" rx="1" fill="#2a3818" stroke="#4a5c28" stroke-width="1"/><line x1="97" y1="46" x2="97" y2="56" stroke="#3a4c22" stroke-width="0.8"/><line x1="100" y1="46" x2="100" y2="56" stroke="#3a4c22" stroke-width="0.8"/><line x1="103" y1="46" x2="103" y2="56" stroke="#3a4c22" stroke-width="0.8"/><line x1="106" y1="46" x2="106" y2="56" stroke="#3a4c22" stroke-width="0.8"/><!-- Runway (horizontal) --><rect x="14" y="72" width="100" height="8" rx="1" fill="#1e2814" stroke="#3a4c22" stroke-width="0.8"/><line x1="20" y1="76" x2="30" y2="76" stroke="#5a7030" stroke-width="1.5" stroke-dasharray="4,3"/><line x1="36" y1="76" x2="46" y2="76" stroke="#5a7030" stroke-width="1.5" stroke-dasharray="4,3"/><line x1="82" y1="76" x2="92" y2="76" stroke="#5a7030" stroke-width="1.5" stroke-dasharray="4,3"/><line x1="98" y1="76" x2="108" y2="76" stroke="#5a7030" stroke-width="1.5" stroke-dasharray="4,3"/><!-- Guard towers (corners) --><rect x="14" y="14" width="8" height="8" rx="1" fill="#3a4c22" stroke="#5a7030" stroke-width="1"/><rect x="106" y="14" width="8" height="8" rx="1" fill="#3a4c22" stroke="#5a7030" stroke-width="1"/><rect x="14" y="106" width="8" height="8" rx="1" fill="#3a4c22" stroke="#5a7030" stroke-width="1"/><rect x="106" y="106" width="8" height="8" rx="1" fill="#3a4c22" stroke="#5a7030" stroke-width="1"/><!-- Tower dots (lookout) --><circle cx="18" cy="18" r="2" fill="#8ab040"/><circle cx="110" cy="18" r="2" fill="#8ab040"/><circle cx="18" cy="110" r="2" fill="#8ab040"/><circle cx="110" cy="110" r="2" fill="#8ab040"/><!-- Radar dish (top center) --><circle cx="64" cy="20" r="5" fill="none" stroke="#6a8040" stroke-width="1.5"/><line x1="64" y1="15" x2="64" y2="25" stroke="#6a8040" stroke-width="1"/><line x1="59" y1="20" x2="69" y2="20" stroke="#6a8040" stroke-width="1"/><circle cx="64" cy="20" r="1.5" fill="#8ab040"/><!-- Antenna mast --><line x1="64" y1="20" x2="64" y2="38" stroke="#5a7030" stroke-width="0.8"/></svg>`,
  },
  {
    id: "fighter",
    label: "Fighter Aircraft",
    color: "#06b6d4",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"> <path d="M0,0 L128,0 L128,128 L0,128 Z " fill="#000202" transform="translate(0,0)"/> <path d="M0,0 L2,1 L-5,14 L-14,25 L-22,33 L-18,32 L-16,36 L-23,43 L-23,99 L-28,104 L-32,102 L-55,79 L-53,75 L-54,75 L-58,79 L-59,102 L-62,104 L-66,103 L-73,93 L-72,87 L-71,85 L-75,87 L-77,85 L-76,81 L-78,79 L-82,80 L-82,78 L-84,78 L-82,74 L-83,74 L-90,75 L-100,67 L-98,62 L-97,60 L-75,59 L-71,54 L-73,56 L-76,56 L-76,54 L-80,52 L-87,44 L-98,33 L-100,32 L-98,28 L-95,25 L-41,24 L-34,18 L-30,19 L-30,22 L-25,18 L-15,9 Z " fill="#04EEF1" transform="translate(113,12)"/> </svg>`,
  },
  {
    id: "military_airport",
    label: "Military Airport",
    color: "#22c55e",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="#0a0f1a" rx="8"/><rect x="56" y="10" width="16" height="108" fill="#22c55e" rx="4"/><rect x="10" y="56" width="108" height="16" fill="#22c55e" rx="4"/><rect x="60" y="14" width="8" height="100" fill="#16a34a" rx="2"/><rect x="14" y="60" width="100" height="8" fill="#16a34a" rx="2"/><circle cx="64" cy="64" r="10" fill="#0a0f1a" stroke="#22c55e" stroke-width="2"/><circle cx="64" cy="64" r="4" fill="#22c55e"/></svg>`,
  },
  {
    id: "nuclear",
    label: "Nuclear Facility",
    color: "#eab308",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"> <path d="M0,0 L94,0 L94,94 L0,94 Z " fill="#070702" transform="translate(17,17)"/> <path d="M0,0 L94,0 L94,94 L0,94 Z M39,7 L28,11 L19,18 L13,25 L8,36 L7,39 L7,55 L14,71 L24,81 L34,86 L40,88 L54,88 L67,83 L77,74 L81,69 L85,62 L87,55 L87,41 L84,31 L78,21 L69,13 L58,8 L53,7 Z " fill="#030301" transform="translate(17,17)"/> <path d="M0,0 L14,0 L24,3 L34,9 L42,18 L47,29 L48,34 L48,48 L44,59 L38,67 L31,74 L21,79 L15,81 L1,81 L-10,77 L-18,71 L-25,64 L-32,48 L-32,32 L-27,20 L-21,12 L-14,6 L-6,2 Z M1,3 L-10,7 L-18,13 L-24,20 L-29,32 L-29,48 L-25,58 L-21,64 L-13,72 L-5,76 L1,78 L14,78 L23,75 L31,70 L36,65 L40,60 L44,52 L45,48 L45,32 L40,20 L31,10 L20,4 L15,3 Z " fill="#E0DE07" transform="translate(56,24)"/> <path d="M0,0 L12,0 L21,15 L22,19 L16,22 L11,23 L-1,23 L-10,19 L-8,13 Z " fill="#F6F302" transform="translate(58,74)"/> <path d="M0,0 L5,2 L12,10 L16,19 L16,28 L-5,28 L-7,22 L-10,19 L-8,13 Z " fill="#F8F503" transform="translate(80,36)"/> <path d="M0,0 L3,1 L12,17 L12,19 L8,23 L7,28 L-14,28 L-14,20 L-10,10 L-3,2 Z " fill="#F8F403" transform="translate(46,36)"/> <path d="M0,0 L6,0 L11,5 L12,6 L12,12 L7,17 L6,18 L0,18 L-5,13 L-6,12 L-6,6 L-1,1 Z " fill="#EFEC03" transform="translate(61,55)"/> <path d="M0,0 L94,0 L94,1 L0,1 Z " fill="#000000" transform="translate(17,112)"/> <path d="M0,0 L1,0 L1,94 L0,94 Z " fill="#000000" transform="translate(112,17)"/> <path d="M0,0 L1,0 L1,94 L0,94 Z " fill="#000000" transform="translate(15,17)"/> <path d="M0,0 L94,0 L94,1 L0,1 Z " fill="#000000" transform="translate(17,15)"/> </svg>`,
  },
  {
    id: "naval",
    label: "Naval Vessel",
    color: "#3b82f6",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"> <path d="M0,0 L128,0 L128,128 L0,128 Z " fill="#010202" transform="translate(0,0)"/> <path d="M0,0 L4,1 L-5,14 L-110,15 L-116,12 L-116,11 L-107,11 L-107,13 L-105,11 L-101,11 L-102,4 L-26,3 Z " fill="#3896CF" transform="translate(120,69)"/> <path d="M0,0 L7,0 L8,10 L10,10 L11,6 L26,6 L27,11 L38,11 L38,14 L-14,14 L-14,10 L-11,10 L-11,8 L-13,8 L-13,6 L-6,6 L-6,10 L-3,10 L-1,1 Z " fill="#3281B1" transform="translate(52,58)"/> <path d="M0,0 L97,1 L96,4 L-9,5 L-15,2 L-15,1 L-6,1 L-6,3 L-4,1 Z " fill="#266388" transform="translate(19,79)"/> <path d="M0,0 L2,0 L2,3 L0,3 L0,5 L2,6 L1,10 L3,10 L4,7 L6,7 L6,11 L13,11 L13,19 L9,19 L8,15 L-4,15 L-5,2 L0,1 Z " fill="#2E79A6" transform="translate(71,48)"/> <path d="M0,0 L7,0 L7,9 L-2,9 L-1,1 Z " fill="#368FC5" transform="translate(52,58)"/> </svg>`,
  },
  {
    id: "oil_gas",
    label: "Oil & Gas",
    color: "#f97316",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"> <path d="M0,0 L90,0 L90,104 L0,104 Z " fill="#020101" transform="translate(19,12)"/> <path d="M0,0 L4,2 L10,11 L12,18 L12,30 L7,31 L0,19 L-14,24 L-15,29 L-7,53 L-3,66 L-3,69 L20,69 L20,74 L-57,74 L-57,69 L-52,69 L-52,57 L-48,57 L-48,38 L-50,38 L-51,32 L-26,22 L-22,18 L-13,17 L-3,13 L-3,1 Z " fill="#D25D03" transform="translate(83,27)"/> <path d="M0,0 L1,2 L-6,24 L-12,41 L-16,41 L-16,30 L-20,30 L-20,8 Z " fill="#0B0502" transform="translate(57,55)"/> <path d="M0,0 L6,0 L6,2 L8,2 L10,7 L9,12 L-4,12 L-3,9 L-4,7 L-3,2 L1,3 Z " fill="#4A2205" transform="translate(60,67)"/> <path d="M0,0 L1,0 L1,102 L0,102 Z " fill="#000000" transform="translate(110,13)"/> <path d="M0,0 L1,0 L1,102 L0,102 Z " fill="#000000" transform="translate(17,13)"/> <path d="M0,0 L5,5 L8,8 L7,15 L4,16 L2,10 L0,9 L0,12 L-2,12 L-1,16 L-3,16 L-4,14 L-4,8 L-1,4 Z " fill="#E06404" transform="translate(91,78)"/> <path d="M0,0 L5,1 L13,6 L13,7 L-10,7 L-5,3 Z " fill="#0B0502" transform="translate(61,89)"/> <path d="M0,0 L90,0 L90,1 L0,1 Z " fill="#000000" transform="translate(19,117)"/> <path d="M0,0 L90,0 L90,1 L0,1 Z " fill="#000000" transform="translate(19,10)"/> </svg>`,
  },
  {
    id: "satellite",
    label: "Satellite / SIGINT",
    color: "#a855f7",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"> <path d="M0,0 L128,0 L128,128 L0,128 Z " fill="#0A0915" transform="translate(0,0)"/> <path d="M0,0 L6,1 L16,10 L27,22 L26,24 L22,23 L7,8 L3,6 L6,18 L13,32 L22,42 L29,48 L40,54 L45,56 L52,57 L45,48 L36,38 L34,35 L38,33 L49,45 L57,55 L57,61 L45,67 L42,68 L24,68 L11,63 L2,56 L-5,47 L-10,34 L-10,20 L-6,9 Z " fill="#9101F6" transform="translate(34,24)"/> <path d="M0,0 L14,0 L23,4 L29,8 L34,13 L40,21 L44,34 L44,45 L39,46 L38,31 L31,17 L23,10 L15,6 L1,4 Z " fill="#8D02ED" transform="translate(64,10)"/> <path d="M0,0 L9,0 L19,4 L26,10 L32,22 L32,34 L27,34 L26,21 L21,13 L15,8 L8,5 L-1,4 Z " fill="#8D02EC" transform="translate(65,20)"/> <path d="M0,0 L5,0 L6,1 L6,6 L4,8 L1,8 L-1,13 L-7,22 L-11,20 L-16,15 L-16,13 L-3,5 Z " fill="#9102F4" transform="translate(68,43)"/> <path d="M0,0 L10,1 L16,5 L21,12 L21,22 L17,22 L15,12 L10,7 L0,5 L-1,1 Z " fill="#8E02ED" transform="translate(65,30)"/> </svg>`,
  },
  {
    id: "embassy",
    label: "Embassy / Consulate",
    color: "#f59e0b",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"> <path d="M0,0 L128,0 L128,128 L0,128 Z " fill="#050401" transform="translate(0,0)"/> <path d="M0,0 L2,0 L3,16 L48,35 L52,37 L52,39 L-50,39 L-49,36 L-9,19 L-4,17 L0,17 Z " fill="#F7C806" transform="translate(63,13)"/> <path d="M0,0 L92,0 L92,7 L97,7 L97,13 L-5,13 L-5,7 L0,7 Z " fill="#F2C506" transform="translate(18,102)"/> <path d="M0,0 L13,0 L13,37 L0,37 Z " fill="#F4C706" transform="translate(92,63)"/> <path d="M0,0 L13,0 L13,37 L0,37 Z " fill="#F7C705" transform="translate(69,63)"/> <path d="M0,0 L13,0 L13,37 L0,37 Z " fill="#F8C804" transform="translate(46,63)"/> <path d="M0,0 L13,0 L13,37 L0,37 Z " fill="#F5C705" transform="translate(23,63)"/> <path d="M0,0 L92,0 L92,5 L0,5 Z " fill="#F5C706" transform="translate(18,55)"/> <path d="M0,0 L13,0 L13,9 L0,9 Z " fill="#FACD06" transform="translate(67,15)"/> </svg>`,
  },
  {
    id: "data_center",
    label: "Data Center / Cyber",
    color: "#06b6d4",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"> <path d="M0,0 L70,0 L75,2 L75,96 L71,98 L-1,98 L-5,96 L-5,2 Z M73,3 L73,95 L74,95 L74,3 Z M7,4 Z M10,4 Z M13,4 Z M16,4 Z M20,4 Z M23,4 Z M26,4 Z M30,4 Z M33,4 Z M36,4 Z M43,4 Z M46,4 Z M49,4 Z M53,4 Z M56,4 Z M59,4 Z M10,7 Z M13,7 Z M20,7 Z M23,7 Z M26,7 Z M33,7 Z M36,7 Z M43,7 Z M46,7 Z M49,7 Z M53,7 Z M56,7 Z M59,7 Z M2,11 L2,12 L68,12 L68,11 Z M2,13 L2,84 L4,84 L4,13 Z M66,13 L66,84 L68,84 L68,13 Z M4,28 L4,29 L66,29 L66,28 Z M4,36 L4,37 L66,37 L66,36 Z M34,45 Z M34,52 L34,54 L36,54 L36,52 Z M4,53 Z M65,53 Z M34,60 L4,61 L4,62 L60,62 L60,61 Z M61,61 L61,62 L66,62 L66,61 Z M4,69 L4,70 L36,71 L66,70 L66,69 Z M4,77 Z M34,77 L34,79 L37,78 Z M65,77 Z M2,85 Z M34,85 Z M66,85 Z M8,89 L9,91 Z M11,89 L12,92 Z M14,89 L15,92 Z M17,89 Z M20,89 Z M23,89 L24,92 Z M26,89 L27,91 Z M37,89 L38,92 Z M40,89 Z M43,89 Z M46,89 Z M49,89 Z M52,89 L53,92 Z M55,90 Z M17,91 Z M20,91 Z M40,91 Z M43,91 Z M46,91 Z M49,91 Z M5,93 Z M8,93 Z M11,93 Z M14,93 Z M17,93 Z M20,93 Z M23,93 Z M26,93 Z M29,93 Z M37,93 Z M40,93 Z M43,93 Z M46,93 Z M49,93 Z M52,93 Z M55,93 Z M65,93 Z " fill="#0DB9C3" transform="translate(29,15)"/> <path d="M0,0 L72,0 L72,1 L0,1 Z " fill="#00F7FB" transform="translate(28,114)"/> <path d="M0,0 L70,0 L70,1 L0,1 Z " fill="#00FFFF" transform="translate(29,13)"/> <path d="M0,0 Z " fill="#00FFFF" transform="translate(100,113)"/> <path d="M0,0 Z " fill="#00AAAA" transform="translate(27,113)"/> <path d="M0,0 Z " fill="#000000" transform="translate(101,112)"/> <path d="M0,0 Z " fill="#000000" transform="translate(26,112)"/> <path d="M0,0 Z " fill="#007FFF" transform="translate(25,111)"/> <path d="M0,0 Z " fill="#000000" transform="translate(101,15)"/> <path d="M0,0 Z " fill="#000000" transform="translate(26,15)"/> <path d="M0,0 Z " fill="#00FFFF" transform="translate(100,14)"/> <path d="M0,0 Z " fill="#00FFFF" transform="translate(27,14)"/> </svg>`,
  },
  {
    id: "port",
    label: "Port / Harbor",
    color: "#0ea5e9",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"> <path d="M0,0 L128,0 L128,128 L0,128 Z " fill="#0A0B15" transform="translate(0,0)"/> <path d="M0,0 L8,1 L12,6 L12,11 L9,10 L6,5 L0,5 L-2,8 L-1,13 L5,12 L10,14 L10,17 L6,18 L7,23 L15,24 L13,29 L6,29 L7,45 L6,46 L9,49 L14,50 L17,53 L16,61 L18,61 L17,67 L14,70 L12,70 L12,68 L8,70 L10,75 L11,76 L19,76 L27,71 L31,66 L27,65 L34,59 L36,56 L38,56 L39,62 L39,71 L37,71 L37,69 L34,72 L28,80 L20,85 L6,91 L2,93 L-6,88 L-11,86 L-11,82 L-13,84 L-12,79 L-15,79 L-17,83 L-16,78 L-12,75 L-11,70 L-8,67 L0,68 L-2,67 L-2,50 L-2,48 L-2,45 L-6,43 L-10,41 L-12,38 L-12,35 L-10,35 L-13,31 L-13,28 L-17,30 L-22,29 L-22,24 L-21,23 L-1,23 L-1,19 L-6,20 L-5,16 L-6,14 L-6,5 Z " fill="#094C73" transform="translate(61,17)"/> <path d="M0,0 L2,0 L3,6 L3,15 L1,15 L1,13 L-2,16 L-8,24 L-16,29 L-30,35 L-34,37 L-42,32 L-47,30 L-47,26 L-49,28 L-48,23 L-51,23 L-53,27 L-52,22 L-47,19 L-46,21 L-40,19 L-37,15 L-36,16 L-28,16 L-25,20 L-17,20 L-9,15 L-5,10 L-9,9 L-2,3 Z " fill="#0482C2" transform="translate(97,73)"/> <path d="M0,0 L8,1 L12,6 L12,11 L9,10 L6,5 L0,5 L-2,8 L-1,13 L5,12 L10,14 L10,17 L6,18 L7,23 L15,24 L13,29 L6,29 L7,45 L-1,42 L-1,29 L-16,29 L-21,30 L-22,29 L-22,24 L-21,23 L-1,23 L-1,19 L-6,20 L-5,16 L-6,14 L-6,5 Z " fill="#0487C6" transform="translate(61,17)"/> <path d="M0,0 L7,0 L12,1 L12,14 L17,15 L20,20 L27,22 L30,25 L30,28 L28,28 L27,33 L22,40 L19,40 L19,38 L21,38 L20,33 L20,23 L16,24 L14,23 L14,21 L10,19 L11,17 L7,15 L3,13 L1,10 L1,7 L3,7 L0,3 Z " fill="#093A5A" transform="translate(48,45)"/> <path d="M0,0 L6,0 L9,3 L10,6 L12,7 L12,9 L18,9 L21,14 L21,17 L19,17 L20,20 L27,19 L28,20 L28,25 L23,26 L20,24 L19,29 L16,31 L18,24 L17,24 L17,18 L15,18 L13,12 L10,12 L10,10 L1,9 L-2,9 L-3,4 Z " fill="#083D62" transform="translate(61,21)"/> <path d="M0,0 L3,1 L4,7 L6,7 L7,12 L8,15 L3,20 L1,22 L1,25 L-4,27 L-5,22 L-5,14 L2,14 L3,10 L-4,9 L-5,8 L-5,3 Z " fill="#0A243D" transform="translate(72,32)"/> <path d="M0,0 L3,1 L7,6 L11,10 L7,10 L13,17 L16,19 L14,25 L10,24 L4,16 L1,13 L1,15 L-1,15 L-1,6 Z " fill="#0484C2" transform="translate(29,73)"/> <path d="M0,0 L8,1 L9,16 L0,15 Z " fill="#0389C8" transform="translate(60,67)"/> </svg>`,
  },
  {
    id: "airport",
    label: "Airport",
    color: "#94a3b8",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="#0a0f1a" rx="8"/><g fill="#cbd5e1"><ellipse cx="64" cy="64" rx="8" ry="40" /><ellipse cx="64" cy="64" rx="42" ry="8" /><ellipse cx="64" cy="88" rx="18" ry="5" /><rect x="60" y="100" width="8" height="14" rx="3"/></g></svg>`,
  },
  {
    id: "company",
    label: "Company / HQ",
    color: "#ef4444",
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"> <path d="M0,0 L128,0 L128,128 L0,128 Z " fill="#060509" transform="translate(0,0)"/> <path d="M0,0 L4,2 L11,9 L19,16 L35,31 L38,33 L38,50 L36,50 L32,46 L32,43 L28,42 L22,35 L18,29 L8,23 L5,20 L5,16 L-3,16 L-4,21 L-7,24 L-14,28 L-19,33 L-25,41 L-28,44 L-30,44 L-31,47 L-34,50 L-36,50 L-36,34 L-24,22 L-16,15 Z " fill="#F50301" transform="translate(63,17)"/> <path d="M0,0 L4,0 L4,9 L7,9 L7,0 L14,1 L20,5 L25,13 L25,18 L16,18 L16,20 L25,20 L24,27 L20,33 L14,37 L7,38 L7,29 L5,29 L5,38 L-2,37 L-10,31 L-13,24 L-13,20 L-4,20 L-4,18 L-13,18 L-12,11 L-8,5 Z " fill="#0B0101" transform="translate(58,45)"/> <path d="M0,0 L2,0 L2,7 L9,8 L16,12 L22,20 L23,28 L30,28 L30,30 L23,30 L22,37 L18,44 L10,50 L2,51 L2,58 L0,58 L0,51 L-8,50 L-16,44 L-20,38 L-21,30 L-28,30 L-28,28 L-21,28 L-20,20 L-14,12 L-8,8 L0,7 Z M-5,10 L-14,16 L-18,23 L-18,28 L-9,28 L-9,30 L-18,30 L-17,37 L-13,43 L-5,48 L0,48 L0,39 L2,39 L2,48 L9,47 L17,41 L20,34 L20,30 L11,30 L11,28 L20,28 L19,21 L15,15 L9,11 L2,10 L2,19 L-1,19 L-1,10 Z " fill="#E80403" transform="translate(63,35)"/> <path d="M0,0 L2,0 L6,10 L8,14 L-2,24 L-10,31 L-11,31 L-11,10 L-4,3 Z " fill="#F20302" transform="translate(38,68)"/> <path d="M0,0 L5,2 L13,10 L13,31 L6,25 L-4,16 L-6,12 L-2,7 Z " fill="#F20302" transform="translate(88,68)"/> <path d="M0,0 L8,0 L10,5 L19,11 L24,16 L27,20 L27,22 L24,22 L18,14 L10,10 L5,9 L5,2 L3,2 L3,9 L-7,12 L-13,17 L-17,25 L-18,30 L-25,30 L-23,26 L-14,13 L-7,8 L-2,5 Z " fill="#1E0302" transform="translate(60,33)"/> </svg>`,
  },
];
const FACILITY_MAP = Object.fromEntries(FACILITY_TYPES.map(f => [f.id, f]));
// ─── ICON CREATORS ─────────────────────────────────────────────────────────────

/**
 * Military-grade facility icon — uses AI-generated PNG images as Leaflet DivIcon markers.
 * Each icon is a 48×48 image with a CSS drop-shadow glow in the facility's threat color.
 * Critical facilities get a red pulse ring animation around the icon.
 * Dimmed facilities are rendered at 18% opacity when a filter is active.
 */
function createFacilityIcon(facilityType: string, isCritical: boolean, dimmed = false, hasBreakingNews = false): L.DivIcon {
  const ft = FACILITY_MAP[facilityType] ?? FACILITY_MAP['company'];
  const color = isCritical ? '#ef4444' : ft.color;
  const opacity = dimmed ? 0.18 : 1;
  const S = 32; // compact size — inline SVG, no network requests
  // Critical pulse ring (large outer ring for threat-level critical)
  const ringSize = S + 12;
  const pulseRing = isCritical
    ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${ringSize}px;height:${ringSize}px;border-radius:50%;border:1.5px solid #ef4444;animation:dot-blink 1.2s ease-in-out infinite;pointer-events:none;"></div>`
    : '';
  // Breaking news bounce dot — small red dot at top-right corner
  const breakingDot = hasBreakingNews
    ? `<div style="position:absolute;top:-3px;right:-3px;width:8px;height:8px;border-radius:50%;background:#ef4444;box-shadow:0 0 5px #ef4444,0 0 10px #ef444466;animation:dot-blink 1s ease-in-out infinite;pointer-events:none;"></div>`
    : '';
  // Strip newlines/extra whitespace from the inline SVG for safe embedding in html string
  const svgHtml = ft.svgIcon.replace(/\s+/g, ' ').trim();
  return L.divIcon({
    html: `
      <div style="opacity:${opacity};position:relative;display:flex;align-items:center;justify-content:center;width:${S}px;height:${S}px;">
        ${pulseRing}
        <div style="width:${S}px;height:${S}px;filter:drop-shadow(0 0 4px ${color}88) drop-shadow(0 1px 3px rgba(0,0,0,0.7));border-radius:4px;overflow:hidden;line-height:0;">${svgHtml}</div>
        ${breakingDot}
      </div>
    `,
    className: '',
    iconSize: [S, S],
    iconAnchor: [S / 2, S / 2],
    popupAnchor: [0, -(S / 2 + 8)],
  });
}

/**
 * News article pin — a clean teardrop map pin.
 * Color encodes topic. Breaking news = red + pulse. Dimmed = 15% opacity.
 * No emoji, no text — pure color + shape communicates the category.
 */
function createNewsIcon(isBreaking: boolean, topics: string[], sentiment: string, dimmed = false): L.DivIcon {
  const primaryTopic = TOPIC_MAP[topics?.[0]];
  const color = isBreaking
    ? '#ef4444'
    : primaryTopic
    ? primaryTopic.color
    : sentiment === 'negative'
    ? '#f97316'
    : sentiment === 'positive'
    ? '#22c55e'
    : '#64748b';

  const W = isBreaking ? 18 : 14;
  const H = isBreaking ? 24 : 18;
  const stemH = 5;
  const totalH = H + stemH;
  const opacity = dimmed ? 0.15 : 1;
  const pulse = isBreaking ? `animation:dot-blink 1.1s ease-in-out infinite;` : '';

  return L.divIcon({
    html: `
      <div style="opacity:${opacity};display:flex;flex-direction:column;align-items:center;width:${W}px;height:${totalH}px;">
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
          style="${pulse}filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8)) drop-shadow(0 0 5px ${color}70);">
          <!-- teardrop pin shape -->
          <path d="M${W/2},${H-2}
            C${W/2},${H-2} 1,${H*0.55} 1,${W/2}
            A${W/2-1},${W/2-1} 0 1,1 ${W-1},${W/2}
            C${W-1},${H*0.55} ${W/2},${H-2} ${W/2},${H-2}Z"
            fill="${color}" stroke="oklch(from var(--foreground) l c h / 0.2)" stroke-width="0.8"/>
          <!-- inner highlight dot -->
          <circle cx="${W/2}" cy="${W/2}" r="${W/5}" fill="oklch(from var(--foreground) l c h / 0.35)"/>
        </svg>
        <div style="width:1.5px;height:${stemH}px;background:${color};opacity:0.6;margin-top:-1px;"></div>
      </div>
    `,
    className: '',
    iconSize: [W, totalH],
    iconAnchor: [W / 2, totalH],
    popupAnchor: [0, -totalH],
  });
}

/**
 * Country cluster badge — shown when clusterArticles is ON.
 * Outer ring color = dominant topic. Count badge. Breaking pulse ring.
 */
function createClusterIcon(count: number, dominantColor: string, hasBreaking: boolean): L.DivIcon {
  const size = count > 50 ? 44 : count > 20 ? 38 : count > 10 ? 32 : 26;
  const ringColor = hasBreaking ? '#ef4444' : dominantColor;
  const fontSize = size > 38 ? 13 : size > 30 ? 11 : 9;
  return L.divIcon({
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        ${hasBreaking ? `<div style="
          position:absolute;inset:-5px;border-radius:50%;
          border:1.5px solid #ef444455;
          animation:dot-blink 1.3s ease-in-out infinite;
        "></div>` : ''}
        <div style="
          position:absolute;inset:0;border-radius:50%;
          background:rgba(6,10,20,0.92);
          border:2px solid ${ringColor}80;
          box-shadow:0 2px 8px rgba(0,0,0,0.8), 0 0 10px ${ringColor}30;
          display:flex;align-items:center;justify-content:center;
        ">
          <span style="
            font-size:${fontSize}px;font-weight:800;
            color:${ringColor};font-family:'Inter',monospace;
            line-height:1;letter-spacing:-0.03em;
          ">${count > 99 ? '99+' : count}</span>
        </div>
      </div>
    `,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 8)],
  });
}
function createFacilityClusterIcon(count: number, hasBreaking: boolean): L.DivIcon {
  const size = count > 20 ? 40 : count > 10 ? 34 : count > 5 ? 28 : 24;
  const color = hasBreaking ? '#ef4444' : '#f59e0b';
  const fontSize = size > 34 ? 12 : size > 26 ? 10 : 9;
  return L.divIcon({
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        ${hasBreaking ? `<div style="position:absolute;inset:-4px;border-radius:4px;border:1.5px solid #ef444455;animation:dot-blink 1.3s ease-in-out infinite;"></div>` : ''}
        <div style="
          position:absolute;inset:0;border-radius:4px;
          background:rgba(6,10,20,0.92);
          border:2px solid ${color}80;
          box-shadow:0 2px 8px rgba(0,0,0,0.8), 0 0 10px ${color}30;
          display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1px;
        ">
          <span style="font-size:7px;color:${color}80;font-family:'Inter',monospace;line-height:1;letter-spacing:0.05em;">FAC</span>
          <span style="font-size:${fontSize}px;font-weight:800;color:${color};font-family:'Inter',monospace;line-height:1;">${count > 99 ? '99+' : count}</span>
        </div>
      </div>
    `,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 8)],
  });
}

// Flies the map to the selected region whenever it changes.
// Guards against calling flyTo before the map container has a valid size
// (can happen when the LiveTab is mounted but not yet visible).
function FlyToRegion({ region }: { region: string }) {
  const map = useMap();
  const prevRegionRef = useRef<string>(region); // track previous to skip no-op calls
  useEffect(() => {
    // Skip if region hasn't actually changed (initial mount)
    if (prevRegionRef.current === region && map.getZoom() !== undefined) {
      prevRegionRef.current = region;
      return;
    }
    prevRegionRef.current = region;
    const view = REGION_VIEW[region];
    if (!view) return;
    // Guard: only fly if the map container has a real size
    const size = map.getSize();
    if (!size || !isFinite(size.x) || !isFinite(size.y) || size.x === 0 || size.y === 0) {
      // Defer until the map fires its first 'resize' or 'load' event
      const doFly = () => map.flyTo(view.center, view.zoom, { animate: true, duration: 1.2 });
      map.once('resize', doFly);
      map.once('load', doFly);
      return;
    }
    map.flyTo(view.center, view.zoom, { animate: true, duration: 1.2 });
  }, [region]);
  return null;
}
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom, { animate: true }); }, []);
  return null;
}

// Zooms to a country's bounding box whenever countryFilter changes
function FlyToCountry({ country }: { country: string | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (!country) return;
    const bounds = COUNTRY_BOUNDS[country];
    if (bounds) {
      map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 8, duration: 1.2 });
    } else {
      // Fallback to centre-point zoom if no bounding box
      const coords = Object.entries(COUNTRY_BOUNDS).find(([k]) => k.toLowerCase() === country.toLowerCase())?.[1];
      if (coords) map.flyToBounds(coords, { padding: [40, 40], maxZoom: 8, duration: 1.2 });
    }
  }, [country]);
  return null;
}

// ─── COUNTRY SEARCH BAR ──────────────────────────────────────────────────────
// Floating search bar shown when Country Intel layer is active.
// On Enter, flies the map to the searched country and opens the intel panel.
function CountrySearchBar({ onNavigate, collapsed }: { onNavigate: (country: string) => void; collapsed?: boolean }) {
  const [query, setQuery] = useState('');
  const [hovered, setHovered] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Known country list from GeoJSON (common names)
  const KNOWN_COUNTRIES = [
    'Afghanistan','Algeria','Argentina','Australia','Austria','Azerbaijan',
    'Bahrain','Bangladesh','Belarus','Belgium','Bolivia','Bosnia and Herzegovina',
    'Brazil','Bulgaria','Cambodia','Cameroon','Canada','Chile','China','Colombia',
    'Croatia','Cuba','Czech Republic','Denmark','Ecuador','Egypt','Ethiopia',
    'Finland','France','Germany','Ghana','Greece','Hungary','India','Indonesia',
    'Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kazakhstan',
    'Kenya','Kuwait','Lebanon','Libya','Malaysia','Mexico','Morocco','Myanmar',
    'Netherlands','New Zealand','Nigeria','North Korea','Norway','Oman','Pakistan',
    'Palestine','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia',
    'Saudi Arabia','Serbia','Somalia','South Africa','South Korea','Spain','Sudan',
    'Sweden','Switzerland','Syria','Taiwan','Thailand','Tunisia','Turkey','UAE',
    'Ukraine','United Kingdom','United States','Uzbekistan','Venezuela','Vietnam',
    'Yemen','Zimbabwe',
  ];

  const handleChange = (val: string) => {
    setQuery(val);
    if (val.length < 2) { setSuggestions([]); return; }
    const q = val.toLowerCase();
    setSuggestions(KNOWN_COUNTRIES.filter(c => c.toLowerCase().includes(q)).slice(0, 6));
  };

  const handleSelect = (country: string) => {
    setQuery(country);
    setSuggestions([]);
    onNavigate(country);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      const match = KNOWN_COUNTRIES.find(c => c.toLowerCase() === query.toLowerCase())
        ?? suggestions[0];
      if (match) handleSelect(match);
    }
    if (e.key === 'Escape') {
      setSuggestions([]);
      setQuery('');
    }
  };

  const isExpanded = !collapsed || hovered;

  return (
    <div
      className="absolute top-14 left-4 z-[2500] transition-all duration-200"
      style={{ width: isExpanded ? 240 : 36 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); if (!query) setSuggestions([]); }}
    >
      <div className="relative">
        <div className="flex items-center gap-2 bg-background/90 border border-primary/40 rounded-lg px-3 py-2 backdrop-blur-md shadow-lg overflow-hidden" style={{ height: 34 }}>
          <Search className="w-3.5 h-3.5 text-primary shrink-0" />
          {isExpanded && (
            <input
              ref={inputRef}
              value={query}
              onChange={e => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search country..."
              className="flex-1 bg-transparent text-[11px] font-mono text-foreground placeholder-[#444] outline-none"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
              autoFocus={collapsed && hovered}
            />
          )}
          {query && (
            <button onClick={() => { setQuery(''); setSuggestions([]); }}
              className="text-muted-foreground hover:text-primary transition-colors">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-background/95 border border-primary/20 rounded-lg overflow-hidden shadow-xl">
            {suggestions.map(c => (
              <button key={c} onClick={() => handleSelect(c)}
                className="w-full text-left px-3 py-1.5 text-[11px] font-mono text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── COUNTRY INTEL LAYER ─────────────────────────────────────────────────────
// Lightweight approach: load GeoJSON once into memory, use map-level mousemove
// to detect which country is under cursor, draw ONE highlight polygon on hover.
// Right-click anywhere on the map fires the context menu for that country.
interface CtxMenu { x: number; y: number; country: string; }

// Module-level cache so GeoJSON is shared across re-mounts and loaded only once
let _geojsonCache: any[] | null = null;
let _geojsonPromise: Promise<any[]> | null = null;
function loadGeoJson(): Promise<any[]> {
  if (_geojsonCache) return Promise.resolve(_geojsonCache);
  if (_geojsonPromise) return _geojsonPromise;
  _geojsonPromise = fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
    .then(r => r.json())
    .then((gj: any) => { _geojsonCache = gj.features; return _geojsonCache!; })
    .catch(() => []);
  return _geojsonPromise;
}

// Simple point-in-polygon (ray casting) for GeoJSON Polygon / MultiPolygon
function pointInGeoJsonFeature(lng: number, lat: number, feature: any): boolean {
  const geom = feature?.geometry;
  if (!geom) return false;
  const rings: number[][][] = geom.type === 'Polygon'
    ? geom.coordinates
    : geom.type === 'MultiPolygon'
      ? geom.coordinates.flat(1)
      : [];
  for (const ring of rings) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

function CountryIntelLayer({
  enabled,
  selectedCountry,
  onContextMenu,
  onCountryClick,
}: {
  enabled: boolean;
  selectedCountry: string | null;
  onContextMenu: (m: CtxMenu) => void;
  onCountryClick: (country: string) => void;
}) {
  const map = useMap();
  const geojsonRef = useRef<any>(null);   // raw GeoJSON features array
  const highlightRef = useRef<any>(null); // single L.geoJSON layer for hover highlight
  const selectedHighlightRef = useRef<any>(null); // layer for selected country
  const hoveredRef = useRef<string | null>(null);
  const ctxRef = useRef(onContextMenu);
  const clickRef = useRef(onCountryClick);
  const enabledRef = useRef(enabled);
  const selectedRef = useRef<string | null>(selectedCountry);
  useEffect(() => { ctxRef.current = onContextMenu; }, [onContextMenu]);
  useEffect(() => { clickRef.current = onCountryClick; }, [onCountryClick]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { selectedRef.current = selectedCountry; }, [selectedCountry]);

  // Load GeoJSON once (uses module-level cache to survive re-mounts)
  useEffect(() => {
    loadGeoJson().then(features => { geojsonRef.current = features; });
  }, []);

  // Draw / clear selected country highlight
  useEffect(() => {
    if (selectedHighlightRef.current) {
      map.removeLayer(selectedHighlightRef.current);
      selectedHighlightRef.current = null;
    }
    if (!selectedCountry || !geojsonRef.current) return;
    const feat = geojsonRef.current.find((f: any) => (f?.properties?.ADMIN ?? f?.properties?.name) === selectedCountry);
    if (!feat) return;
    selectedHighlightRef.current = L.geoJSON(feat, {
      style: { fillColor: '#ff4444', fillOpacity: 0.22, color: '#ff4444', weight: 1.5, opacity: 0.9, interactive: false },
    }).addTo(map);
  }, [selectedCountry, map]);

  // Map-level mousemove → hover highlight; contextmenu → context menu
  useEffect(() => {
    const onMouseMove = (e: any) => {
      if (!enabledRef.current || !geojsonRef.current) return;
      const { lng, lat } = e.latlng;
      // Find feature under cursor
      const feat = geojsonRef.current.find((f: any) => pointInGeoJsonFeature(lng, lat, f));
      const name: string = feat?.properties?.ADMIN ?? feat?.properties?.name ?? '';
      if (name === hoveredRef.current) return; // no change
      hoveredRef.current = name;
      // Remove old hover highlight
      if (highlightRef.current) { map.removeLayer(highlightRef.current); highlightRef.current = null; }
      if (!name) return;
      // Draw new hover highlight (skip if it's the selected country — already highlighted)
      if (name !== selectedRef.current) {
        highlightRef.current = L.geoJSON(feat, {
          style: { fillColor: '#4488ff', fillOpacity: 0.18, color: '#4488ff', weight: 1.2, opacity: 0.7, interactive: false },
        }).addTo(map);
      }
      // Show tooltip
      const pt = map.latLngToContainerPoint(e.latlng);
      map.getContainer().title = name ? `${name} — right-click for intel` : '';
    };

    const onContextMenu = (e: any) => {
      if (!enabledRef.current || !geojsonRef.current) return;
      const { lng, lat } = e.latlng;
      const feat = geojsonRef.current.find((f: any) => pointInGeoJsonFeature(lng, lat, f));
      const name: string = feat?.properties?.ADMIN ?? feat?.properties?.name ?? '';
      if (!name) return;
      const pt = map.latLngToContainerPoint(e.latlng);
      ctxRef.current({ x: pt.x, y: pt.y, country: name });
    };

    const onClick = (e: any) => {
      if (!enabledRef.current || !geojsonRef.current) return;
      const { lng, lat } = e.latlng;
      const feat = geojsonRef.current.find((f: any) => pointInGeoJsonFeature(lng, lat, f));
      const name: string = feat?.properties?.ADMIN ?? feat?.properties?.name ?? '';
      if (!name) return;
      clickRef.current(name);
    };

    const onMouseOut = () => {
      if (highlightRef.current) { map.removeLayer(highlightRef.current); highlightRef.current = null; }
      hoveredRef.current = null;
      map.getContainer().title = '';
    };

    map.on('mousemove', onMouseMove);
    map.on('contextmenu', onContextMenu);
    map.on('click', onClick);
    map.getContainer().addEventListener('mouseleave', onMouseOut);

    return () => {
      map.off('mousemove', onMouseMove);
      map.off('contextmenu', onContextMenu);
      map.off('click', onClick);
      map.getContainer().removeEventListener('mouseleave', onMouseOut);
      if (highlightRef.current) { map.removeLayer(highlightRef.current); highlightRef.current = null; }
      if (selectedHighlightRef.current) { map.removeLayer(selectedHighlightRef.current); selectedHighlightRef.current = null; }
    };
  }, [map]);

  // Clear hover highlight when layer is disabled
  useEffect(() => {
    if (!enabled) {
      if (highlightRef.current) { map.removeLayer(highlightRef.current); highlightRef.current = null; }
      hoveredRef.current = null;
    }
  }, [enabled, map]);

  return null;
}

// ─── HEATMAP LAYER ─────────────────────────────────────────────────────────────
interface HeatPoint { lat: number; lng: number; intensity: number; }
function HeatmapLayer({ points, visible }: { points: HeatPoint[]; visible: boolean }) {
  const map = useMap();
  const heatRef = useRef<any>(null);

  useEffect(() => {
    if (!visible) {
      if (heatRef.current) { map.removeLayer(heatRef.current); heatRef.current = null; }
      return;
    }
    const data = points.map(p => [p.lat, p.lng, p.intensity] as [number, number, number]);
    if (heatRef.current) {
      heatRef.current.setLatLngs(data);
    } else {
      heatRef.current = (L as any).heatLayer(data, {
        radius: 45,
        blur: 35,
        maxZoom: 8,
        max: 1.0,
        gradient: { 0.0: '#0ea5e9', 0.3: '#6366f1', 0.5: '#f59e0b', 0.75: '#ef4444', 1.0: '#ffffff' },
        minOpacity: 0.3,
      }).addTo(map);
    }
    return () => {
      if (heatRef.current) { map.removeLayer(heatRef.current); heatRef.current = null; }
    };
  }, [points, visible, map]);

  return null;
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
interface LiveTabProps { region: string; onExplore?: (title: string) => void; onVerify?: (articleId: number) => void; initialCountryFilter?: string; onCountryFilterUsed?: () => void; }

// THREATCON metadata
const THREATCON_META = [
  { level: 'NORMAL',  short: 'NRM', color: '#22c55e',  bg: '#052e16', ring: '#16a34a' },
  { level: 'ALPHA',   short: 'α',   color: '#84cc16',  bg: '#1a2e05', ring: '#65a30d' },
  { level: 'BRAVO',   short: 'β',   color: 'var(--intel-yellow)',  bg: '#2d1f00', ring: '#d97706' },
  { level: 'CHARLIE', short: 'γ',   color: 'var(--intel-red)',  bg: '#2d0505', ring: '#dc2626' },
  { level: 'DELTA',   short: 'Δ',   color: '#dc2626',  bg: '#1a0000', ring: '#b91c1c' },
];

// Time window options
const TIME_WINDOWS = [
  { label: '6H',  hours: 6 },
  { label: '24H', hours: 24 },
  { label: '48H', hours: 48 },
  { label: '7D',  hours: 168 },
  { label: '14D', hours: 336 },
  { label: '1M',  hours: 720 },
];

export default function LiveTab({ region, onExplore, onVerify, initialCountryFilter, onCountryFilterUsed }: LiveTabProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedFacilityTypes, setSelectedFacilityTypes] = useState<string[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [selectedFacility, setSelectedFacility] = useState<any>(null);
  const [selectedCountryForPanel, setSelectedCountryForPanel] = useState<string | null>(null);
  const [searchFlyTo, setSearchFlyTo] = useState<string | undefined>(undefined);
  const [mapCtxMenu, setMapCtxMenu] = useState<CtxMenu | null>(null);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showArticles, setShowArticles] = useState(true);
  const [showConnections, setShowConnections] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showAttacks, setShowAttacks] = useState(false);
  const [showThreatRings, setShowThreatRings] = useState(false);  // off by default
  const [showCountryIntel, setShowCountryIntel] = useState(true);  // country hover layer
  const [clusterArticles, setClusterArticles] = useState(true);
  const [clusterFacilities, setClusterFacilities] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const { theme } = useTheme();
  const [baseMap, setBaseMap] = useState<'dark' | 'light' | 'satellite' | 'topo' | 'osm'>(theme === 'light' ? 'light' : 'dark');

  // Sync baseMap with theme changes
  useEffect(() => {
    setBaseMap(theme === 'light' ? 'light' : 'dark');
  }, [theme]);
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState<string | undefined>(initialCountryFilter);
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [timeWindowHours, setTimeWindowHours] = useState(24);

  // Apply initialCountryFilter when it changes (from CompareTab drill-down)
  useEffect(() => {
    if (initialCountryFilter) {
      setCountryFilter(initialCountryFilter);
      onCountryFilterUsed?.();
    }
  }, [initialCountryFilter]);

  // Panel visibility
  const [showIntelPanel, setShowIntelPanel] = useState(true);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(true);
  const [intelPanelTab, setIntelPanelTab] = useState<'feed' | 'threats' | 'facilities'>('feed');
  const [intelPanelExpanded, setIntelPanelExpanded] = useState(false);

  // Breaking news flash
  const [flashArticle, setFlashArticle] = useState<any>(null);
  const prevBreakingRef = useRef<Set<number>>(new Set());

  // Ticker
  const tickerRef = useRef<HTMLDivElement>(null);

  // ── Data Queries ──────────────────────────────────────────────────────────
  const articlesSince = useMemo(() => new Date(Date.now() - timeWindowHours * 60 * 60 * 1000), [timeWindowHours]);
  const { data: articles, isLoading: articlesLoading, refetch: refetchArticles } = trpc.articles.list.useQuery(
    { region, topics: selectedTopics.length > 0 ? selectedTopics : undefined, search: searchQuery || undefined, limit: 1000, since: articlesSince },
    { refetchInterval: 30000 }
  );
  const { data: facilities, refetch: refetchFacilities } = trpc.facilities.list.useQuery(
    { region, types: selectedFacilityTypes.length > 0 ? selectedFacilityTypes : undefined, limit: 500 },
    { refetchInterval: 120000 }
  );
  const { data: breaking } = trpc.articles.breaking.useQuery(
    { region, limit: 10 },
    { refetchInterval: 15000 }
  );
  const { data: threatSummary } = trpc.intel.regionThreatSummary.useQuery(
    { region, hours: timeWindowHours },
    { refetchInterval: 60000 }
  );
  const { data: countryMatrix } = trpc.intel.countryThreatMatrix.useQuery(
    { region, hours: timeWindowHours },
    { refetchInterval: 60000 }
  );
  const { data: eventTimeline } = trpc.intel.eventTimeline.useQuery(
    { region, hours: timeWindowHours, limit: 40 },
    { refetchInterval: 30000 }
  );
  const { data: facilityThreatScores } = trpc.intel.facilityThreatScores.useQuery(
    { region },
    { refetchInterval: 120000 }
  );
  const { data: facilityNewsData, isLoading: facilityNewsLoading } = trpc.facilities.newsForFacility.useQuery(
    { facilityId: selectedFacility?.id ?? 0, limit: 15 },
    { enabled: !!selectedFacility?.id, staleTime: 60000 }
  );
  const { data: facilityNewsCounts } = trpc.facilities.newsCounts.useQuery(undefined, { staleTime: 120000 });
  const { data: facilityBreakingCounts } = trpc.facilities.breakingNewsCounts.useQuery(undefined, { staleTime: 60000 });
  const { data: topicDist } = trpc.articles.topicDistribution.useQuery({ region });

  // ── Computed Values ───────────────────────────────────────────────────────
  const topicCounts: Record<string, number> = {};
  topicDist?.forEach(t => { topicCounts[t.topic] = t.count; });

  const threatScoreMap = useMemo(() => {
    const m: Record<number, number> = {};
    facilityThreatScores?.forEach(s => { m[s.facilityId] = s.threatScore; });
    return m;
  }, [facilityThreatScores]);

  const threatTrendMap = useMemo(() => {
    const m: Record<number, { trend: string; trendData: { currentMonth: number; previousMonth: number; twoMonthsAgo: number } }> = {};
    facilityThreatScores?.forEach(s => {
      if ('trend' in s) m[s.facilityId] = { trend: (s as any).trend, trendData: (s as any).trendData };
    });
    return m;
  }, [facilityThreatScores]);

  const countryThreatMap = useMemo(() => {
    const m: Record<string, { threatScore: number; threatLevel: string; dominantTopic: string; articleCount: number; breakingCount: number }> = {};
    countryMatrix?.forEach(c => { m[c.country] = c; });
    return m;
  }, [countryMatrix]);

  const parseTopics = (raw: any): string[] => {
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw ?? '[]'); } catch { return []; }
  };

  const filteredArticles = useMemo(() => {
    return (articles ?? []).filter(a => {
      if (sentimentFilter !== "all" && a.sentiment !== sentimentFilter) return false;
      if (countryFilter && a.country !== countryFilter) return false;
      if (selectedTopics.length > 0) {
        const articleTopics = parseTopics(a.topicsJson ?? (a as any).topics);
        if (!articleTopics.some((t: string) => selectedTopics.includes(t))) return false;
      }
      return true;
    });
  }, [articles, sentimentFilter, selectedTopics, countryFilter]);

  const articlesByCountry = useMemo(() => {
    const map: Record<string, any[]> = {};
    filteredArticles.filter(a => a.country).forEach(a => {
      if (!map[a.country!]) map[a.country!] = [];
      map[a.country!].push(a);
    });
    return map;
  }, [filteredArticles]);
  // Group facilities by country for clustering
  const facilitiesByCountry = useMemo(() => {
    const map: Record<string, any[]> = {};
    (facilities ?? []).filter(f => f.country && f.latitude && f.longitude).forEach(f => {
      const key = f.country as string;
      if (!map[key]) map[key] = [];
      map[key].push(f);
    });
    return map;
  }, [facilities]);

  const getDominantColor = (countryArticles: any[]) => {
    const tc: Record<string, number> = {};
    countryArticles.forEach(a => {
      parseTopics(a.topicsJson ?? (a as any).topics).forEach((t: string) => { tc[t] = (tc[t] || 0) + 1; });
    });
    const dominant = Object.entries(tc).sort((a, b) => b[1] - a[1])[0]?.[0];
    return TOPIC_COLORS[dominant ?? ''] ?? '#22d3ee';
  };

  const heatmapPoints = useMemo((): HeatPoint[] => {
    const countMap: Record<string, { count: number; lat: number; lng: number }> = {};
    filteredArticles.forEach(a => {
      if (!a.country) return;
      const coords = getCountryCoords(a.country);
      if (!coords) return;
      if (!countMap[a.country]) countMap[a.country] = { count: 0, lat: coords[0], lng: coords[1] };
      countMap[a.country].count++;
    });
    const maxCount = Math.max(...Object.values(countMap).map(v => v.count), 1);
    return Object.values(countMap).map(v => ({ lat: v.lat, lng: v.lng, intensity: v.count / maxCount }));
  }, [filteredArticles]);

  /**
   * De-collision engine v2: grid-based layout with guaranteed minimum separation.
   * Groups articles by country, then places them on a rectangular grid
   * centered on the country coordinate. Each cell is CELL_DEG apart.
   * Breaking news articles are placed first (center cells).
   * Maximum 50 articles shown per country to prevent runaway spread.
   */
  const decollidedPositions = useMemo(() => {
    const positions = new Map<number, [number, number]>();
    const CELL_DEG = 0.35; // ~38km per cell — enough separation to click at zoom 5
    const MAX_PER_COUNTRY = 40;

    // Group articles by country, breaking news first
    const byCountry: Record<string, typeof filteredArticles> = {};
    filteredArticles.forEach(a => {
      const key = a.country ?? '__unknown__';
      if (!byCountry[key]) byCountry[key] = [];
      byCountry[key].push(a);
    });

    Object.values(byCountry).forEach(rawGroup => {
      const base = getCountryCoords(rawGroup[0].country ?? '');
      if (!base) return;

      // Sort: breaking first, then by importance desc
      const group = [...rawGroup]
        .sort((a, b) => (b.isBreaking ? 1 : 0) - (a.isBreaking ? 1 : 0))
        .slice(0, MAX_PER_COUNTRY);

      // Build a spiral grid: (0,0), (1,0), (0,1), (-1,0), (0,-1), (1,1), ...
      // Using a concentric square shell pattern for even distribution
      const gridCells: [number, number][] = [];
      gridCells.push([0, 0]);
      let shell = 1;
      while (gridCells.length < group.length) {
        // Top row: (-shell, shell) to (shell, shell)
        for (let x = -shell; x <= shell && gridCells.length < group.length; x++)
          gridCells.push([x, shell]);
        // Right col: (shell, shell-1) to (shell, -shell)
        for (let y = shell - 1; y >= -shell && gridCells.length < group.length; y--)
          gridCells.push([shell, y]);
        // Bottom row: (shell-1, -shell) to (-shell, -shell)
        for (let x = shell - 1; x >= -shell && gridCells.length < group.length; x--)
          gridCells.push([x, -shell]);
        // Left col: (-shell, -shell+1) to (-shell, shell-1)
        for (let y = -shell + 1; y <= shell - 1 && gridCells.length < group.length; y++)
          gridCells.push([-shell, y]);
        shell++;
      }

      group.forEach((a, i) => {
        const [gx, gy] = gridCells[i] ?? [0, 0];
        positions.set(a.id, [
          base[0] + gy * CELL_DEG,
          base[1] + gx * CELL_DEG,
        ]);
      });
    });
    return positions;
  }, [filteredArticles]);

  const activeFilterCount = selectedTopics.length + selectedFacilityTypes.length +
    (searchQuery ? 1 : 0) + (sentimentFilter !== "all" ? 1 : 0) + (countryFilter ? 1 : 0);

  const toggleTopic = (id: string) =>
    setSelectedTopics(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  const toggleFacilityType = (id: string) =>
    setSelectedFacilityTypes(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  const clearAllFilters = () => {
    setSelectedTopics([]); setSelectedFacilityTypes([]);
    setSearchQuery(""); setSentimentFilter("all"); setCountryFilter(undefined);
  };

  // THREATCON data
  const tc = threatSummary?.threatcon ?? 1;
  const tcMeta = THREATCON_META[tc - 1] ?? THREATCON_META[0];

  // Breaking news flash detection
  useEffect(() => {
    if (!breaking?.length) return;
    const newBreaking = breaking.filter(a => a.id && !prevBreakingRef.current.has(a.id));
    if (newBreaking.length > 0 && prevBreakingRef.current.size > 0) {
      setFlashArticle(newBreaking[0]);
      setTimeout(() => setFlashArticle(null), 6000);
    }
    breaking.forEach(a => { if (a.id) prevBreakingRef.current.add(a.id); });
  }, [breaking]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'f' || e.key === 'F') setShowFacilities(v => !v);
      if (e.key === 'a' || e.key === 'A') setShowArticles(v => !v);
      if (e.key === 'h' || e.key === 'H') setShowHeatmap(v => !v);
      if (e.key === 'l' || e.key === 'L') setShowLayerPanel(v => !v);
      if (e.key === 'i' || e.key === 'I') setShowCountryIntel(v => !v);
      if (e.key === 'c' || e.key === 'C') setShowIntelPanel(v => !v);
      if (e.key === 'Escape') { setSelectedFacility(null); setSelectedArticle(null); setFlashArticle(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Tile URL
   const tileUrl = baseMap === 'satellite'
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : baseMap === 'topo'
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
    : baseMap === 'osm'
    ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    : baseMap === 'light'
    ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const tileAttrib = baseMap === 'osm'
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    : baseMap === 'satellite' || baseMap === 'topo'
    ? 'Tiles &copy; Esri'
    : '&copy; <a href="https://carto.com/">CARTO</a>';

  // Ticker items from event timeline
  const tickerItems = useMemo(() => {
    const items = [...(eventTimeline ?? [])];
    // Prioritize breaking
    items.sort((a, b) => {
      if (a.isBreaking && !b.isBreaking) return -1;
      if (!a.isBreaking && b.isBreaking) return 1;
      return 0;
    });
    return items;
  }, [eventTimeline]);

  // Attack routes from real data (high-importance articles with country pairs)
  const attackRoutes = useMemo(() => {
    if (!articles) return [];
    const routes: any[] = [];
    const highImpact = articles.filter(a => (a.importance ?? 5) >= 8 && a.country);
    // Create routes between countries with conflict/military topics
    const conflictArts = highImpact.filter(a => {
      const topics = parseTopics(a.topicsJson ?? (a as any).topics);
      return topics.includes('WAR/CONFLICT') || topics.includes('SECURITY');
    });
    conflictArts.slice(0, 8).forEach((art, i) => {
      const fromCoords = getCountryCoords(art.country ?? '');
      if (!fromCoords) return;
      // Find a related country to draw a vector to
      const relatedCountries = ['Israel', 'Iran', 'Saudi Arabia', 'USA', 'Russia', 'Turkey', 'Egypt'];
      const toCountry = relatedCountries.find(c => c !== art.country);
      if (!toCountry) return;
      const toCoords = getCountryCoords(toCountry);
      if (!toCoords) return;
      routes.push({
        id: `route-${art.id ?? i}`,
        fromLat: fromCoords[0], fromLon: fromCoords[1],
        toLat: toCoords[0], toLon: toCoords[1],
        type: (art.importance ?? 5) >= 9 ? 'missile' : 'airstrike',
        severity: (art.importance ?? 5) >= 9 ? 'critical' : 'high',
        label: `${art.country} → ${toCountry}`,
      });
    });
    return routes;
  }, [articles]);

  return (
    <div className="relative flex flex-col h-full overflow-hidden bg-background">

      {/* ══════════════════════════════════════════════════════════════════════
          TOP COMMAND BAR
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 bg-background border-b border-border/60 z-[2000]"
        style={{ boxShadow: '0 2px 20px oklch(from var(--foreground) l c h / 0.15)' }}>

        {/* THREATCON Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
          style={{ background: tcMeta.bg, borderColor: tcMeta.ring + '60' }}>
          <div className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: tcMeta.color, boxShadow: `0 0 8px ${tcMeta.color}`, animation: tc >= 3 ? 'dot-blink 1s ease-in-out infinite' : 'none' }}/>
          <span className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: tcMeta.color }}>
            THREATCON {tcMeta.level}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/60">{tc}/5</span>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-2 flex-1">
          <span className="text-[8px] font-mono text-muted-foreground/35 tracking-[0.15em] uppercase flex-shrink-0">Displaying</span>
          {[
            { val: threatSummary?.totalArticles ?? 0, cap: 500, label: 'Articles', color: 'var(--primary)' },
            { val: threatSummary?.breakingCount ?? 0, cap: 100, label: 'Breaking', color: 'var(--intel-red)' },
            { val: threatSummary?.criticalFacilities ?? 0, cap: 50, label: 'Critical Fac.', color: '#f97316' },
            { val: threatSummary?.activeConflicts ?? 0, cap: 100, label: 'Conflicts', color: '#a78bfa' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-border/20 bg-foreground/[0.025]">
              <span className="text-[11px] font-bold font-mono leading-none tabular-nums" style={{ color: s.color }}>
                {s.val >= s.cap ? `${s.cap}+` : s.val}
              </span>
              <span className="text-[8px] text-muted-foreground/50 uppercase tracking-wide">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Time window selector */}
        <div className="flex items-center gap-0.5 bg-foreground/[0.04] rounded-lg p-0.5 border border-border/20">
          {TIME_WINDOWS.map(tw => (
            <button key={tw.hours} onClick={() => setTimeWindowHours(tw.hours)}
              className="px-2 py-1 rounded-md text-[9px] font-bold tracking-wide transition-all"
              style={timeWindowHours === tw.hours
                ? { background: 'var(--primary)', color: 'var(--primary-foreground)', boxShadow: '0 1px 6px oklch(from var(--primary) l c h / 0.35)' }
                : { color: 'oklch(from var(--foreground) l c h / 0.3)', background: 'transparent' }}>
              {tw.label}
            </button>
          ))}
        </div>

        {/* Map mode */}
        <div className="flex items-center gap-1 bg-foreground/5 rounded-lg p-0.5">
          {(['dark', 'light', 'osm', 'satellite', 'topo'] as const).map(m => (
            <button key={m} onClick={() => setBaseMap(m)}
              className="px-2 py-1 rounded-md text-[10px] font-medium transition-all capitalize"
              style={baseMap === m ? { background: 'var(--primary)', color: 'var(--primary-foreground)' } : { color: 'oklch(from var(--foreground) l c h / 0.3)' }}>
              {m === 'osm' ? 'OSM' : m === 'dark' ? '🌑 Dark' : m === 'light' ? '💡 Light' : m === 'satellite' ? 'SAT' : 'Topo'}
            </button>
          ))}
        </div>

        {/* Panel toggles */}
        <div className="flex items-center gap-1">
          <button onClick={() => setShowIntelPanel(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all border"
            style={showIntelPanel ? { background: 'var(--primary)', borderColor: 'var(--primary)', color: 'var(--primary-foreground)' } : { background: 'transparent', borderColor: 'oklch(from var(--foreground) l c h / 0.1)', color: 'oklch(from var(--foreground) l c h / 0.4)' }}>
            <Newspaper size={10}/> Intel
          </button>
          <button onClick={() => setShowLayerPanel(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all border"
            style={showLayerPanel ? { background: 'var(--intel-green)', borderColor: 'var(--intel-green)', color: 'var(--primary-foreground)' } : { background: 'transparent', borderColor: 'oklch(from var(--foreground) l c h / 0.1)', color: 'oklch(from var(--foreground) l c h / 0.4)' }}>
            <Layers size={10}/> Layers
          </button>
        </div>

        {/* Refresh */}
        <button onClick={() => { refetchArticles(); refetchFacilities(); }}
          className="p-1.5 rounded-lg border border-border/70 text-muted-foreground/60 hover:text-primary hover:border-primary/40 transition-all">
          <RefreshCw size={12}/>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MAP + PANELS ROW
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ─── INTEL PANEL (left) ─────────────────────────────────────────── */}
        {showIntelPanel && (
          <div className="flex-shrink-0 flex flex-col bg-background border-r border-border/60 overflow-hidden z-[1000] transition-all duration-300" style={{ width: intelPanelExpanded ? '480px' : '288px' }}>
            {/* Panel header */}
            <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Activity size={11} className="text-primary"/>
                <span className="text-[11px] font-bold text-foreground/80 tracking-wide">Intelligence Feed</span>
                {activeFilterCount > 0 && (
                  <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">{activeFilterCount}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {activeFilterCount > 0 && (
                  <button onClick={clearAllFilters} className="text-[10px] text-muted-foreground/60 hover:text-red-400 transition-colors">Clear</button>
                )}
                <button onClick={() => setIntelPanelExpanded(v => !v)}
                  className="text-muted-foreground/60 hover:text-foreground transition-colors p-0.5">
                  {intelPanelExpanded ? <ChevronLeft size={11}/> : <ChevronRight size={11}/>}
                </button>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex border-b border-border/60 flex-shrink-0">
              {([
                { id: 'feed', label: 'Feed', icon: <Newspaper size={10}/> },
                { id: 'threats', label: 'Threats', icon: <Activity size={10}/> },
                { id: 'facilities', label: 'Facilities', icon: <Building2 size={10}/> },
              ] as const).map(tab => (
                <button key={tab.id} onClick={() => setIntelPanelTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-medium transition-all border-b-2 -mb-px ${
                    intelPanelTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground/70 hover:text-foreground/60'
                  }`}>
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 border-b border-border/60 flex-shrink-0">
              {[
                { val: filteredArticles.length, cap: 1000, total: articles?.length ?? 0, label: 'Articles', color: 'text-blue-400' },
                { val: facilities?.length ?? 0, cap: 500, total: facilities?.length ?? 0, label: 'Facilities', color: 'text-amber-400' },
                { val: breaking?.length ?? 0, cap: 100, total: breaking?.length ?? 0, label: 'Breaking', color: (breaking?.length ?? 0) > 0 ? 'text-red-400' : 'text-muted-foreground/50' },
              ].map((s, i) => (
                <div key={i} className={`group relative flex flex-col items-center py-2 cursor-default select-none ${i < 2 ? 'border-r border-border/60' : ''}`}>
                  <span className={`text-sm font-bold font-mono leading-none tabular-nums ${s.color}`}>
                    {s.val >= s.cap ? `${s.cap}+` : s.val}
                  </span>
                  <span className="text-[9px] text-muted-foreground/70 mt-0.5">{s.label}</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-popover border border-border/60 text-[8px] font-mono text-muted-foreground/80 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                    In database: {s.total >= s.cap ? `${s.cap}+` : s.total}
                  </div>
                </div>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">

              {/* ── FEED TAB ── */}
              {intelPanelTab === 'feed' && (
                <div className="flex flex-col h-full">
                  {/* Search */}
                  <div className="px-3 py-2 border-b border-border/60 flex-shrink-0">
                    <div className="flex items-center gap-2 bg-foreground/5 border border-border/70 rounded-lg px-2.5 py-1.5 focus-within:border-primary/50 transition-colors">
                      <Search size={10} className="text-muted-foreground/70 flex-shrink-0"/>
                      <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search intelligence..." className="flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/50 outline-none"/>
                      {searchQuery && <button onClick={() => setSearchQuery("")} className="text-muted-foreground/50 hover:text-foreground"><X size={9}/></button>}
                    </div>
                  </div>
                  {/* Topic chips */}
                  <div className="px-3 py-2 border-b border-border/60 flex-shrink-0">
                    <div className="flex flex-wrap gap-1">
                      {TOPICS.map(topic => {
                        const isActive = selectedTopics.includes(topic.id);
                        const count = topicCounts[topic.id] ?? 0;
                        return (
                          <button key={topic.id} onClick={() => toggleTopic(topic.id)}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-all border"
                            style={isActive
                              ? { background: `${topic.color}22`, borderColor: topic.color, color: topic.color }
                              : { background: 'transparent', borderColor: 'oklch(from var(--foreground) l c h / 0.08)', color: 'oklch(from var(--foreground) l c h / 0.4)' }}>
                            <span style={{ width: 4, height: 4, borderRadius: '50%', background: topic.color, display: 'inline-block', flexShrink: 0 }}/>
                            {topic.label.split(' ')[0]}
                            {count > 0 && <span className="opacity-50">{count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* Sentiment filter */}
                  <div className="px-3 py-1.5 border-b border-border/60 flex-shrink-0">
                    <div className="grid grid-cols-4 gap-1">
                      {[{val:'all',label:'All'},{val:'negative',label:'Neg'},{val:'neutral',label:'Neu'},{val:'positive',label:'Pos'}].map(s => (
                        <button key={s.val} onClick={() => setSentimentFilter(s.val)}
                          className={`py-1 text-[9px] rounded border font-medium transition-all ${
                            sentimentFilter === s.val
                              ? s.val === 'all' ? 'bg-foreground/10 border-foreground/40 text-foreground'
                                : s.val === 'negative' ? 'bg-red-500/15 border-red-400 text-red-400'
                                : s.val === 'neutral' ? 'bg-amber-500/15 border-amber-400 text-amber-400'
                                : 'bg-emerald-500/15 border-emerald-400 text-emerald-400'
                              : 'border-border/60 text-muted-foreground/60 hover:text-muted-foreground'
                          }`}>{s.label}</button>
                      ))}
                    </div>
                  </div>
                  {/* Article list */}
                  <div className="flex-1 overflow-y-auto">
                    {articlesLoading ? (
                      <div className="p-3 space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-12 bg-foreground/4 rounded-lg animate-pulse"/>)}</div>
                    ) : filteredArticles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <Newspaper size={20} className="text-muted-foreground/20 mb-2"/>
                        <div className="text-xs text-muted-foreground/50">No articles match filters</div>
                        {activeFilterCount > 0 && <button onClick={clearAllFilters} className="mt-2 text-[10px] text-primary hover:underline">Clear filters</button>}
                      </div>
                    ) : (
                      <div className="divide-y divide-white/4">
                        {filteredArticles.slice(0, 40).map(article => {
                          const topics = parseTopics(article.topicsJson ?? (article as any).topics);
                          const topicColor = TOPIC_COLORS[topics[0]] ?? '#94a3b8';
                          const isSelected = selectedArticle?.id === article.id;
                          return (
                            <button key={article.id}
                              className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-all hover:bg-foreground/4 border-l-2 ${isSelected ? 'bg-foreground/5' : 'border-transparent'}`}
                              style={isSelected ? { borderLeftColor: topicColor } : {}}
                              onClick={() => setSelectedArticle(isSelected ? null : article)}>
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: topicColor }}/>
                              <div className="flex-1 min-w-0">
                                {article.isBreaking && <div className="text-red-400 text-[8px] font-bold mb-0.5 tracking-wider">● BREAKING</div>}
                                <div className="text-[10px] text-foreground/80 leading-snug line-clamp-2 font-medium">{article.title}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: `${topicColor}18`, color: topicColor }}>{topics[0] ?? 'General'}</span>
                                  <span className="text-[8px] text-muted-foreground/50">{article.country}</span>
                                  <span className="text-[8px] text-muted-foreground/35">{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : ''}</span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Selected article detail */}
                  {selectedArticle && (
                    <div className="border-t border-border/60 p-3 bg-card flex-shrink-0">
                      <div className="flex items-start justify-between mb-1.5">
                        <span className="text-[9px] text-primary font-semibold uppercase tracking-wide">Selected</span>
                        <button onClick={() => setSelectedArticle(null)} className="text-muted-foreground/50 hover:text-foreground"><X size={10}/></button>
                      </div>
                      <div className="text-[11px] font-semibold text-foreground leading-snug mb-1 line-clamp-2">{selectedArticle.title}</div>
                      {selectedArticle.summary && <div className="text-[9px] text-muted-foreground/80 mb-1.5 line-clamp-2">{selectedArticle.summary}</div>}
                      <div className="flex items-center gap-3">
                        <a href={selectedArticle.url?.startsWith('http') && !selectedArticle.url.includes('example.com')
                            ? selectedArticle.url
                            : `https://news.google.com/search?q=${encodeURIComponent(selectedArticle.title ?? '')}&hl=en-US&gl=US&ceid=US:en`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-primary hover:underline font-medium">
                          <ExternalLink size={9}/> Read
                        </a>
                        {onExplore && (
                          <button onClick={() => onExplore(selectedArticle.title ?? '')}
                            className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 font-medium">
                            <Network size={9}/> Explore
                          </button>
                        )}
                        {onVerify && selectedArticle.id && (
                          <button onClick={() => onVerify(selectedArticle.id)}
                            className="flex items-center gap-1 text-[10px] text-green-400 hover:text-green-300 font-medium">
                            <CheckCircle2 size={9}/> Verify
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── THREATS TAB ── */}
              {intelPanelTab === 'threats' && (
                <div className="p-3 space-y-3">
                  {/* THREATCON detail */}
                  <div className="rounded-xl border p-3" style={{ background: tcMeta.bg, borderColor: tcMeta.ring + '50' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: tcMeta.color }}>
                        THREATCON {tcMeta.level}
                      </span>
                      <span className="text-[11px] font-black font-mono" style={{ color: tcMeta.color }}>{tc}/5</span>
                    </div>
                    {/* Threat bar */}
                    <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${(tc / 5) * 100}%`, background: tcMeta.color, boxShadow: `0 0 8px ${tcMeta.color}` }}/>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[9px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground/70">Breaking:</span>
                        <span className="font-bold text-red-400">{threatSummary?.breakingCount ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground/70">Critical Fac:</span>
                        <span className="font-bold text-orange-400">{threatSummary?.criticalFacilities ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground/70">Conflicts:</span>
                        <span className="font-bold text-purple-400">{threatSummary?.activeConflicts ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground/70">Total:</span>
                        <span className="font-bold text-blue-400">{threatSummary?.totalArticles ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Top threat countries */}
                  <div>
                    <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">Top Threat Countries</div>
                    <div className="space-y-1.5">
                      {(threatSummary?.topThreats ?? []).map((t, i) => (
                        <div key={t.country} className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-muted-foreground/50 w-4">{i + 1}</span>
                          <span className="text-[10px] text-foreground/70 flex-1">{t.country}</span>
                          <div className="w-16 h-1.5 bg-foreground/8 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{
                              width: `${Math.min(100, t.score)}%`,
                              background: i === 0 ? '#ef4444' : i === 1 ? '#f97316' : '#f59e0b',
                            }}/>
                          </div>
                          <span className="text-[9px] font-mono text-muted-foreground/60 w-6 text-right">{t.score}</span>
                        </div>
                      ))}
                      {(!threatSummary?.topThreats?.length) && (
                        <div className="text-[10px] text-muted-foreground/40 text-center py-4">No threat data yet</div>
                      )}
                    </div>
                  </div>

                  {/* Country threat matrix */}
                  <div>
                    <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">Country Matrix</div>
                    <div className="space-y-1">
                      {(countryMatrix ?? []).slice(0, 12).map(c => {
                        const levelColors: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e' };
                        const lc = levelColors[c.threatLevel] ?? '#64748b';
                        return (
                          <div key={c.country} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-foreground/4 transition-colors">
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: lc }}/>
                            <span className="text-[10px] text-foreground/65 flex-1 truncate">{c.country}</span>
                            <span className="text-[8px] font-mono text-muted-foreground/60">{c.articleCount}</span>
                            {c.breakingCount > 0 && (
                              <span className="text-[8px] text-red-400 font-bold">+{c.breakingCount}B</span>
                            )}
                            <span className="text-[8px] font-bold px-1 rounded" style={{ background: lc + '20', color: lc }}>
                              {c.threatLevel.toUpperCase().slice(0, 3)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── FACILITIES TAB ── */}
              {intelPanelTab === 'facilities' && (
                <div className="p-3 space-y-2">
                  <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">
                    Strategic Facilities ({facilities?.length ?? 0})
                  </div>
                  {/* Facility type filter */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {FACILITY_TYPES.slice(0, 6).map(ft => {
                      const isActive = selectedFacilityTypes.includes(ft.id);
                      return (
                        <button key={ft.id} onClick={() => toggleFacilityType(ft.id)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-all border"
                          style={isActive
                            ? { background: `${ft.color}22`, borderColor: ft.color, color: ft.color }
                            : { background: 'transparent', borderColor: 'oklch(from var(--foreground) l c h / 0.08)', color: 'oklch(from var(--foreground) l c h / 0.35)' }}>
                          {ft.label.split(' ')[0]}
                        </button>
                      );
                    })}
                  </div>
                  {/* Facility list with threat scores */}
                  <div className="space-y-1">
                    {(facilities ?? []).slice(0, 20).map(f => {
                      const ft = FACILITY_MAP[f.type] ?? FACILITY_MAP['company'];
                      const score = threatScoreMap[f.id] ?? 0;
                      const threatColors: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e' };
                      const tc2 = threatColors[f.threatLevel ?? 'low'] ?? '#64748b';
                      return (
                        <button key={f.id}
                          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-foreground/5 transition-colors text-left border border-transparent hover:border-border/70"
                          onClick={() => setSelectedFacility(f)}>
                          <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--card)', border: `1px solid ${ft.color}60` }}>
                            <span style={{display:"inline-block",width:16,height:16,lineHeight:0,verticalAlign:"middle"}} dangerouslySetInnerHTML={{__html:ft.svgIcon}}/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-foreground/75 truncate font-medium">{f.name}</div>
                            <div className="text-[8px] text-muted-foreground/60 truncate">{f.country}</div>
                          </div>
                          {score > 0 && (() => {
                            const ti = threatTrendMap[f.id];
                            const arrow = ti?.trend === 'increasing' ? '↑' : ti?.trend === 'decreasing' ? '↓' : '';
                            const arrowColor = ti?.trend === 'increasing' ? '#ef4444' : ti?.trend === 'decreasing' ? '#22c55e' : '#64748b';
                            return (
                              <div className="flex flex-col items-end gap-0.5">
                                <div className="flex items-center gap-1">
                                  {arrow && <span className="text-[8px] font-bold" style={{ color: arrowColor }}>{arrow}</span>}
                                  <span className="text-[8px] font-mono font-bold" style={{ color: tc2 }}>{score}</span>
                                </div>
                                <div className="w-8 h-1 bg-foreground/8 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, score)}%`, background: tc2 }}/>
                                </div>
                              </div>
                            );
                          })()}
                        </button>
                      );
                    })}
                    {(!facilities?.length) && (
                      <div className="text-[10px] text-muted-foreground/40 text-center py-8">No facilities in this region</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── MAP AREA ─────────────────────────────────────────────────────── */}
        {/* onContextMenu prevents the browser right-click menu from appearing over the map */}
        <div className="relative flex-1 overflow-hidden" onContextMenu={(e) => e.preventDefault()}
          onClick={() => { if (mapCtxMenu) setMapCtxMenu(null); }}
        >
          <MapContainer
            center={MENA_CENTER} zoom={MENA_ZOOM}
            style={{ width: '100%', height: '100%', background: 'var(--background)' }}
            zoomControl={false}
            attributionControl={true}
          >
            <TileLayer url={tileUrl} attribution={tileAttrib} maxZoom={18}/>
            <FlyToCountry country={countryFilter}/>
            <FlyToCountry country={searchFlyTo}/>
            <FlyToRegion region={region}/>
            <HeatmapLayer points={heatmapPoints} visible={showHeatmap}/>

            {/* ── FACILITY MARKERS ── */}
            {showFacilities && (
              clusterFacilities
                ? Object.entries(facilitiesByCountry)
                    .filter(([country]) => !countryFilter || country === countryFilter)
                    .map(([country, countryFacilities]) => {
                    const coords = getCountryCoords(country);
                    if (!coords) return null;
                    const hasBreaking = countryFacilities.some(f => ((facilityBreakingCounts as Record<number, number> | undefined)?.[f.id] ?? 0) > 0);
                    if (countryFacilities.length === 1) {
                      const facility = countryFacilities[0];
                      const facilityNewsCount = (facilityNewsCounts as Record<number, number> | undefined)?.[facility.id] ?? 0;
                      const hasNews = facilityNewsCount > 0;
                      const threatScore = threatScoreMap[facility.id] ?? 0;
                      const isCriticalWithNews = (facility.threatLevel === 'critical' || threatScore >= 60) && hasNews;
                      const isDimmedFacility = selectedFacilityTypes.length > 0 && !selectedFacilityTypes.includes(facility.type);
                      return (
                        <Marker key={`fac-${facility.id}`} position={[facility.latitude!, facility.longitude!]}
                          icon={createFacilityIcon(facility.type, isCriticalWithNews, isDimmedFacility, hasBreaking)}
                          eventHandlers={{ click: () => { if (hasNews && !isDimmedFacility) setSelectedFacility(facility); } }}>
                          <Popup maxWidth={320} className="intel-popup">
                            <FacilityPopup facility={facility} newsCount={facilityNewsCount} onViewNews={hasNews && !isDimmedFacility ? () => setSelectedFacility(facility) : undefined}/>
                          </Popup>
                        </Marker>
                      );
                    }
                    return (
                      <Marker key={`fac-cluster-${country}`} position={coords}
                        icon={createFacilityClusterIcon(countryFacilities.length, hasBreaking)}>
                        <Popup maxWidth={300}>
                          <div style={{ fontFamily: 'Inter, sans-serif', padding: '8px' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--intel-yellow)', marginBottom: 6 }}>{country} — {countryFacilities.length} Facilities</div>
                            {countryFacilities.slice(0, 8).map((f: any) => (
                              <div key={f.id} style={{ fontSize: 10, color: 'var(--muted-foreground)', padding: '2px 0', borderBottom: '1px solid oklch(from var(--foreground) l c h / 0.06)' }}>{f.name}</div>
                            ))}
                            {countryFacilities.length > 8 && <div style={{ fontSize: 9, color: 'var(--muted-foreground)', marginTop: 4 }}>+{countryFacilities.length - 8} more</div>}
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })
                : (facilities ?? []).filter(f => f.latitude && f.longitude && (!countryFilter || f.country === countryFilter)).map(facility => {
                    const facilityNewsCount = (facilityNewsCounts as Record<number, number> | undefined)?.[facility.id] ?? 0;
                    const hasNews = facilityNewsCount > 0;
                    const threatScore = threatScoreMap[facility.id] ?? 0;
                    const isCriticalWithNews = (facility.threatLevel === 'critical' || threatScore >= 60) && hasNews;
                    const hasBreakingNews = ((facilityBreakingCounts as Record<number, number> | undefined)?.[facility.id] ?? 0) > 0;
                    const isDimmedFacility = selectedFacilityTypes.length > 0 && !selectedFacilityTypes.includes(facility.type);
                    return (
                      <Marker key={`fac-${facility.id}`}
                        position={[facility.latitude!, facility.longitude!]}
                        icon={createFacilityIcon(facility.type, isCriticalWithNews, isDimmedFacility, hasBreakingNews)}
                        eventHandlers={{ click: () => { if (hasNews && !isDimmedFacility) setSelectedFacility(facility); } }}>
                        <Popup maxWidth={320} className="intel-popup">
                          <FacilityPopup facility={facility} newsCount={facilityNewsCount} onViewNews={hasNews && !isDimmedFacility ? () => setSelectedFacility(facility) : undefined}/>
                        </Popup>
                      </Marker>
                    );
                  })
            )}

            {/* ── NEWS ARTICLE MARKERS ── */}
            {showArticles && (
              clusterArticles
                ? Object.entries(articlesByCountry)
                    .filter(([country]) => !countryFilter || country === countryFilter)
                    .map(([country, countryArticles]) => {
                    const coords = getCountryCoords(country);
                    if (!coords) return null;
                    const hasBreaking = countryArticles.some(a => a.isBreaking);
                    if (countryArticles.length === 1) {
                      const a = countryArticles[0];
                      const topics = parseTopics(a.topicsJson ?? (a as any).topics);
                      return (
                        <Marker key={`art-${a.id}`} position={coords}
                          icon={createNewsIcon(a.isBreaking ?? false, topics, a.sentiment ?? 'neutral')}
                          eventHandlers={{ click: () => setSelectedArticle(a) }}>
                          <Popup maxWidth={300}><NewsPopup article={a} onExplore={onExplore} onVerify={onVerify}/></Popup>
                        </Marker>
                      );
                    }
                    return (
                      <Marker key={`cluster-${country}`} position={coords}
                        icon={createClusterIcon(countryArticles.length, getDominantColor(countryArticles), hasBreaking)}>
                        <Popup maxWidth={360}><ClusterPopup country={country} articles={countryArticles} onExplore={onExplore} onVerify={onVerify}/></Popup>
                      </Marker>
                    );
                  })
                : filteredArticles.map((a) => {
                    // Use de-collision engine position (sunflower spiral per country group)
                    const pos = decollidedPositions.get(a.id);
                    if (!pos) return null;
                    const topics = parseTopics(a.topicsJson ?? (a as any).topics);
                    // Dim if a topic filter is active and this article doesn't match
                    const isDimmedArticle = selectedTopics.length > 0
                      && !topics.some((t: string) => selectedTopics.includes(t));
                    return (
                      <Marker key={`art-${a.id}`} position={pos}
                        icon={createNewsIcon(a.isBreaking ?? false, topics, a.sentiment ?? 'neutral', isDimmedArticle)}
                        zIndexOffset={a.isBreaking ? 1000 : isDimmedArticle ? -100 : 0}
                        eventHandlers={{ click: () => !isDimmedArticle && setSelectedArticle(a) }}>
                        <Popup maxWidth={300}><NewsPopup article={a} onExplore={onExplore} onVerify={onVerify}/></Popup>
                      </Marker>
                    );
                  })
            )}

            {/* ── THREAT RINGS (country threat level circles) ── */}
            {showThreatRings && Object.entries(countryThreatMap).filter(([country]) => !countryFilter || country === countryFilter).map(([country, data]) => {
              const coords = getCountryCoords(country);
              if (!coords || data.threatScore < 20) return null;
              const ringColors: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e' };
              const ringColor = ringColors[data.threatLevel] ?? '#64748b';
              const radius = 80000 + (data.threatScore / 100) * 200000;
              return (
                <Marker key={`ring-${country}`} position={coords}
                  icon={L.divIcon({
                    html: `<div style="
                      width:${Math.round(radius / 8000)}px; height:${Math.round(radius / 8000)}px;
                      border-radius:50%;
                      border: 1.5px solid ${ringColor}50;
                      background: ${ringColor}08;
                      pointer-events:none;
                    "></div>`,
                    className: '',
                    iconSize: [Math.round(radius / 8000), Math.round(radius / 8000)],
                    iconAnchor: [Math.round(radius / 16000), Math.round(radius / 16000)],
                  })}>
                  <Popup maxWidth={200}>
                    <div style={{ fontFamily: 'Inter, sans-serif', padding: '8px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: ringColor, marginBottom: 4 }}>{country}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Threat Score: {data.threatScore}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Articles: {data.articleCount}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Dominant: {data.dominantTopic}</div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* ── COUNTRY INTEL LAYER — hover highlight + right-click context menu ── */}
            <CountryIntelLayer
              enabled={showCountryIntel}
              selectedCountry={selectedCountryForPanel}
              onContextMenu={(m: CtxMenu) => setMapCtxMenu(m)}
              onCountryClick={(country: string) => setSelectedCountryForPanel(country)}
            />
          </MapContainer>

          {/* ── COUNTRY INTEL PANEL ── */}
          {selectedCountryForPanel && (
            <div className="absolute top-0 right-0 h-full z-[2000]">
              <CountryIntelPanel
                country={selectedCountryForPanel}
                onClose={() => setSelectedCountryForPanel(null)}
              />
            </div>
          )}

          {/* ── MAP RIGHT-CLICK CONTEXT MENU ── */}
          {mapCtxMenu && (
            <div
              className="absolute z-[3000] select-none"
              style={{ left: mapCtxMenu.x, top: mapCtxMenu.y }}
            >
              <div
                className="flex flex-col overflow-hidden rounded-lg shadow-2xl"
                style={{
                  background: 'var(--card)',
                  border: '1px solid #2a2a4a',
                  minWidth: 210,
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                  boxShadow: '0 8px 32px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,51,51,0.12)',
                }}
              >
                {/* Header */}
                <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                  <div className="text-[9px] font-bold tracking-widest uppercase" style={{ color: '#ff3333' }}>GEOINT CONTEXT</div>
                  <div className="text-[13px] font-bold mt-0.5 truncate" style={{ color: '#e0e0ff' }}>{mapCtxMenu.country}</div>
                </div>
                {/* Actions */}
                <div className="flex flex-col py-1">
                  <button
                    className="flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted"
                    onClick={() => {
                      setSelectedCountryForPanel(mapCtxMenu.country);
                      setMapCtxMenu(null);
                    }}
                  >
                    <Shield className="w-3.5 h-3.5 shrink-0" style={{ color: '#ff3333' }} />
                    <div>
                      <div className="text-[11px] font-bold" style={{ color: '#e0e0ff' }}>Explore Intel</div>
                      <div className="text-[9px]" style={{ color: '#555' }}>Full intelligence profile</div>
                    </div>
                  </button>
                  <button
                    className="flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted"
                    onClick={() => {
                      setCountryFilter(mapCtxMenu.country);
                      setMapCtxMenu(null);
                    }}
                  >
                    <MapIcon className="w-3.5 h-3.5 shrink-0" style={{ color: '#4488ff' }} />
                    <div>
                      <div className="text-[11px] font-bold" style={{ color: '#e0e0ff' }}>Filter to Country</div>
                      <div className="text-[9px]" style={{ color: '#555' }}>Show only this country’s data</div>
                    </div>
                  </button>
                  <div className="mx-3 my-1" style={{ borderTop: '1px solid var(--border)' }} />
                  <button
                    className="flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted"
                    onClick={() => setMapCtxMenu(null)}
                  >
                    <X className="w-3 h-3 shrink-0" style={{ color: '#444' }} />
                    <div className="text-[11px]" style={{ color: '#555' }}>Dismiss</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {showAttacks && (
            <div className="absolute inset-0 z-[500] pointer-events-none">
              <AnimatedAttackLines visible={true} routes={attackRoutes}/>
            </div>
          )}

          {/* ── MAP LEGEND (bottom-left, floating) ── */}
          {legendExpanded && (
            <div className="absolute inset-0 z-[2500] flex items-center justify-center" style={{ background: 'rgba(5,10,20,0.85)', backdropFilter: 'blur(8px)' }}>
              <div className="bg-background border border-border rounded-2xl shadow-2xl overflow-hidden" style={{ width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"/>
                    <span className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest">Map Legend</span>
                  </div>
                  <button onClick={() => setLegendExpanded(false)} className="text-muted-foreground/60 hover:text-foreground transition-colors p-1 rounded-lg hover:bg-foreground/10">
                    <X size={14}/>
                  </button>
                </div>
                <div className="overflow-y-auto p-5 space-y-5">
                  <div>
                    <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Facility Types</div>
                    <div className="grid grid-cols-3 gap-2">
                      {FACILITY_TYPES.map(ft => {
                        const existsOnMap = (facilities ?? []).some(f => f.type === ft.id);
                        return (
                          <div key={ft.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all"
                            style={{
                              background: existsOnMap ? `${ft.color}12` : 'oklch(from var(--foreground) l c h / 0.02)',
                              borderColor: existsOnMap ? `${ft.color}40` : 'oklch(from var(--foreground) l c h / 0.06)',
                              opacity: existsOnMap ? 1 : 0.4,
                            }}>
                            <div style={{ width: 22, height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ display: 'inline-block', width: 18, height: 18, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: ft.svgIcon }}/>
                            </div>
                            <div>
                              <div className="text-[10px] font-semibold leading-none mb-0.5" style={{ color: existsOnMap ? ft.color : 'oklch(from var(--foreground) l c h / 0.3)' }}>{ft.label}</div>
                              {existsOnMap && <div className="text-[8px] text-muted-foreground/60">{(facilities ?? []).filter(f => f.type === ft.id).length} on map</div>}
                              {!existsOnMap && <div className="text-[8px] text-muted-foreground/40">Not available</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="border-t border-foreground/6 pt-4">
                    <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Threat Levels</div>
                    <div className="grid grid-cols-3 gap-2">
                      {[['Critical','#ef4444'],['High','#f97316'],['Medium','#f59e0b'],['Low','#22c55e'],['Minimal','#64748b']].map(([l,c]) => (
                        <div key={l} className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: `${c}10`, borderColor: `${c}30` }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${c}`, background: `${c}20`, flexShrink: 0 }}/>
                          <span className="text-[10px] font-medium" style={{ color: c }}>{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-foreground/6 pt-4">
                    <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Indicators</div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" style={{ boxShadow: '0 0 6px #ef4444', animation: 'dot-blink 1s ease-in-out infinite' }}/>
                        <span className="text-[10px] text-foreground/60">Red pulse dot = Breaking news linked to facility</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0" style={{ boxShadow: '0 0 6px #f59e0b' }}/>
                        <span className="text-[10px] text-foreground/60">Amber glow = Critical threat level with active news</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-4 rounded flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(6,10,20,0.92)', border: '2px solid #22d3ee80' }}>
                          <span className="text-[8px] font-bold text-cyan-400">12</span>
                        </div>
                        <span className="text-[10px] text-foreground/60">Cluster badge = multiple articles in same country</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="absolute bottom-14 left-3 z-[1000] bg-background/95 border border-border/70 rounded-xl backdrop-blur-md shadow-2xl overflow-hidden" style={{ minWidth: 170 }}>
            <button onClick={() => setLegendExpanded(true)} className="w-full px-3 py-2 border-b border-border/60 flex items-center justify-between gap-2 hover:bg-foreground/5 transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"/>
                <span className="text-[8px] font-bold text-muted-foreground/80 uppercase tracking-widest">Legend</span>
              </div>
              <Maximize2 size={9} className="text-muted-foreground/50"/>
            </button>
            <div className="px-3 pt-2 pb-1">
              <div className="text-[7px] font-bold text-muted-foreground/40 uppercase tracking-widest mb-1.5">Facilities</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {FACILITY_TYPES.slice(0, 6).map(ft => (
                  <div key={ft.id} className="flex items-center gap-1">
                    <div style={{ width: 14, height: 14, background: 'transparent', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{display:"inline-block",width:10,height:10,lineHeight:0,verticalAlign:"middle"}} dangerouslySetInnerHTML={{__html:ft.svgIcon}}/>
                    </div>
                    <span className="text-[8px] text-muted-foreground leading-tight">{ft.label.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mx-3 border-t border-foreground/6"/>
            <div className="px-3 pt-1.5 pb-2">
              <div className="text-[7px] font-bold text-muted-foreground/40 uppercase tracking-widest mb-1.5">Threat Rings</div>
              <div className="space-y-1">
                {[['critical','#ef4444'],['high','#f97316'],['medium','#f59e0b']].map(([l,c]) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <div style={{ width: 10, height: 10, borderRadius: '50%', border: `1.5px solid ${c}`, background: `${c}15`, flexShrink: 0 }}/>
                    <span className="text-[8px] text-muted-foreground/80 capitalize">{l}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-3 pb-2 border-t border-foreground/6 pt-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" style={{ boxShadow: '0 0 5px #ef4444', animation: 'dot-blink 1s ease-in-out infinite' }}/>
                <span className="text-[8px] text-red-400/70">Pulse = Breaking</span>
              </div>
            </div>
          </div>

          {/* ── KEYBOARD SHORTCUTS HINT (bottom-center) ── */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-background/80 border border-border/60 rounded-full px-4 py-1.5 backdrop-blur-md">
            {([
              { key: 'F', label: 'Facilities', active: showFacilities, color: 'var(--intel-yellow)' },
              { key: 'A', label: 'Articles',   active: showArticles,   color: 'var(--primary)' },
              { key: 'H', label: 'Heatmap',    active: showHeatmap,    color: '#f97316' },
              { key: 'I', label: 'Country Intel', active: showCountryIntel, color: '#22d3ee' },
              { key: 'L', label: 'Layers',     active: showLayerPanel, color: 'var(--intel-green)' },
              { key: 'ESC', label: 'Close',    active: false,          color: '' },
            ] as const).map(({ key, label, active, color }) => (
              <div key={key} className="flex items-center gap-1">
                <kbd
                  className="text-[8px] font-mono bg-foreground/10 border rounded px-1 py-0.5 transition-colors"
                  style={active && color ? { color, borderColor: color + '80', boxShadow: `0 0 6px ${color}40` } : { color: 'oklch(from var(--foreground) l c h / 0.5)', borderColor: 'oklch(from var(--foreground) l c h / 0.2)' }}
                >{key}</kbd>
                <span className="text-[8px]" style={active && color ? { color: color + 'cc' } : { color: 'oklch(from var(--foreground) l c h / 0.25)' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* ── COUNTRY SEARCH BAR (top-left, visible when Country Intel layer is on) ── */}
          {showCountryIntel && (
            <CountrySearchBar
              collapsed={!!selectedCountryForPanel}
              onNavigate={(country: string) => {
                setSearchFlyTo(country);
                setSelectedCountryForPanel(country);
                // Reset flyTo after a tick so re-searching same country re-triggers
                setTimeout(() => setSearchFlyTo(undefined), 100);
              }}
            />
          )}

          {/* ── ACTIVE FILTERS BADGE ── */}
          {activeFilterCount > 0 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-card/90 border border-primary/40 rounded-full px-3 py-1 text-[10px] font-medium flex items-center gap-2 backdrop-blur-md shadow-lg">
              <Filter size={9} className="text-primary"/>
              {countryFilter && (
                <span className="flex items-center gap-1 bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full text-[9px]">
                  <MapPin size={8}/> {countryFilter}
                  <button onClick={() => setCountryFilter(undefined)} className="hover:text-red-400 ml-0.5"><X size={7}/></button>
                </span>
              )}
              <span className="text-primary">{activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active</span>
              <button onClick={clearAllFilters} className="text-muted-foreground/70 hover:text-red-400 transition-colors ml-0.5"><X size={9}/></button>
            </div>
          )}
        </div>

        {/* ─── LAYER CONTROL PANEL (right) ─────────────────────────────────── */}
        {showLayerPanel && (
          <div className="flex-shrink-0 w-60 flex flex-col bg-background border-l border-border/60 overflow-y-auto z-[1000]">
            <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Layers size={11} className="text-green-400"/>
                <span className="text-[11px] font-bold text-foreground/80">Layer Control</span>
              </div>
              <button onClick={() => setShowLayerPanel(false)} className="text-muted-foreground/50 hover:text-foreground"><X size={11}/></button>
            </div>

            <div className="p-3 space-y-4">
              {/* Data Layers */}
              <div>
                <div className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-2">Data Layers</div>
                <div className="space-y-2">
                  {[
                    { label: 'Facilities', val: showFacilities, set: setShowFacilities, color: 'var(--intel-yellow)', key: 'F' },
                    { label: 'News Articles', val: showArticles, set: setShowArticles, color: 'var(--primary)', key: 'A' },
                    { label: 'Threat Rings', val: showThreatRings, set: setShowThreatRings, color: '#a78bfa', key: null },
                    { label: 'Heat Map', val: showHeatmap, set: setShowHeatmap, color: '#f97316', key: 'H' },
                    { label: 'Attack Vectors', val: showAttacks, set: setShowAttacks, color: 'var(--intel-red)', key: null },
                    { label: 'Country Intel Layer', val: showCountryIntel, set: setShowCountryIntel, color: '#22d3ee', key: 'I' },
                    { label: 'Cluster Articles', val: clusterArticles, set: setClusterArticles, color: '#22d3ee', key: null },
                    { label: 'Cluster Facilities', val: clusterFacilities, set: setClusterFacilities, color: 'var(--intel-yellow)', key: null },
                  ].map(item => (
                    <label key={item.label} className="flex items-center gap-2.5 cursor-pointer group">
                      <div
                        className="w-8 h-4 rounded-full transition-all relative flex-shrink-0"
                        style={{ background: item.val ? item.color + '40' : 'oklch(from var(--foreground) l c h / 0.08)', border: `1px solid ${item.val ? item.color : 'oklch(from var(--foreground) l c h / 0.1)'}` }}
                        onClick={() => item.set((v: boolean) => !v)}>
                        <div className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
                          style={{ left: item.val ? 'calc(100% - 14px)' : '2px', background: item.val ? item.color : 'oklch(from var(--foreground) l c h / 0.3)' }}/>
                      </div>
                      <span className="text-[10px] text-muted-foreground group-hover:text-foreground/80 transition-colors flex-1">{item.label}</span>
                      {item.key && <kbd className="text-[8px] font-mono bg-foreground/8 border border-border rounded px-1 text-muted-foreground/60">{item.key}</kbd>}
                    </label>
                  ))}
                </div>
              </div>

              {/* Facility Type Filters */}
              <div>
                <div className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-2">Facility Types</div>
                <div className="space-y-1.5">
                  {FACILITY_TYPES.map(ft => {
                    const isActive = selectedFacilityTypes.includes(ft.id);
                    return (
                      <label key={ft.id} className="flex items-center gap-2 cursor-pointer group">
                        <div className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all"
                          style={{ background: isActive ? ft.color + '30' : 'transparent', borderColor: isActive ? ft.color : 'oklch(from var(--foreground) l c h / 0.15)' }}
                          onClick={() => toggleFacilityType(ft.id)}>
                          {isActive && <div className="w-2 h-2 rounded-sm" style={{ background: ft.color }}/>}
                        </div>
                        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                          <span style={{display:"inline-block",width:14,height:14,lineHeight:0,verticalAlign:"middle"}} dangerouslySetInnerHTML={{__html:ft.svgIcon}}/>
                        </div>
                        <span className="text-[10px] text-muted-foreground group-hover:text-foreground/75 transition-colors">{ft.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Topic Filters */}
              <div>
                <div className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-2">Topic Filters</div>
                <div className="space-y-1.5">
                  {TOPICS.map(t => {
                    const isActive = selectedTopics.includes(t.id);
                    return (
                      <label key={t.id} className="flex items-center gap-2 cursor-pointer group">
                        <div className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all"
                          style={{ background: isActive ? t.color + '30' : 'transparent', borderColor: isActive ? t.color : 'oklch(from var(--foreground) l c h / 0.15)' }}
                          onClick={() => toggleTopic(t.id)}>
                          {isActive && <div className="w-2 h-2 rounded-sm" style={{ background: t.color }}/>}
                        </div>
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }}/>
                        <span className="text-[10px] text-muted-foreground group-hover:text-foreground/75 transition-colors">{t.label}</span>
                        <span className="text-[8px] text-muted-foreground/40 ml-auto">{topicCounts[t.id] ?? 0}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── FACILITY DEEP-DIVE PANEL (slides in from right) ─────────────── */}
        {selectedFacility && (
          <div className="absolute inset-y-0 right-0 z-[2000] w-96 flex flex-col bg-background border-l border-border/70 shadow-2xl overflow-hidden"
            style={{ animation: 'slideInRight 0.2s ease-out' }}>
            {(() => {
              const ft = FACILITY_MAP[selectedFacility.type] ?? FACILITY_MAP['company'];
              const threatColors: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e' };
              const threatColor = threatColors[selectedFacility.threatLevel ?? 'low'] ?? '#64748b';
              const score = threatScoreMap[selectedFacility.id] ?? 0;
              return (
                <>
                  {/* Header */}
                  <div className="flex-shrink-0 border-b border-border/70"
                    style={{ background: `linear-gradient(135deg, var(--card) 0%, ${ft.color}12 100%)` }}>
                    <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--card)', border: `2px solid ${ft.color}` }}>
                        <span style={{display:"inline-block",width:28,height:28,lineHeight:0,verticalAlign:"middle"}} dangerouslySetInnerHTML={{__html:ft.svgIcon}}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: ft.color }}>{ft.label}</span>
                          {selectedFacility.threatLevel && (
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: `${threatColor}20`, color: threatColor }}>
                              {selectedFacility.threatLevel.toUpperCase()}
                            </span>
                          )}
                          {score > 0 && (
                            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-foreground/8 text-muted-foreground">
                              SCORE: {score}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-foreground leading-tight line-clamp-2">{selectedFacility.name}</div>
                        <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                          {[selectedFacility.city, selectedFacility.country].filter(Boolean).join(', ')}
                        </div>
                      </div>
                      <button onClick={() => setSelectedFacility(null)}
                        className="text-muted-foreground/50 hover:text-foreground transition-colors flex-shrink-0 mt-0.5">
                        <X size={14}/>
                      </button>
                    </div>
                    {/* Threat score bar + trend */}
                    {score > 0 && (() => {
                      const trendInfo = threatTrendMap[selectedFacility.id];
                      const trendIcon = trendInfo?.trend === 'increasing' ? '↑' : trendInfo?.trend === 'decreasing' ? '↓' : '→';
                      const trendColor = trendInfo?.trend === 'increasing' ? '#ef4444' : trendInfo?.trend === 'decreasing' ? '#22c55e' : '#64748b';
                      const trendLabel = trendInfo?.trend === 'increasing' ? 'INCREASING' : trendInfo?.trend === 'decreasing' ? 'DECREASING' : 'STABLE';
                      return (
                        <div className="px-4 pb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[8px] text-muted-foreground/60 uppercase tracking-wider">Intelligence Threat Score</span>
                            <div className="flex items-center gap-2">
                              {trendInfo && (
                                <span className="text-[8px] font-bold flex items-center gap-0.5" style={{ color: trendColor }}>
                                  {trendIcon} {trendLabel}
                                </span>
                              )}
                              <span className="text-[9px] font-mono font-bold" style={{ color: threatColor }}>{score}/100</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-foreground/8 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-1000"
                              style={{ width: `${Math.min(100, score)}%`, background: `linear-gradient(90deg, ${threatColor}80, ${threatColor})`, boxShadow: `0 0 8px ${threatColor}60` }}/>
                          </div>
                          {/* Monthly trend breakdown */}
                          {trendInfo?.trendData && (
                            <div className="flex items-center gap-3 mt-1.5">
                              <div className="flex items-center gap-1">
                                <span className="text-[7px] text-muted-foreground/50 uppercase">This month</span>
                                <span className="text-[8px] font-mono font-bold text-foreground">{trendInfo.trendData.currentMonth}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[7px] text-muted-foreground/50 uppercase">Prev</span>
                                <span className="text-[8px] font-mono text-muted-foreground">{trendInfo.trendData.previousMonth}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[7px] text-muted-foreground/50 uppercase">2mo ago</span>
                                <span className="text-[8px] font-mono text-muted-foreground">{trendInfo.trendData.twoMonthsAgo}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Facility details */}
                  <div className="flex-shrink-0 grid grid-cols-2 gap-0 border-b border-border/60">
                    {[
                      { label: 'Type', val: selectedFacility.type },
                      { label: 'Status', val: selectedFacility.operationalStatus ?? 'Unknown' },
                      { label: 'Coordinates', val: selectedFacility.latitude ? `${selectedFacility.latitude.toFixed(3)}, ${selectedFacility.longitude.toFixed(3)}` : 'N/A' },
                      { label: 'Importance', val: selectedFacility.importance ?? 'N/A' },
                    ].map((item, i) => (
                      <div key={i} className={`px-3 py-2 ${i % 2 === 0 ? 'border-r border-foreground/6' : ''} ${i < 2 ? 'border-b border-foreground/6' : ''}`}>
                        <div className="text-[8px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">{item.label}</div>
                        <div className="text-[10px] text-foreground/65 font-medium capitalize truncate">{String(item.val)}</div>
                      </div>
                    ))}
                  </div>

                  {/* News section */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="px-4 py-2.5 border-b border-border/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Newspaper size={11} className="text-primary"/>
                        <span className="text-[10px] font-bold text-foreground/75 uppercase tracking-wider">Intelligence Reports</span>
                      </div>
                      {facilityNewsData && (
                        <span className="text-[8px] text-muted-foreground/50 font-mono">{facilityNewsData.articles.length} reports</span>
                      )}
                    </div>
                    {facilityNewsLoading ? (
                      <div className="p-4 space-y-3">
                        {[1,2,3].map(i => (
                          <div key={i} className="animate-pulse space-y-2">
                            <div className="h-3 bg-foreground/5 rounded w-3/4"/>
                            <div className="h-2 bg-foreground/5 rounded w-full"/>
                          </div>
                        ))}
                      </div>
                    ) : !facilityNewsData?.articles?.length ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <Newspaper size={20} className="text-muted-foreground/20 mb-2"/>
                        <div className="text-[11px] text-muted-foreground/50">No intelligence reports linked</div>
                        <a href={`https://news.google.com/search?q=${encodeURIComponent(selectedFacility.name + ' ' + (selectedFacility.country ?? ''))}&hl=en-US&gl=US&ceid=US:en`}
                          target="_blank" rel="noopener noreferrer"
                          className="mt-3 flex items-center gap-1.5 text-[10px] text-primary hover:underline">
                          <ExternalLink size={9}/> Search Google News
                        </a>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/4">
                        {facilityNewsData.articles.map((article: any) => {
                          const topics = parseTopics(article.topicsJson ?? article.topics);
                          const topicColor = TOPIC_COLORS[topics[0]] ?? '#94a3b8';
                          const articleUrl = article.url?.startsWith('http') && !article.url.includes('example.com')
                            ? article.url
                            : `https://news.google.com/search?q=${encodeURIComponent(article.title ?? '')}&hl=en-US&gl=US&ceid=US:en`;
                          return (
                            <div key={article.id} className="px-4 py-3 hover:bg-foreground/3 transition-colors group">
                              <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: topicColor }}/>
                                <div className="flex-1 min-w-0">
                                  {article.isBreaking && <div className="text-red-400 text-[8px] font-bold mb-0.5 tracking-wider">● BREAKING</div>}
                                  <div className="text-[11px] text-foreground/80 leading-snug font-medium line-clamp-2">{article.title}</div>
                                  {article.summary && <div className="text-[9px] text-muted-foreground/70 mt-1 line-clamp-2">{article.summary}</div>}
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: `${topicColor}18`, color: topicColor }}>{topics[0] ?? 'General'}</span>
                                    <span className="text-[8px] text-muted-foreground/50">{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : ''}</span>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                  <a href={articleUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                                    <ExternalLink size={10}/>
                                  </a>
                                  {onVerify && article.id && (
                                    <button onClick={() => onVerify(article.id)} className="text-green-400 hover:text-green-300" title="Verify">
                                      <CheckCircle2 size={10}/>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Google News fallback */}
                    <div className="p-4 border-t border-foreground/6">
                      <a href={`https://news.google.com/search?q=${encodeURIComponent(selectedFacility.name + ' ' + (selectedFacility.country ?? ''))}&hl=en-US&gl=US&ceid=US:en`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-border/60 text-[10px] text-muted-foreground/70 hover:text-foreground/60 hover:border-border transition-all">
                        <ExternalLink size={9}/> More on Google News
                      </a>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          LIVE EVENT TICKER (bottom strip)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-shrink-0 flex items-center bg-card border-t border-border/60 overflow-hidden"
        style={{ height: 32, boxShadow: '0 -2px 20px rgba(0,0,0,0.5)' }}>
        {/* Label */}
        <div className="flex-shrink-0 flex items-center gap-2 px-3 border-r border-border/60 h-full"
          style={{ background: 'var(--card)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" style={{ boxShadow: '0 0 6px #ef4444' }}/>
          <span className="text-[9px] font-black text-foreground/60 uppercase tracking-widest whitespace-nowrap">LIVE INTEL</span>
        </div>
        {/* Scrolling ticker */}
        <div className="flex-1 overflow-hidden relative h-full">
          <div ref={tickerRef} className="flex items-center h-full gap-8 px-4"
            style={{
              animation: tickerItems.length > 0 ? `ticker-scroll ${Math.max(20, tickerItems.length * 4)}s linear infinite` : 'none',
              whiteSpace: 'nowrap',
            }}>
            {tickerItems.length === 0 ? (
              <span className="text-[10px] text-muted-foreground/40">Awaiting intelligence feed...</span>
            ) : (
              [...tickerItems, ...tickerItems].map((item, i) => {
                // eventTimeline returns topics as array directly (not topicsJson)
                const topics = Array.isArray(item.topics) ? item.topics : parseTopics((item as any).topicsJson ?? (item as any).topics);
                const topicColor = TOPIC_COLORS[topics[0]] ?? '#94a3b8';
                const articleUrl = (item as any).url?.startsWith('http') && !(item as any).url?.includes('example.com')
                  ? (item as any).url
                  : `https://news.google.com/search?q=${encodeURIComponent(item.title ?? '')}&hl=en-US&gl=US&ceid=US:en`;
                return (
                  <button
                    key={`${item.id}-${i}`}
                    className="flex items-center gap-2 text-[10px] hover:bg-foreground/5 px-2 py-0.5 rounded transition-colors cursor-pointer flex-shrink-0"
                    onClick={() => {
                      // Open article in new tab on click
                      window.open(articleUrl, '_blank', 'noopener,noreferrer');
                    }}
                    title={item.title ?? ''}
                  >
                    {item.isBreaking && (
                      <span className="text-red-400 font-black text-[8px] tracking-widest">● BREAKING</span>
                    )}
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: topicColor, display: 'inline-block' }}/>
                    <span className="text-foreground/70 font-medium hover:text-foreground transition-colors">{item.title}</span>
                    {item.country && <span className="text-muted-foreground/50">— {item.country}</span>}
                    <span className="text-muted-foreground/30">{item.publishedAt ? new Date(item.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    <span className="text-muted-foreground/20 mx-2">◆</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
        {/* Time window indicator */}
        <div className="flex-shrink-0 px-3 border-l border-border/60 h-full flex items-center">
          <span className="text-[8px] font-mono text-muted-foreground/40">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} UTC
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          BREAKING NEWS FLASH OVERLAY
      ══════════════════════════════════════════════════════════════════════ */}
      {flashArticle && (
        <div className="absolute inset-0 z-[9999] pointer-events-none flex items-start justify-center pt-16"
          style={{ animation: 'flash-in 0.3s ease-out' }}>
          <div className="pointer-events-auto max-w-xl mx-4 bg-destructive/10 border border-red-500/70 rounded-xl shadow-2xl overflow-hidden"
            style={{ boxShadow: '0 0 60px rgba(239,68,68,0.35), 0 4px 24px rgba(0,0,0,0.8)' }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-red-500/20"
              style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.15) 0%, transparent 100%)' }}>
              <div className="w-2 h-2 rounded-full bg-red-500" style={{ boxShadow: '0 0 8px #ef4444', animation: 'dot-blink 0.8s ease-in-out infinite' }}/>
              <span className="text-red-400 text-[9px] font-black tracking-[0.35em] uppercase">Breaking Intelligence</span>
              <div className="ml-auto flex items-center gap-2">
                {flashArticle.country && (
                  <span className="text-[9px] text-muted-foreground/60 font-mono">{flashArticle.country}</span>
                )}
                <span className="text-[9px] text-muted-foreground/40 font-mono">
                  {flashArticle.publishedAt ? new Date(flashArticle.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
                <button onClick={() => setFlashArticle(null)} className="text-muted-foreground/40 hover:text-foreground/60 transition-colors ml-1">
                  <X size={12}/>
                </button>
              </div>
            </div>
            {/* Clickable body — opens article */}
            <a
              href={flashArticle.url?.startsWith('http') && !flashArticle.url?.includes('example.com')
                ? flashArticle.url
                : `https://news.google.com/search?q=${encodeURIComponent(flashArticle.title ?? '')}&hl=en-US&gl=US&ceid=US:en`}
              target="_blank" rel="noopener noreferrer"
              className="block px-4 py-3 hover:bg-foreground/3 transition-colors group"
              onClick={() => setFlashArticle(null)}
            >
              <div className="text-[13px] font-semibold text-foreground leading-snug mb-2 group-hover:text-primary transition-colors">
                {flashArticle.title}
              </div>
              {flashArticle.summary && (
                <div className="text-[10px] text-muted-foreground/80 leading-relaxed line-clamp-2 mb-2">{flashArticle.summary}</div>
              )}
              <div className="flex items-center gap-1.5 text-[9px] text-primary/60 group-hover:text-primary transition-colors">
                <ExternalLink size={9}/>
                <span>Open full article</span>
              </div>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
function SidebarSection({ icon, title, expanded, onToggle, children, badge, noToggle }: {
  icon: React.ReactNode; title: string; expanded: boolean;
  onToggle: () => void; children: React.ReactNode;
  badge?: string; noToggle?: boolean;
}) {
  return (
    <div className="border-b border-border/60">
      <button className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-foreground/3 transition-colors"
        onClick={noToggle ? undefined : onToggle} style={noToggle ? { cursor: 'default' } : {}}>
        <span className="text-primary/70">{icon}</span>
        <span className="text-[11px] font-semibold text-foreground/80 flex-1 text-left">{title}</span>
        {badge && <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">{badge}</span>}
        {!noToggle && (expanded ? <ChevronUp size={11} className="text-muted-foreground/60"/> : <ChevronDown size={11} className="text-muted-foreground/60"/>)}
      </button>
      {expanded && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

// ─── FACILITY POPUP (completely different from news) ──────────────────────────
function FacilityPopup({ facility, onViewNews, newsCount }: { facility: any; onViewNews?: () => void; newsCount?: number }) {
  const ft = FACILITY_MAP[facility.type] ?? FACILITY_MAP['company'];
  const threatColors: Record<string, string> = {
    critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e'
  };
  const threatColor = threatColors[facility.threatLevel ?? 'low'] ?? '#64748b';

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", minWidth: 280, maxWidth: 320 }}>
      {/* Header band with facility type color */}
      <div style={{
        background: `linear-gradient(135deg, var(--card) 0%, ${ft.color}22 100%)`,
        borderBottom: `1px solid ${ft.color}40`,
        padding: '14px 16px 12px',
        borderRadius: '12px 12px 0 0',
        display: 'flex', alignItems: 'flex-start', gap: 12
      }}>
        {/* Icon */}
        <div style={{
          width: 44, height: 44, borderRadius: 8, background: 'var(--card)',
          border: `2px solid ${ft.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
          <span style={{display:"inline-block",width:30,height:30,lineHeight:0,verticalAlign:"middle"}} dangerouslySetInnerHTML={{__html:ft.svgIcon}}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: ft.color }}>
              {ft.label}
            </span>
            {facility.threatLevel && (
              <span style={{
                fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                background: `${threatColor}20`, color: threatColor, letterSpacing: 0.5
              }}>{facility.threatLevel.toUpperCase()}</span>
            )}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: '#f1f5f9' }}>
            {facility.name}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 16px' }}>
        {/* Location */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>📍</span>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
            {[facility.city, facility.country].filter(Boolean).join(', ')}
          </span>
        </div>

        {/* Operator */}
        {facility.operator && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, padding: '8px 10px', background: 'oklch(from var(--foreground) l c h / 0.04)', borderRadius: 6 }}>
            <span style={{ fontSize: 10, color: '#475569', flexShrink: 0 }}>Operator</span>
            <span style={{ fontSize: 11, color: 'var(--foreground)', fontWeight: 600 }}>{facility.operator}</span>
          </div>
        )}

        {/* Description */}
        {facility.description && (
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.6, marginBottom: 12 }}>
            {facility.description.substring(0, 160)}{facility.description.length > 160 ? '…' : ''}
          </div>
        )}

        {/* Coordinates */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, fontSize: 10, color: '#475569', fontFamily: 'monospace' }}>
          <span>{facility.latitude?.toFixed(4)}°N</span>
          <span>·</span>
          <span>{facility.longitude?.toFixed(4)}°E</span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {onViewNews && (
            <button onClick={onViewNews}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 6, textAlign: 'center',
                background: `${ft.color}22`, border: `1px solid ${ft.color}60`,
                color: ft.color, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}>
              📰 View Related News {newsCount !== undefined && newsCount > 0 ? `(${newsCount})` : ''}
            </button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={`https://www.google.com/maps?q=${facility.latitude},${facility.longitude}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 6, textAlign: 'center',
                background: `${ft.color}18`, border: `1px solid ${ft.color}40`,
                color: ft.color, fontSize: 11, fontWeight: 600, textDecoration: 'none'
              }}>
              📍 Google Maps
            </a>
            <a href={`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(facility.name)}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 6, textAlign: 'center',
                background: 'oklch(from var(--foreground) l c h / 0.05)', border: '1px solid oklch(from var(--foreground) l c h / 0.1)',
                color: 'var(--muted-foreground)', fontSize: 11, fontWeight: 600, textDecoration: 'none'
              }}>
              📖 Wikipedia
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NEWS ARTICLE POPUP (completely different from facility) ──────────────────
function NewsPopup({ article, onExplore, onVerify }: { article: any; onExplore?: (title: string) => void; onVerify?: (articleId: number) => void }) {
  const topics: string[] = (() => { try { return JSON.parse(article.topicsJson ?? '[]'); } catch { return []; } })();
  const primaryTopic = TOPIC_MAP[topics[0]];
  const topicColor = primaryTopic?.color ?? '#64748b';
  const articleUrl = article.url?.startsWith('http') && !article.url.includes('example.com')
    ? article.url
    : `https://news.google.com/search?q=${encodeURIComponent(article.title ?? '')}&hl=en-US&gl=US&ceid=US:en`;

  const sentimentColors: Record<string, string> = { negative: '#ef4444', positive: '#22c55e', neutral: '#f59e0b' };
  const sentimentColor = sentimentColors[article.sentiment ?? 'neutral'] ?? '#64748b';

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", minWidth: 260, maxWidth: 300 }}>
      {/* Topic color strip at top */}
      <div style={{ height: 3, background: topicColor, borderRadius: '12px 12px 0 0' }}/>

      <div style={{ padding: '12px 14px' }}>
        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {article.isBreaking && (
            <span style={{
              fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
              background: 'rgba(239,68,68,0.15)', color: 'var(--intel-red)', letterSpacing: 1
            }}>● BREAKING</span>
          )}
          {primaryTopic && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
              background: `${topicColor}18`, color: topicColor
            }}>{primaryTopic.label}</span>
          )}
          <span style={{ fontSize: 9, color: '#475569', marginLeft: 'auto' }}>{article.country ?? ''}</span>
        </div>

        {/* Title */}
        <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.45, color: '#f1f5f9', marginBottom: 8 }}>
          {article.title?.substring(0, 130)}{(article.title?.length ?? 0) > 130 ? '…' : ''}
        </div>

        {/* Summary */}
        {article.summary && (
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.6, marginBottom: 10 }}>
            {article.summary.substring(0, 110)}…
          </div>
        )}

        {/* Info row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
          padding: '7px 10px', background: 'oklch(from var(--foreground) l c h / 0.04)', borderRadius: 6
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: sentimentColor }}/>
            <span style={{ fontSize: 10, color: sentimentColor, fontWeight: 600, textTransform: 'capitalize' }}>
              {article.sentiment ?? 'neutral'}
            </span>
          </div>
          {article.agencyName && (
            <>
              <span style={{ color: 'var(--muted-foreground)' }}>·</span>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{article.agencyName}</span>
            </>
          )}
          <span style={{ fontSize: 10, color: '#334155', marginLeft: 'auto' }}>
            {new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={articleUrl} target="_blank" rel="noopener noreferrer"
            style={{
              flex: 1, padding: '7px 10px', borderRadius: 6, textAlign: 'center',
              background: `${topicColor}18`, border: `1px solid ${topicColor}40`,
              color: topicColor, fontSize: 11, fontWeight: 600, textDecoration: 'none'
            }}>
            Read Article ↗
          </a>
          {onExplore && (
            <button onClick={() => onExplore(article.title ?? '')}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 6, textAlign: 'center',
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                color: 'var(--intel-yellow)', fontSize: 11, fontWeight: 600, cursor: 'pointer'
              }}>
              Explore →
            </button>
          )}
          {onVerify && article.id && (
            <button onClick={() => onVerify(article.id)}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 6, textAlign: 'center',
                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                color: '#22c55e', fontSize: 11, fontWeight: 600, cursor: 'pointer'
              }}>
              ✓ Verify
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CLUSTER POPUP ────────────────────────────────────────────────────────────
function ClusterPopup({ country, articles, onExplore, onVerify }: {
  country: string; articles: any[]; onExplore?: (title: string) => void; onVerify?: (articleId: number) => void;
}) {
  const hasBreaking = articles.some(a => a.isBreaking);
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", minWidth: 300, maxWidth: 340 }}>
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid oklch(from var(--foreground) l c h / 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>📍 {country}</span>
          <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>{articles.length} articles</span>
          {hasBreaking && <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--intel-red)', letterSpacing: 1 }}>● BREAKING</span>}
        </div>
      </div>
      <div style={{ maxHeight: 260, overflowY: 'auto', padding: '8px 14px' }}>
        {articles.slice(0, 10).map(a => {
          const topics: string[] = (() => { try { return JSON.parse(a.topicsJson ?? '[]'); } catch { return []; } })();
          const pt = TOPIC_MAP[topics[0]];
          const topicColor = pt?.color ?? '#64748b';
          const url = a.url?.startsWith('http') && !a.url.includes('example.com')
            ? a.url : `https://news.google.com/search?q=${encodeURIComponent(a.title ?? '')}&hl=en-US&gl=US&ceid=US:en`;
          return (
            <div key={a.id} style={{
              padding: '8px 0', borderBottom: '1px solid oklch(from var(--foreground) l c h / 0.05)',
              display: 'flex', flexDirection: 'column', gap: 4
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: topicColor, flexShrink: 0 }}/>
                {a.isBreaking && <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--intel-red)' }}>BREAKING</span>}
                {pt && <span style={{ fontSize: 9, color: topicColor, fontWeight: 600 }}>{pt.label}</span>}
                <span style={{ fontSize: 9, color: '#334155', marginLeft: 'auto' }}>
                  {new Date(a.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.4, color: 'var(--foreground)' }}>
                {a.title?.substring(0, 95)}{(a.title?.length ?? 0) > 95 ? '…' : ''}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 10, color: topicColor, textDecoration: 'none', fontWeight: 600 }}
                  onClick={e => e.stopPropagation()}>Read ↗</a>
                {onExplore && (
                  <button onClick={e => { e.stopPropagation(); onExplore(a.title ?? ''); }}
                    style={{ fontSize: 10, color: 'var(--intel-yellow)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                    Explore →
                  </button>
                )}
                {onVerify && a.id && (
                  <button onClick={e => { e.stopPropagation(); onVerify(a.id); }}
                    style={{ fontSize: 10, color: '#22c55e', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                    ✓ Verify
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {articles.length > 10 && (
          <div style={{ fontSize: 10, color: '#334155', textAlign: 'center', padding: '8px 0' }}>
            +{articles.length - 10} more articles
          </div>
        )}
      </div>
    </div>
  );
}

// ─── COUNTRY COORDINATES ──────────────────────────────────────────────────────
function getCountryCoords(country: string): [number, number] | null {
  const coords: Record<string, [number, number]> = {
    'Saudi Arabia': [24.7, 46.7], 'Iran': [35.7, 51.4], 'Iraq': [33.3, 44.4],
    'Israel': [31.8, 35.2], 'Palestine': [31.9, 35.2], 'Egypt': [30.1, 31.2],
    'Turkey': [39.9, 32.9], 'UAE': [24.5, 54.4], 'Qatar': [25.3, 51.5],
    'Kuwait': [29.4, 47.9], 'Bahrain': [26.2, 50.6], 'Oman': [23.6, 58.6],
    'Yemen': [15.6, 44.2], 'Syria': [33.5, 36.3], 'Lebanon': [33.9, 35.5],
    'Jordan': [31.9, 35.9], 'Libya': [32.9, 13.2], 'Tunisia': [36.8, 10.2],
    'Algeria': [36.7, 3.2], 'Morocco': [34.0, -6.8], 'Sudan': [15.6, 32.5],
    'Somalia': [2.0, 45.3], 'Afghanistan': [34.5, 69.2], 'Pakistan': [33.7, 73.1],
    'Russia': [55.8, 37.6], 'China': [39.9, 116.4], 'USA': [38.9, -77.0],
    'UK': [51.5, -0.1], 'France': [48.9, 2.3], 'Germany': [52.5, 13.4],
    'India': [28.6, 77.2], 'Japan': [35.7, 139.7], 'South Korea': [37.6, 127.0],
    'North Korea': [39.0, 125.8], 'Ukraine': [50.4, 30.5], 'Ethiopia': [9.0, 38.7],
    'Nigeria': [9.1, 7.2], 'South Africa': [-25.7, 28.2],
    'United States': [38.9, -77.0], 'United Kingdom': [51.5, -0.1],
    'Gaza': [31.5, 34.5], 'West Bank': [31.9, 35.2],
  };
  return coords[country] ?? null;
}
