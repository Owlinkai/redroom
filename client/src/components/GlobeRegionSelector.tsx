/**
 * GlobeRegionSelector — Redroom V2.4 Intelligence Globe
 * © Alexsai · Owlink.ai — Stealth Intelligence for Gov and People
 * - NASA photorealistic earth texture (day + night city lights + specular)
 * - GPS/LEO satellite constellation network with orbital rings
 * - Animated threat pulse rings at hotspot coordinates
 * - Data-stream arcs between allied capitals
 * - Atmospheric glow + cloud layer
 * - Boot terminal animation
 * - LEFT: Live intelligence activity feed (cameras, flights, ships, news investigations)
 * - RIGHT: Enhanced region selector with fade-edge scroll + country count chips
 */
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import {
  Globe, ChevronRight, Shield, Zap, Search, Radio, Activity,
  Camera, Plane, Ship, Newspaper, Eye, Wifi, AlertTriangle, Lock,
  Crosshair, Satellite, Signal, TrendingUp, MapPin, Sun, Moon,
} from "lucide-react";
import { usePageVisible } from "@/hooks/usePageVisible";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeSelector } from "@/components/ThemeSelector";

interface Props {
  onSelect: (region: string) => void;
}

const EARTH_DAY_URL   = "https://d2xsxph8kpxj0f.cloudfront.net/310419663026724153/VRmg57SSnuBtigQkBoMMSk/earth_2048_45c9305e.jpg";
const EARTH_NIGHT_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310419663026724153/VRmg57SSnuBtigQkBoMMSk/earth_night_2048_6f11a7b9.jpg";
const EARTH_SPEC_URL  = "https://d2xsxph8kpxj0f.cloudfront.net/310419663026724153/VRmg57SSnuBtigQkBoMMSk/earth_specular_85d6bee4.jpg";

const REGIONS = [
  { id: "MENA",               label: "Middle East & North Africa", lat: 25,  lon: 45,   color: "#ef4444", heatColor: 0xef4444, description: "High-priority intelligence zone",      threatLevel: "CRITICAL",  threatVal: 4, trend: "up" as const,
    countries: ["SA","AE","IQ","SY","LB","JO","IL","EG","LY","TN","DZ","MA","YE","OM","KW","QA","BH","IR","PS","SD"],
    countryNames: ["Saudi Arabia","UAE","Iraq","Syria","Lebanon","Jordan","Israel","Egypt","Libya","Tunisia","Algeria","Morocco","Yemen","Oman","Kuwait","Qatar","Bahrain","Iran","Palestine","Sudan"] },
  { id: "Global",             label: "Global",                      lat: 20,  lon: 0,    color: "#8b5cf6", heatColor: 0x8b5cf6, description: "Worldwide intelligence coverage",       threatLevel: "ELEVATED",  threatVal: 2, trend: "up" as const, countries: [], countryNames: [] },
  { id: "Europe",             label: "Europe",                      lat: 54,  lon: 15,   color: "#22d3ee", heatColor: 0x22d3ee, description: "NATO & EU strategic monitoring",        threatLevel: "MODERATE",  threatVal: 1, trend: "stable" as const,
    countries: ["GB","FR","DE","IT","ES","PL","UA","RU","NL","BE","SE","NO","DK","FI","CH","AT","CZ","HU","RO","GR","PT"],
    countryNames: ["UK","France","Germany","Italy","Spain","Poland","Ukraine","Russia","Netherlands","Belgium","Sweden","Norway","Denmark","Finland","Switzerland","Austria","Czech Republic","Hungary","Romania","Greece","Portugal"] },
  { id: "East Asia",          label: "East Asia",                   lat: 35,  lon: 118,  color: "#f59e0b", heatColor: 0xf59e0b, description: "East Asian strategic theater",          threatLevel: "HIGH",      threatVal: 3, trend: "up" as const,
    countries: ["CN","JP","KR","KP","TW","MN"],
    countryNames: ["China","Japan","South Korea","North Korea","Taiwan","Mongolia"] },
  { id: "Asia-Pacific",       label: "Asia-Pacific",                lat: -5,  lon: 130,  color: "#f97316", heatColor: 0xf97316, description: "Indo-Pacific maritime theater",         threatLevel: "HIGH",      threatVal: 3, trend: "stable" as const,
    countries: ["AU","NZ","ID","PH","VN","TH","MY","SG","MM","KH","PG"],
    countryNames: ["Australia","New Zealand","Indonesia","Philippines","Vietnam","Thailand","Malaysia","Singapore","Myanmar","Cambodia","Papua New Guinea"] },
  { id: "South Asia",         label: "South Asia",                  lat: 20,  lon: 78,   color: "#ec4899", heatColor: 0xec4899, description: "South Asian geopolitical hotspot",      threatLevel: "HIGH",      threatVal: 3, trend: "down" as const,
    countries: ["IN","PK","BD","AF","LK","NP"],
    countryNames: ["India","Pakistan","Bangladesh","Afghanistan","Sri Lanka","Nepal"] },
  { id: "Central Asia",       label: "Central Asia",                lat: 43,  lon: 63,   color: "#84cc16", heatColor: 0x84cc16, description: "Central Asian energy & security zone",  threatLevel: "MODERATE",  threatVal: 1, trend: "stable" as const,
    countries: ["KZ","UZ","KG","TJ","TM"],
    countryNames: ["Kazakhstan","Uzbekistan","Kyrgyzstan","Tajikistan","Turkmenistan"] },
  { id: "Sub-Saharan Africa", label: "Sub-Saharan Africa",          lat: -5,  lon: 22,   color: "#f97316", heatColor: 0xf97316, description: "Sub-Saharan intelligence network",      threatLevel: "HIGH",      threatVal: 3, trend: "up" as const,
    countries: ["NG","ET","CD","TZ","ZA","KE","UG","GH","MZ","CI","CM","AO","ML","ZM","SN","ZW","RW","SS","CF","TD"],
    countryNames: ["Nigeria","Ethiopia","DR Congo","Tanzania","South Africa","Kenya","Uganda","Ghana","Mozambique","Ivory Coast","Cameroon","Angola","Mali","Zambia","Senegal","Zimbabwe","Rwanda","South Sudan","Central African Republic","Chad"] },
  { id: "North Africa",       label: "North Africa",                lat: 27,  lon: 15,   color: "#fbbf24", heatColor: 0xfbbf24, description: "North African strategic corridor",     threatLevel: "ELEVATED",  threatVal: 2, trend: "down" as const,
    countries: ["EG","LY","TN","DZ","MA","SD","MR"],
    countryNames: ["Egypt","Libya","Tunisia","Algeria","Morocco","Sudan","Mauritania"] },
  { id: "Americas",           label: "Americas",                    lat: 38,  lon: -97,  color: "#22c55e", heatColor: 0x22c55e, description: "North American strategic theater",      threatLevel: "MODERATE",  threatVal: 1, trend: "stable" as const,
    countries: ["US","CA","MX","CO","VE"],
    countryNames: ["United States","Canada","Mexico","Colombia","Venezuela"] },
  { id: "Latin America",      label: "Latin America",               lat: -15, lon: -60,  color: "#ec4899", heatColor: 0xec4899, description: "Latin American geopolitical zone",      threatLevel: "MODERATE",  threatVal: 1, trend: "up" as const,
    countries: ["BR","AR","CL","PE","BO","EC","CU","HT","GT","HN"],
    countryNames: ["Brazil","Argentina","Chile","Peru","Bolivia","Ecuador","Cuba","Haiti","Guatemala","Honduras"] },
];

const THREAT_COLORS: Record<string, string> = { CRITICAL:"#ef4444", HIGH:"#f97316", ELEVATED:"#f59e0b", MODERATE:"#22c55e" };
const THREAT_HEX: Record<string, number> = { CRITICAL:0xef4444, HIGH:0xf97316, ELEVATED:0xf59e0b, MODERATE:0x22c55e };

const COUNTRY_REGION_MAP: Record<string, string> = {};
REGIONS.forEach(r => r.countries.forEach(c => { COUNTRY_REGION_MAP[c] = r.id; }));
const COUNTRY_NAME_TO_ISO: Record<string, string> = {};
REGIONS.forEach(r => r.countries.forEach((iso, i) => { const n = r.countryNames[i]; if (n) COUNTRY_NAME_TO_ISO[n.toLowerCase()] = iso; }));

const COORDS: Record<string, [number, number]> = {
  SA:[24,45],AE:[24,54],IQ:[33,44],SY:[35,38],LB:[34,36],JO:[31,36],IL:[31,35],EG:[27,30],LY:[27,17],TN:[34,9],
  DZ:[28,3],MA:[32,-5],YE:[15,48],OM:[22,58],KW:[29,48],QA:[25,51],BH:[26,50],IR:[33,53],PS:[32,35],SD:[15,30],
  GB:[54,-2],FR:[47,2],DE:[51,10],IT:[43,12],ES:[40,-4],PL:[52,20],UA:[49,32],RU:[60,100],NL:[52,5],BE:[51,4],
  SE:[60,15],NO:[60,8],DK:[56,10],FI:[64,26],CH:[47,8],AT:[47,14],CZ:[50,15],HU:[47,19],RO:[46,25],GR:[39,22],PT:[39,-8],
  CN:[35,105],JP:[36,138],KR:[37,128],KP:[40,127],TW:[24,121],MN:[46,105],
  AU:[-25,133],NZ:[-41,174],ID:[-5,120],PH:[13,122],VN:[16,108],TH:[15,101],MY:[2,112],SG:[1,104],MM:[17,96],KH:[12,105],PG:[-6,147],
  IN:[21,78],PK:[30,70],BD:[24,90],AF:[33,65],LK:[7,81],NP:[28,84],
  KZ:[48,68],UZ:[41,64],KG:[41,75],TJ:[39,71],TM:[40,60],
  NG:[10,8],ET:[9,40],CD:[-4,24],TZ:[-6,35],ZA:[-29,25],KE:[-1,37],UG:[1,32],GH:[8,-1],MZ:[-18,35],CI:[7,-5],
  CM:[6,12],AO:[-12,18],ML:[17,-4],ZM:[-15,28],SN:[14,-14],ZW:[-20,30],RW:[-2,30],SS:[7,30],CF:[7,21],TD:[15,19],
  MR:[20,-12],
  US:[38,-97],CA:[56,-96],MX:[23,-102],CO:[4,-72],VE:[8,-66],
  BR:[-10,-55],AR:[-34,-64],CL:[-30,-71],PE:[-10,-76],BO:[-17,-65],EC:[-2,-78],CU:[22,-80],HT:[19,-73],GT:[15,-90],HN:[15,-87],
};

const HOTSPOTS: Array<{ lat: number; lon: number; region: string; intensity: number }> = [
  { lat: 33, lon: 44,   region: "MENA",               intensity: 1.0 },
  { lat: 35, lon: 38,   region: "MENA",               intensity: 0.9 },
  { lat: 33, lon: 53,   region: "MENA",               intensity: 0.85 },
  { lat: 15, lon: 48,   region: "MENA",               intensity: 0.8 },
  { lat: 49, lon: 32,   region: "Europe",             intensity: 0.8 },
  { lat: 51, lon: 10,   region: "Europe",             intensity: 0.5 },
  { lat: 35, lon: 105,  region: "East Asia",          intensity: 0.75 },
  { lat: 36, lon: 138,  region: "East Asia",          intensity: 0.65 },
  { lat: 24, lon: 121,  region: "East Asia",          intensity: 0.7 },
  { lat: -5, lon: 120,  region: "Asia-Pacific",       intensity: 0.65 },
  { lat: 13, lon: 122,  region: "Asia-Pacific",       intensity: 0.6 },
  { lat: 30, lon: 70,   region: "South Asia",         intensity: 0.75 },
  { lat: 33, lon: 65,   region: "South Asia",         intensity: 0.8 },
  { lat: 21, lon: 78,   region: "South Asia",         intensity: 0.6 },
  { lat: 10, lon: 8,    region: "Sub-Saharan Africa", intensity: 0.75 },
  { lat: 9,  lon: 40,   region: "Sub-Saharan Africa", intensity: 0.7 },
  { lat: 7,  lon: 30,   region: "Sub-Saharan Africa", intensity: 0.8 },
  { lat: 38, lon: -97,  region: "Americas",           intensity: 0.5 },
  { lat: 8,  lon: -66,  region: "Latin America",      intensity: 0.65 },
  { lat: -10,lon: -55,  region: "Latin America",      intensity: 0.55 },
];

// ─── Intelligence activity feed data ─────────────────────────────────────────
type IntelType = "camera" | "flight" | "ship" | "news" | "signal" | "alert";

interface IntelEvent {
  id: number;
  type: IntelType;
  label: string;
  detail: string;
  location: string;
  status: "LIVE" | "TRACKING" | "INTERCEPTED" | "INVESTIGATING" | "CONFIRMED" | "CLASSIFIED";
  progress?: number; // 0-100 for flight/ship
  color: string;
  ts: number; // relative seconds ago
}

const INTEL_POOL: Omit<IntelEvent, "id" | "ts">[] = [
  { type:"camera", label:"CAM-7741", detail:"OSINT feed active · Damascus perimeter", location:"Syria", status:"LIVE", color:"#22d3ee" },
  { type:"camera", label:"CAM-0392", detail:"Port surveillance · Bandar Abbas", location:"Iran", status:"LIVE", color:"#22d3ee" },
  { type:"camera", label:"CAM-1187", detail:"Border crossing · Rafah", location:"Gaza", status:"LIVE", color:"#22d3ee" },
  { type:"camera", label:"CAM-4420", detail:"Airfield activity · Latakia", location:"Syria", status:"LIVE", color:"#22d3ee" },
  { type:"flight", label:"FLT-RU841", detail:"TU-95MS · 38,000ft · heading 270°", location:"Black Sea", status:"TRACKING", progress:67, color:"#f59e0b" },
  { type:"flight", label:"FLT-IR202", detail:"C-130 · low altitude · no transponder", location:"Persian Gulf", status:"TRACKING", progress:34, color:"#f59e0b" },
  { type:"flight", label:"FLT-KP007", detail:"IL-76 cargo · Pyongyang→Beijing", location:"East Asia", status:"TRACKING", progress:82, color:"#f59e0b" },
  { type:"flight", label:"FLT-US77X", detail:"RC-135 SIGINT · classified route", location:"MENA", status:"CLASSIFIED", progress:51, color:"#8b5cf6" },
  { type:"ship", label:"VESSEL-4471", detail:"Bulk carrier · AIS disabled · 14kn", location:"Red Sea", status:"TRACKING", progress:44, color:"#f97316" },
  { type:"ship", label:"VESSEL-0093", detail:"Frigate GORSHKOV · transit Bosphorus", location:"Black Sea", status:"TRACKING", progress:78, color:"#f97316" },
  { type:"ship", label:"VESSEL-2281", detail:"Oil tanker · suspected sanction evasion", location:"Strait of Hormuz", status:"INVESTIGATING", progress:23, color:"#fbbf24" },
  { type:"ship", label:"VESSEL-5502", detail:"Type 052D destroyer · South China Sea", location:"Asia-Pacific", status:"TRACKING", progress:60, color:"#f97316" },
  { type:"news", label:"INTEL-BRIEF", detail:"Escalation indicators · 3 new sources", location:"MENA", status:"INVESTIGATING", color:"#ec4899" },
  { type:"news", label:"SIGACT-0041", detail:"Significant activity report · verified", location:"Ukraine", status:"CONFIRMED", color:"#22c55e" },
  { type:"news", label:"DISINFO-77", detail:"Narrative injection detected · 14 outlets", location:"Europe", status:"INVESTIGATING", color:"#ec4899" },
  { type:"news", label:"HUMINT-REP", detail:"Source corroboration · 2nd tier asset", location:"South Asia", status:"CLASSIFIED", color:"#8b5cf6" },
  { type:"signal", label:"SIGINT-4492", detail:"Encrypted burst · 12.4GHz · 0.3s", location:"Persian Gulf", status:"INTERCEPTED", color:"#ef4444" },
  { type:"signal", label:"SIGINT-0017", detail:"Radar emission · S-400 · active lock", location:"Syria", status:"INTERCEPTED", color:"#ef4444" },
  { type:"signal", label:"COMINT-881", detail:"Comms intercept · 3 nodes · decoded", location:"North Korea", status:"INTERCEPTED", color:"#ef4444" },
  { type:"alert", label:"ALERT-CRIT", detail:"Ballistic trajectory detected · 4min TTI", location:"MENA", status:"LIVE", color:"#ef4444" },
  { type:"alert", label:"ALERT-HIGH", detail:"Cyber intrusion · critical infrastructure", location:"Europe", status:"INVESTIGATING", color:"#f97316" },
];

function ll2v(lat: number, lon: number, r: number) {
  const phi = (90 - lat) * (Math.PI / 180), theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function arcPoints(from: [number,number], to: [number,number], r: number, segments = 40): THREE.Vector3[] {
  const start = ll2v(from[0], from[1], r);
  const end = ll2v(to[0], to[1], r);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const v = new THREE.Vector3().lerpVectors(start, end, t).normalize().multiplyScalar(r * (1 + 0.18 * Math.sin(Math.PI * t)));
    pts.push(v);
  }
  return pts;
}

// ─── Intelligence overlay builders ──────────────────────────────────────────

// Ship: a small glowing dot that moves along a great-circle path between two coords
function buildShipOverlays(scene: THREE.Scene) {
  const routes: Array<{ from:[number,number]; to:[number,number]; color:number; speed:number }> = [
    { from:[15,43], to:[12,44],  color:0xf97316, speed:0.04  }, // Red Sea
    { from:[26,56], to:[24,58],  color:0xfbbf24, speed:0.035 }, // Strait of Hormuz
    { from:[43,29], to:[41,29],  color:0xf97316, speed:0.05  }, // Bosphorus
    { from:[1,104], to:[22,114], color:0x22d3ee, speed:0.03  }, // South China Sea
    { from:[-6,40], to:[15,42],  color:0xf97316, speed:0.045 }, // East Africa
    { from:[38,-97],to:[54,-2],  color:0x22c55e, speed:0.025 }, // Atlantic
  ];
  return routes.map(route => {
    const geo = new THREE.SphereGeometry(0.014, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: route.color });
    const mesh = new THREE.Mesh(geo, mat);
    // Wake trail: short line behind the ship
    const trailPts = [new THREE.Vector3(), new THREE.Vector3()];
    const trailGeo = new THREE.BufferGeometry().setFromPoints(trailPts);
    const trailMat = new THREE.LineBasicMaterial({ color: route.color, transparent: true, opacity: 0.35 });
    const trail = new THREE.Line(trailGeo, trailMat);
    scene.add(mesh); scene.add(trail);
    return { mesh, trail, trailGeo, route, progress: Math.random() };
  });
}

// Aircraft: slightly larger dot with a longer heading trail
function buildAircraftOverlays(scene: THREE.Scene) {
  const flights: Array<{ from:[number,number]; to:[number,number]; color:number; speed:number; alt:number }> = [
    { from:[49,32],  to:[51,10],  color:0xf59e0b, speed:0.055, alt:1.04 }, // Ukraine→Germany
    { from:[35,38],  to:[33,53],  color:0x8b5cf6, speed:0.07,  alt:1.05 }, // Syria→Iran classified
    { from:[40,127], to:[35,105], color:0xf59e0b, speed:0.06,  alt:1.04 }, // NK→China
    { from:[38,-97], to:[54,-2],  color:0x22d3ee, speed:0.045, alt:1.045}, // US→UK
    { from:[21,78],  to:[30,70],  color:0xec4899, speed:0.065, alt:1.04 }, // India→Pakistan
    { from:[35,105], to:[24,121], color:0xf59e0b, speed:0.08,  alt:1.05 }, // China→Taiwan
  ];
  return flights.map(f => {
    const geo = new THREE.SphereGeometry(0.018, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: f.color });
    const mesh = new THREE.Mesh(geo, mat);
    // Heading trail — 8 points fading behind
    const TRAIL = 8;
    const trailPts = Array.from({ length: TRAIL }, () => new THREE.Vector3());
    const trailGeo = new THREE.BufferGeometry().setFromPoints(trailPts);
    const trailMat = new THREE.LineBasicMaterial({ color: f.color, transparent: true, opacity: 0.5, vertexColors: false });
    const trail = new THREE.Line(trailGeo, trailMat);
    scene.add(mesh); scene.add(trail);
    return { mesh, trail, trailGeo, trailHistory: trailPts.map(() => new THREE.Vector3()), f, progress: Math.random() };
  });
}

// Fire flare: pulsing orange/red ring at conflict hotspots
function buildFireMarkers(scene: THREE.Scene) {
  const fires: Array<[number,number]> = [
    [33,44],[35,38],[15,48],[7,30],[9,40],[49,32],[30,70],[35,105],
  ];
  return fires.map(([lat,lon]) => {
    const pos = ll2v(lat, lon, 1.015);
    const geo = new THREE.RingGeometry(0.008, 0.018, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.copy(pos); ring.lookAt(new THREE.Vector3(0,0,0));
    // Inner dot
    const dotGeo = new THREE.SphereGeometry(0.007, 6, 6);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.copy(pos);
    scene.add(ring); scene.add(dot);
    return { ring, dot, phase: Math.random() * Math.PI * 2 };
  });
}

// Camera ping: expanding cyan ring at surveillance locations
function buildCameraPings(scene: THREE.Scene) {
  const cams: Array<[number,number]> = [
    [33,36],[26,50],[43,29],[1,104],[38,-97],[54,-2],[35,105],[49,32],
  ];
  return cams.map(([lat,lon]) => {
    const pos = ll2v(lat, lon, 1.012);
    const geo = new THREE.RingGeometry(0.005, 0.012, 10);
    const mat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.copy(pos); ring.lookAt(new THREE.Vector3(0,0,0));
    scene.add(ring);
    return { ring, pos, phase: Math.random() * Math.PI * 2, speed: 1.5 + Math.random() };
  });
}

// Animated SIGINT arc beams: bright arcs that fade in/out to show signal intercepts
function buildSigintArcs(scene: THREE.Scene) {
  const beams: Array<{ from:[number,number]; to:[number,number]; color:number; phase:number; speed:number }> = [
    { from:[33,53], to:[38,-97],  color:0xef4444, phase:0,   speed:0.6 }, // Iran→US intercept
    { from:[40,127],to:[35,105],  color:0xef4444, phase:1.5, speed:0.7 }, // NK→China
    { from:[35,38], to:[51,10],   color:0xff8800, phase:0.8, speed:0.5 }, // Syria→Germany
    { from:[49,32], to:[54,-2],   color:0xff4444, phase:2.1, speed:0.65}, // Ukraine→UK
    { from:[30,70], to:[21,78],   color:0xec4899, phase:3.0, speed:0.8 }, // Pakistan→India
    { from:[35,105],to:[24,121],  color:0xf59e0b, phase:1.2, speed:0.9 }, // China→Taiwan
  ];
  return beams.map(b => {
    const pts = arcPoints(b.from, b.to, 1.03, 32);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: b.color, transparent: true, opacity: 0 });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    return { line, b };
  });
}

function buildGPSConstellation(scene: THREE.Scene) {
  const sats: Array<{ mesh: THREE.Mesh; orbitRadius: number; orbitInclination: number; orbitAscending: number; speed: number; phase: number }> = [];
  const satGeo = new THREE.SphereGeometry(0.012, 6, 6);
  const satMat = new THREE.MeshBasicMaterial({ color: 0x88ccff });
  const satGlowMat = new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.3 });
  const satGlowGeo = new THREE.SphereGeometry(0.022, 6, 6);

  for (let plane = 0; plane < 6; plane++) {
    const raan = (plane * 60) * Math.PI / 180;
    for (let sat = 0; sat < 4; sat++) {
      const mesh = new THREE.Mesh(satGeo, satMat.clone());
      const glow = new THREE.Mesh(satGlowGeo, satGlowMat.clone());
      mesh.add(glow);
      scene.add(mesh);
      sats.push({ mesh, orbitRadius: 2.0, orbitInclination: 55 * Math.PI / 180, orbitAscending: raan, speed: 0.15 + plane * 0.01, phase: (sat / 4) * Math.PI * 2 + plane * 0.3 });
    }
  }
  for (let plane = 0; plane < 3; plane++) {
    const raan = (plane * 120 + 30) * Math.PI / 180;
    for (let sat = 0; sat < 5; sat++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.008, 5, 5), new THREE.MeshBasicMaterial({ color: 0xff8844 }));
      scene.add(mesh);
      sats.push({ mesh, orbitRadius: 1.55, orbitInclination: 45 * Math.PI / 180, orbitAscending: raan, speed: 0.45 + plane * 0.05, phase: (sat / 5) * Math.PI * 2 });
    }
  }
  return sats;
}

function updateSatellite(sat: { mesh: THREE.Mesh; orbitRadius: number; orbitInclination: number; orbitAscending: number; speed: number; phase: number }, t: number) {
  const angle = sat.phase + t * sat.speed;
  const inc = sat.orbitInclination, raan = sat.orbitAscending, r = sat.orbitRadius;
  const x0 = r * Math.cos(angle), y0 = r * Math.sin(angle);
  const x1 = x0, y1 = y0 * Math.cos(inc), z1 = y0 * Math.sin(inc);
  sat.mesh.position.set(x1 * Math.cos(raan) - z1 * Math.sin(raan), y1, x1 * Math.sin(raan) + z1 * Math.cos(raan));
}

// ─── Intel type icon + color helpers ─────────────────────────────────────────
function IntelIcon({ type, color, size = 10 }: { type: IntelType; color: string; size?: number }) {
  const cls = `flex-shrink-0`;
  const style = { color, width: size, height: size };
  if (type === "camera")  return <Camera  className={cls} style={style}/>;
  if (type === "flight")  return <Plane   className={cls} style={style}/>;
  if (type === "ship")    return <Ship    className={cls} style={style}/>;
  if (type === "news")    return <Newspaper className={cls} style={style}/>;
  if (type === "signal")  return <Signal  className={cls} style={style}/>;
  if (type === "alert")   return <AlertTriangle className={cls} style={style}/>;
  return <Eye className={cls} style={style}/>;
}

function StatusBadge({ status, color }: { status: IntelEvent["status"]; color: string }) {
  const isPulse = status === "LIVE" || status === "INTERCEPTED";
  return (
    <span className={`text-[7px] font-mono font-bold px-1.5 py-0.5 rounded tracking-wider flex-shrink-0 ${isPulse ? "animate-pulse" : ""}`}
      style={{ background: color + "18", color, border: `1px solid ${color}35` }}>
      {status === "LIVE" ? "● LIVE" : status === "CLASSIFIED" ? "⬛ CLASS" : status.slice(0, 5)}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function GlobeRegionSelector({ onSelect }: Props) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  const isNavy = theme === 'navy';

  // Default to dark mode on first visit to this page
  useEffect(() => {
    try {
      if (!localStorage.getItem('theme')) {
        // No stored preference — explicitly set dark
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      }
    } catch {}
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const globeRef = useRef<THREE.Mesh | null>(null);
  const pulseRingsRef = useRef<Array<{ mesh: THREE.Mesh; phase: number; speed: number; maxR: number }>>([]);
  const satsRef = useRef<ReturnType<typeof buildGPSConstellation>>([]);
  const frameRef = useRef<number>(0);
  const pointerRef = useRef<{ active: boolean; id: number; x: number; y: number }>({ active: false, id: -1, x: 0, y: 0 });
  const rotX = useRef(0.3), rotY = useRef(-0.5);
  const velX = useRef(0), velY = useRef(0);
  const autoRot = useRef(true);
  const lastTimeRef = useRef(0);

  const [sel, setSel] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [qResult, setQResult] = useState<string | null>(null);
  const [boot, setBoot] = useState(0);
  const [bootTxt, setBootTxt] = useState("");
  const [tick, setTick] = useState(0);

  // Intel feed state — a rotating window of 6 events
  const [feedOffset, setFeedOffset] = useState(0);
  const feedHovered = useRef(false);

  // Camera popup state: 'hidden' | 'showing' | 'hiding'
  const [camState, setCamState] = useState<'hidden'|'showing'|'hiding'>('hidden');
  const [camLocation, setCamLocation] = useState({ label: 'BEIRUT-CAM-07', coords: '33.8886° N, 35.4955° E', region: 'MENA' });
  const CAM_LOCATIONS = [
    { label: 'BEIRUT-CAM-07',   coords: '33.8886° N, 35.4955° E', region: 'MENA' },
    { label: 'KYIV-DRONE-03',   coords: '50.4501° N, 30.5234° E', region: 'EUROPE' },
    { label: 'HORMUZ-SAT-01',   coords: '26.5667° N, 56.2500° E', region: 'MENA' },
    { label: 'TAIPEI-CAM-12',   coords: '25.0330° N, 121.5654° E', region: 'EAST ASIA' },
    { label: 'DAMASCUS-CAM-04', coords: '33.5138° N, 36.2765° E', region: 'MENA' },
  ];

  // Boot sequence
  useEffect(() => {
    const lines = [
      "▶ REDROOM V2.4 INITIALIZING...",
      "▶ LOADING SATELLITE CONSTELLATION DATA...",
      "▶ CONNECTING TO INTELLIGENCE NETWORK...",
      "▶ DECRYPTING REGIONAL THREAT ASSESSMENTS...",
      "▶ CALIBRATING GEOSPATIAL INTELLIGENCE FEED...",
      "▶ ALL SYSTEMS NOMINAL. READY.",
    ];
    let li = 0, ci = 0, full = "";
    const iv = setInterval(() => {
      if (li >= lines.length) { clearInterval(iv); setTimeout(() => setBoot(1), 300); return; }
      const line = lines[li];
      if (ci < line.length) { ci++; setBootTxt(full + line.slice(0, ci)); }
      else { full += line + "\n"; li++; ci = 0; }
    }, 22);
    return () => clearInterval(iv);
  }, []);

  const pageVisible = usePageVisible();

  useEffect(() => {
    if (!pageVisible) return;
    const iv = setInterval(() => setTick(t => t + 1), 80);
    return () => clearInterval(iv);
  }, [pageVisible]);

  // Rotate intel feed every 3.5s (pause on hover)
  useEffect(() => {
    if (!pageVisible) return;
    const iv = setInterval(() => {
      if (!feedHovered.current) {
        setFeedOffset(o => (o + 1) % INTEL_POOL.length);
      }
    }, 3500);
    return () => clearInterval(iv);
  }, [pageVisible]);

  // Camera popup cycle: show for 6s every 14s
  useEffect(() => {
    if (!pageVisible || boot < 1) return;
    let camIdx = 0;
    const cycle = () => {
      camIdx = (camIdx + 1) % 5;
      setCamLocation(CAM_LOCATIONS[camIdx]);
      setCamState('showing');
      const hideTimer = setTimeout(() => setCamState('hiding'), 6000);
      const clearTimer = setTimeout(() => setCamState('hidden'), 7000);
      return () => { clearTimeout(hideTimer); clearTimeout(clearTimer); };
    };
    // First popup after 4s, then every 14s
    const first = setTimeout(cycle, 4000);
    const interval = setInterval(cycle, 14000);
    return () => { clearTimeout(first); clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageVisible, boot]);

  // Three.js scene
  useEffect(() => {
    if (boot < 1) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const W = canvas.clientWidth || 460, H = canvas.clientHeight || 460;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    cam.position.set(0, 0, 2.8);

    const loader = new THREE.TextureLoader();
    const dayTex = loader.load(EARTH_DAY_URL);
    const nightTex = loader.load(EARTH_NIGHT_URL);
    const specTex = loader.load(EARTH_SPEC_URL);

    const earthMat = new THREE.MeshPhongMaterial({
      map: dayTex, color: new THREE.Color(isNavy ? 0x6faee8 : 0xffffff), emissiveMap: nightTex,
      emissive: new THREE.Color(isNavy ? 0x0d5cba : 0x112244),
      emissiveIntensity: isNavy ? 0.82 : 0.55, specularMap: specTex, specular: new THREE.Color(isNavy ? 0x75c5ff : 0x336699),
      shininess: 18,
    });
    const earthGeo = new THREE.SphereGeometry(1, 64, 64);
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);
    globeRef.current = earth;

    // Atmosphere
    const atmMat = new THREE.MeshPhongMaterial({ color: isNavy ? 0x58b7ff : 0x4488ff, transparent: true, opacity: isNavy ? 0.16 : 0.06, side: THREE.FrontSide });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.025, 32, 32), atmMat));

    // Lights
    const sun = new THREE.DirectionalLight(isNavy ? 0x9dd7ff : 0xfff5e0, isNavy ? 2.15 : 1.6);
    sun.position.set(5, 3, 5);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(isNavy ? 0x1c5791 : 0x112233, isNavy ? 1.15 : 0.6));

    // Data-stream arcs
    const arcPairs: Array<[[number,number],[number,number],number]> = isNavy ? [
      [[38,-97],[51,10],0x69bfff],[[38,-97],[35,105],0x4c9cff],
      [[51,10],[35,38],0x83ceff],[[54,-2],[49,32],0x3f8ae8],
      [[24,54],[35,105],0x77bfff],[[35,105],[37,128],0x579de8],
      [[21,78],[33,53],0x73b8ff],[[38,-97],[54,-2],0x91d3ff],
    ] : [
      [[38,-97],[51,10],0x4488ff],[[38,-97],[35,105],0x44ffcc],
      [[51,10],[35,38],0xff4444],[[54,-2],[49,32],0xff8800],
      [[24,54],[35,105],0xffcc44],[[35,105],[37,128],0xffaa22],
      [[21,78],[33,53],0xff44aa],[[38,-97],[54,-2],0x44ff88],
    ];
    arcPairs.forEach(([from, to, col]) => {
      const pts = arcPoints(from, to, 1.02);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.18 });
      scene.add(new THREE.Line(geo, mat));
    });

    // Pulse rings at hotspots
    HOTSPOTS.forEach(h => {
      const pos = ll2v(h.lat, h.lon, 1.01);
      const ringGeo = new THREE.RingGeometry(0.01, 0.025, 16);
      const col = isNavy ? 0x64b8ff : THREAT_HEX[REGIONS.find(r => r.id === h.region)?.threatLevel || "MODERATE"];
      const ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      scene.add(ring);
      pulseRingsRef.current.push({ mesh: ring, phase: Math.random() * Math.PI * 2, speed: 1.2 + Math.random() * 0.8, maxR: 0.08 + h.intensity * 0.06 });
    });

    // GPS satellites
    satsRef.current = buildGPSConstellation(scene);

    // Orbital rings (visual only)
    [2.0, 1.55].forEach((r, i) => {
      const pts: THREE.Vector3[] = [];
      for (let a = 0; a <= 64; a++) { const ang = (a / 64) * Math.PI * 2; pts.push(new THREE.Vector3(r * Math.cos(ang), 0, r * Math.sin(ang))); }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: i === 0 ? 0x4488ff : 0xff8844, transparent: true, opacity: 0.06 });
      scene.add(new THREE.Line(geo, mat));
    });

    // ── Intelligence overlays removed — replaced by HTML overlay layer ──────────

    // Helper: interpolate position along great circle at progress [0,1]
    function greatCirclePos(from: [number,number], to: [number,number], progress: number, r: number) {
      const p = progress % 1;
      const a = ll2v(from[0], from[1], r);
      const b = ll2v(to[0], to[1], r);
      return new THREE.Vector3().lerpVectors(a, b, p).normalize().multiplyScalar(r);
    }

    let t = 0;
    function animate(now: number) {
      frameRef.current = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;
      t += dt;

      if (autoRot.current) { velY.current += 0.004 * dt; }
      velX.current *= 0.92; velY.current *= 0.92;
      rotX.current += velX.current; rotY.current += velY.current;
      earth.rotation.x = rotX.current; earth.rotation.y = rotY.current;

      pulseRingsRef.current.forEach(pr => {
        pr.phase += dt * pr.speed;
        const s = 1 + (Math.sin(pr.phase) * 0.5 + 0.5) * (pr.maxR / 0.025);
        pr.mesh.scale.setScalar(s);
        (pr.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - (Math.sin(pr.phase) * 0.5 + 0.5) * 0.6);
      });

      // Three.js intel overlays removed — see HTML overlay layer below

      satsRef.current.forEach(s => updateSatellite(s, t));
      renderer.render(scene, cam);
    }
    frameRef.current = requestAnimationFrame(animate);

    const onResize = () => {
      if (!canvas) return;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, [boot, isNavy]);

  // Pointer drag
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerRef.current = { active: true, id: e.pointerId, x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    autoRot.current = false;
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerRef.current.active || e.pointerId !== pointerRef.current.id) return;
    const dx = e.clientX - pointerRef.current.x, dy = e.clientY - pointerRef.current.y;
    velY.current = dx * 0.003; velX.current = dy * 0.003;
    pointerRef.current.x = e.clientX; pointerRef.current.y = e.clientY;
  }, []);
  const onPointerUp = useCallback(() => {
    pointerRef.current.active = false;
    setTimeout(() => { autoRot.current = true; }, 2000);
  }, []);

  const rotateTo = useCallback((rid: string) => {
    const r = REGIONS.find(x => x.id === rid); if (!r) return;
    const targetY = -(r.lon * Math.PI / 180) - Math.PI / 2;
    const targetX = -(((90 - r.lat) * Math.PI / 180) - Math.PI / 2) * 0.5;
    velY.current = (targetY - rotY.current) * 0.04;
    velX.current = (targetX - rotX.current) * 0.04;
    autoRot.current = false;
    setTimeout(() => { autoRot.current = true; }, 5000);
  }, []);

  const handleClick = useCallback((rid: string) => { setSel(rid); rotateTo(rid); }, [rotateTo]);
  const handleConfirm = useCallback(() => { if (sel) onSelect(sel); }, [sel, onSelect]);

  const handleSearch = useCallback((v: string) => {
    setQ(v); if (!v.trim()) { setQResult(null); return; }
    const lo = v.toLowerCase();
    for (const [name, iso] of Object.entries(COUNTRY_NAME_TO_ISO)) {
      if (name.includes(lo)) { const rid = COUNTRY_REGION_MAP[iso]; if (rid) { setQResult(rid); setSel(rid); rotateTo(rid); return; } }
    }
    for (const r of REGIONS) {
      if (r.id.toLowerCase().includes(lo) || r.label.toLowerCase().includes(lo)) { setQResult(r.id); setSel(r.id); rotateTo(r.id); return; }
    }
    setQResult(null);
  }, [rotateTo]);

  const selected = REGIONS.find(r => r.id === sel);
  const active = REGIONS.find(r => r.id === hov) || selected;
  const dataVal = Math.floor(1e6 + Math.sin(tick * 0.3) * 50000 + tick * 1337);

  // Build the 6-item visible feed window
  const FEED_VISIBLE = 6;
  const feedItems: IntelEvent[] = Array.from({ length: FEED_VISIBLE }, (_, i) => {
    const poolItem = INTEL_POOL[(feedOffset + i) % INTEL_POOL.length];
    return { ...poolItem, id: i, ts: i * 8 + Math.floor(tick * 0.1) % 8 };
  });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{ background: 'var(--background)' }}>
      {/* Scan-line overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: isLight ? 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(120,0,0,0.012) 3px, rgba(120,0,0,0.012) 4px)' : 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(180,0,0,0.006) 3px, rgba(180,0,0,0.006) 4px)', zIndex: 1 }}/>
      {/* Fine grid */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: isLight ? 'linear-gradient(rgba(180,0,0,0.042) 1px, transparent 1px), linear-gradient(90deg, rgba(180,0,0,0.042) 1px, transparent 1px)' : 'linear-gradient(rgba(200,0,0,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(200,0,0,0.018) 1px, transparent 1px)', backgroundSize: '80px 80px', zIndex: 1 }}/>
      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, oklch(from var(--foreground) l c h / 0.25) 100%)', zIndex: 1 }}/>

      {/* Corner HUD brackets */}
      {[['top-3 left-3','border-t-2 border-l-2'],['top-3 right-3','border-t-2 border-r-2'],['bottom-3 left-3','border-b-2 border-l-2'],['bottom-3 right-3','border-b-2 border-r-2']].map(([pos, border]) => (
        <div key={pos} className={`absolute ${pos} w-12 h-12 ${border} border-red-600/25 pointer-events-none`} style={{ zIndex: 2 }}/>
      ))}

      {/* Top status bar */}
      <div className="absolute top-0 left-0 right-0 hidden h-8 items-center justify-between px-6 pointer-events-none sm:flex" style={{ background: isLight ? 'linear-gradient(180deg, var(--surface-container-high) 0%, transparent 100%)' : 'linear-gradient(180deg, rgba(20,0,0,0.9) 0%, transparent 100%)', zIndex: 3 }}>
        <div className="flex items-center gap-4">
          <span className={`font-mono text-[9px] tracking-widest ${isLight ? "text-red-700/60" : "text-red-400/50"}`}>SYS:ONLINE</span>
          <span className={`font-mono text-[9px] tracking-widest ${isLight ? "text-green-700/60" : "text-green-400/50"}`}>SAT:LOCK</span>
          <span className={`font-mono text-[9px] tracking-widest ${isLight ? "text-yellow-700/60" : "text-yellow-400/50"}`}>ENC:AES-256</span>
        </div>
        <div className={`font-mono text-[9px] tracking-widest ${isLight ? "text-red-700/50" : "text-red-400/35"}`}>INTEL STREAM: {dataVal.toLocaleString()} PKT/S</div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[9px] text-red-500/70 tracking-widest animate-pulse">● LIVE</span>
          <a
            href="https://owlink.ai"
            target="_blank"
            rel="noopener noreferrer"
            className={`font-mono text-[9px] tracking-widest transition-colors duration-200 font-semibold ${isLight ? "text-red-700 hover:text-red-800" : "text-red-400/80 hover:text-red-400"}`}
          >REDROOM V2.4 · © ALEXSAI · OWLINK.AI</a>
        </div>
      </div>

      {/* Shared global theme selector */}
      <div className="absolute top-3 right-3 z-[10] sm:top-10 sm:right-4">
        <ThemeSelector />
      </div>
      {/* Boot screen */}
      {boot === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="font-mono text-[11px] text-red-400/80 max-w-md text-left whitespace-pre-line leading-7 p-8 rounded-xl border border-red-900/30" style={{ background: isLight ? 'var(--surface-container-lowest)' : 'rgba(10,0,0,0.95)' }}>
            {bootTxt}<span className="animate-pulse text-red-300">█</span>
          </div>
        </div>
      )}

      {boot === 1 && (
        <div className="relative mx-3 flex h-[100dvh] w-full max-w-7xl flex-col items-center gap-2 overflow-x-hidden overflow-y-auto pt-14 pb-3 sm:mx-4 sm:gap-3 sm:pt-8 lg:overflow-hidden lg:pt-6 lg:pb-4"
          style={{ zIndex: 5, boxSizing: 'border-box' }}>

          {/* Header */}
          <div className="text-center flex-shrink-0">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="flex max-w-[calc(100vw-5rem)] items-center gap-1.5 rounded-full border border-red-600/30 px-2 py-1 sm:px-3"
                style={{ background: 'rgba(200,0,0,0.06)', boxShadow: '0 0 20px rgba(200,0,0,0.12)' }}>
                <Shield size={11} className="text-red-400"/>
                <span className="font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-red-400/80 sm:text-[9px] sm:tracking-[0.35em]">News & Geo Intelligence</span>
                <Zap size={11} className="text-red-400"/>
              </div>
            </div>
            <h1 className="mb-1 text-3xl font-black tracking-tight sm:text-4xl md:text-5xl"
              style={{ color: '#cc1111', textShadow: '0 0 30px rgba(220,0,0,0.9), 0 0 60px rgba(180,0,0,0.5), 0 0 100px rgba(150,0,0,0.3), 0 2px 4px oklch(from var(--foreground) l c h / 0.3)' }}>
              REDROOM
            </h1>
            <p className={`hidden sm:block text-[10px] font-mono tracking-[0.3em] ${isLight ? "text-red-700/40" : "text-red-400/30"}`}>
              DRAG GLOBE · CLICK REGION · SEARCH COUNTRY · SATELLITE NETWORK ACTIVE
            </p>
            <p className={`sm:hidden text-[9px] font-mono tracking-[0.2em] ${isLight ? "text-red-700/40" : "text-red-400/30"}`}>
              TAP REGION · SEARCH COUNTRY
            </p>
          </div>

          {/* Main layout — desktop: 3-col row | mobile: globe + region list stacked */}
          <div className="flex min-h-0 w-full flex-none flex-col items-stretch gap-2 lg:flex-1 lg:flex-row lg:gap-4">

            {/* ── LEFT: Intelligence Activity Feed — hidden on mobile ── */}
            <div className="hidden lg:flex w-56 flex-col gap-2 flex-shrink-0 min-h-0">

              {/* SIGINT/HUMINT bars */}
              <div className="px-3 py-2.5 rounded-lg border border-red-900/25 flex-shrink-0" style={{ background: isLight ? 'var(--surface-container-lowest)' : 'rgba(15,0,0,0.7)' }}>
                <div className={`text-[8px] font-mono tracking-widest mb-2 flex items-center gap-1.5 ${isLight ? "text-red-700/50" : "text-red-400/40"}`}>
                  <Radio size={8}/> SIGNAL INTERCEPTS
                </div>
                {[
                  { label: "SIGINT", val: 847 + (tick % 13), color: "#ef4444" },
                  { label: "HUMINT", val: 234 + (tick % 7),  color: "#f59e0b" },
                  { label: "OSINT",  val: 3821 + (tick % 31), color: "#22d3ee" },
                  { label: "IMINT",  val: 156 + (tick % 5),  color: "#22c55e" },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2 mb-1">
                    <div className="text-[9px] font-mono text-muted-foreground/80 w-10">{item.label}</div>
                    <div className="flex-1 h-1 rounded-full bg-foreground/5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, item.val / 40)}%`, background: item.color, boxShadow: `0 0 4px ${item.color}` }}/>
                    </div>
                    <div className="text-[8px] font-mono text-muted-foreground/60 w-8 text-right">{item.val}</div>
                  </div>
                ))}
              </div>

              {/* Live intel activity feed */}
              <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-red-900/25 overflow-hidden"
                style={{ background: isLight ? 'var(--surface-container-lowest)' : 'rgba(10,0,0,0.75)' }}
                onMouseEnter={() => { feedHovered.current = true; }}
                onMouseLeave={() => { feedHovered.current = false; }}>

                {/* Feed header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-red-900/20 flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0"/>
                    <span className={`text-[8px] font-mono tracking-widest ${isLight ? "text-red-700/70" : "text-red-400/60"}`}>LIVE INTEL FEED</span>
                  </div>
                  <span className="text-[7px] font-mono text-muted-foreground/30">{INTEL_POOL.length} ACTIVE</span>
                </div>

                {/* Feed items */}
                <div className="flex-1 overflow-hidden flex flex-col gap-0">
                  {feedItems.map((item, idx) => {
                    const isNew = idx === 0;
                    return (
                      <div key={item.id}
                        className="px-2.5 py-2 border-b border-white/[0.03] transition-all duration-500 hover:bg-white/[0.02]"
                        style={{
                          opacity: isNew ? 1 : 0.55 + idx * 0.08,
                          animation: isNew ? 'feedSlideIn 0.4s ease-out' : undefined,
                        }}>
                        {/* Row 1: icon + label + status */}
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <IntelIcon type={item.type} color={item.color} size={9}/>
                          <span className="text-[9px] font-mono font-bold flex-1 truncate" style={{ color: item.color }}>{item.label}</span>
                          <StatusBadge status={item.status} color={item.color}/>
                        </div>
                        {/* Row 2: detail */}
                        <div className="text-[8px] font-mono text-muted-foreground/60 leading-tight truncate pl-3.5">{item.detail}</div>
                        {/* Row 3: location + progress bar (flights/ships) or timestamp */}
                        <div className="flex items-center gap-1.5 mt-0.5 pl-3.5">
                          <MapPin size={7} className="text-muted-foreground/30 flex-shrink-0"/>
                          <span className="text-[7px] font-mono text-muted-foreground/40 flex-1 truncate">{item.location}</span>
                          {item.progress !== undefined ? (
                            <div className="w-12 h-0.5 rounded-full bg-white/5 overflow-hidden flex-shrink-0">
                              <div className="h-full rounded-full transition-all duration-1000"
                                style={{ width: `${item.progress}%`, background: item.color, boxShadow: `0 0 3px ${item.color}` }}/>
                            </div>
                          ) : (
                            <span className="text-[7px] font-mono text-muted-foreground/25">{item.ts}s ago</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Feed footer */}
                <div className="px-3 py-1.5 border-t border-red-900/20 flex items-center justify-between flex-shrink-0">
                  <span className="text-[7px] font-mono text-muted-foreground/25">AUTO-CYCLING · HOVER TO PAUSE</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="w-1 h-1 rounded-full"
                        style={{ background: i === feedOffset % 5 ? '#ef4444' : 'rgba(255,255,255,0.1)' }}/>
                    ))}
                  </div>
                </div>
              </div>

              {/* Active alert */}
              <div className="px-3 py-2 rounded-lg border border-red-700/30 flex-shrink-0" style={{ background: isLight ? 'oklch(0.955 0.022 25)' : 'rgba(30,0,0,0.6)' }}>
                <div className={`text-[8px] font-mono tracking-widest mb-1 flex items-center gap-1.5 ${isLight ? "text-red-700/70" : "text-red-400/60"}`}>
                  <span className="animate-pulse">●</span> ACTIVE ALERTS
                </div>
                <div className={`text-[9px] font-mono leading-4 ${isLight ? "text-red-700/80" : "text-red-300/70"}`}>
                  {tick % 60 < 30 ? "MENA: CRITICAL ESCALATION" : "ASIA: ELEVATED POSTURE"}
                </div>
                <div className="text-[8px] font-mono text-muted-foreground/40 mt-0.5">{new Date().toUTCString().slice(0, 25)}</div>
              </div>
            </div>

            {/* ── CENTER: Globe ── */}
            <div className="relative isolate flex h-[230px] min-w-0 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl lg:h-auto lg:flex-1 lg:overflow-visible lg:rounded-none">
              {/* Heat visualization layers */}
              <div className="absolute hidden h-[700px] w-[700px] rounded-full pointer-events-none md:block" style={{
                background: active
                  ? `radial-gradient(circle, ${active.color}0a 0%, ${active.color}04 35%, transparent 65%)`
                  : 'radial-gradient(circle, rgba(180,0,0,0.04) 0%, transparent 55%)',
                transition: 'background 1.2s ease', filter: 'blur(60px)',
              }}/>
              <div className="absolute hidden h-[540px] w-[540px] rounded-full pointer-events-none md:block" style={{
                background: active
                  ? `radial-gradient(circle, transparent 42%, ${active.color}22 55%, ${active.color}10 68%, transparent 80%)`
                  : 'radial-gradient(circle, transparent 42%, rgba(180,0,0,0.10) 55%, transparent 75%)',
                transition: 'background 0.9s ease', filter: 'blur(12px)',
                animation: 'heatBreath 4s ease-in-out infinite',
              }}/>
              <div className="absolute hidden h-[480px] w-[480px] rounded-full pointer-events-none md:block" style={{
                background: active
                  ? `radial-gradient(circle, transparent 44%, ${active.color}35 50%, ${active.color}18 58%, transparent 66%)`
                  : 'radial-gradient(circle, transparent 44%, rgba(180,0,0,0.18) 50%, transparent 60%)',
                transition: 'background 0.7s ease', filter: 'blur(6px)',
                animation: 'heatBreath 4s ease-in-out infinite 0.5s',
              }}/>
              {active && (
                <div className="absolute hidden h-[300px] w-[300px] rounded-full pointer-events-none md:block" style={{
                  background: `radial-gradient(circle, ${active.color}28 0%, ${active.color}0c 45%, transparent 70%)`,
                  transition: 'background 0.6s ease', filter: 'blur(20px)',
                  animation: 'heatPulse 2.5s ease-in-out infinite',
                }}/>
              )}
              {active && active.threatVal >= 3 && (
                <div className="absolute hidden h-[520px] w-[520px] rounded-full pointer-events-none md:block" style={{
                  background: `conic-gradient(from 0deg, ${active.color}08, transparent 30%, ${active.color}12 60%, transparent 90%, ${active.color}06)`,
                  filter: 'blur(30px)', animation: 'heatSpin 12s linear infinite',
                  opacity: active.threatVal === 4 ? 0.9 : 0.6,
                }}/>
              )}
              <div className="absolute hidden h-[500px] w-[500px] rounded-full pointer-events-none md:block"
                style={{ border: `1px solid ${active ? active.color + "20" : "rgba(180,0,0,0.12)"}`, transition: "border-color 0.8s ease" }}/>
              <div className="absolute hidden h-[530px] w-[530px] rounded-full pointer-events-none md:block"
                style={{ border: `1px solid ${active ? active.color + "10" : "rgba(180,0,0,0.06)"}`, transition: "border-color 0.8s ease" }}/>

              {/* HUD tick marks */}
              <div className="absolute hidden h-[510px] w-[510px] pointer-events-none md:block">
                {Array.from({ length: 36 }).map((_, i) => {
                  const isMain = i % 9 === 0;
                  return (
                    <div key={i} className="absolute" style={{
                      left: '50%', top: '50%',
                      width: isMain ? '2px' : '1px',
                      height: isMain ? '12px' : '7px',
                      background: isMain ? 'rgba(220,0,0,0.45)' : 'rgba(220,0,0,0.18)',
                      transformOrigin: `0 ${-252}px`,
                      transform: `translateX(-50%) rotate(${i * 10}deg)`,
                    }}/>
                  );
                })}
              </div>

              <canvas
                ref={canvasRef}
                className="h-[215px] w-[215px] sm:h-[250px] sm:w-[250px] lg:h-[460px] lg:w-[460px]"
                style={{ cursor: pointerRef.current.active ? 'grabbing' : 'grab', touchAction: 'none' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />

              {/* ── SATELLITE ORBIT ── A visible satellite body orbiting the globe */}
              <div className="absolute inset-0 hidden pointer-events-none md:block" style={{ zIndex: 10 }}>
                {/* Orbit path ring */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full" style={{
                    width: 540, height: 540,
                    border: '1px dashed rgba(34,211,238,0.18)',
                    transform: 'rotateX(70deg) rotateZ(25deg)',
                  }}/>
                </div>
                {/* Satellite body — orbits using CSS animation */}
                <div className="absolute" style={{
                  top: '50%', left: '50%',
                  animation: 'sat-orbit 18s linear infinite',
                  transformOrigin: '0 0',
                }}>
                  <div style={{ transform: 'translate(-50%, -50%)' }}>
                    {/* Satellite SVG */}
                    <svg width="32" height="18" viewBox="0 0 32 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Left solar panel */}
                      <rect x="0" y="5" width="10" height="8" rx="1" fill="rgba(34,211,238,0.7)" stroke="rgba(34,211,238,0.9)" strokeWidth="0.5"/>
                      <line x1="2" y1="5" x2="2" y2="13" stroke="rgba(34,211,238,0.4)" strokeWidth="0.5"/>
                      <line x1="4" y1="5" x2="4" y2="13" stroke="rgba(34,211,238,0.4)" strokeWidth="0.5"/>
                      <line x1="6" y1="5" x2="6" y2="13" stroke="rgba(34,211,238,0.4)" strokeWidth="0.5"/>
                      <line x1="8" y1="5" x2="8" y2="13" stroke="rgba(34,211,238,0.4)" strokeWidth="0.5"/>
                      {/* Connector arm left */}
                      <rect x="10" y="8" width="3" height="2" fill="rgba(200,200,220,0.6)"/>
                      {/* Body */}
                      <rect x="13" y="4" width="6" height="10" rx="1.5" fill="rgba(180,190,210,0.85)" stroke="rgba(200,220,255,0.6)" strokeWidth="0.5"/>
                      {/* Antenna */}
                      <line x1="16" y1="4" x2="16" y2="1" stroke="rgba(255,255,255,0.7)" strokeWidth="1"/>
                      <circle cx="16" cy="0.5" r="1" fill="rgba(34,211,238,0.9)"/>
                      {/* Connector arm right */}
                      <rect x="19" y="8" width="3" height="2" fill="rgba(200,200,220,0.6)"/>
                      {/* Right solar panel */}
                      <rect x="22" y="5" width="10" height="8" rx="1" fill="rgba(34,211,238,0.7)" stroke="rgba(34,211,238,0.9)" strokeWidth="0.5"/>
                      <line x1="24" y1="5" x2="24" y2="13" stroke="rgba(34,211,238,0.4)" strokeWidth="0.5"/>
                      <line x1="26" y1="5" x2="26" y2="13" stroke="rgba(34,211,238,0.4)" strokeWidth="0.5"/>
                      <line x1="28" y1="5" x2="28" y2="13" stroke="rgba(34,211,238,0.4)" strokeWidth="0.5"/>
                      <line x1="30" y1="5" x2="30" y2="13" stroke="rgba(34,211,238,0.4)" strokeWidth="0.5"/>
                      {/* Glow dot */}
                      <circle cx="16" cy="9" r="1.5" fill="rgba(34,211,238,0.9)" style={{ filter: 'drop-shadow(0 0 4px rgba(34,211,238,1))' }}/>
                    </svg>
                    {/* SAT label */}
                    <div style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(34,211,238,0.8)', textAlign: 'center', marginTop: 2, letterSpacing: '0.1em', textShadow: '0 0 6px rgba(34,211,238,0.8)' }}>SAT-7</div>
                  </div>
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════
                   CORPORATE INTELLIGENCE OVERLAYS — HTML layer over Three.js
                   All positioned within the globe center div (460×460 viewBox)
              ═══════════════════════════════════════════════════════════════ */}

              {/* ── FLIGHT TRACK 1: FLT-UA441 · Kyiv → Berlin ── */}
              <div className="absolute inset-0 hidden pointer-events-none md:block" style={{ zIndex: 11 }}>
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 460 460" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Glow layer */}
                  <path d="M 308 148 C 280 72 210 68 186 152" stroke="rgba(251,191,36,0.18)" strokeWidth="5" fill="none" strokeLinecap="round"/>
                  {/* Main arc */}
                  <path id="fp1" d="M 308 148 C 280 72 210 68 186 152" stroke="rgba(251,191,36,0.75)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                  {/* Origin dot */}
                  <circle cx="308" cy="148" r="3" fill="rgba(251,191,36,0.9)" />
                  <circle cx="308" cy="148" r="5" fill="none" stroke="rgba(251,191,36,0.4)" strokeWidth="1"/>
                  {/* Destination dot */}
                  <circle cx="186" cy="152" r="3" fill="rgba(251,191,36,0.9)"/>
                  <circle cx="186" cy="152" r="5" fill="none" stroke="rgba(251,191,36,0.4)" strokeWidth="1"/>
                  {/* Origin label */}
                  <text x="314" y="145" fontFamily="monospace" fontSize="7" fill="rgba(251,191,36,0.7)" letterSpacing="0.5">KBP</text>
                  {/* Destination label */}
                  <text x="168" y="149" fontFamily="monospace" fontSize="7" fill="rgba(251,191,36,0.7)" letterSpacing="0.5">TXL</text>
                  {/* Animated plane along arc */}
                  <g style={{ offsetPath: 'path("M 308 148 C 280 72 210 68 186 152")', offsetRotate: 'auto', animation: 'flight-arc 9s linear infinite' } as React.CSSProperties}>
                    {/* Plane silhouette — top-down view */}
                    <g transform="translate(-7,-6)">
                      <path d="M7 0 L9.5 5 L14 6 L14 7.5 L9.5 7 L10 12 L12 13 L12 14 L7 13 L2 14 L2 13 L4 12 L4.5 7 L0 7.5 L0 6 L4.5 5 Z" fill="rgba(251,191,36,1)" style={{ filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.9))' }}/>
                    </g>
                  </g>
                </svg>
                {/* Callout box mid-arc */}
                <div style={{
                  position: 'absolute', top: '18%', left: '42%',
                  fontFamily: 'monospace', fontSize: 7.5,
                  background: 'rgba(0,0,0,0.75)',
                  border: '1px solid rgba(251,191,36,0.5)',
                  borderRadius: 3, padding: '2px 5px',
                  color: 'rgba(251,191,36,0.9)',
                  letterSpacing: '0.08em',
                  boxShadow: '0 0 8px rgba(251,191,36,0.2)',
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ color: 'rgba(251,191,36,0.5)', marginRight: 3 }}>✈</span>FLT-UA441
                  <div style={{ fontSize: 6, color: 'rgba(251,191,36,0.5)', marginTop: 1 }}>38,000ft · 520kts · TRACKING</div>
                </div>
              </div>

              {/* ── FLIGHT TRACK 2: SIGINT-RC135 · Classified route ── */}
              <div className="absolute inset-0 hidden pointer-events-none md:block" style={{ zIndex: 11 }}>
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 460 460" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Glow */}
                  <path d="M 330 205 C 310 155 278 138 252 150" stroke="rgba(139,92,246,0.15)" strokeWidth="5" fill="none" strokeLinecap="round"/>
                  {/* Arc */}
                  <path d="M 330 205 C 310 155 278 138 252 150" stroke="rgba(139,92,246,0.65)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeDasharray="6 3"/>
                  <circle cx="330" cy="205" r="2.5" fill="rgba(139,92,246,0.9)"/>
                  <circle cx="252" cy="150" r="2.5" fill="rgba(139,92,246,0.9)"/>
                  <text x="336" y="203" fontFamily="monospace" fontSize="6.5" fill="rgba(139,92,246,0.65)" letterSpacing="0.5">IKA</text>
                  <text x="240" y="147" fontFamily="monospace" fontSize="6.5" fill="rgba(139,92,246,0.65)" letterSpacing="0.5">SVO</text>
                  <g style={{ offsetPath: 'path("M 330 205 C 310 155 278 138 252 150")', offsetRotate: 'auto', animation: 'flight-arc 13s linear infinite 4s' } as React.CSSProperties}>
                    <g transform="translate(-6,-5)">
                      <path d="M6 0 L8 4 L12 5 L12 6 L8 5.5 L8.5 10 L10 11 L10 12 L6 11 L2 12 L2 11 L3.5 10 L4 5.5 L0 6 L0 5 L4 4 Z" fill="rgba(139,92,246,0.9)" style={{ filter: 'drop-shadow(0 0 3px rgba(139,92,246,0.8))' }}/>
                    </g>
                  </g>
                </svg>
                <div style={{
                  position: 'absolute', top: '34%', left: '62%',
                  fontFamily: 'monospace', fontSize: 7,
                  background: 'rgba(0,0,0,0.75)',
                  border: '1px solid rgba(139,92,246,0.45)',
                  borderRadius: 3, padding: '2px 5px',
                  color: 'rgba(139,92,246,0.85)',
                  letterSpacing: '0.08em',
                  boxShadow: '0 0 8px rgba(139,92,246,0.2)',
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ color: 'rgba(139,92,246,0.5)', marginRight: 3 }}>✈</span>RC-135W
                  <div style={{ fontSize: 6, color: 'rgba(139,92,246,0.5)', marginTop: 1 }}>SIGINT · CLASSIFIED</div>
                </div>
              </div>

              {/* ── VESSEL TRACK: VESSEL-4471 · Red Sea ── */}
              <div className="absolute inset-0 hidden pointer-events-none md:block" style={{ zIndex: 11 }}>
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 460 460" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Wake trail */}
                  <path d="M 340 235 C 338 238 335 242 332 248" stroke="rgba(34,211,238,0.3)" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  {/* Vessel icon at tip */}
                  <g transform="translate(329,245)">
                    {/* Ship silhouette */}
                    <path d="M0 -5 L2 -2 L4 -2 L4 2 L-4 2 L-4 -2 L-2 -2 Z" fill="rgba(34,211,238,0.9)" style={{ filter: 'drop-shadow(0 0 4px rgba(34,211,238,0.8))' }}/>
                    <rect x="-1" y="-8" width="2" height="4" fill="rgba(34,211,238,0.7)"/>
                  </g>
                  {/* AIS ping ring */}
                  <circle cx="332" cy="248" r="6" fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="1" style={{ animation: 'fire-pulse-ring 2.5s ease-out infinite' }}/>
                  <circle cx="332" cy="248" r="3" fill="rgba(34,211,238,0.8)"/>
                </svg>
                {/* Callout */}
                <div style={{
                  position: 'absolute', top: '55%', left: '73%',
                  fontFamily: 'monospace', fontSize: 7,
                  background: 'rgba(0,0,0,0.78)',
                  border: '1px solid rgba(34,211,238,0.4)',
                  borderRadius: 3, padding: '2px 5px',
                  color: 'rgba(34,211,238,0.85)',
                  letterSpacing: '0.07em',
                  boxShadow: '0 0 8px rgba(34,211,238,0.15)',
                  whiteSpace: 'nowrap',
                }}>
                  ⚓ VESSEL-4471
                  <div style={{ fontSize: 6, color: 'rgba(34,211,238,0.5)', marginTop: 1 }}>AIS DISABLED · RED SEA</div>
                </div>
              </div>

              {/* ── THERMAL EVENT: TGT-IRAQ-03 · Baghdad ── */}
              <div className="absolute hidden pointer-events-none md:block" style={{
                top: '47%', left: '64%',
                zIndex: 12,
                transform: 'translate(-50%, -50%)',
              }}>
                {/* Outer pulse rings */}
                <div className="absolute" style={{
                  width: 36, height: 36,
                  top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  border: '1px solid rgba(239,68,68,0.6)',
                  borderRadius: '50%',
                  animation: 'fire-pulse-ring 2.2s ease-out infinite',
                }}/>
                <div className="absolute" style={{
                  width: 36, height: 36,
                  top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  borderRadius: '50%',
                  animation: 'fire-pulse-ring 2.2s ease-out infinite 0.7s',
                }}/>
                {/* Military diamond marker */}
                <div style={{
                  width: 14, height: 14,
                  background: 'rgba(239,68,68,0.9)',
                  transform: 'rotate(45deg)',
                  boxShadow: '0 0 10px rgba(239,68,68,0.8), 0 0 20px rgba(239,68,68,0.4)',
                  animation: 'fire-core-glow 1.2s ease-in-out infinite',
                }}/>
                {/* Corner brackets */}
                <svg style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M2 8 L2 2 L8 2" stroke="rgba(239,68,68,0.8)" strokeWidth="1.5" strokeLinecap="square"/>
                  <path d="M20 2 L26 2 L26 8" stroke="rgba(239,68,68,0.8)" strokeWidth="1.5" strokeLinecap="square"/>
                  <path d="M26 20 L26 26 L20 26" stroke="rgba(239,68,68,0.8)" strokeWidth="1.5" strokeLinecap="square"/>
                  <path d="M8 26 L2 26 L2 20" stroke="rgba(239,68,68,0.8)" strokeWidth="1.5" strokeLinecap="square"/>
                </svg>
                {/* Label */}
                <div style={{
                  position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                  marginTop: 6,
                  fontFamily: 'monospace', fontSize: 7,
                  color: 'rgba(239,68,68,0.95)',
                  textShadow: '0 0 8px rgba(239,68,68,0.7)',
                  textAlign: 'center',
                  letterSpacing: '0.1em',
                  whiteSpace: 'nowrap',
                  animation: 'cam-blink-red 2.5s ease-in-out infinite',
                }}>
                  THERMAL EVENT
                  <div style={{ fontSize: 6, color: 'rgba(239,68,68,0.6)', marginTop: 1, letterSpacing: '0.05em' }}>33.3152°N 44.3661°E · TGT-IRAQ-03</div>
                </div>
              </div>

              {/* ── CAMERA FEED POPUP ── */}
              {camState !== 'hidden' && (
                <div className="absolute hidden pointer-events-none md:block" style={{
                  bottom: '18%', right: '8%',
                  zIndex: 20,
                  width: 160,
                  animation: camState === 'showing' ? 'cam-popup-in 0.5s ease-out forwards' : 'cam-popup-out 0.5s ease-in forwards',
                }}>
                  {/* Camera feed window */}
                  <div style={{
                    background: 'rgba(0,0,0,0.88)',
                    border: '1px solid rgba(34,211,238,0.5)',
                    borderRadius: 6,
                    overflow: 'hidden',
                    boxShadow: '0 0 20px rgba(34,211,238,0.25), 0 4px 20px rgba(0,0,0,0.8)',
                  }}>
                    {/* Header bar */}
                    <div style={{
                      background: 'rgba(34,211,238,0.12)',
                      borderBottom: '1px solid rgba(34,211,238,0.3)',
                      padding: '3px 6px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', animation: 'cam-blink-red 1s ease-in-out infinite' }}/>
                        <span style={{ fontFamily: 'monospace', fontSize: 7, color: 'rgba(34,211,238,0.9)', letterSpacing: '0.1em' }}>LIVE</span>
                      </div>
                      <span style={{ fontFamily: 'monospace', fontSize: 7, color: 'rgba(34,211,238,0.7)', letterSpacing: '0.05em' }}>{camLocation.label}</span>
                    </div>
                    {/* Video area — simulated with noise/scan */}
                    <div style={{
                      width: '100%', height: 90,
                      position: 'relative',
                      background: 'linear-gradient(135deg, rgba(10,20,15,0.95) 0%, rgba(5,15,25,0.95) 50%, rgba(15,10,10,0.95) 100%)',
                      overflow: 'hidden',
                    }}>
                      {/* Simulated terrain/scene */}
                      <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: 'radial-gradient(ellipse at 40% 60%, rgba(50,80,40,0.4) 0%, transparent 50%), radial-gradient(ellipse at 70% 40%, rgba(60,50,30,0.3) 0%, transparent 40%)',
                      }}/>
                      {/* Scan line effect */}
                      <div style={{
                        position: 'absolute', left: 0, right: 0, height: 2,
                        background: 'linear-gradient(to bottom, transparent, rgba(34,211,238,0.15), transparent)',
                        animation: 'cam-scanline 2s linear infinite',
                      }}/>
                      {/* Grid overlay */}
                      <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: 'linear-gradient(rgba(34,211,238,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px)',
                        backgroundSize: '20px 20px',
                      }}/>
                      {/* Target crosshair */}
                      <div style={{ position: 'absolute', top: '40%', left: '45%', transform: 'translate(-50%,-50%)' }}>
                        <div style={{ width: 20, height: 20, border: '1px solid rgba(34,211,238,0.6)', borderRadius: '50%', position: 'relative' }}>
                          <div style={{ position: 'absolute', top: '50%', left: -4, right: -4, height: 1, background: 'rgba(34,211,238,0.6)', transform: 'translateY(-50%)' }}/>
                          <div style={{ position: 'absolute', left: '50%', top: -4, bottom: -4, width: 1, background: 'rgba(34,211,238,0.6)', transform: 'translateX(-50%)' }}/>
                        </div>
                      </div>
                      {/* Noise overlay */}
                      <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.06\'/%3E%3C/svg%3E")',
                        opacity: 0.4,
                      }}/>
                    </div>
                    {/* Footer info */}
                    <div style={{
                      padding: '3px 6px',
                      borderTop: '1px solid rgba(34,211,238,0.2)',
                      background: 'rgba(0,0,0,0.6)',
                    }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 6.5, color: 'rgba(34,211,238,0.7)', letterSpacing: '0.05em', marginBottom: 1 }}>{camLocation.coords}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 6, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>RGN: {camLocation.region} · ENC: AES-256</div>
                    </div>
                  </div>
                  {/* Connector line to globe */}
                  <div style={{
                    position: 'absolute', top: '50%', right: '100%',
                    width: 30, height: 1,
                    background: 'linear-gradient(to left, rgba(34,211,238,0.5), transparent)',
                  }}/>
                </div>
              )}

              {active && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full font-mono text-[11px] font-bold pointer-events-none"
                  style={{ background: active.color + "14", border: `1px solid ${active.color}50`, color: active.color, boxShadow: `0 0 20px ${active.color}25` }}>
                  ◈ {active.label.toUpperCase()} ◈
                </div>
              )}
            </div>

            {/* ── RIGHT: Region selector — same height as left panel ── */}
            <div className="flex h-[220px] min-h-0 w-full flex-shrink-0 flex-col gap-0 overflow-hidden rounded-xl lg:h-full lg:w-64" style={{ border: isLight ? '1px solid rgba(200,0,0,0.3)' : '1px solid rgba(200,0,0,0.22)', background: isLight ? 'var(--surface-container-lowest)' : 'rgba(8,0,0,0.72)', boxShadow: isLight ? '0 0 24px rgba(180,0,0,0.08), inset 0 0 40px oklch(0.25 0.02 248 / 0.025)' : '0 0 24px rgba(180,0,0,0.08), inset 0 0 40px rgba(0,0,0,0.4)' }}>

              {/* Search */}
              <div className="relative flex-shrink-0 px-2 pt-2 pb-2">
                <Search size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400/40"/>
                <input type="text" value={q} onChange={e => handleSearch(e.target.value)}
                  placeholder="Search country or region..."
                  className="h-10 w-full rounded-lg py-2 pl-8 pr-8 font-mono text-[12px] outline-none transition-all lg:h-auto lg:text-[11px]"
                  style={{ background: isLight ? 'var(--surface-container-low)' : 'rgba(200,0,0,0.04)', border: isLight ? '1px solid rgba(200,0,0,0.25)' : '1px solid rgba(200,0,0,0.15)', color: 'var(--foreground)' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(220,0,0,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(200,0,0,0.15)')}
                />
                {q && (
                  <button onClick={() => { setQ(""); setQResult(null); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-400/40 hover:text-red-400 transition-colors">
                    ✕
                  </button>
                )}
              </div>
              {q && !qResult && <div className="text-[9px] font-mono text-red-400/60 px-3 flex-shrink-0">⚠ NO MATCH FOUND</div>}
              {q && qResult && <div className="text-[9px] font-mono text-red-400/60 px-3 flex-shrink-0">→ <span className="text-red-300">{REGIONS.find(r => r.id === qResult)?.label}</span></div>}

              {/* Region list — fills remaining height, scrolls overflow like left panel feed */}
              <div className="relative flex-1 min-h-0 overflow-hidden" style={{ borderTop: '1px solid rgba(200,0,0,0.12)' }}>
                {/* Bottom fade mask */}
                <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none z-10"
                  style={{ background: isLight ? 'linear-gradient(to top, var(--surface-container-lowest), transparent)' : 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}/>

                <div className="overflow-y-auto flex flex-col gap-0 py-0"
                  style={{ maxHeight: 'calc(9 * 61px)', scrollbarWidth: 'thin', scrollbarColor: 'rgba(200,0,0,0.25) transparent', scrollBehavior: 'smooth' }}>
                  {REGIONS.map(region => {
                    const isSel = sel === region.id, isHov = hov === region.id;
                    const tc = THREAT_COLORS[region.threatLevel];
                    return (
                      <button key={region.id}
                        onClick={() => handleClick(region.id)}
                        onMouseEnter={() => setHov(region.id)}
                        onMouseLeave={() => setHov(null)}
                        className="group flex items-center gap-3 px-3 py-3 border-b transition-all duration-200 text-left relative overflow-hidden w-full flex-shrink-0"
                        style={{
                          background: isSel ? region.color + "18" : isHov ? region.color + "0d" : `rgba(${parseInt(region.color.slice(1,3),16)},${parseInt(region.color.slice(3,5),16)},${parseInt(region.color.slice(5,7),16)},0.03)`,
                          borderColor: isSel ? region.color + "40" : 'rgba(200,0,0,0.08)',
                          boxShadow: isSel ? `inset 0 0 20px ${region.color}10, 0 1px 0 ${region.color}20` : 'none',
                          transform: isHov && !isSel ? 'translateX(2px)' : 'none',
                        }}>
                        {/* Animated left accent bar */}
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r transition-all duration-200"
                          style={{ background: region.color, opacity: isSel ? 1 : isHov ? 0.5 : 0 }}/>

                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all" style={{
                          background: region.color,
                          boxShadow: isSel ? `0 0 12px ${region.color}, 0 0 4px ${region.color}` : `0 0 4px ${region.color}80`,
                        }}/>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="text-[13px] font-bold text-foreground leading-none font-mono tracking-wide truncate">{region.id}</div>
                              {region.countries.length > 0 && (
                                <span className="text-[7px] font-mono px-1 py-0.5 rounded flex-shrink-0"
                                  style={{ background: region.color + "18", color: region.color, border: `1px solid ${region.color}30` }}>
                                  {region.countries.length}
                                </span>
                              )}
                            </div>
                            <div className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                              style={{ background: tc + '15', color: tc, border: `1px solid ${tc}25` }}>
                              {region.threatLevel.slice(0,3)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="text-[9px] text-muted-foreground/50 truncate font-mono flex-1">{region.label}</div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* Trend arrow */}
                              <span
                                title={region.trend === 'up' ? 'Threat escalating' : region.trend === 'down' ? 'Threat de-escalating' : 'Threat stable'}
                                style={{
                                  fontSize: '9px',
                                  lineHeight: 1,
                                  color: region.trend === 'up' ? '#ef4444' : region.trend === 'down' ? '#22c55e' : '#6b7280',
                                  filter: region.trend === 'up' ? 'drop-shadow(0 0 3px #ef444488)' : region.trend === 'down' ? 'drop-shadow(0 0 3px #22c55e88)' : 'none',
                                  display: 'inline-block',
                                  transform: region.trend === 'up' ? 'translateY(-1px)' : region.trend === 'down' ? 'translateY(1px)' : 'none',
                                  transition: 'all 0.2s',
                                }}>
                                {region.trend === 'up' ? '▲' : region.trend === 'down' ? '▼' : '▬'}
                              </span>
                              {/* Threat intensity bar */}
                              <div className="w-10 h-px rounded-full bg-foreground/5 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${region.threatVal * 25}%`, background: tc + 'cc' }}/>
                              </div>
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={10} className="flex-shrink-0 transition-all duration-200 ml-0.5"
                          style={{ color: isSel ? region.color : isHov ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)', transform: isHov ? 'translateX(2px)' : 'none' }}/>
                      </button>
                    );
                  })}
                  {/* Spacer so last item clears the bottom fade */}
                  <div className="h-8 flex-shrink-0"/>
                </div>
              </div>

              {/* Selected region info card */}
              {selected && (
                <div className="px-3 py-2.5 flex-shrink-0"
                  style={{ background: selected.color + '0a', borderTop: `1px solid ${selected.color}20` }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: selected.color, boxShadow: `0 0 8px ${selected.color}` }}/>
                    <span className="text-[10px] font-bold font-mono" style={{ color: selected.color }}>{selected.id}</span>
                    <span className="text-[8px] font-mono text-muted-foreground/50 ml-auto">{selected.countries.length || '∞'} COUNTRIES</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground/70 font-mono">{selected.description}</div>
                </div>
              )}
            </div>
          </div>

          {/* Confirm button */}
          <div className="flex w-full flex-shrink-0 items-center justify-center pt-1">
            <button onClick={handleConfirm} disabled={!sel}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-mono text-xs font-bold tracking-wider transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-25 md:w-auto md:gap-3 md:px-10 md:py-3 md:text-sm md:tracking-widest"
              style={{
                background: selected ? `linear-gradient(135deg, #cc0000dd, #880000aa)` : "oklch(from var(--foreground) l c h / 0.05)",
                color: selected ? "#fff" : "oklch(from var(--foreground) l c h / 0.25)",
                boxShadow: selected ? `0 0 30px rgba(200,0,0,0.4), 0 0 60px rgba(180,0,0,0.15), 0 4px 20px oklch(from var(--foreground) l c h / 0.2)` : "none",
                border: selected ? `1px solid rgba(220,0,0,0.5)` : '1px solid oklch(from var(--foreground) l c h / 0.08)',
              }}>
              <Globe size={16}/>
              {sel ? `▶ ENTER ${sel} INTELLIGENCE` : "SELECT A REGION TO CONTINUE"}
              <ChevronRight size={16}/>
            </button>
          </div>

          <p className={`hidden md:block text-[8px] font-mono tracking-[0.4em] flex-shrink-0 ${isLight ? "text-slate-400/60" : "text-muted-foreground/20"}`}>
            REGION CAN BE CHANGED ANYTIME FROM THE TOP NAVIGATION BAR
          </p>
        </div>
      )}

      {/* feedSlideIn keyframe injected via style tag */}
      <style>{`
        @keyframes feedSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
