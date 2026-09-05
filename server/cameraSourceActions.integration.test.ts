import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sigintRouter = readFileSync(path.resolve(import.meta.dirname, "./routers/sigint.ts"), "utf8");
const liveCameras = readFileSync(path.resolve(import.meta.dirname, "./routers/liveCameras.ts"), "utf8");

describe("SIGINT human-facing camera source actions", () => {
  it("maps database-backed API providers to official human-facing camera viewers", () => {
    expect(sigintRouter).toContain("'NYSDOT 511': 'https://511ny.org/'");
    expect(sigintRouter).not.toContain("'TfL JamCam': 'https://api.tfl.gov.uk/Place/Type/JamCam'");
    expect(sigintRouter).not.toContain("'Finland Digitraffic': 'https://tie.digitraffic.fi/api/weathercam/v1/stations'");
  });

  it("uses official human-facing viewers rather than data catalogues for affected live providers", () => {
    expect(liveCameras).toContain("https://www.hkemobility.gov.hk/en/traffic-information/live/cctv");
    expect(liveCameras).toContain("https://liikennetilanne.fintraffic.fi/pulssi/");
    expect(liveCameras).toContain("https://onemotoring.lta.gov.sg/content/onemotoring/home/driving/traffic_information/traffic-cameras.html");
    expect(liveCameras).not.toContain("external_url: 'https://data.gov.hk/en-data/dataset/hk-td-sm_1-traffic-snapshot-images'");
    expect(liveCameras).not.toContain("external_url: 'https://data.gov.sg/datasets?query=traffic%20images'");
  });
});
