# Source ledger

Checked 7 October 2026. Claims and geometry have different evidence sources; a planning source is not a geometry licence or proof that development was completed.

## Vector inputs and rights

### Natural Earth land, coast and city places

Publisher: Natural Earth / NACIS. Public-domain permission was verified at https://www.naturalearthdata.com/about/terms-of-use/ . Their official countries page is https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/ and coastline page https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-coastline/ .

Actual GeoJSON inputs came from the publisher-linked `nvkelso/natural-earth-vector` repository:

- `geojson/ne_10m_admin_0_countries.geojson`
- `geojson/ne_10m_coastline.geojson`
- `geojson/ne_10m_populated_places_simple.geojson`

Repository snapshot SHA: `ca96624a56bd078437bca8184e78163e5039ad19`, dated 2 June 2022. Stable root: https://github.com/nvkelso/natural-earth-vector/tree/ca96624a56bd078437bca8184e78163e5039ad19/geojson . Input SHA-256 fingerprints are saved separately. The publisher pages list admin-0 version 5.1.1 and coastline 4.1.0; this delivery identifies its repository snapshot rather than claiming a newly surveyed 2026 release.

Processing: WGS84 clipping to stated bounds; topology-preserving polygon simplification tolerance 0.00025 degrees; tiny components under 0.000003 square degrees omitted for overview legibility; line simplification at the same tolerance; no redrawing from generated art. Unit is geographic coordinates, not real-time infrastructure or current reclamation.

### OpenStreetMap land/river boundary

Primary database source: https://www.openstreetmap.org/relation/913110 (Hong Kong) and https://www.openstreetmap.org/relation/3464353 (Shenzhen). Two bounded, read-only full-relation requests used the documented OSM 0.6 API. The API is documented at https://wiki.openstreetmap.org/wiki/API_v0.6 .

Snapshots: HK relation version 225 and Shenzhen relation version 152, both with relation timestamp 31 August 2026 03:39:36 UTC, retrieved 7 October 2026. Individual member edits may have other dates. This is an OSM snapshot, not official legal certification.

Selection: the HK relation's ways tagged `boundary=administrative`, English name “Border Guangdong - Hong Kong”, with `maritime` not equal to `yes`. The selected 60 ways merge into one line, bounding box [114.0340851, 22.5023406, 114.2269194, 22.5619630]. The line includes the river boundary; sea-limit segments and leased/port-area polygons are deliberately excluded. Source way IDs are preserved in the separate GeoJSON. Usernames and contributor-account fields are not included in the deliverable data.

Modification: union/merge and simplification tolerance 0.00008 degrees; no positional snapping to Natural Earth. Rights: ODbL 1.0, with attribution and share-alike data requirements. Keep `hk-mainland-land-border-odbl.geojson` available as the derivative data, with its rights/source fields. [OSM copyright](https://www.openstreetmap.org/copyright) · [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

### Place anchors

Wikidata structured-data locations, CC0, checked 7 October 2026. These are approximate place anchors; no precision or legal centroid is implied by decimal conversion from DMS.

- Luohu District, Q1001376: 22°32′44″N, 114°7′44″E. https://www.wikidata.org/wiki/Q1001376
- Futian District, Q572153: 22°31′31″N, 114°3′2″E. https://www.wikidata.org/wiki/Q572153
- Nanshan District, Q533836: 22°30′5.80″N, 113°54′28.12″E. https://www.wikidata.org/wiki/Q533836
- Qianhai, Q10898930: 22°31′8″N, 113°53′57″E. https://www.wikidata.org/wiki/Q10898930
- Lo Wu station, Q15169: 22°31′41.9″N, 114°6′48.2″E. https://www.wikidata.org/wiki/Q15169
- Lok Ma Chau station, Q15170: 22°30′51.8″N, 114°3′56.5″E. https://www.wikidata.org/wiki/Q15170
- Zhongshan, Q59223: 22°32′N, 113°21′E. https://www.wikidata.org/wiki/Q59223

Other GBA city anchors are the Natural Earth populated-places point records. Wikidata pages were readable through web search/open; JSON entity retrieval returned 403 and was not used. Only coordinates and source identity were transcribed. No Wikipedia prose, photographs or map tiles are reused. Wikidata's CC0 notice is stated on the source pages: https://www.wikidata.org/wiki/Wikidata:Licensing .

## Timeline evidence

### 1980s: an early gateway

- Shenzhen Archives official institutional history records SEZ establishment on 26 August 1980: https://www.szdag.gov.cn/dawh/tqssn/content/post_98517.html . Official archive account, readable in search-rendered text; not a contemporaneous census.
- Shenzhen Port Office's 2021 historical exhibition account describes Luohu and Wenjindu gateways and early Luohu development: https://ka.sz.gov.cn/gkmlpt/content/8/8914/post_8914184.html . Full official HTML opened. This supports an early focus, not a claim that a crossing was the sole cause of growth.

### 1996–2004: Futian's civic focus

- Shenzhen government's 5 March 1996 notice, 深府[1996]65号, publishes the November 1995 expert consultation, including Futian-centre functional layout: https://www.sz.gov.cn/zfgb/1996/gb1996/content/post_10134183.html . Full official HTML opened. Planning/advice, not a completed-development count.
- Shenzhen Museum's “古今深圳” account states Civic Centre design selection in 1996, construction from December 1998 and opening in May 2004: https://mobile.shenzhenmuseum.com/motalDetial?clazzName=CmsInformation&resId=db1ab9300ea746fdb737c9ca1a4d8600 . Official museum text available through search; the mobile HTML itself rendered empty. The delivery uses month/year, not an unsupported exact day.

### 2010: Qianhai cooperation planning

- Official Qianhai overall-development plan, published 21 December 2023, recounts August 2010 State Council approval of the 2010–2020 plan and its modern-services/Hong Kong role: https://qh.sz.gov.cn/gkmlpt/content/11/11063/post_11063234.html . Official text inspected. Approval is not construction completion or measured economic success.
- Current official cooperation-zone introduction records the 2021 expansion from 14.92 to 120.56 km²: https://qh.sz.gov.cn/ljszqh/zjqh/qhhzqjj/ . Used only to warn against treating the original locality pin as today's enlarged zone. No polygon is inferred from the area number.

### Adopted 2024, issued 2025: several centres

- Shenzhen Territorial Spatial Master Plan 2021–2035, issued 25 January 2025, posted 20 February 2025; articles 24–27 describe the core and the four functional centres: https://www.sz.gov.cn/cn/xxgk/zfxxgj/ghjh/csgh/zt/content/post_12013111.html . Full HTML read earlier in this research; direct HTTP retry for the attachment returned 502. No uninspected atlas map was traced.
- Official 10 October 2024 press-conference transcript explains successive planning structures and current multiple centres: https://www.sz.gov.cn/cn/xxgk/xwfyr/wqhg/20241010/cn/xxgk/xwfyr/wqhg/20230921_22/zB/content/post_11619983.html . The historical overview explicitly discusses western, central and eastern development axes, a reason to avoid a simplistic single westward progression.

### Two different boundaries

- Shenzhen government historical account: citywide SEZ expansion effective July 2010, followed by management-line removal in 2018: https://www.sz.gov.cn/szstory/202212/content/mpost_10340606.html . Historical institutional chronology.
- State Council 国函〔2018〕3号, dated 6 January and posted 15 January 2018, explicitly distinguishes removal of the internal line from continued Guangdong–HK boundary control: https://app.www.gov.cn/govdata/gov/201801/15/419496/article.html . Official full text read.

## Official visual reference and GBA scope

Hong Kong Education Bureau, February 2022 geography teaching resource, page 2 figure 1: https://www.edb.gov.hk/attachment/en/curriculum-development/kla/pshe/references-and-resources/geography/Overview_E.pdf . Downloaded, rendered and visually inspected. The figure credits Hong Kong C&SD (2017). It establishes broad regional placement; statistics elsewhere in the document are historical and are not carried into the map.

No explicit republication licence for this figure was established, so it is retained only under `sources/` for reference. Our public PNG/SVG maps are independently drawn from permitted vector data, not a screenshot, trace or reproduction of this figure.

The official current GBA overview lists nine mainland municipalities plus HK and Macao: https://www.bayarea.gov.hk/en/about/overview.html . The inset includes those 11 locality labels but not all their municipal territory. It contains no GDP, population or infrastructure-completion claim.

## Sources rejected / limitations retained

- Natural Earth's shared HK/mainland polygon boundary was incomplete for the full river-boundary segment at this zoom. It was not used as the border layer.
- geoBoundaries CHN ADM1 metadata/API was accessible and a coarse file inspected, but its close-up HK geography was unsuitable. No geoBoundaries geometry is in the shipped map.
- The attempted standalone geoBoundaries HKG ADM0 lookup returned 404. No claim that such an endpoint is available.
- PNR's Luohu draft-plan PDF returned 404 and was not used.
- Exact former internal SEZ-line geometry, current detailed coastlines, plan-centre polygons and route alignments remain unverified. Do not fill these gaps with generated geography.
