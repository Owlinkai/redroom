# OsirisAI CCTV Comparative Research

## Initial public documentation observations

On 5 September 2026, the public OsirisAI documentation described three CCTV-related endpoints: `GET /api/cctv` for public camera networks with optional region or radius filters, `GET /api/cctv/stream-status` for checking camera reachability before opening a player, and `GET /api/cctv/proxy` as a same-origin stream proxy for upstream sources with restrictive browser CORS policies.

The public overview also states that its API normalizes upstream feeds and handles differences in format, rate limits, and CORS before returning consistent JSON to the browser. The documentation visible at this stage does not identify SkylineWebcams as a provider or establish any right to proxy its live streams.

## Working constraint

This comparison will use the public endpoint only to understand its returned catalogue shape and attribution. Redroom will not copy a provider-specific stream-proxy technique for SkylineWebcams unless Skyline itself explicitly authorizes that delivery model.

## Public endpoint result

The public `https://osirisai.live/api/cctv` response exposed **34,969** camera records at the time of inspection. Its largest providers were public transport and road-camera networks rather than SkylineWebcams; the response contained **681** entries attributed to `SkylineWebcams`.

Representative Skyline records use `id`, latitude/longitude, name, city, country, `external_url`, and, only in some cases, `feed_url`. Where a feed URL is supplied, the observed pattern is a same-origin Osiris proxy request for a `cdn.skylinewebcams.com/live*.jpg` URL. Other Skyline entries expose only the external Skyline page. This is materially different from Skyline’s documented third-party photogram Embed path and does not constitute evidence of authorization to proxy Skyline imagery.

The apparent scale is therefore principally an aggregation strategy spanning many official traffic-camera networks; Skyline represents roughly two percent of the observed records, not the bulk of the catalogue.

## Public repository evidence

OsirisAI links to the public MIT-licensed repository `simplifaisoul/osiris`. Its public history describes the scale method as an aggregation of official, keyless traffic-authority indexes, supplemented by smaller manually curated public-webcam groups. A documented expansion added 1,124 Oregon TripCheck cameras, 806 Michigan MiDrive cameras, and 257 New Zealand NZTA cameras, plus 341 curated public webcams across 41 countries. The same public history describes a 30-minute cache for camera indexes, in-flight request de-duplication, stale-on-error handling, and compressed aggregate API responses.

This confirms that the scalable portion worth adopting is a **source-adapter architecture for official network indexes**, not a bulk Skyline import. It also confirms the observed Skyline `live*.jpg` handling is implemented through a same-origin proxy; Redroom will not reproduce that provider-specific behavior without a verified Skyline authorization.

## Redroom adoption decision

Redroom adopts the safe, provider-neutral parts of the observed architecture: independent index adapters, bounded request times, parallel collection, in-flight request de-duplication, independent 30-minute index caches, stale-on-error fallback, direct periodic images from official authorities, and a canonical provider link on every card.

The first independently verified adapters are ODOT TripCheck (1,149 public index records observed), Caltrans QuickMap (2,000 records observed), and NZTA Waka Kotahi (319 public index records observed). Redroom does **not** import or proxy OsirisAI’s generated Skyline list. Skyline remains constrained to the provider-issued five-minute Embed photogram or external-only link model described in `SKYLINE_WEBCAM_SCOPE.md`.

After the adapters were added, the SIGINT preview completed its normal initial load and restored active map clusters without an application error. The aggregate uses the existing visual clustering and player display; the next validation step is to read the returned source counts directly, rather than infer camera totals from the map’s cluster labels.

An early response check was made before the new adapters were wired into the active aggregation fan-out. After wiring, the live adapter diagnostic returned 1,131 ODOT TripCheck, 1,969 Caltrans QuickMap, and 249 NZTA Waka Kotahi records, in addition to the 47 retained Skyline references. The combined SIGINT response then returned **16,610** cameras. It includes 2,259 ODOT-labelled records because the existing database already held 1,128 ODOT records; every newly surfaced official provider record has a canonical source link.

## Public catalogue composition snapshot

At the time of inspection, the OsirisAI public CCTV response held **34,969** records from **147** labels. The source mix was 31,169 periodic-image records, 3,340 stream records, and 460 external-link-only references. Its five largest sources were FDOT (4,953), GDOT (4,043), Taiwan Highway Bureau (2,163), UDOT (2,075), and Caltrans (2,000). The next group comprised DGT Spain (1,917), ASFINAG (1,806), NCDOT (1,139), ODOT TripCheck (1,131), DriveBC (1,062), Hong Kong Transport Department (1,013), 511 Ontario (947), TfL (890), Fintraffic (811), and MDOT MiDrive (804). SkylineWebcams was 681 records (1.95% of the observed catalogue).

This confirms the remaining volume is primarily traffic-authority camera coverage. It also includes an aggregator-labelled OpenCCTV segment and smaller curated sources, which require separate provider and permission review rather than bulk reuse.

## First all-provider expansion cohort

The provider inventory and direct endpoint checks identify a first independent cohort that does not need the OsirisAI aggregate, its proxy, or a private API key. DGT Spain publishes a current JSON camera index with direct image addresses; THB Taiwan publishes a keyless CCTV index and its national open-data licence allows reuse with attribution; Hong Kong's open-data terms permit reproduction and distribution, including commercial use, with proper source acknowledgement; Fintraffic licenses its data under CC BY 4.0; and Singapore's public transport image endpoint returned current camera data. NSW Live Traffic's current public feed was also technically reachable and will receive a separate terms review before admission.

The direct endpoint verifier returned HTTP 200 for DGT, THB, Hong Kong Transport Department, Fintraffic, LTA Singapore, and NSW Live Traffic. The Iceland road-camera endpoint was not reachable from this environment, so it stays excluded pending a provider-compatible access path. Direct reachability is a technical observation, not a replacement for the documented licence and attribution conditions.

Washington State's official camera FeatureServer explicitly supports JSON and GeoJSON queries, exposes public camera image URLs, and states that its camera imagery refreshes approximately every five minutes. Florida's published FL511 FeatureServer exposes a queryable camera layer in WGS84 and its official FL511 site provides an Embed Map workflow with a selectable Traffic Cameras layer. These are the direct authority resources used for the independent Redroom adapter assessment; no OsirisAI data or proxy endpoint is used.

Ontario 511 documents a free developer API that provides cameras and throttles at ten calls per sixty seconds; the Government of Ontario camera dataset is published under the Open Government Licence – Ontario. Québec's authoritative camera WFS lists 678 traffic cameras, makes each official viewer URL available, and is licensed CC BY 4.0. DriveBC HighwayCams is published by the Government of British Columbia under OGL-BC and includes camera pages, images, update metadata, and WGS84 locations. Toronto's traffic-camera dataset is licensed under the Open Government Licence – Toronto; the City documents both its location list and direct `loc{number}.jpg` image convention. Ottawa permits third-party use of its camera data but requests developer registration and instructs public-distribution applications to serve camera images from developer infrastructure, so Redroom includes its locations as external-only references. Transport for NSW publishes a CC-BY Live Traffic Cameras dataset and a public camera feed, while Michigan MDOT describes MiDrive as its official camera map but directs real-time data consumers to its authenticated RIDE service; Michigan therefore remains outside the direct-adapter cohort pending an authorized public feed.

Rijkswaterstaat's current open-data policy permits public reuse of its open data. However, the legacy `https://opendata.ndw.nu/cameras.json` endpoint used by the comparative implementation now returns HTTP 404, and the official source does not identify a current compatible camera-index replacement in the reviewed material. The Netherlands adapter is therefore deliberately not added until a live, documented successor endpoint is verified.

### Full published catalogue inventory and admission boundary

The public OsirisAI response reported 147 provider labels and 34,969 camera records. Its high-volume named sources are FDOT (4,953), GDOT (4,043), THB Highway Bureau (2,163), UDOT (2,075), Caltrans (2,000), DGT (1,917), ASFINAG (1,806), NCDOT (1,139), ODOT TripCheck (1,131), DriveBC (1,062), Hong Kong Transport Department (1,013), Ontario 511 (947), TfL (890), Fintraffic (811), MDOT MiDrive (804), INDOT TrafficWise (707), SkylineWebcams (681), Québec 511 (678), ADOT (644), NDOT (640), Vegagerðin (500), City of Ottawa (428), City of Toronto (336), LADOTD (336), NZTA (246), Live Traffic NSW (217), and a long tail of 119 labels representing fewer than 200 records each.

Redroom admits an underlying source only where it has a verified official index and a documented compatible access/reuse pathway. The direct/attributed adapter cohort contains ODOT, Caltrans, NZTA, DGT, THB, Hong Kong Transport Department, Fintraffic, LTA Singapore, WSDOT, Ontario 511, Florida 511, Québec 511, DriveBC, City of Toronto, City of Ottawa as external references, and NSW Live Traffic. Skyline is a distinct provider-limited category: only its permitted five-minute photogram output or an external official page is used.

The following groups remain intentionally outside Redroom’s dynamic catalogue: sources that explicitly require a developer key or account (GDOT, UDOT, NCDOT, Alberta 511, Nevada 511, and Michigan RIDE); sources where the formerly published endpoint is retired or inaccessible (the legacy NDW camera endpoint and Iceland at the time of review); and all OpenCCTV/third-party aggregator labels. The third category is excluded because an aggregator’s label does not establish a redistributable licence or a direct official-source chain for each underlying camera. Individually identified small public webcam services remain candidates only after their own provider terms and technical delivery model are independently reviewed.

The NSW Government’s CC-BY dataset page identifies the official camera data model (GPS coordinates, image URL, and view description), but its archived direct-download endpoint returned HTTP 403 from this environment. Redroom therefore reads the separate public Live Traffic map feed operated by the same Transport for NSW service. It is clearly attributed as `NSW Live Traffic`, uses a conservative periodic-image cadence, and is not represented as an unauthorised copy of the blocked download resource.

The full 147-label provider inventory, with snapshot count, delivery class, official-origin status, and admission rationale, is maintained as the supporting review artifact `osiris_provider_admission_register.md` outside the deployable project workspace. It is research evidence only and is never used as a runtime source or copied camera catalogue.
