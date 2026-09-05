import { describe, expect, it } from "vitest";
import {
  getCameraPresentation,
  isMachineReadableCameraSource,
  SKYLINE_DEFAULT_PHOTOGRAM_REFRESH_MS,
  SKYLINE_MIN_PHOTOGRAM_REFRESH_MS,
} from "../client/src/lib/cameraPresentation";

describe("camera presentation safety", () => {
  it("prefers the canonical provider source page for every external action", () => {
    const presentation = getCameraPresentation({
      sourceRef: "https://www.skylinewebcams.com/en/webcam/example.html",
      streamUrl: "https://untrusted.example/live",
      feedUrl: "https://untrusted.example/image.jpg",
    });

    expect(presentation.sourceLink).toBe("https://www.skylinewebcams.com/en/webcam/example.html");
  });

  it("uses a provider-issued Skyline Embed photogram directly at five-minute cadence", () => {
    const presentation = getCameraPresentation({
      sourceRef: "https://www.skylinewebcams.com/en/webcam/example.html",
      periodicImageUrl: "https://embed.skylinewebcams.com/img/538.jpg",
      refreshIntervalMs: SKYLINE_DEFAULT_PHOTOGRAM_REFRESH_MS,
      referenceOnly: false,
    });

    expect(presentation.isProviderPhotogram).toBe(true);
    expect(presentation.isExternalReference).toBe(false);
    expect(presentation.imageFeedUrl).toBe("https://embed.skylinewebcams.com/img/538.jpg");
    expect(presentation.refreshIntervalMs).toBe(SKYLINE_DEFAULT_PHOTOGRAM_REFRESH_MS);
  });

  it("rejects non-provider image URLs and keeps references external-only", () => {
    const presentation = getCameraPresentation({
      sourceRef: "https://www.skylinewebcams.com/en/webcam/example.html",
      periodicImageUrl: "https://cdn.skylinewebcams.com/live538.webp",
      refreshIntervalMs: 5_000,
      referenceOnly: true,
      feedMode: "reference",
    });

    expect(presentation.isProviderPhotogram).toBe(false);
    expect(presentation.isExternalReference).toBe(true);
    expect(presentation.periodicImageUrl).toBe("");
    expect(presentation.refreshIntervalMs).toBeLessThan(SKYLINE_MIN_PHOTOGRAM_REFRESH_MS);
  });

  it("honors an official provider's declared periodic-image refresh interval", () => {
    const presentation = getCameraPresentation({
      sourceRef: "https://thbapp.thb.gov.tw/opendata/",
      feedUrl: "https://cctv-ss01.thb.gov.tw/T7-099K+600/snapshot",
      refreshIntervalMs: 60_000,
    });

    expect(presentation.imageFeedUrl).toContain("/snapshot");
    expect(presentation.refreshIntervalMs).toBe(60_000);
  });

  it("never exposes a JSON or API index as the source action when a live image is available", () => {
    const imageUrl = "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.jpg";
    const presentation = getCameraPresentation({
      sourceRef: "https://api.tfl.gov.uk/Place/Type/JamCam",
      feedUrl: imageUrl,
    });

    expect(isMachineReadableCameraSource("https://api.tfl.gov.uk/Place/Type/JamCam")).toBe(true);
    expect(isMachineReadableCameraSource("https://tie.digitraffic.fi/api/weathercam/v1/stations")).toBe(true);
    expect(isMachineReadableCameraSource("https://www.livetraffic.com/traffic-cameras")).toBe(false);
    expect(presentation.sourceLink).toBe(imageUrl);
  });
});
