export type CameraPresentationInput = {
  feedUrl?: string | null;
  streamUrl?: string | null;
  sourceRef?: string | null;
  periodicImageUrl?: string | null;
  refreshIntervalMs?: number | null;
  referenceOnly?: boolean | null;
  feedMode?: string | null;
};

export const DEFAULT_PERIODIC_REFRESH_MS = 5_000;
export const SKYLINE_MIN_PHOTOGRAM_REFRESH_MS = 3 * 60 * 1000;
export const SKYLINE_DEFAULT_PHOTOGRAM_REFRESH_MS = 5 * 60 * 1000;

function isProviderPhotogramUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "embed.skylinewebcams.com"
      && /^\/img\/\d+\.jpg$/.test(url.pathname);
  } catch {
    return false;
  }
}

/** Machine-readable source indexes must never be exposed as the player action. */
export function isMachineReadableCameraSource(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname.startsWith("api.")
      || url.hostname.startsWith("tie.")
      || /\.(?:json|xml|js)$/i.test(url.pathname)
      || /\/(?:api|opendata|FeatureServer|List\/GetData)\b/i.test(url.pathname)
      || /(?:^|[?&])f=json(?:&|$)/i.test(url.search);
  } catch {
    return false;
  }
}

/**
 * Normalizes camera presentation behavior. Skyline photograms are constrained
 * to provider-issued image URLs and never routed through the CCTV image proxy.
 */
export function getCameraPresentation(camera: CameraPresentationInput) {
  const requestedPhotogram = camera.periodicImageUrl || "";
  const periodicImageUrl = isProviderPhotogramUrl(requestedPhotogram) ? requestedPhotogram : "";
  const isProviderPhotogram = Boolean(periodicImageUrl);
  const isExternalReference = Boolean(camera.referenceOnly || camera.feedMode === "reference") && !isProviderPhotogram;
  const canonicalSource = camera.sourceRef || "";
  const sourceLink = isMachineReadableCameraSource(canonicalSource)
    ? camera.streamUrl || camera.feedUrl || ""
    : canonicalSource || camera.streamUrl || camera.feedUrl || "";

  return {
    sourceLink,
    periodicImageUrl,
    imageFeedUrl: periodicImageUrl || camera.feedUrl || "",
    isProviderPhotogram,
    isExternalReference,
    refreshIntervalMs: isProviderPhotogram
      ? Math.max(camera.refreshIntervalMs || SKYLINE_DEFAULT_PHOTOGRAM_REFRESH_MS, SKYLINE_MIN_PHOTOGRAM_REFRESH_MS)
      : Math.max(camera.refreshIntervalMs || DEFAULT_PERIODIC_REFRESH_MS, DEFAULT_PERIODIC_REFRESH_MS),
  };
}
