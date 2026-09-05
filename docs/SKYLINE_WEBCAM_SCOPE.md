# SkylineWebcams Reference Library

Redroom’s SIGINT webcam library preserves existing operational feeds and adds a global collection of **SkylineWebcams reference cards**. Each Skyline card retains its publicly accessible Skyline live-page URL, which users open on Skyline’s own website.

SkylineWebcams’ published FAQ states that only webcam hosts may embed its live video feed. Its permitted public sharing option is a five-minute-refresh photogram obtained through Skyline’s own Embed workflow. Redroom uses only the provider-issued `embed.skylinewebcams.com/img/{id}.jpg` photogram when that Embed identifier is present on the same camera’s public Share control. The client displays that image directly and reloads it every five minutes; it does not proxy the image, embed Skyline video, fetch arbitrary Skyline thumbnails, or extract direct stream URLs.

The built-in reference catalogue is intentionally regional and extensible rather than claiming a complete, real-time enumeration of every webcam worldwide. Skyline does not publish an official public catalogue API in the material reviewed for this implementation. Of the currently curated valid pages, 43 expose a provider-issued photogram reference and four retain their external-live-source card without an internal image. New source entries must include a verified public page URL, latitude/longitude, short location context, and—where a photogram is used—the identifier exposed by that camera’s official Share → Embed control.

References: [SkylineWebcams directory](https://www.skylinewebcams.com/en.html) and [SkylineWebcams FAQ](https://www.skylinewebcams.com/en/support/faq.html).

## Human-facing source-action policy

The visible camera action must never open a JSON, XML, JavaScript, ArcGIS FeatureServer, or other machine-readable catalogue endpoint. A provider index may be read by the server to discover cameras, but it is not a user-facing destination. Camera records therefore use an official traffic-camera map, an official camera-viewer page, a per-camera official viewer, or—only when the authority does not maintain a user-facing viewer—the provider-hosted current camera image itself.

The legacy TfL traffic-camera route returned a provider 404 during verification, so TfL JamCam records now link to their official per-camera current image rather than the `api.tfl.gov.uk` index. Hong Kong Transport Department records link to the official HKeMobility Traffic Snapshot page, which renders the public camera map and snapshots for users rather than returning the underlying data feed.

Fintraffic records link to the official `liikennetilanne.fintraffic.fi/pulssi/` visual traffic service rather than the `tie.digitraffic.fi/api/weathercam/v1/stations` discovery index. The viewer’s title resolves as `Liikennetilanne`; its data-heavy map did not render interactive elements in the isolated test browser, but it does not return the API payload that previously reached users. The isolated Redroom preview session likewise remained blank before its application gate was completed, so link routing is covered by source-action unit and integration tests in addition to the provider-page checks.

Representative action checks confirm that a TfL JamCam action renders the provider-hosted current road image rather than the TfL API index. The official LTA OneMotoring traffic-camera page resolved to its government maintenance page during the provider's scheduled maintenance window; it remains the designated human-facing official viewer and did not return the `api.data.gov.sg` camera payload.

The database-backed NYSDOT 511 records now resolve from their former `511ny.org/api/getcameras` index to `511ny.org`, the public interactive 511NY map. The verified page exposes a dedicated **Cameras** map layer for users and does not present a JSON response.
