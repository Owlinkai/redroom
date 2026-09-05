# SkylineWebcams Reference Library

Redroom’s SIGINT webcam library preserves existing operational feeds and adds a global collection of **SkylineWebcams reference cards**. Each Skyline card retains its publicly accessible Skyline live-page URL, which users open on Skyline’s own website.

SkylineWebcams’ published FAQ states that only webcam hosts may embed its live video feed. Its permitted public sharing option is a five-minute-refresh photogram obtained through Skyline’s own Embed workflow. Redroom uses only the provider-issued `embed.skylinewebcams.com/img/{id}.jpg` photogram when that Embed identifier is present on the same camera’s public Share control. The client displays that image directly and reloads it every five minutes; it does not proxy the image, embed Skyline video, fetch arbitrary Skyline thumbnails, or extract direct stream URLs.

The built-in reference catalogue is intentionally regional and extensible rather than claiming a complete, real-time enumeration of every webcam worldwide. Skyline does not publish an official public catalogue API in the material reviewed for this implementation. Of the currently curated valid pages, 43 expose a provider-issued photogram reference and four retain their external-live-source card without an internal image. New source entries must include a verified public page URL, latitude/longitude, short location context, and—where a photogram is used—the identifier exposed by that camera’s official Share → Embed control.

References: [SkylineWebcams directory](https://www.skylinewebcams.com/en.html) and [SkylineWebcams FAQ](https://www.skylinewebcams.com/en/support/faq.html).
