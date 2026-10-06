# Two shores scene artwork

Three original scene images made for this project with the built-in OpenAI image generation tool on 2026-10-06. They were generated specifically for the project, using the first generated scene as an aesthetic reference for the next two. No external image, stock illustration, artist reference, brand identity, or third-party source asset was supplied. These are expressive fictional scenes, not a navigational map or a depiction of a specific restaurant.

## Runtime files

- `two-shores.webp`: 1672 × 941, 558 KB. A fictional harbor panorama connecting warm Hong Kong-style neighborhoods on the left with a modern Shenzhen-style skyline on the right. Broad water corridor through the center.
- `hong-kong-evening.webp`: 1672 × 941, 592 KB. A local restaurant, layered apartment facades, amber lanterns, and harbor twilight. Original generic signs: 茶 and 晚飯.
- `shenzhen-evening.webp`: 1672 × 941, 635 KB. A contemporary tree-lined dining street, teal towers, terraced restaurants and a transit entrance. Original generic restaurant sign: 食.
- `two-shores.svg`: a separate original hand-authored conceptual illustration, 1200 × 660, about 42 KB. Includes its own accessible title and description. Use only if a flatter lightweight alternative is helpful.

The WebP images are the recommended primary runtime assets. All were visually inspected at full generated size. The final WebP files preserve the original dimensions and were encoded at quality 88. Original generated PNGs were kept outside runtime assets to avoid shipping unnecessary megabytes.

## Presentation

Set useful `alt` text on images; visual scene details must not be the only way to understand a choice. Place interactive hotspot buttons in the DOM with independent accessible names. Do not embed buttons or critical UI text in the art.

On a wide view, the entire 16:9 composition works well. On narrow screens, prefer retaining the full panorama or offering an intentionally pannable scene: a severe central crop of the overview would show mostly water. If individual local scenes need cover crops, start around `object-position: 30% center` for Hong Kong and `55% center` for Shenzhen. Foreground left is the primary restaurant anchor in both close-ups.

## Generation direction

Shared direction: original editorial travel-story illustration, rich architectural detail, inviting amber windows, tactile painted/diorama atmosphere, warm cream, deep teal, coral and aged brass. Anonymous everyday adult people; no branded shops or advertising. Edge-to-edge landscape art with breathing room for later DOM hotspots. No UI, captions, title, labels or watermarks.

Overview prompt direction: a wide slightly elevated panorama of two fictional city shores; intimate peach/coral apartment neighborhoods bottom-left, contemporary green/teal glass towers upper-right, beautiful diagonal harbor, gentle islands and hills, tiny ferry and meandering light rail. Architecture frames a relatively clear central water corridor. This is deliberately expressive, not a real geographic map.

Hong Kong prompt direction: a new companion scene using the overview only as aesthetic reference; slightly elevated wide local street dinner view with the layered old neighborhood on the left and harbor on the right. Rounded balconies, air-conditioning units, rooftop tanks, window grilles, plants, red-striped awning, bowls and dishes, money trees, amber lanterns, patterned entry tiles, mint stools, bicycle, anonymous diners. The only requested sign text was 茶 and 晚飯.

Shenzhen prompt direction: a new companion scene using the overview only as aesthetic reference; a modern tree-lined food street at blue-green dusk. Contemporary amber-lit restaurant pavilions left, a broad pedestrian avenue center, lush planters and seating terraces, water feature, subtle transit entrance right, original geometric teal towers above. Lived-in and personable, restrained lighting without cyberpunk or neon overload. The only requested sign text was 食.

No exclusive copyright or trademark clearance is asserted by this note. No third-party asset license was imported into the project.

## Close table compositions

The next arrival-stage pair is documented in [TABLE-ASSETS.md](TABLE-ASSETS.md). It uses only this project’s original city scenes and fictional adult Jun as references, with no third-party art. The shared normalized object anchors are defined in `src/data/scene-art.ts`; rendered mobile framing must be verified separately.
