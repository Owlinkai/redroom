import { describe, expect, it } from "vitest";
import {
  getSkylineReferenceCameras,
  getWindyEmbedCameras,
  getYouTubeLiveStreams,
  mapDgtCamera,
  mapDriveBcCamera,
  mapFintrafficCamera,
  mapFlorida511Camera,
  mapSingaporeTrafficCamera,
  mapThbCamera,
  mapWsdotCamera,
  mapCaltransCamera,
  mapOdotCamera,
  mapOntario511Camera,
  mapOttawaCameraReference,
  mapNswLiveTrafficCamera,
  mapQuebec511Camera,
  parseTorontoTrafficCameras,
  parseHongKongTrafficCameras,
  parseNztaCameras,
  withProviderBudget,
} from "./routers/liveCameras";

describe("SIGINT webcam library", () => {
  it("preserves the existing curated YouTube and Windy camera sources", () => {
    const youtube = getYouTubeLiveStreams();
    const windy = getWindyEmbedCameras();

    expect(youtube.some((camera) => camera.id === "yt-times-sq" && camera.stream_type === "iframe")).toBe(true);
    expect(windy.some((camera) => camera.id === "windy-1599149330" && camera.stream_type === "iframe")).toBe(true);
  });

  it("uses only provider-issued Skyline photograms at the documented five-minute cadence", () => {
    const skyline = getSkylineReferenceCameras();
    const photogramCameras = skyline.filter((camera) => camera.periodic_image_url);

    expect(photogramCameras.length).toBeGreaterThan(0);
    for (const camera of photogramCameras) {
      expect(camera.stream_url).toBeUndefined();
      expect(camera.external_url).toMatch(/^https:\/\/www\.skylinewebcams\.com\//);
      expect(camera.periodic_image_url).toMatch(/^https:\/\/embed\.skylinewebcams\.com\/img\/\d+\.jpg$/);
      expect(camera.refresh_interval_ms).toBeGreaterThanOrEqual(3 * 60 * 1000);
      expect(camera.refresh_interval_ms).toBe(5 * 60 * 1000);
      expect(camera.reference_only).toBe(false);
    }
  });

  it("retains an external-only source card when Skyline does not expose a photogram", () => {
    const externalOnly = getSkylineReferenceCameras().filter((camera) => !camera.periodic_image_url);

    expect(externalOnly.length).toBeGreaterThan(0);
    for (const camera of externalOnly) {
      expect(camera.reference_only).toBe(true);
      expect(camera.stream_url).toBeUndefined();
      expect(camera.external_url).toMatch(/^https:\/\/www\.skylinewebcams\.com\//);
    }
  });

  it("maps verified official camera indexes to periodic images with attributed source pages", () => {
    expect(mapOdotCamera({ attributes: { cameraId: 77, filename: "camera.jpg", latitude: 45.5, longitude: -122.6, title: "I-5 test" } })).toMatchObject({
      id: "odot-77", source: "ODOT TripCheck", feed_url: "https://tripcheck.com/RoadCams/cams/camera.jpg", external_url: "https://www.tripcheck.com/",
    });
    expect(mapCaltransCamera({ attributes: { OBJECTID: 24, locationName: "SR-1 test", nearbyPlace: "Monterey", latitude: 36.6, longitude: -121.9, currentImageURL: "https://cwwp2.dot.ca.gov/camera.jpg", inService: "True" } })).toMatchObject({
      id: "caltrans-24", source: "Caltrans QuickMap", external_url: "https://quickmap.dot.ca.gov/",
    });
  });

  it("parses active NZTA cameras while excluding offline records", () => {
    const cameras = parseNztaCameras(`
      <cameras>
        <camera><id>101</id><name>State Highway 1</name><imageUrl>/images/101.jpg</imageUrl><latitude>-41.2865</latitude><longitude>174.7762</longitude><offline>false</offline><underMaintenance>false</underMaintenance><region><name>Wellington</name></region></camera>
        <camera><id>102</id><name>Unavailable</name><imageUrl>/images/102.jpg</imageUrl><latitude>-41.2</latitude><longitude>174.8</longitude><offline>true</offline></camera>
      </cameras>
    `);

    expect(cameras).toHaveLength(1);
    expect(cameras[0]).toMatchObject({
      id: "nzta-101", source: "NZTA Waka Kotahi", feed_url: "https://trafficnz.info/images/101.jpg", external_url: "https://trafficnz.info/camera/view/101",
    });
  });

  it("uses a provider time budget and safely serves the last good result when a source is slow", async () => {
    const fallback = [{ id: "last-good" }];
    const result = await withProviderBudget(
      "test provider",
      () => new Promise<typeof fallback>((resolve) => setTimeout(() => resolve([{ id: "late" }]), 30)),
      fallback,
      5,
    );

    expect(result).toEqual(fallback);
  });

  it("maps officially published DGT, THB, Fintraffic, and Singapore snapshot indexes with safe refresh cadences", () => {
    expect(mapDgtCamera({ id: "2", latitud: "42.0676", longitud: "-4.2227", imagen: "https://etraffic.dgt.es/camarasEtraffic/2.jpg", carretera: "A-62", pk: "57.9" })).toMatchObject({
      id: "dgt-2", source: "DGT Spain", refresh_interval_ms: 60_000,
    });
    expect(mapThbCamera({ id: "CCTV-45-0070-099-002", stakenumber: "台7線099K+600", gisx: 121.604, gisy: 24.67, html: "https://cctv-ss01.thb.gov.tw/T7-099K+600" })).toMatchObject({
      id: "thb-cctv-45-0070-099-002", feed_url: "https://cctv-ss01.thb.gov.tw/T7-099K+600/snapshot", source: "Taiwan Highway Bureau", refresh_interval_ms: 60_000,
    });
    expect(mapFintrafficCamera({ id: "C01503", geometry: { coordinates: [23.99616, 60.05374] }, properties: { name: "Lohja", municipality: "Lohja", presets: [{ id: "C0150301" }] } })).toMatchObject({
      id: "fintraffic-C01503", source: "Fintraffic", refresh_interval_ms: 60_000, external_url: "https://liikennetilanne.fintraffic.fi/pulssi/",
    });
    expect(mapSingaporeTrafficCamera({ camera_id: "1001", image: "https://images.data.gov.sg/api/traffic-images/example.jpg", location: { latitude: 1.3, longitude: 103.8 } })).toMatchObject({
      id: "lta-sg-1001", source: "LTA Singapore", refresh_interval_ms: 60_000, external_url: "https://onemotoring.lta.gov.sg/content/onemotoring/home/driving/traffic_information/traffic-cameras.html",
    });
  });

  it("parses the Hong Kong authority XML only when its direct image and local coordinates are valid", () => {
    const cameras = parseHongKongTrafficCameras(`
      <image-list><image><key>H429F</key><region>Hong Kong Island</region><district>Southern</district><description>Aberdeen Praya Road [H429F]</description><latitude>22.248</latitude><longitude>114.156</longitude><url>https://tdcctv.data.one.gov.hk/H429F.JPG</url></image>
      <image><key>OUTSIDE</key><latitude>53</latitude><longitude>114.1</longitude><url>https://tdcctv.data.one.gov.hk/OUTSIDE.JPG</url></image></image-list>
    `);
    expect(cameras).toHaveLength(1);
    expect(cameras[0]).toMatchObject({ id: "hk-h429f", source: "Hong Kong Transport Department", refresh_interval_ms: 60_000, external_url: "https://www.hkemobility.gov.hk/en/traffic-information/live/cctv" });
  });

  it("maps the official WSDOT camera layer with its five-minute image cadence", () => {
    expect(mapWsdotCamera({
      attributes: { OBJECTID: 1001, CameraTitle: "I-5 at Interstate Bridge", ImageURL: "https://images.wsdot.wa.gov/sw/005vc00320.jpg", CompassDirection: "S" },
      geometry: { x: -122.674, y: 45.6205 },
    })).toMatchObject({
      id: "wsdot-1001", source: "WSDOT", refresh_interval_ms: 300_000, external_url: "https://wsdot.com/travel/real-time/map/",
    });
  });

  it("maps Ontario 511’s official camera API using an enabled periodic image view", () => {
    expect(mapOntario511Camera({
      Id: 1,
      Roadway: "QEW",
      Location: "West of Thompson Road",
      Latitude: 42.9143,
      Longitude: -78.958,
      Views: [{ Url: "https://511on.ca/map/Cctv/1", Status: "Enabled", Description: "Toronto Bound" }],
    })).toMatchObject({
      id: "ontario-511-1", source: "Ontario 511", refresh_interval_ms: 60_000, external_url: "https://511on.ca/cctv",
    });
  });

  it("maps Florida 511’s documented FeatureServer image record with a canonical source link", () => {
    expect(mapFlorida511Camera({
      attributes: { ID: "1215", DESCRIPT: "I-75 @ MM 350.8 NB", COUNTY: "Marion", HIGHWAY: "I-75", DIRECTION: "N", LATITUDE: 29.1688, LONGITUDE: -82.115, IMAGE: "https://images-dis.divas.cloud/DGI/chan-9422_h.jpg" },
    })).toMatchObject({
      id: "fl511-1215", source: "FDOT Florida 511", refresh_interval_ms: 60_000, external_url: "https://fl511.com/cctv",
    });
  });

  it("maps the Québec government WFS into external-only official source references without transforming the media URL", () => {
    expect(mapQuebec511Camera({
      properties: { IDEcamera: "4057", DescriptionLocalisationEn: "Route 241 at boulevard de Bromont", NomRegionDiffusion: "Estrie", URL_FLUX_DONNEE: "https://www.quebec511.info/Carte/Fenetres/FenetreVideo.html?id=4057" },
      geometry: { coordinates: [-72.64774, 45.32044] },
    })).toMatchObject({
      id: "quebec-511-4057", source: "Québec 511", reference_only: true, feed_url: "", external_url: "https://www.quebec511.info/Carte/Fenetres/FenetreVideo.html?id=4057",
    });
  });

  it("maps the DriveBC open-data camera index with its published cadence and canonical camera link", () => {
    expect(mapDriveBcCamera({
      id: 253,
      name: "John Hart Highway",
      caption: "Highway 97 at Mason Road, looking east.",
      links: { imageDisplay: "/images/253.jpg?t=123" },
      location: { coordinates: [-120.483821, 55.757894] },
      region_name: "Northern",
      update_period_mean: 299,
    })).toMatchObject({
      id: "drivebc-253", source: "DriveBC", refresh_interval_ms: 299_000, external_url: "https://www.drivebc.ca/cameras/253",
    });
  });

  it("parses Toronto's public JSONP camera list without executing the response and constructs its documented image URLs", () => {
    const cameras = parseTorontoTrafficCameras('jsonTMCEarthCamerasCallback({"Data":[{"Number":"8001","Name":"YORK ST & BREMNER BLVD","Latitude":"43.643120","Longitude":"-79.381386","Group":"Arterial"}]})');
    expect(cameras).toHaveLength(1);
    expect(cameras[0]).toMatchObject({
      id: "toronto-8001", source: "City of Toronto", refresh_interval_ms: 60_000,
      feed_url: "https://opendata.toronto.ca/transportation/tmc/rescucameraimages/CameraImages/loc8001.jpg",
    });
  });

  it("maps Ottawa’s public index as an official external-only reference instead of requesting a restricted direct image", () => {
    expect(mapOttawaCameraReference({
      id: 33, camera_number: 49, name: "Booth & Wellington", latitude: 45.416354, longitude: -75.714726, cameraOwner: "CITY",
    })).toMatchObject({
      id: "ottawa-33", source: "City of Ottawa", reference_only: true, feed_url: "", external_url: "https://traffic.ottawa.ca/map/camera?id=49",
    });
  });

  it("maps NSW’s CC-BY public Live Traffic camera index as a periodic provider image", () => {
    expect(mapNswLiveTrafficCamera({
      id: "023651ee-389c-4677-978e-d39b6c24c1e7",
      eventType: "liveCams",
      geometry: { coordinates: [151.10533, -34.02977] },
      properties: { title: "5 Ways (Miranda)", region: "SYD_SOUTH", href: "https://www.livetraffic.com/camera.jpg" },
    })).toMatchObject({
      id: "nsw-live-traffic-023651ee-389c-4677-978e-d39b6c24c1e7", source: "NSW Live Traffic", refresh_interval_ms: 60_000,
    });
  });
});
