# Skyline Embed Verification

On 2026-09-05, Skyline’s official FAQ was reviewed alongside the public Times Square camera page. The FAQ states that only webcam hosts may embed live video, while other sites may incorporate a **photogram updating every five minutes** by using the page’s **Embed** sharing option.

The public share dialog was opened on the Times Square page. Its **Embed** control exposed provider-issued HTML that links to the official camera page and uses a non-live image reference at `https://embed.skylinewebcams.com/img/538.jpg`. This is the permitted photogram format for that camera, not a live video or a stream endpoint.

The same page’s public Share control identifies the camera with `w=538` and uses Skyline’s `/cams/share.php` mechanism to create the Embed code. The resulting relationship between the provider-issued share identifier and `https://embed.skylinewebcams.com/img/{id}.jpg` can be used only after the identifier is read from that camera’s own public Share control.

The permitted image must refresh no more frequently than Skyline’s documented five-minute cadence. The original Skyline page remains the canonical external live-source link. Until a provider-issued Embed photogram reference is obtained for a camera, its SIGINT card is treated as an external source reference. No Skyline live stream is embedded, extracted, or proxied.

## SIGINT Test Session

The SIGINT portal loaded its CCTV layer in the browser test session with the privacy disclaimer overlay still open. The underlying page reported 1,716 visible intelligence objects. Camera-detail validation proceeds in a temporary test session after the local acceptance gate is satisfied; it does not change any source configuration or commit state.

The isolated session acceptance flag was then enabled locally for visual testing. The SIGINT shell and night map rendered after reload; the initial asset count was still loading, so the camera-panel check waits for the CCTV query before selecting a test camera.

After the query settled, the map reported 1,716 active intelligence objects and rendered its signal clusters. The browser resource list did not retain a directly named CCTV query URL, so the source response is verified through the local server route before selecting specific test records.

The first direct tRPC probe used a null input and was rejected by the route validator, which expects an object. The browser map remained healthy; the next probe uses the valid empty-object input contract to inspect one existing camera and one Skyline camera.

The valid local CCTV response returned 11,655 cameras. It retained the existing `yt-times-sq` iframe feed unchanged and returned `skyline-times-square` as a periodic image camera with no stream URL, the canonical Skyline page in `sourceRef`, the provider-issued `https://embed.skylinewebcams.com/img/538.jpg` image, and a 300,000 ms refresh interval. In the same browser context, that photogram loaded directly at 450 × 264 pixels with a cache-busting query value, confirming it is available to the client without the CCTV proxy.

The browser camera map was then focused through its existing country-filter control. The visible list did not contain United States in the currently rendered options, so no camera selection was forced through a potentially unrelated map action. The validated response contract and direct browser image load remain the authoritative test evidence for the photogram path.

The opened country filter exposes a standard “Search country…” text control. Its browser index is not available outside the annotated viewport element list, so the subsequent test uses the visible field location rather than changing any camera data or stored configuration.

The coordinate attempt did not focus the country-search field and invoked the existing keyboard drawing shortcut instead. It did not alter the camera library, source data, or implementation; the camera behavior is therefore validated through the focused response, direct browser image load, and automated player-safety tests rather than further map automation.

For the remaining rendered-player check, the isolated browser session’s React tree was inspected only to identify the SIGINT page component and its existing local detail state. This does not expose or modify user data; it permits the test session to render a known camera record using the platform’s normal detail-panel components instead of changing the map’s source data.

The rendered SIGINT camera panel was successfully opened for Skyline Times Square. It displayed the provider photogram rather than a blank player, labelled the feed as a five-minute provider photogram, exposed the official Skyline page as the source link, and showed the existing location-context row. The panel did not expose or use a live stream URL.

The same rendered panel was then opened for the preserved `yt-times-sq` YouTube iframe feed. It continued to present its real-time embedded-video state and the canonical YouTube source link, confirming the Skyline path did not replace or degrade the existing player presentation.
