import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sigintRouter = readFileSync(path.resolve(import.meta.dirname, "./routers/sigint.ts"), "utf8");

describe("SIGINT camera source-reference resolution", () => {
  it("normalizes database API indexes through the human-facing viewer registry", () => {
    expect(sigintRouter).toContain("export function resolveCameraSourceReference");
    expect(sigintRouter).toContain("'Finland Digitraffic': 'https://liikennetilanne.fintraffic.fi/pulssi/'");
    expect(sigintRouter).toContain("sourceRef: resolveCameraSourceReference(row.source, row.sourceApi, row.feedUrl)");
    expect(sigintRouter).not.toContain("sourceRef: row.sourceApi || \"\"");
  });

  it("uses the same normalizer for live-camera source actions and blocks machine-readable URL patterns", () => {
    expect(sigintRouter).toContain("sourceRef: resolveCameraSourceReference(lc.source, lc.external_url, lc.feed_url, lc.stream_url)");
    expect(sigintRouter).toContain("url.hostname.startsWith('api.')");
    expect(sigintRouter).toContain("url.hostname.startsWith('tie.')");
    expect(sigintRouter).toContain("/(?:api|opendata|FeatureServer|List\\/GetData)\\b/i");
  });
});
