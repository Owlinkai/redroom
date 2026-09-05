import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sigintSource = readFileSync(
  path.resolve(import.meta.dirname, "../client/src/pages/Sigint.tsx"),
  "utf8",
);

function componentSource(startMarker: string, endMarker: string): string {
  const start = sigintSource.indexOf(startMarker);
  const end = sigintSource.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`Unable to locate ${startMarker}`);
  return sigintSource.slice(start, end);
}

const miniPlayerSource = componentSource(
  "function PinnedCameraMiniPlayer",
  "// ─── Detail Panel Components",
);
const hoverPreviewSource = componentSource(
  "function CameraHoverPreview",
  "// ─── Detail Panel Components",
);
const feedPanelSource = componentSource(
  "function CameraFeedPanel",
  "// ─── Helper Components",
);

describe("SIGINT camera player presentation integration", () => {
  it("keeps the pinned player on the shared canonical-source and provider-photogram path", () => {
    expect(miniPlayerSource).toContain("getCameraPresentation(camera)");
    expect(miniPlayerSource).toContain("refreshIntervalMs, sourceLink } = getCameraPresentation(camera)");
    expect(miniPlayerSource).toContain("isProviderPhotogram");
    expect(miniPlayerSource).toContain("? `${imageFeedUrl}${imageFeedUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`");
    expect(miniPlayerSource).toContain("OPEN LIVE SOURCE · {camera.source || 'PUBLIC REFERENCE'}");
  });

  it("keeps the detail player on the direct provider image path and excludes it from the CCTV proxy", () => {
    expect(feedPanelSource).toContain("getCameraPresentation(camera)");
    expect(feedPanelSource).toContain("enabled: !!camera.feedUrl && !isProviderPhotogram && !isExternalReference && !isIframeStream && !isMjpeg");
    expect(feedPanelSource).toContain("if (!isProviderPhotogram || !periodicImageUrl) return;");
    expect(feedPanelSource).toContain("const newSrc = `${periodicImageUrl}${periodicImageUrl.includes('?') ? '&' : '?'}_t=${fetchTick}`;");
    expect(feedPanelSource).toContain("const REFRESH_INTERVAL = isMjpeg");
    expect(feedPanelSource).toContain(": refreshIntervalMs;");
  });

  it("adds a delayed map-hover preview that reuses the safe camera presentation contract without changing marker selection", () => {
    expect(sigintSource).toContain("const [hoveredCameraPreview, setHoveredCameraPreview]");
    expect(sigintSource).toContain("cameraHoverTimerRef.current = setTimeout(() => setHoveredCameraPreview({ camera: cam, x, y }), 180);");
    expect(sigintSource).toContain("m.on(\"click\", () => selectItem(\"camera\", cam));");
    expect(hoverPreviewSource).toContain("getCameraPresentation(camera)");
    expect(hoverPreviewSource).toContain("pointer-events-none");
    expect(hoverPreviewSource).toContain("isProviderPhotogram");
    expect(hoverPreviewSource).toContain("/api/trpc/sigint.proxyCCTVImage");
  });

  it("shows canonical source controls and structured operational context in the refined detail panel", () => {
    expect(feedPanelSource).toContain("Source attribution");
    expect(feedPanelSource).toContain("Operational context");
    expect(feedPanelSource).toContain("Open official viewer");
    expect(feedPanelSource).toContain("Refresh plan");
    expect(feedPanelSource).toContain("{camera.sourceContext && <div className=\"mt-2 border-t");
    expect(feedPanelSource).toContain("{sourceLink && <a href={sourceLink} target=\"_blank\" rel=\"noopener noreferrer\"");
    expect(feedPanelSource).toContain("<Pin size={10} /> PIN");
  });
});
