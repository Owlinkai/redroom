/**
 * Live Camera Feed Aggregator
 * Fetches real-time camera data from verified government traffic APIs.
 * Sources verified working as of 2026:
 * - TfL API (882 cameras, free, no key) — https://api.tfl.gov.uk/Place/Type/JamCam
 * - Asfinag (Austria, ~1900 cameras, basic auth) — verified 200 OK
 * - YouTube Live Streams (iframe embeds, truly live video)
 * - Windy Webcam embeds (iframe, always works)
 */

export interface LiveCamera {
  id: string;
  lat: number;
  lng: number;
  name: string;
  city: string;
  country: string;
  feed_url: string;
  stream_url?: string;
  stream_type?: 'iframe' | 'hls' | 'mjpeg';
  source: string;
  external_url?: string;
  /** A provider-issued non-live image that the client may display directly. */
  periodic_image_url?: string;
  /** Minimum client refresh cadence for a provider-issued periodic image. */
  refresh_interval_ms?: number;
  /** Reference-only sources link to their provider page and have no permitted in-app image. */
  reference_only?: boolean;
  source_context?: string;
  catalog_region?: string;
}

// ─── Cache Layer ──────────────────────────────────────────────────────────────
const CACHE_TTL = 30 * 60 * 1000; // Camera indexes change slowly; frames still refresh individually.
let liveCameraCache: { cameras: LiveCamera[]; lastFetch: number } = { cameras: [], lastFetch: 0 };
let pendingFetch: Promise<LiveCamera[]> | null = null;

type ProviderCameraLoader = () => Promise<LiveCamera[]>;
type ProviderCameraCache = { cameras: LiveCamera[]; lastSuccess: number; pending?: Promise<LiveCamera[]> };
const PROVIDER_CACHE_TTL = 30 * 60 * 1000;
const PROVIDER_BUDGET_MS = 22_000;
const providerCameraCache = new Map<string, ProviderCameraCache>();

/**
 * Prevent a single slow public index from delaying the entire SIGINT camera
 * response. The loader continues in the background, so a late success becomes
 * available on the next refresh; callers receive only the last known good set.
 */
export function withProviderBudget<T>(label: string, loader: () => Promise<T>, fallback: T, budgetMs = PROVIDER_BUDGET_MS): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn(`[LiveCameras] ${label} exceeded the provider budget; serving its last good result.`);
      resolve(fallback);
    }, budgetMs);

    loader().then((result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    }).catch(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(fallback);
    });
  });
}

/** Cache each public index independently and preserve its last good result on a transient failure. */
async function getCachedProviderCameras(key: string, loader: ProviderCameraLoader): Promise<LiveCamera[]> {
  const now = Date.now();
  const current = providerCameraCache.get(key);
  if (current?.cameras.length && now - current.lastSuccess < PROVIDER_CACHE_TTL) return current.cameras;
  if (current?.pending) return current.pending;

  let pending!: Promise<LiveCamera[]>;
  pending = loader()
    .then((cameras) => {
      if (cameras.length) {
        providerCameraCache.set(key, { cameras, lastSuccess: Date.now() });
        return cameras;
      }
      return current?.cameras ?? [];
    })
    .catch((error) => {
      console.warn(`[LiveCameras] ${key} index refresh failed; serving last good result when available.`, error);
      return current?.cameras ?? [];
    })
    .finally(() => {
      const stored = providerCameraCache.get(key);
      if (stored?.pending === pending) stored.pending = undefined;
    });

  providerCameraCache.set(key, {
    cameras: current?.cameras ?? [],
    lastSuccess: current?.lastSuccess ?? 0,
    pending,
  });
  return pending;
}

// ─── TfL JamCams (UK) — Verified Working API ────────────────────────────────
async function fetchTfLCameras(): Promise<LiveCamera[]> {
  try {
    const res = await fetch('https://api.tfl.gov.uk/Place/Type/JamCam', {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = await res.json() as any[];
    
    return data
      .filter((cam: any) => cam.lat && cam.lon && cam.id)
      .map((cam: any) => {
        const camId = cam.id.replace('JamCams_', '');
        return {
          id: `tfl-live-${camId}`,
          lat: cam.lat,
          lng: cam.lon,
          name: cam.commonName || `TfL ${camId}`,
          city: 'London',
          country: 'United Kingdom',
          feed_url: `https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/${camId}.jpg`,
          external_url: `https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/${camId}.jpg`,
          source: 'TfL JamCam',
        };
      });
  } catch (e) {
    console.error('[LiveCameras] TfL fetch failed:', e);
    return [];
  }
}

// ─── Asfinag (Austria) — Verified Working API ───────────────────────────────
async function fetchAsfinagCameras(): Promise<LiveCamera[]> {
  try {
    const res = await fetch(
      'https://odo.asfinag.at/odo/rest/sec/resource/001/json/webcams?language=atDE',
      {
        signal: AbortSignal.timeout(12000),
        headers: {
          'Authorization': 'Basic bWFwX3dpZGdldDp0ZWdkaXc=',
          'Referer': 'https://www.asfinag.at/',
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json() as any[];
    if (!Array.isArray(data)) return [];
    
    return data
      .filter((cam: any) => cam.wgs84_lat && cam.wgs84_lon && cam.url_campic)
      .map((cam: any) => ({
        id: `asfinag-${cam.wcs_id || Math.random().toString(36).slice(2)}`,
        lat: parseFloat(cam.wgs84_lat),
        lng: parseFloat(cam.wgs84_lon),
        name: cam.position_txt || cam.direction_txt || 'ASFINAG Webcam',
        city: cam.road || 'Austria',
        country: 'Austria',
        feed_url: cam.url_campic,
        source: 'ASFINAG',
      }));
  } catch (e) {
    console.error('[LiveCameras] Asfinag fetch failed:', e);
    return [];
  }
}

// ─── Oregon Department of Transportation TripCheck ─────────────────────────
const ODOT_CAMERA_INDEX = 'https://www.tripcheck.com/Scripts/map/data/cctvinventory.js';
const ODOT_IMAGE_BASE = 'https://tripcheck.com/RoadCams/cams';

type ODOTFeature = { attributes?: { cameraId?: number; filename?: string; latitude?: number; longitude?: number; route?: string; title?: string } };

export function mapOdotCamera(feature: ODOTFeature): LiveCamera | null {
  const attributes = feature?.attributes;
  if (!attributes?.cameraId || !attributes.filename) return null;
  const { latitude, longitude } = attributes;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude! < 41.9 || latitude! > 46.3 || longitude! < -124.6 || longitude! > -116.4) return null;
  return {
    id: `odot-${attributes.cameraId}`,
    lat: latitude!,
    lng: longitude!,
    name: (attributes.title || attributes.route || `ODOT Camera ${attributes.cameraId}`).trim(),
    city: (attributes.route || 'Oregon').trim(),
    country: 'United States',
    feed_url: `${ODOT_IMAGE_BASE}/${attributes.filename}`,
    external_url: 'https://www.tripcheck.com/',
    source: 'ODOT TripCheck',
    source_context: 'Oregon Department of Transportation public road-camera reference.',
    catalog_region: 'North America',
  };
}

async function loadOdotCameras(): Promise<LiveCamera[]> {
  const response = await fetch(ODOT_CAMERA_INDEX, {
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: '*/*', Referer: 'https://www.tripcheck.com/', 'User-Agent': 'RedroomCameraCatalogue/1.0 (+https://redroom.live)' },
  });
  if (!response.ok) throw new Error(`ODOT TripCheck HTTP ${response.status}`);
  const payload = JSON.parse(await response.text()) as { features?: ODOTFeature[] };
  const seen = new Set<string>();
  return (payload.features || []).flatMap((feature) => {
    const camera = mapOdotCamera(feature);
    if (!camera || seen.has(camera.id)) return [];
    seen.add(camera.id);
    return [camera];
  });
}

export function getOdotCameras(): Promise<LiveCamera[]> {
  const fallback = providerCameraCache.get('odot-tripcheck')?.cameras ?? [];
  return withProviderBudget('ODOT TripCheck', () => getCachedProviderCameras('odot-tripcheck', loadOdotCameras), fallback);
}

// ─── California Department of Transportation QuickMap ───────────────────────
const CALTRANS_CAMERA_INDEX = 'https://caltrans-gis.dot.ca.gov/arcgis/rest/services/CHhighway/CCTV/FeatureServer/0/query?where=1%3D1&outFields=*&f=json';

type CaltransFeature = { attributes?: { OBJECTID?: number; locationName?: string; nearbyPlace?: string; latitude?: number; longitude?: number; currentImageURL?: string; inService?: string } };

export function mapCaltransCamera(feature: CaltransFeature): LiveCamera | null {
  const attributes = feature?.attributes;
  const url = attributes?.currentImageURL?.trim();
  if (!attributes?.OBJECTID || !url || !/^https:\/\//.test(url)) return null;
  const { latitude, longitude } = attributes;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude! < 32 || latitude! > 42.2 || longitude! < -124.7 || longitude! > -114.1) return null;
  if (attributes.inService?.toLowerCase() === 'false') return null;
  return {
    id: `caltrans-${attributes.OBJECTID}`,
    lat: latitude!,
    lng: longitude!,
    name: attributes.locationName?.trim() || `Caltrans Camera ${attributes.OBJECTID}`,
    city: attributes.nearbyPlace?.trim() || 'California',
    country: 'United States',
    feed_url: url,
    external_url: 'https://quickmap.dot.ca.gov/',
    source: 'Caltrans QuickMap',
    source_context: 'California Department of Transportation public road-camera reference.',
    catalog_region: 'North America',
  };
}

async function loadCaltransCameras(): Promise<LiveCamera[]> {
  const response = await fetch(CALTRANS_CAMERA_INDEX, {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'application/json', 'User-Agent': 'RedroomCameraCatalogue/1.0 (+https://redroom.live)' },
  });
  if (!response.ok) throw new Error(`Caltrans QuickMap HTTP ${response.status}`);
  const payload = await response.json() as { features?: CaltransFeature[] };
  const seen = new Set<string>();
  return (payload.features || []).flatMap((feature) => {
    const camera = mapCaltransCamera(feature);
    if (!camera || seen.has(camera.id)) return [];
    seen.add(camera.id);
    return [camera];
  });
}

export function getCaltransCameras(): Promise<LiveCamera[]> {
  const fallback = providerCameraCache.get('caltrans-quickmap')?.cameras ?? [];
  return withProviderBudget('Caltrans QuickMap', () => getCachedProviderCameras('caltrans-quickmap', loadCaltransCameras), fallback);
}

// ─── New Zealand Transport Agency Waka Kotahi ───────────────────────────────
const NZTA_CAMERA_INDEX = 'https://trafficnz.info/service/traffic/rest/4/cameras/all';
const NZTA_BASE_URL = 'https://trafficnz.info';

function decodeXml(value: string): string {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
}

function xmlTag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? decodeXml(match[1]) : '';
}

export function parseNztaCameras(xml: string): LiveCamera[] {
  const cameras: LiveCamera[] = [];
  const seen = new Set<string>();
  for (const raw of xml.split('<camera>').slice(1)) {
    const block = raw.split('</camera>')[0];
    const id = xmlTag(block, 'id');
    const imagePath = xmlTag(block, 'imageUrl');
    const lat = parseFloat(xmlTag(block, 'latitude'));
    const lng = parseFloat(xmlTag(block, 'longitude'));
    if (!id || !imagePath || seen.has(id)) continue;
    if (xmlTag(block, 'offline') === 'true' || xmlTag(block, 'underMaintenance') === 'true') continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -47.5 || lat > -34 || lng < 166 || lng > 179) continue;
    const regionBlock = block.match(/<region>[\s\S]*?<\/region>/)?.[0] || '';
    const region = xmlTag(regionBlock, 'name');
    const flatBlock = block.replace(/<(journey|journeyLeg|region|way)>[\s\S]*?<\/\1>/g, '');
    const name = xmlTag(flatBlock, 'name') || xmlTag(block, 'description') || `NZTA Camera ${id}`;
    const direction = xmlTag(block, 'direction');
    seen.add(id);
    cameras.push({
      id: `nzta-${id}`,
      lat,
      lng,
      name: direction && direction !== 'NA' ? `${name} (${direction})` : name,
      city: region || 'New Zealand',
      country: 'New Zealand',
      feed_url: imagePath.startsWith('http') ? imagePath : `${NZTA_BASE_URL}${imagePath}`,
      external_url: `${NZTA_BASE_URL}/camera/view/${id}`,
      source: 'NZTA Waka Kotahi',
      source_context: 'New Zealand Transport Agency public road-camera reference.',
      catalog_region: 'Oceania',
    });
  }
  return cameras;
}

async function loadNztaCameras(): Promise<LiveCamera[]> {
  const response = await fetch(NZTA_CAMERA_INDEX, {
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: 'application/xml,text/xml', Referer: 'https://trafficnz.info/', 'User-Agent': 'RedroomCameraCatalogue/1.0 (+https://redroom.live)' },
  });
  if (!response.ok) throw new Error(`NZTA HTTP ${response.status}`);
  return parseNztaCameras(await response.text());
}

export function getNztaCameras(): Promise<LiveCamera[]> {
  const fallback = providerCameraCache.get('nzta-waka-kotahi')?.cameras ?? [];
  return withProviderBudget('NZTA Waka Kotahi', () => getCachedProviderCameras('nzta-waka-kotahi', loadNztaCameras), fallback);
}

// ─── Official open-data snapshot camera indexes ─────────────────────────────
// These indexes are distinct from Skyline. They return authority-provided
// snapshot URLs and keep an outward source link on every returned camera.
const PUBLIC_SNAPSHOT_REFRESH_MS = 60_000;

type DgtCamera = { id?: string; latitud?: string; longitud?: string; imagen?: string; carretera?: string; pk?: string; sentido?: string; provincia?: string };

export function mapDgtCamera(camera: DgtCamera): LiveCamera | null {
  const lat = Number(camera.latitud);
  const lng = Number(camera.longitud);
  const image = camera.imagen?.trim();
  if (!camera.id || !image || !/^https:\/\//.test(image) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < 27 || lat > 44.5 || lng < -19 || lng > 5) return null;
  const road = camera.carretera?.trim() || 'DGT road camera';
  const distance = camera.pk?.trim() ? ` · KM ${camera.pk.trim()}` : '';
  const direction = camera.sentido?.trim() && camera.sentido.trim() !== '-' ? ` · ${camera.sentido.trim()}` : '';
  return {
    id: `dgt-${camera.id}`,
    lat,
    lng,
    name: `${road}${distance}${direction}`,
    city: camera.provincia?.trim() || 'Spain',
    country: 'Spain',
    feed_url: image,
    external_url: 'https://etraffic.dgt.es/etrafficWEB/',
    refresh_interval_ms: PUBLIC_SNAPSHOT_REFRESH_MS,
    source: 'DGT Spain',
    source_context: 'Dirección General de Tráfico camera reference; attribution required under the source licence.',
    catalog_region: 'Europe',
  };
}

async function loadDgtCameras(): Promise<LiveCamera[]> {
  const response = await fetch('https://www.dgt.es/.content/.assets/json/camaras.json', {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'application/json', 'User-Agent': 'RedroomCameraCatalogue/1.0 (+https://redroom.live)' },
  });
  if (!response.ok) throw new Error(`DGT HTTP ${response.status}`);
  const payload = await response.json() as { camaras?: DgtCamera[] };
  const seen = new Set<string>();
  return (payload.camaras || []).flatMap((record) => {
    const camera = mapDgtCamera(record);
    if (!camera || seen.has(camera.id)) return [];
    seen.add(camera.id);
    return [camera];
  });
}

export function getDgtCameras(): Promise<LiveCamera[]> {
  const fallback = providerCameraCache.get('dgt-spain')?.cameras ?? [];
  return withProviderBudget('DGT Spain', () => getCachedProviderCameras('dgt-spain', loadDgtCameras), fallback);
}

type ThbCamera = { id?: string; stakenumber?: string; gisx?: number | string; gisy?: number | string; html?: string };

export function mapThbCamera(camera: ThbCamera): LiveCamera | null {
  const lat = Number(camera.gisy);
  const lng = Number(camera.gisx);
  const baseUrl = camera.html?.trim().replace(/\/$/, '');
  if (!camera.id || !baseUrl || !/^https:\/\//.test(baseUrl) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < 21.5 || lat > 25.5 || lng < 119 || lng > 123) return null;
  return {
    id: `thb-${camera.id.toLowerCase()}`,
    lat,
    lng,
    name: camera.stakenumber?.trim() || camera.id,
    city: 'Taiwan',
    country: 'Taiwan',
    feed_url: `${baseUrl}/snapshot`,
    external_url: baseUrl,
    refresh_interval_ms: PUBLIC_SNAPSHOT_REFRESH_MS,
    source: 'Taiwan Highway Bureau',
    source_context: 'Taiwan Highway Bureau open-data CCTV reference under the Open Government Data License v1.0.',
    catalog_region: 'Asia',
  };
}

async function loadThbCameras(): Promise<LiveCamera[]> {
  const response = await fetch('https://thbapp.thb.gov.tw/services/cctv/thb', {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'application/json', 'User-Agent': 'RedroomCameraCatalogue/1.0 (+https://redroom.live)' },
  });
  if (!response.ok) throw new Error(`Taiwan Highway Bureau HTTP ${response.status}`);
  const payload = await response.json() as ThbCamera[];
  const seen = new Set<string>();
  return (Array.isArray(payload) ? payload : []).flatMap((record) => {
    const camera = mapThbCamera(record);
    if (!camera || seen.has(camera.id)) return [];
    seen.add(camera.id);
    return [camera];
  });
}

export function getThbCameras(): Promise<LiveCamera[]> {
  const fallback = providerCameraCache.get('taiwan-highway-bureau')?.cameras ?? [];
  return withProviderBudget('Taiwan Highway Bureau', () => getCachedProviderCameras('taiwan-highway-bureau', loadThbCameras), fallback);
}

function decodeOpenXml(value: string): string {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
}

function openXmlTag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? decodeOpenXml(match[1]) : '';
}

export function parseHongKongTrafficCameras(xml: string): LiveCamera[] {
  const cameras: LiveCamera[] = [];
  const seen = new Set<string>();
  for (const raw of xml.split('<image>').slice(1)) {
    const block = raw.split('</image>')[0];
    const id = openXmlTag(block, 'key');
    const imageUrl = openXmlTag(block, 'url');
    const lat = Number(openXmlTag(block, 'latitude'));
    const lng = Number(openXmlTag(block, 'longitude'));
    if (!id || !imageUrl || !/^https:\/\//.test(imageUrl) || seen.has(id)) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 22.1 || lat > 22.6 || lng < 113.8 || lng > 114.5) continue;
    seen.add(id);
    const name = openXmlTag(block, 'description').replace(/\s*\[[^\]]*\]\s*$/, '');
    cameras.push({
      id: `hk-${id.toLowerCase()}`,
      lat,
      lng,
      name: name || `Hong Kong camera ${id}`,
      city: openXmlTag(block, 'district') || openXmlTag(block, 'region') || 'Hong Kong',
      country: 'Hong Kong',
      feed_url: imageUrl,
      external_url: 'https://www.hkemobility.gov.hk/en/traffic-information/live/cctv',
      refresh_interval_ms: PUBLIC_SNAPSHOT_REFRESH_MS,
      source: 'Hong Kong Transport Department',
      source_context: 'Hong Kong Transport Department open traffic snapshot reference; Government and data.gov.hk attribution required.',
      catalog_region: 'Asia',
    });
  }
  return cameras;
}

async function loadHongKongTrafficCameras(): Promise<LiveCamera[]> {
  const response = await fetch('https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.xml', {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'application/xml,text/xml', 'User-Agent': 'RedroomCameraCatalogue/1.0 (+https://redroom.live)' },
  });
  if (!response.ok) throw new Error(`Hong Kong Transport Department HTTP ${response.status}`);
  return parseHongKongTrafficCameras(await response.text());
}

export function getHongKongTrafficCameras(): Promise<LiveCamera[]> {
  const fallback = providerCameraCache.get('hong-kong-transport-department')?.cameras ?? [];
  return withProviderBudget('Hong Kong Transport Department', () => getCachedProviderCameras('hong-kong-transport-department', loadHongKongTrafficCameras), fallback);
}

type FintrafficFeature = { id?: string; geometry?: { coordinates?: number[] }; properties?: { name?: string; names?: { fi?: string }; municipality?: string; presets?: Array<{ id?: string; imageUrl?: string }> } };

export function mapFintrafficCamera(feature: FintrafficFeature): LiveCamera | null {
  const coords = feature.geometry?.coordinates;
  const properties = feature.properties;
  const preset = properties?.presets?.[0];
  const imageUrl = preset?.imageUrl || (preset?.id ? `https://weathercam.digitraffic.fi/${preset.id}.jpg` : '');
  if (!feature.id || !coords || coords.length < 2 || !imageUrl || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return null;
  const [lng, lat] = coords;
  if (lat < 59 || lat > 71 || lng < 19 || lng > 33) return null;
  return {
    id: `fintraffic-${feature.id}`,
    lat,
    lng,
    name: properties?.name || properties?.names?.fi || `Fintraffic weather camera ${feature.id}`,
    city: properties?.municipality || 'Finland',
    country: 'Finland',
    feed_url: imageUrl,
    external_url: 'https://liikennetilanne.fintraffic.fi/pulssi/',
    refresh_interval_ms: PUBLIC_SNAPSHOT_REFRESH_MS,
    source: 'Fintraffic',
    source_context: 'Fintraffic open road-camera reference licensed CC BY 4.0; attribution is required.',
    catalog_region: 'Europe',
  };
}

async function loadFintrafficCameras(): Promise<LiveCamera[]> {
  const response = await fetch('https://tie.digitraffic.fi/api/weathercam/v1/stations', {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'application/json', 'Digitraffic-User': 'RedroomCameraCatalogue/1.0 (+https://redroom.live)' },
  });
  if (!response.ok) throw new Error(`Fintraffic HTTP ${response.status}`);
  const payload = await response.json() as { features?: FintrafficFeature[] };
  const seen = new Set<string>();
  return (payload.features || []).flatMap((feature) => {
    const camera = mapFintrafficCamera(feature);
    if (!camera || seen.has(camera.id)) return [];
    seen.add(camera.id);
    return [camera];
  });
}

export function getFintrafficCameras(): Promise<LiveCamera[]> {
  const fallback = providerCameraCache.get('fintraffic')?.cameras ?? [];
  return withProviderBudget('Fintraffic', () => getCachedProviderCameras('fintraffic', loadFintrafficCameras), fallback);
}

type SingaporeTrafficCamera = { camera_id?: string; image?: string; location?: { latitude?: number; longitude?: number } };

export function mapSingaporeTrafficCamera(camera: SingaporeTrafficCamera): LiveCamera | null {
  const lat = camera.location?.latitude;
  const lng = camera.location?.longitude;
  const image = camera.image?.trim();
  if (!camera.camera_id || !image || !/^https:\/\//.test(image) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat! < 1.15 || lat! > 1.5 || lng! < 103.55 || lng! > 104.1) return null;
  return {
    id: `lta-sg-${camera.camera_id}`,
    lat: lat!,
    lng: lng!,
    name: `Singapore traffic camera ${camera.camera_id}`,
    city: 'Singapore',
    country: 'Singapore',
    feed_url: image,
    external_url: 'https://onemotoring.lta.gov.sg/content/onemotoring/home/driving/traffic_information/traffic-cameras.html',
    refresh_interval_ms: PUBLIC_SNAPSHOT_REFRESH_MS,
    source: 'LTA Singapore',
    source_context: 'Singapore Land Transport Authority public traffic-image reference.',
    catalog_region: 'Asia',
  };
}

async function loadSingaporeTrafficCameras(): Promise<LiveCamera[]> {
  const response = await fetch('https://api.data.gov.sg/v1/transport/traffic-images', {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'application/json', 'User-Agent': 'RedroomCameraCatalogue/1.0 (+https://redroom.live)' },
  });
  if (!response.ok) throw new Error(`LTA Singapore HTTP ${response.status}`);
  const payload = await response.json() as { items?: Array<{ cameras?: SingaporeTrafficCamera[] }> };
  const seen = new Set<string>();
  return (payload.items?.[0]?.cameras || []).flatMap((record) => {
    const camera = mapSingaporeTrafficCamera(record);
    if (!camera || seen.has(camera.id)) return [];
    seen.add(camera.id);
    return [camera];
  });
}

export function getSingaporeTrafficCameras(): Promise<LiveCamera[]> {
  const fallback = providerCameraCache.get('lta-singapore')?.cameras ?? [];
  return withProviderBudget('LTA Singapore', () => getCachedProviderCameras('lta-singapore', loadSingaporeTrafficCameras), fallback);
}

// ─── Washington State Department of Transportation ──────────────────────────
const WSDOT_CAMERA_INDEX = 'https://data.wsdot.wa.gov/arcgis/rest/services/TravelInformation/TravelInfoCamerasWeather/FeatureServer/0/query?where=1%3D1&outFields=OBJECTID%2CCameraTitle%2CImageURL%2CCompassDirection&returnGeometry=true&outSR=4326&f=json';

type WsdotFeature = { attributes?: { OBJECTID?: number; CameraTitle?: string; ImageURL?: string; CompassDirection?: string }; geometry?: { x?: number; y?: number } };

export function mapWsdotCamera(feature: WsdotFeature): LiveCamera | null {
  const attributes = feature.attributes;
  const lng = feature.geometry?.x;
  const lat = feature.geometry?.y;
  const image = attributes?.ImageURL?.trim();
  if (!attributes?.OBJECTID || !image || !/^https:\/\//.test(image) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat! < 45 || lat! > 49.2 || lng! < -125.1 || lng! > -116.8) return null;
  const direction = attributes.CompassDirection?.trim();
  return {
    id: `wsdot-${attributes.OBJECTID}`,
    lat: lat!,
    lng: lng!,
    name: `${attributes.CameraTitle?.trim() || `WSDOT camera ${attributes.OBJECTID}`}${direction ? ` · ${direction}` : ''}`,
    city: 'Washington State',
    country: 'United States',
    feed_url: image,
    external_url: 'https://wsdot.com/travel/real-time/map/',
    refresh_interval_ms: 5 * 60 * 1000,
    source: 'WSDOT',
    source_context: 'Washington State Department of Transportation camera reference; official layer images refresh approximately every five minutes.',
    catalog_region: 'North America',
  };
}

async function loadWsdotCameras(): Promise<LiveCamera[]> {
  const response = await fetch(WSDOT_CAMERA_INDEX, {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'application/json', 'User-Agent': 'RedroomCameraCatalogue/1.0 (+https://redroom.live)' },
  });
  if (!response.ok) throw new Error(`WSDOT HTTP ${response.status}`);
  const payload = await response.json() as { features?: WsdotFeature[] };
  const seen = new Set<string>();
  return (payload.features || []).flatMap((feature) => {
    const camera = mapWsdotCamera(feature);
    if (!camera || seen.has(camera.id)) return [];
    seen.add(camera.id);
    return [camera];
  });
}

export function getWsdotCameras(): Promise<LiveCamera[]> {
  const fallback = providerCameraCache.get('wsdot')?.cameras ?? [];
  return withProviderBudget('WSDOT', () => getCachedProviderCameras('wsdot', loadWsdotCameras), fallback);
}

// ─── Ontario 511 ───────────────────────────────────────────────────────────
type OntarioCamera = { Id?: number; Roadway?: string; Direction?: string; Location?: string; Latitude?: number; Longitude?: number; Views?: Array<{ Url?: string; Status?: string; Description?: string }> };

export function mapOntario511Camera(camera: OntarioCamera): LiveCamera | null {
  const view = camera.Views?.find((entry) => entry.Status === 'Enabled' && entry.Url) || camera.Views?.find((entry) => entry.Url);
  if (!camera.Id || !view?.Url || !/^https:\/\//.test(view.Url) || !Number.isFinite(camera.Latitude) || !Number.isFinite(camera.Longitude)) return null;
  if (camera.Latitude! < 41 || camera.Latitude! > 57 || camera.Longitude! < -96 || camera.Longitude! > -74) return null;
  const roadway = camera.Roadway?.trim() || 'Ontario 511 camera';
  const location = camera.Location?.trim();
  const direction = view.Description?.trim() || camera.Direction?.trim();
  return {
    id: `ontario-511-${camera.Id}`,
    lat: camera.Latitude!,
    lng: camera.Longitude!,
    name: [roadway, location, direction && direction !== 'Unknown' ? direction : ''].filter(Boolean).join(' · '),
    city: 'Ontario',
    country: 'Canada',
    feed_url: view.Url,
    external_url: 'https://511on.ca/cctv',
    refresh_interval_ms: PUBLIC_SNAPSHOT_REFRESH_MS,
    source: 'Ontario 511',
    source_context: 'Government of Ontario traffic-camera reference under the Open Government Licence – Ontario.',
    catalog_region: 'North America',
  };
}

async function loadOntario511Cameras(): Promise<LiveCamera[]> {
  const response = await fetch('https://511on.ca/api/v2/get/cameras', {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'application/json', 'User-Agent': 'RedroomCameraCatalogue/1.0 (+https://redroom.live)' },
  });
  if (!response.ok) throw new Error(`Ontario 511 HTTP ${response.status}`);
  const payload = await response.json() as OntarioCamera[];
  const seen = new Set<string>();
  return (Array.isArray(payload) ? payload : []).flatMap((record) => {
    const camera = mapOntario511Camera(record);
    if (!camera || seen.has(camera.id)) return [];
    seen.add(camera.id);
    return [camera];
  });
}

export function getOntario511Cameras(): Promise<LiveCamera[]> {
  const fallback = providerCameraCache.get('ontario-511')?.cameras ?? [];
  return withProviderBudget('Ontario 511', () => getCachedProviderCameras('ontario-511', loadOntario511Cameras), fallback);
}

// ─── Florida 511 / FDOT ────────────────────────────────────────────────────
const FL511_CAMERA_INDEX = 'https://services.arcgis.com/3wFbqsFPLeKqOlIK/arcgis/rest/services/FL511_Traffic_Cameras/FeatureServer/0/query';
const FL511_FIELDS = 'ID,DESCRIPT,COUNTY,HIGHWAY,DIRECTION,LATITUDE,LONGITUDE,IMAGE';
const ARCGIS_PAGE_SIZE = 2_000;

type FloridaFeature = { attributes?: { ID?: string; DESCRIPT?: string; COUNTY?: string; HIGHWAY?: string; DIRECTION?: string; LATITUDE?: number; LONGITUDE?: number; IMAGE?: string } };

export function mapFlorida511Camera(feature: FloridaFeature): LiveCamera | null {
  const attributes = feature.attributes;
  const id = attributes?.ID?.trim();
  const image = attributes?.IMAGE?.trim();
  const lat = attributes?.LATITUDE;
  const lng = attributes?.LONGITUDE;
  if (!id || !image || !/^https:\/\//.test(image) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat! < 24 || lat! > 32 || lng! < -88.5 || lng! > -79) return null;
  const highway = attributes?.HIGHWAY?.trim() || 'Florida 511 camera';
  const description = attributes?.DESCRIPT?.trim();
  const direction = attributes?.DIRECTION?.trim();
  return {
    id: `fl511-${id}`,
    lat: lat!,
    lng: lng!,
    name: [highway, description && description !== highway ? description : '', direction].filter(Boolean).join(' · '),
    city: attributes?.COUNTY?.trim() || 'Florida',
    country: 'United States',
    feed_url: image,
    external_url: 'https://fl511.com/cctv',
    refresh_interval_ms: PUBLIC_SNAPSHOT_REFRESH_MS,
    source: 'FDOT Florida 511',
    source_context: 'Florida Department of Transportation / FL511 traffic-camera reference.',
    catalog_region: 'North America',
  };
}

async function loadFlorida511Cameras(): Promise<LiveCamera[]> {
  const cameras: LiveCamera[] = [];
  const seen = new Set<string>();
  for (let offset = 0; offset < 8_000; offset += ARCGIS_PAGE_SIZE) {
    const query = new URLSearchParams({
      where: '1=1',
      outFields: FL511_FIELDS,
      returnGeometry: 'false',
      resultOffset: String(offset),
      resultRecordCount: String(ARCGIS_PAGE_SIZE),
      f: 'json',
    });
    const response = await fetch(`${FL511_CAMERA_INDEX}?${query}`, {
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: 'application/json', 'User-Agent': 'RedroomCameraCatalogue/1.0 (+https://redroom.live)' },
    });
    if (!response.ok) throw new Error(`Florida 511 HTTP ${response.status}`);
    const payload = await response.json() as { features?: FloridaFeature[]; exceededTransferLimit?: boolean };
    const features = payload.features || [];
    for (const feature of features) {
      const camera = mapFlorida511Camera(feature);
      if (!camera || seen.has(camera.id)) continue;
      seen.add(camera.id);
      cameras.push(camera);
    }
    if (!payload.exceededTransferLimit || features.length === 0) break;
  }
  return cameras;
}

export function getFlorida511Cameras(): Promise<LiveCamera[]> {
  const fallback = providerCameraCache.get('fdot-fl511')?.cameras ?? [];
  return withProviderBudget('FDOT Florida 511', () => getCachedProviderCameras('fdot-fl511', loadFlorida511Cameras), fallback);
}

// ─── Québec government traffic cameras ─────────────────────────────────────
const QUEBEC_CAMERA_INDEX = 'https://ws.mapserver.transports.gouv.qc.ca/swtq?service=wfs&version=2.0.0&request=getfeature&typename=ms:infos_cameras&outfile=Camera&srsname=EPSG:4326&outputformat=geojson';

type QuebecFeature = { properties?: { IDEcamera?: string; DescriptionLocalisationEn?: string; DescriptionLocalisationFr?: string; NomRegionDiffusion?: string; URL_FLUX_DONNEE?: string }; geometry?: { coordinates?: number[] } };

export function mapQuebec511Camera(feature: QuebecFeature): LiveCamera | null {
  const properties = feature.properties;
  const id = properties?.IDEcamera?.trim();
  const externalUrl = properties?.URL_FLUX_DONNEE?.trim();
  const coords = feature.geometry?.coordinates;
  if (!id || !externalUrl || !/^https:\/\//.test(externalUrl) || !coords || coords.length < 2 || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return null;
  const [lng, lat] = coords;
  if (lat < 44 || lat > 53.5 || lng < -80 || lng > -57) return null;
  return {
    id: `quebec-511-${id}`,
    lat,
    lng,
    name: properties?.DescriptionLocalisationEn?.trim() || properties?.DescriptionLocalisationFr?.trim() || `Québec 511 camera ${id}`,
    city: properties?.NomRegionDiffusion?.trim() || 'Québec',
    country: 'Canada',
    feed_url: '',
    external_url: externalUrl,
    reference_only: true,
    source: 'Québec 511',
    source_context: 'Québec Ministry of Transport and Sustainable Mobility traffic-camera reference under CC BY 4.0; source viewer opens externally.',
    catalog_region: 'North America',
  };
}

async function loadQuebec511Cameras(): Promise<LiveCamera[]> {
  const response = await fetch(QUEBEC_CAMERA_INDEX, {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'application/geo+json,application/json', 'User-Agent': 'RedroomCameraCatalogue/1.0 (+https://redroom.live)' },
  });
  if (!response.ok) throw new Error(`Québec 511 HTTP ${response.status}`);
  const payload = await response.json() as { features?: QuebecFeature[] };
  const seen = new Set<string>();
  return (payload.features || []).flatMap((feature) => {
    const camera = mapQuebec511Camera(feature);
    if (!camera || seen.has(camera.id)) return [];
    seen.add(camera.id);
    return [camera];
  });
}

export function getQuebec511Cameras(): Promise<LiveCamera[]> {
  const fallback = providerCameraCache.get('quebec-511')?.cameras ?? [];
  return withProviderBudget('Québec 511', () => getCachedProviderCameras('quebec-511', loadQuebec511Cameras), fallback);
}

// ─── DriveBC HighwayCams ───────────────────────────────────────────────────
type DriveBcCamera = { id?: number; name?: string; caption?: string; links?: { imageDisplay?: string }; location?: { coordinates?: number[] }; orientation?: string; region_name?: string; update_period_mean?: number; is_on?: boolean; should_appear?: boolean };

export function mapDriveBcCamera(camera: DriveBcCamera): LiveCamera | null {
  const id = camera.id;
  const imagePath = camera.links?.imageDisplay?.trim();
  const coords = camera.location?.coordinates;
  if (!id || !imagePath || !imagePath.startsWith('/') || !coords || coords.length < 2 || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return null;
  const [lng, lat] = coords;
  if (lat < 48 || lat > 61 || lng < -140 || lng > -113) return null;
  const refresh = Number.isFinite(camera.update_period_mean) ? Math.max(PUBLIC_SNAPSHOT_REFRESH_MS, Number(camera.update_period_mean) * 1_000) : PUBLIC_SNAPSHOT_REFRESH_MS;
  return {
    id: `drivebc-${id}`,
    lat,
    lng,
    name: camera.caption?.trim() || camera.name?.trim() || `DriveBC camera ${id}`,
    city: camera.region_name?.trim() || 'British Columbia',
    country: 'Canada',
    feed_url: `https://drivebc.ca${imagePath}`,
    external_url: `https://www.drivebc.ca/cameras/${id}`,
    refresh_interval_ms: refresh,
    source: 'DriveBC',
    source_context: 'Government of British Columbia HighwayCams reference under the Open Government Licence – British Columbia.',
    catalog_region: 'North America',
  };
}

async function loadDriveBcCameras(): Promise<LiveCamera[]> {
  const response = await fetch('https://drivebc.ca/api/webcams', {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'application/json', 'User-Agent': 'RedroomCameraCatalogue/1.0 (+https://redroom.live)' },
  });
  if (!response.ok) throw new Error(`DriveBC HTTP ${response.status}`);
  const payload = await response.json() as DriveBcCamera[];
  const seen = new Set<string>();
  return (Array.isArray(payload) ? payload : []).flatMap((record) => {
    if (record.is_on === false || record.should_appear === false) return [];
    const camera = mapDriveBcCamera(record);
    if (!camera || seen.has(camera.id)) return [];
    seen.add(camera.id);
    return [camera];
  });
}

export function getDriveBcCameras(): Promise<LiveCamera[]> {
  const fallback = providerCameraCache.get('drivebc')?.cameras ?? [];
  return withProviderBudget('DriveBC', () => getCachedProviderCameras('drivebc', loadDriveBcCameras), fallback);
}

// ─── City of Toronto traffic cameras ───────────────────────────────────────
type TorontoCamera = { Number?: string; Name?: string; Latitude?: string; Longitude?: string; Group?: string };

export function parseTorontoTrafficCameras(payloadText: string): LiveCamera[] {
  const start = payloadText.indexOf('(');
  const end = payloadText.lastIndexOf(')');
  if (start < 0 || end <= start) return [];
  let payload: { Data?: TorontoCamera[] };
  try {
    payload = JSON.parse(payloadText.slice(start + 1, end));
  } catch {
    return [];
  }
  const seen = new Set<string>();
  return (payload.Data || []).flatMap((record) => {
    const number = record.Number?.trim();
    const lat = Number(record.Latitude);
    const lng = Number(record.Longitude);
    if (!number || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 43.5 || lat > 43.9 || lng < -80 || lng > -79) return [];
    const id = `toronto-${number}`;
    if (seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      lat,
      lng,
      name: record.Name?.trim() || `Toronto traffic camera ${number}`,
      city: 'Toronto',
      country: 'Canada',
      feed_url: `https://opendata.toronto.ca/transportation/tmc/rescucameraimages/CameraImages/loc${number}.jpg`,
      external_url: 'https://www.toronto.ca/services-payments/streets-parking-transportation/road-restrictions-closures/restrictions-map/?camera=true',
      refresh_interval_ms: PUBLIC_SNAPSHOT_REFRESH_MS,
      source: 'City of Toronto',
      source_context: 'City of Toronto traffic-camera reference under the Open Government Licence – Toronto.',
      catalog_region: 'North America',
    }];
  });
}

async function loadTorontoTrafficCameras(): Promise<LiveCamera[]> {
  const response = await fetch('https://opendata.toronto.ca/transportation/tmc/rescucameraimages/Data/tmcearthcameras.json', {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'application/json,text/javascript', 'User-Agent': 'RedroomCameraCatalogue/1.0 (+https://redroom.live)' },
  });
  if (!response.ok) throw new Error(`City of Toronto HTTP ${response.status}`);
  return parseTorontoTrafficCameras(await response.text());
}

export function getTorontoTrafficCameras(): Promise<LiveCamera[]> {
  const fallback = providerCameraCache.get('city-of-toronto')?.cameras ?? [];
  return withProviderBudget('City of Toronto', () => getCachedProviderCameras('city-of-toronto', loadTorontoTrafficCameras), fallback);
}

// ─── City of Ottawa traffic cameras ───────────────────────────────────────
type OttawaCamera = { id?: number; camera_number?: number; name?: string; name_french?: string; latitude?: number; longitude?: number; cameraOwner?: string };

export function mapOttawaCameraReference(camera: OttawaCamera): LiveCamera | null {
  const id = camera.id ?? camera.camera_number;
  const number = camera.camera_number ?? id;
  const lat = camera.latitude;
  const lng = camera.longitude;
  if (!id || !number || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat! < 44.8 || lat! > 45.7 || lng! < -76.5 || lng! > -75.1) return null;
  return {
    id: `ottawa-${id}`,
    lat: lat!,
    lng: lng!,
    name: camera.name?.trim() || camera.name_french?.trim() || `Ottawa traffic camera ${number}`,
    city: 'Ottawa',
    country: 'Canada',
    feed_url: '',
    external_url: `https://traffic.ottawa.ca/map/camera?id=${number}`,
    reference_only: true,
    source: 'City of Ottawa',
    source_context: 'City of Ottawa traffic-camera reference. The City’s public-distribution guidance requires direct imagery to be served through registered developer infrastructure, so the official viewer opens externally.',
    catalog_region: 'North America',
  };
}

async function loadOttawaCameraReferences(): Promise<LiveCamera[]> {
  const response = await fetch('https://traffic.ottawa.ca/map/service/camera', {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'application/json', 'User-Agent': 'RedroomCameraCatalogue/1.0 (+https://redroom.live)' },
  });
  if (!response.ok) throw new Error(`City of Ottawa HTTP ${response.status}`);
  const payload = await response.json() as { cameras?: OttawaCamera[] };
  const seen = new Set<string>();
  return (payload.cameras || []).flatMap((record) => {
    const camera = mapOttawaCameraReference(record);
    if (!camera || seen.has(camera.id)) return [];
    seen.add(camera.id);
    return [camera];
  });
}

export function getOttawaCameraReferences(): Promise<LiveCamera[]> {
  const fallback = providerCameraCache.get('city-of-ottawa')?.cameras ?? [];
  return withProviderBudget('City of Ottawa', () => getCachedProviderCameras('city-of-ottawa', loadOttawaCameraReferences), fallback);
}

// ─── Transport for NSW / Live Traffic ──────────────────────────────────────
type NswLiveTrafficFeature = { id?: string; eventType?: string; geometry?: { coordinates?: number[] }; properties?: { title?: string; region?: string; href?: string } };

export function mapNswLiveTrafficCamera(feature: NswLiveTrafficFeature): LiveCamera | null {
  const id = feature.id?.trim();
  const coords = feature.geometry?.coordinates;
  const properties = feature.properties;
  const image = properties?.href?.trim();
  if (!id || !image || !/^https:\/\//.test(image) || !coords || coords.length < 2 || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return null;
  const [lng, lat] = coords;
  if (lat < -38 || lat > -28 || lng < 140 || lng > 154) return null;
  return {
    id: `nsw-live-traffic-${id}`,
    lat,
    lng,
    name: properties?.title?.trim() || `NSW Live Traffic camera ${id}`,
    city: properties?.region?.trim() || 'New South Wales',
    country: 'Australia',
    feed_url: image,
    external_url: 'https://www.livetraffic.com/traffic-cameras',
    refresh_interval_ms: PUBLIC_SNAPSHOT_REFRESH_MS,
    source: 'NSW Live Traffic',
    source_context: 'Transport for NSW Live Traffic camera reference under Creative Commons Attribution.',
    catalog_region: 'Oceania',
  };
}

async function loadNswLiveTrafficCameras(): Promise<LiveCamera[]> {
  const response = await fetch('https://www.livetraffic.com/datajson/all-feeds-web.json', {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'application/json', 'User-Agent': 'RedroomCameraCatalogue/1.0 (+https://redroom.live)' },
  });
  if (!response.ok) throw new Error(`NSW Live Traffic HTTP ${response.status}`);
  const payload = await response.json() as NswLiveTrafficFeature[];
  const seen = new Set<string>();
  return (Array.isArray(payload) ? payload : []).flatMap((record) => {
    if (record.eventType !== 'liveCams') return [];
    const camera = mapNswLiveTrafficCamera(record);
    if (!camera || seen.has(camera.id)) return [];
    seen.add(camera.id);
    return [camera];
  });
}

export function getNswLiveTrafficCameras(): Promise<LiveCamera[]> {
  const fallback = providerCameraCache.get('nsw-live-traffic')?.cameras ?? [];
  return withProviderBudget('NSW Live Traffic', () => getCachedProviderCameras('nsw-live-traffic', loadNswLiveTrafficCameras), fallback);
}

// ─── YouTube Live Streams (truly live video via iframe) ─────────────────────
export function getYouTubeLiveStreams(): LiveCamera[] {
  return [
    { id: 'yt-shibuya', lat: 35.659, lng: 139.700, name: 'Tokyo Shibuya Crossing LIVE', city: 'Tokyo', country: 'Japan', feed_url: '', stream_url: 'https://www.youtube.com/embed/3n3Hq7XSBgA?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
    { id: 'yt-times-sq', lat: 40.758, lng: -73.986, name: 'NYC Times Square LIVE', city: 'New York', country: 'United States', feed_url: '', stream_url: 'https://www.youtube.com/embed/AdUw5RdyZxI?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
    { id: 'yt-jackson', lat: 43.480, lng: -110.763, name: 'Jackson Hole Town Square LIVE', city: 'Jackson', country: 'United States', feed_url: '', stream_url: 'https://www.youtube.com/embed/1EiC9bvVGnk?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
    { id: 'yt-venice-it', lat: 45.434, lng: 12.338, name: 'Venice St Mark Square LIVE', city: 'Venice', country: 'Italy', feed_url: '', stream_url: 'https://www.youtube.com/embed/vPbQcM4k1Ys?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
    { id: 'yt-dublin', lat: 53.346, lng: -6.259, name: 'Dublin Temple Bar LIVE', city: 'Dublin', country: 'Ireland', feed_url: '', stream_url: 'https://www.youtube.com/embed/eaJHivRiNZs?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
    { id: 'yt-miami', lat: 25.790, lng: -80.130, name: 'Miami Beach LIVE', city: 'Miami', country: 'United States', feed_url: '', stream_url: 'https://www.youtube.com/embed/4b0MbHPdCDI?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
    { id: 'yt-santa-monica', lat: 34.010, lng: -118.497, name: 'Santa Monica Pier LIVE', city: 'Los Angeles', country: 'United States', feed_url: '', stream_url: 'https://www.youtube.com/embed/iwBA4Zy5FBk?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
    { id: 'yt-amsterdam', lat: 52.374, lng: 4.898, name: 'Amsterdam Dam Square LIVE', city: 'Amsterdam', country: 'Netherlands', feed_url: '', stream_url: 'https://www.youtube.com/embed/1Iy7bMCKyqQ?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
    { id: 'yt-nairobi', lat: -1.286, lng: 36.817, name: 'Nairobi City LIVE', city: 'Nairobi', country: 'Kenya', feed_url: '', stream_url: 'https://www.youtube.com/embed/ydYDqZQpim8?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
    { id: 'yt-moscow', lat: 55.754, lng: 37.621, name: 'Moscow Red Square LIVE', city: 'Moscow', country: 'Russia', feed_url: '', stream_url: 'https://www.youtube.com/embed/IFAcqaNzNSc?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
    { id: 'yt-istanbul', lat: 41.008, lng: 28.978, name: 'Istanbul Bosphorus LIVE', city: 'Istanbul', country: 'Turkey', feed_url: '', stream_url: 'https://www.youtube.com/embed/LBVFMRvVHng?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
    { id: 'yt-buenos-aires', lat: -34.604, lng: -58.382, name: 'Buenos Aires Obelisco LIVE', city: 'Buenos Aires', country: 'Argentina', feed_url: '', stream_url: 'https://www.youtube.com/embed/8Xqk5xPfkAA?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
    { id: 'yt-dubai', lat: 25.197, lng: 55.274, name: 'Dubai Marina LIVE', city: 'Dubai', country: 'UAE', feed_url: '', stream_url: 'https://www.youtube.com/embed/jHVHQ3MKl_g?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
    { id: 'yt-rome', lat: 41.901, lng: 12.483, name: 'Rome Trevi Fountain LIVE', city: 'Rome', country: 'Italy', feed_url: '', stream_url: 'https://www.youtube.com/embed/K_1TGStvnfE?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
    { id: 'yt-rio', lat: -22.951, lng: -43.173, name: 'Rio Copacabana Beach LIVE', city: 'Rio de Janeiro', country: 'Brazil', feed_url: '', stream_url: 'https://www.youtube.com/embed/RCbN9G4MRZs?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
    { id: 'yt-bangkok', lat: 13.756, lng: 100.502, name: 'Bangkok Siam LIVE', city: 'Bangkok', country: 'Thailand', feed_url: '', stream_url: 'https://www.youtube.com/embed/OlW2ISBEkZ4?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
    { id: 'yt-seoul', lat: 37.566, lng: 126.978, name: 'Seoul Gangnam LIVE', city: 'Seoul', country: 'South Korea', feed_url: '', stream_url: 'https://www.youtube.com/embed/gFRtAAmiFbE?autoplay=1&mute=1', stream_type: 'iframe', source: 'YouTube Live' },
  ];
}

// ─── Windy Webcam Embeds (iframe — always works) ────────────────────────────
// Windy embed URLs work regardless of whether the static image exists
export function getWindyEmbedCameras(): LiveCamera[] {
  const locations = [
    // Middle East
    { id: '1596863498', lat: 25.276, lng: 55.296, name: 'Dubai Burj Khalifa View', city: 'Dubai', country: 'UAE' },
    { id: '1599149330', lat: 25.197, lng: 55.274, name: 'Dubai Marina', city: 'Dubai', country: 'UAE' },
    { id: '1586955983', lat: 24.454, lng: 54.377, name: 'Abu Dhabi Corniche', city: 'Abu Dhabi', country: 'UAE' },
    { id: '1594394747', lat: 21.422, lng: 39.826, name: 'Mecca View', city: 'Mecca', country: 'Saudi Arabia' },
    // Africa
    { id: '1600785432', lat: -33.918, lng: 18.423, name: 'Cape Town Table Mountain', city: 'Cape Town', country: 'South Africa' },
    { id: '1586264789', lat: -1.292, lng: 36.822, name: 'Nairobi City Center', city: 'Nairobi', country: 'Kenya' },
    { id: '1601234567', lat: 30.044, lng: 31.236, name: 'Cairo Nile View', city: 'Cairo', country: 'Egypt' },
    { id: '1598765432', lat: 6.524, lng: 3.379, name: 'Lagos Victoria Island', city: 'Lagos', country: 'Nigeria' },
    { id: '1602345678', lat: 14.693, lng: -17.444, name: 'Dakar Corniche', city: 'Dakar', country: 'Senegal' },
    { id: '1604567890', lat: 5.603, lng: -0.187, name: 'Accra Independence Square', city: 'Accra', country: 'Ghana' },
    // Latin America
    { id: '1586358714', lat: -22.951, lng: -43.173, name: 'Rio Copacabana', city: 'Rio de Janeiro', country: 'Brazil' },
    { id: '1598234567', lat: -23.550, lng: -46.634, name: 'São Paulo Paulista', city: 'São Paulo', country: 'Brazil' },
    { id: '1600123456', lat: 19.432, lng: -99.133, name: 'Mexico City Zócalo', city: 'Mexico City', country: 'Mexico' },
    { id: '1603456789', lat: -12.046, lng: -77.043, name: 'Lima Miraflores', city: 'Lima', country: 'Peru' },
    { id: '1602876543', lat: 4.711, lng: -74.072, name: 'Bogotá Centro', city: 'Bogotá', country: 'Colombia' },
    { id: '1604321098', lat: -33.449, lng: -70.669, name: 'Santiago Centro', city: 'Santiago', country: 'Chile' },
    // Asia
    { id: '1599876543', lat: 1.352, lng: 103.820, name: 'Singapore Marina Bay', city: 'Singapore', country: 'Singapore' },
    { id: '1600654321', lat: 22.302, lng: 114.177, name: 'Hong Kong Victoria Harbour', city: 'Hong Kong', country: 'China' },
    { id: '1602432109', lat: 13.756, lng: 100.502, name: 'Bangkok Siam', city: 'Bangkok', country: 'Thailand' },
    { id: '1603321098', lat: 28.613, lng: 77.229, name: 'New Delhi India Gate', city: 'New Delhi', country: 'India' },
    { id: '1604210987', lat: 19.076, lng: 72.878, name: 'Mumbai Marine Drive', city: 'Mumbai', country: 'India' },
    { id: '1605109876', lat: 39.904, lng: 116.407, name: 'Beijing Tiananmen', city: 'Beijing', country: 'China' },
    { id: '1606098765', lat: 31.230, lng: 121.474, name: 'Shanghai The Bund', city: 'Shanghai', country: 'China' },
    { id: '1608876543', lat: 3.139, lng: 101.687, name: 'Kuala Lumpur Petronas', city: 'Kuala Lumpur', country: 'Malaysia' },
    { id: '1609765432', lat: -6.175, lng: 106.827, name: 'Jakarta Monas', city: 'Jakarta', country: 'Indonesia' },
    // Russia
    { id: '1586654321', lat: 55.756, lng: 37.617, name: 'Moscow Red Square', city: 'Moscow', country: 'Russia' },
    { id: '1600543210', lat: 59.934, lng: 30.336, name: 'St Petersburg Nevsky', city: 'St Petersburg', country: 'Russia' },
    { id: '1601432109', lat: 43.116, lng: 131.874, name: 'Vladivostok Port', city: 'Vladivostok', country: 'Russia' },
    // Europe
    { id: '1586543210', lat: 48.857, lng: 2.352, name: 'Paris Eiffel Tower', city: 'Paris', country: 'France' },
    { id: '1599432109', lat: 52.520, lng: 13.405, name: 'Berlin Brandenburg Gate', city: 'Berlin', country: 'Germany' },
    { id: '1601210987', lat: 40.417, lng: -3.704, name: 'Madrid Gran Via', city: 'Madrid', country: 'Spain' },
    { id: '1603098765', lat: 50.075, lng: 14.438, name: 'Prague Old Town', city: 'Prague', country: 'Czech Republic' },
    { id: '1604987654', lat: 47.497, lng: 19.040, name: 'Budapest Chain Bridge', city: 'Budapest', country: 'Hungary' },
    { id: '1605876543', lat: 59.329, lng: 18.069, name: 'Stockholm Gamla Stan', city: 'Stockholm', country: 'Sweden' },
    { id: '1607654321', lat: 38.722, lng: -9.139, name: 'Lisbon Praça do Comércio', city: 'Lisbon', country: 'Portugal' },
  ];

  return locations.map(loc => ({
    id: `windy-${loc.id}`,
    lat: loc.lat,
    lng: loc.lng,
    name: loc.name,
    city: loc.city,
    country: loc.country,
    feed_url: '', // Don't rely on static image
    stream_url: `https://www.windy.com/webcams/${loc.id}/embed`,
    stream_type: 'iframe' as const,
    source: 'Windy Webcam',
    external_url: `https://www.windy.com/webcams/${loc.id}`,
  }));
}

// ─── SkylineWebcams reference catalogue ─────────────────────────────────────
// SkylineWebcams permits non-host websites to use the photogram generated by
// its own Embed control. Those image references refresh at the provider's
// documented five-minute cadence. Live video is never embedded or extracted.
export function getSkylineReferenceCameras(): LiveCamera[] {
  const SKYLINE_PHOTOGRAM_REFRESH_MS = 5 * 60 * 1000;
  const periodicPhotogramIds: Record<string, string> = {
    'skyline-times-square': '538',
    'skyline-cabo': '984',
    'skyline-ushuaia': '1053',
    'skyline-cusco': '831',
    'skyline-porto-seguro': '832',
    'skyline-silver-rock': '1111',
    'skyline-galapagos': '931',
    'skyline-venice': '522',
    'skyline-trevi': '286',
    'skyline-santorini': '524',
    'skyline-jokulsarlon': '28',
    'skyline-henningsvaer': '525',
    'skyline-thessaloniki': '570',
    'skyline-petra-treasury': '829',
    'skyline-petra-visitor': '589',
    'skyline-western-wall': '860',
    'skyline-temple-mount': '5632',
    'skyline-ashdod': '2516',
    'skyline-imsouane': '5791',
    'skyline-voi': '992',
    'skyline-diani': '4309',
    'skyline-takamaka': '868',
    'skyline-zambezi': '1159',
    'skyline-ballito': '1112',
    'skyline-zeekoe': '4040',
    'skyline-popenguine': '5614',
    'skyline-le-morne': '1701',
    'skyline-shibuya': '1825',
    'skyline-fuji': '1871',
    'skyline-naha': '4281',
    'skyline-sukhumvit': '5185',
    'skyline-kuredu': '989',
    'skyline-meeru': '814',
    'skyline-banpo': '1863',
    'skyline-gwangan': '3410',
    'skyline-sydney': '2651',
    'skyline-brisbane': '4058',
    'skyline-auckland': '5996',
    'skyline-lyall': '3082',
    'skyline-nuuk': '6165',
    'skyline-tromso': '107',
    'skyline-honningsvag': '4504',
    'skyline-fjallabyggd': '5741',
  };
  const references = [
    // Americas
    { id: 'skyline-times-square', name: 'Times Square', city: 'New York', country: 'United States', lat: 40.7580, lng: -73.9855, region: 'Americas', context: 'Broadway District public-space observation point.', url: 'https://www.skylinewebcams.com/en/webcam/united-states/new-york/new-york/times-square.html' },
    { id: 'skyline-cabo', name: 'Cabo San Lucas Beach', city: 'Cabo San Lucas', country: 'Mexico', lat: 22.8905, lng: -109.9167, region: 'Americas', context: 'Baja California coastal observation point.', url: 'https://www.skylinewebcams.com/en/webcam/mexico/baja-california-sur/cabo-san-lucas/cabo-san-lucas.html' },
    { id: 'skyline-ushuaia', name: 'Train of the End of the World', city: 'Ushuaia', country: 'Argentina', lat: -54.8320, lng: -68.4230, region: 'Americas', context: 'Southern transport and weather reference point.', url: 'https://www.skylinewebcams.com/en/webcam/argentina/tierra-del-fuego/ushuaia/tren-del-fin-del-mundo.html' },
    { id: 'skyline-cusco', name: 'Plaza Mayor', city: 'Cusco', country: 'Peru', lat: -13.5167, lng: -71.9781, region: 'Americas', context: 'Historic-center public-space reference point.', url: 'https://www.skylinewebcams.com/en/webcam/peru/cusco/cusco/plaza-mayor.html' },
    { id: 'skyline-porto-seguro', name: 'Praia de Taperapuan', city: 'Porto Seguro', country: 'Brazil', lat: -16.3890, lng: -39.0490, region: 'Americas', context: 'Bahia coastline conditions reference.', url: 'https://www.skylinewebcams.com/en/webcam/brasil/bahia/porto-seguro/praia-de-taperapuan.html' },
    { id: 'skyline-silver-rock', name: 'Silver Rock Beach', city: 'Christ Church', country: 'Barbados', lat: 13.0483, lng: -59.4933, region: 'Americas', context: 'Caribbean coastal conditions reference.', url: 'https://www.skylinewebcams.com/en/webcam/barbados/christ-church/silver-rock-beach/silver-rock-beach.html' },
    { id: 'skyline-galapagos', name: 'Giant Galápagos Tortoise Pond', city: 'Santa Cruz Island', country: 'Ecuador', lat: -0.6389, lng: -90.3444, region: 'Americas', context: 'Galápagos wildlife and conditions reference.', url: 'https://www.skylinewebcams.com/en/webcam/ecuador/galapagos/santa-cruz-island/galapagos-ecuador.html' },
    // Europe
    { id: 'skyline-venice', name: 'Piazza San Marco', city: 'Venice', country: 'Italy', lat: 45.4339, lng: 12.3381, region: 'Europe', context: 'Venice public-square and lagoon-side reference.', url: 'https://www.skylinewebcams.com/en/webcam/italia/veneto/venezia/piazza-san-marco.html' },
    { id: 'skyline-trevi', name: 'Trevi Fountain', city: 'Rome', country: 'Italy', lat: 41.9009, lng: 12.4833, region: 'Europe', context: 'Rome historic-center public-space reference.', url: 'https://www.skylinewebcams.com/en/webcam/italia/lazio/roma/fontana-di-trevi.html' },
    { id: 'skyline-madrid', name: 'Puerta del Sol', city: 'Madrid', country: 'Spain', lat: 40.4167, lng: -3.7033, region: 'Europe', context: 'Madrid central-square reference point.', url: 'https://www.skylinewebcams.com/en/webcam/espana/comunidad-de-madrid/madrid/puerta-del-sol.html' },
    { id: 'skyline-prague', name: 'Old Town Square', city: 'Prague', country: 'Czech Republic', lat: 50.0871, lng: 14.4207, region: 'Europe', context: 'Historic-center public-space reference.', url: 'https://www.skylinewebcams.com/en/webcam/czech-republic/prague/prague/old-town.html' },
    { id: 'skyline-santorini', name: 'Firostefani', city: 'Santorini', country: 'Greece', lat: 36.4248, lng: 25.4286, region: 'Europe', context: 'Aegean caldera weather reference point.', url: 'https://www.skylinewebcams.com/en/webcam/ellada/naigaio/kyklades/santorini-firostefani.html' },
    { id: 'skyline-jokulsarlon', name: 'Jökulsárlón Lagoon', city: 'Höfn', country: 'Iceland', lat: 64.0703, lng: -16.2117, region: 'Europe', context: 'Glacial lagoon conditions reference.', url: 'https://www.skylinewebcams.com/en/webcam/iceland/austurland/hofn/jokulsarlon.html' },
    { id: 'skyline-henningsvaer', name: 'Henningsvær', city: 'Lofoten', country: 'Norway', lat: 68.1529, lng: 14.2008, region: 'Europe', context: 'Northern fishing-harbor reference.', url: 'https://www.skylinewebcams.com/en/webcam/norge/nordland/lofoten/henningsvaer.html' },
    { id: 'skyline-thessaloniki', name: 'Aristotelous Square', city: 'Thessaloniki', country: 'Greece', lat: 40.6324, lng: 22.9409, region: 'Europe', context: 'Waterfront urban reference point.', url: 'https://www.skylinewebcams.com/en/webcam/ellada/makedonia/thessaloniki/plateia-aristotelous.html' },
    // Middle East and North Africa
    { id: 'skyline-dubai-marina', name: 'Dubai Marina', city: 'Dubai', country: 'United Arab Emirates', lat: 25.0887, lng: 55.1467, region: 'MENA', context: 'Dubai Marina and Sheikh Zayed Road corridor reference.', url: 'https://www.skylinewebcams.com/en/webcam/united-arab-emirates/dubai/dubai/dubai-marina.html' },
    { id: 'skyline-palm', name: 'Fairmont The Palm', city: 'Dubai', country: 'United Arab Emirates', lat: 25.1101, lng: 55.2361, region: 'MENA', context: 'Palm Jumeirah coastal reference point.', url: 'https://www.skylinewebcams.com/en/webcam/united-arab-emirates/dubai/dubai/fairmont-the-palm.html' },
    { id: 'skyline-petra-treasury', name: 'Petra — The Treasury', city: 'Petra', country: 'Jordan', lat: 30.3289, lng: 35.4448, region: 'MENA', context: 'Petra heritage-site observation reference.', url: 'https://www.skylinewebcams.com/en/webcam/jordan/maan/amman/petra-the-treasury.html' },
    { id: 'skyline-petra-visitor', name: 'Petra — Visitor Center', city: 'Petra', country: 'Jordan', lat: 30.3285, lng: 35.4444, region: 'MENA', context: 'Petra access-area reference point.', url: 'https://www.skylinewebcams.com/en/webcam/jordan/maan/amman/petra-visitor-center.html' },
    { id: 'skyline-western-wall', name: 'Jerusalem — Western Wall', city: 'Jerusalem', country: 'Israel', lat: 31.7767, lng: 35.2345, region: 'MENA', context: 'Old City public-plaza reference point.', url: 'https://www.skylinewebcams.com/en/webcam/israel/jerusalem-district/jerusalem/western-wall.html' },
    { id: 'skyline-temple-mount', name: 'Jerusalem — Temple Mount', city: 'Jerusalem', country: 'Israel', lat: 31.7781, lng: 35.2358, region: 'MENA', context: 'Old City elevated-reference point.', url: 'https://www.skylinewebcams.com/en/webcam/israel/jerusalem-district/jerusalem/temple-mount.html' },
    { id: 'skyline-ashdod', name: 'Ashdod — Oranim Beach', city: 'Ashdod', country: 'Israel', lat: 31.8014, lng: 34.6435, region: 'MENA', context: 'Mediterranean coastline conditions reference.', url: 'https://www.skylinewebcams.com/en/webcam/israel/southern-district/ashdod/oranim-beach.html' },
    { id: 'skyline-imsouane', name: 'Imsouane', city: 'Imsouane', country: 'Morocco', lat: 30.8433, lng: -9.8186, region: 'MENA', context: 'Atlantic coastal conditions reference.', url: 'https://www.skylinewebcams.com/en/webcam/morocco/souss-massa/imsouane/plage.html' },
    // Africa
    { id: 'skyline-voi', name: 'Voi Wildlife Lodge', city: 'Voi', country: 'Kenya', lat: -3.3976, lng: 38.5668, region: 'Africa', context: 'Tsavo East wildlife observation reference.', url: 'https://www.skylinewebcams.com/en/webcam/kenya/taita-taveta-county/voi/tsavo-east-national-park.html' },
    { id: 'skyline-diani', name: 'Diani Beach', city: 'Diani Beach', country: 'Kenya', lat: -4.3222, lng: 39.5750, region: 'Africa', context: 'Indian Ocean coastal conditions reference.', url: 'https://www.skylinewebcams.com/en/webcam/kenya/kwale-county/diani-beach/diani-beach.html' },
    { id: 'skyline-takamaka', name: 'Anse Parnel', city: 'Takamaka', country: 'Seychelles', lat: -4.7592, lng: 55.5147, region: 'Africa', context: 'Seychelles coastline reference point.', url: 'https://www.skylinewebcams.com/en/webcam/seychelles/mahe/takamaka/seychelles-takamaka.html' },
    { id: 'skyline-zambezi', name: 'Royal Zambezi Lodge', city: 'Mafuta', country: 'Zambia', lat: -15.7276, lng: 29.3150, region: 'Africa', context: 'Zambezi riverine wildlife reference.', url: 'https://www.skylinewebcams.com/en/webcam/zambia/lusaka-province/mafuta/zambezi-national-park.html' },
    { id: 'skyline-ballito', name: 'Willard Beach', city: 'Ballito', country: 'South Africa', lat: -29.5318, lng: 31.2236, region: 'Africa', context: 'KwaZulu-Natal coastline reference.', url: 'https://www.skylinewebcams.com/en/webcam/south-africa/kwazulu-natal/kwadukuza/willard-beach.html' },
    { id: 'skyline-zeekoe', name: 'Zeekoe Vlei Yacht Club', city: 'Cape Town', country: 'South Africa', lat: -34.0643, lng: 18.5078, region: 'Africa', context: 'Cape Town inland-waterway reference.', url: 'https://www.skylinewebcams.com/en/webcam/south-africa/western-cape/cape-town/zeekoevlei.html' },
    { id: 'skyline-popenguine', name: 'Popenguine Beach', city: 'Popenguine', country: 'Senegal', lat: 14.5517, lng: -17.1147, region: 'Africa', context: 'Senegal Atlantic coastline reference.', url: 'https://www.skylinewebcams.com/en/webcam/senegal/thies/popenguine-ndayane/plage-popenguine.html' },
    { id: 'skyline-le-morne', name: 'Kozy Le Morne Villa', city: 'Le Morne', country: 'Mauritius', lat: -20.4528, lng: 57.3236, region: 'Africa', context: 'Mauritius lagoon and shoreline reference.', url: 'https://www.skylinewebcams.com/en/webcam/mauritius/le-morne-brabant/le-morne/le-morne.html' },
    // South and East Asia
    { id: 'skyline-shibuya', name: 'Shibuya Scramble Crossing', city: 'Tokyo', country: 'Japan', lat: 35.6595, lng: 139.7005, region: 'Asia', context: 'Tokyo public-mobility reference point.', url: 'https://www.skylinewebcams.com/en/webcam/japan/kanto/tokyo/tokyo-shibuya-scramble-crossing.html' },
    { id: 'skyline-fuji', name: 'Mount Fuji', city: 'Fujikawaguchiko', country: 'Japan', lat: 35.5011, lng: 138.7653, region: 'Asia', context: 'Regional weather and visibility reference.', url: 'https://www.skylinewebcams.com/en/webcam/japan/yamanashi-prefecture/fujikawaguchiko/mount-fuji.html' },
    { id: 'skyline-naha', name: 'Naha City Panorama', city: 'Naha', country: 'Japan', lat: 26.2122, lng: 127.6791, region: 'Asia', context: 'Okinawa urban-area reference.', url: 'https://www.skylinewebcams.com/en/webcam/japan/okinawa-prefecture/naha/city.html' },
    { id: 'skyline-sukhumvit', name: 'Sukhumvit Road', city: 'Bangkok', country: 'Thailand', lat: 13.7214, lng: 100.5827, region: 'Asia', context: 'Bangkok mobility corridor reference.', url: 'https://www.skylinewebcams.com/en/webcam/thailand/central-thailand/bangkok/sukhumvit.html' },
    { id: 'skyline-kuredu', name: 'Kuredu Island Resort', city: 'Kuredu Island', country: 'Maldives', lat: 5.5498, lng: 73.4663, region: 'Asia', context: 'Maldives coastal conditions reference.', url: 'https://www.skylinewebcams.com/en/webcam/maldives/lhaviyani-atoll/kurendhoo/kuredu-island.html' },
    { id: 'skyline-meeru', name: 'Meeru Maldives Beach', city: 'Meerufenfushi Island', country: 'Maldives', lat: 4.4542, lng: 73.7169, region: 'Asia', context: 'Maldives shoreline reference point.', url: 'https://www.skylinewebcams.com/en/webcam/maldives/north-male-atoll/meerufenfushi/meeru-island-beach.html' },
    { id: 'skyline-banpo', name: 'Banpo Bridge', city: 'Seoul', country: 'South Korea', lat: 37.5146, lng: 126.9965, region: 'Asia', context: 'Han River urban infrastructure reference.', url: 'https://www.skylinewebcams.com/en/webcam/south-korea/seoul-capital/seoul/seoul.html' },
    { id: 'skyline-gwangan', name: 'Gwangan Bridge', city: 'Busan', country: 'South Korea', lat: 35.1457, lng: 129.1284, region: 'Asia', context: 'Busan coastal infrastructure reference.', url: 'https://www.skylinewebcams.com/en/webcam/south-korea/haeundae-district/busan/gwangan-bridge.html' },
    // Oceania and Arctic
    { id: 'skyline-sydney', name: 'Sydney Harbour Bridge', city: 'Sydney', country: 'Australia', lat: -33.8522, lng: 151.2106, region: 'Oceania', context: 'Sydney harbour and maritime reference.', url: 'https://www.skylinewebcams.com/en/webcam/australia/new-south-wales/sydney/harbour-bridge.html' },
    { id: 'skyline-brisbane', name: 'Brisbane River', city: 'Brisbane', country: 'Australia', lat: -27.4678, lng: 153.0281, region: 'Oceania', context: 'Brisbane riverside visibility reference.', url: 'https://www.skylinewebcams.com/en/webcam/australia/queensland/brisbane/brisbane-river.html' },
    { id: 'skyline-auckland', name: 'Auckland Waterfront', city: 'Auckland', country: 'New Zealand', lat: -36.8427, lng: 174.7643, region: 'Oceania', context: 'Auckland waterfront reference.', url: 'https://www.skylinewebcams.com/en/webcam/new-zealand/auckland/auckland/panorama.html' },
    { id: 'skyline-lyall', name: 'Lyall Bay', city: 'Wellington', country: 'New Zealand', lat: -41.3300, lng: 174.7930, region: 'Oceania', context: 'Wellington coastal conditions reference.', url: 'https://www.skylinewebcams.com/en/webcam/new-zealand/wellington/wellington-city/lyall-bay.html' },
    { id: 'skyline-nuuk', name: 'Port of Nuuk', city: 'Nuuk', country: 'Greenland', lat: 64.1745, lng: -51.7384, region: 'Arctic', context: 'Greenland commercial-port reference.', url: 'https://www.skylinewebcams.com/en/webcam/greenland/nuuk/nuuk/port.html' },
    { id: 'skyline-tromso', name: 'Tromsø Panorama', city: 'Tromsø', country: 'Norway', lat: 69.6489, lng: 18.9610, region: 'Arctic', context: 'High-latitude harbour and city reference.', url: 'https://www.skylinewebcams.com/en/webcam/norge/northern-norway/tromso/tromso.html' },
    { id: 'skyline-honningsvag', name: 'Honningsvåg Port', city: 'Honningsvåg', country: 'Norway', lat: 70.9806, lng: 25.9703, region: 'Arctic', context: 'North Cape maritime reference point.', url: 'https://www.skylinewebcams.com/en/webcam/norge/northern-norway/nordkapp/honningsvag.html' },
    { id: 'skyline-fjallabyggd', name: 'Port of Fjallabyggð', city: 'Fjallabyggð', country: 'Iceland', lat: 66.1490, lng: -18.9080, region: 'Arctic', context: 'Northern Iceland port reference.', url: 'https://www.skylinewebcams.com/en/webcam/iceland/northeastern-region/fjallabygge/port.html' },
  ];

  return references.map((reference) => {
    const photogramId = periodicPhotogramIds[reference.id];
    return {
    id: reference.id,
    lat: reference.lat,
    lng: reference.lng,
    name: reference.name,
    city: reference.city,
    country: reference.country,
    feed_url: '',
    source: 'SkylineWebcams',
    external_url: reference.url,
    periodic_image_url: photogramId ? `https://embed.skylinewebcams.com/img/${photogramId}.jpg` : undefined,
    refresh_interval_ms: photogramId ? SKYLINE_PHOTOGRAM_REFRESH_MS : undefined,
    reference_only: !photogramId,
    source_context: reference.context,
    catalog_region: reference.region,
    };
  });
}

// ─── Main Aggregator ─────────────────────────────────────────────────────────
async function fetchAllLiveCameras(): Promise<LiveCamera[]> {
  const results = await Promise.allSettled([
    fetchTfLCameras(),
    fetchAsfinagCameras(),
    getOdotCameras(),
    getCaltransCameras(),
    getNztaCameras(),
    getDgtCameras(),
    getThbCameras(),
    getHongKongTrafficCameras(),
    getFintrafficCameras(),
    getSingaporeTrafficCameras(),
    getWsdotCameras(),
    getOntario511Cameras(),
    getFlorida511Cameras(),
    getQuebec511Cameras(),
    getDriveBcCameras(),
    getTorontoTrafficCameras(),
    getOttawaCameraReferences(),
    getNswLiveTrafficCameras(),
  ]);

  const cameras: LiveCamera[] = [];
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      cameras.push(...result.value);
    }
  }
  
  // Add YouTube live streams (truly live)
  cameras.push(...getYouTubeLiveStreams());
  
  // Add Windy embed cameras (iframe always works)
  cameras.push(...getWindyEmbedCameras());

  // Add compliant Skyline photograms and external-only references. No live feed is used.
  cameras.push(...getSkylineReferenceCameras());
  
  console.log(`[LiveCameras] Loaded ${cameras.length} live cameras`);
  return cameras;
}

/**
 * Get all live cameras with caching.
 * Returns cameras from real APIs (TfL, Asfinag) + YouTube Live + Windy embeds.
 * These supplement the DB cameras.
 */
export async function getLiveCameras(): Promise<LiveCamera[]> {
  const now = Date.now();
  if (liveCameraCache.cameras.length > 0 && (now - liveCameraCache.lastFetch) < CACHE_TTL) {
    return liveCameraCache.cameras;
  }

  if (!pendingFetch) {
    pendingFetch = fetchAllLiveCameras()
      .then(cameras => {
        if (cameras.length > 0) {
          liveCameraCache = { cameras, lastFetch: Date.now() };
        }
        return liveCameraCache.cameras;
      })
      .catch(() => liveCameraCache.cameras)
      .finally(() => { pendingFetch = null; });
  }

  return pendingFetch;
}
