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
    expect(feedPanelSource).toContain("PROVIDER PHOTOGRAM — REFRESHES EVERY ${REFRESH_INTERVAL / 60000} MIN");
  });

  it("shows the canonical source action and intelligence context in the rendered detail panel", () => {
    expect(feedPanelSource).toContain("{camera.sourceContext && <DetailRow label=\"INTEL CONTEXT\" value={camera.sourceContext} />}");
    expect(feedPanelSource).toContain("{sourceLink && <a href={sourceLink} target=\"_blank\" rel=\"noopener noreferrer\"");
    expect(feedPanelSource).toContain("Open feed source");
  });
});
