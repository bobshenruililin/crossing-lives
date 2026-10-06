# Arrival at the table

Two original illustrations generated for Crossing Lives with the built-in image-generation tool on 6 October 2026. The project’s existing city scenes and original adult Jun portrait were the only reference images. The second table scene also used the first generated table composition to keep character and physical objects aligned. No external artist/site art, stock image, real person, restaurant brand or map was supplied.

| Runtime asset | Dimensions | Bytes | SHA-256 |
|---|---|---:|---|
| hong-kong-table.webp | 1671 × 941 | 347,448 | 823942de56ff47fe54a84d29ab3ac209b62502872aa967238a5d4bf935b2e23f |
| shenzhen-table.webp | 1672 × 941 | 374,874 | e98b8003f2969768694ddba0db91d418317d1a8e52b098fccbbbadd75100fef1 |

The generated PNGs were converted to RGB WebP at quality88/method6. No resizing, cropping or semantic postprocessing was applied. Original PNGs are retained outside the runtime package. Both optimized images were visually inspected.

## Direction and limits

A closer, first-person table composition makes the travel commitment visibly change the place. Jun is an ordinary fictional adult friend in a teal overshirt and glasses. The menu, inactive phone and closed wallet are quiet physical props; there are no readable prices, payment details, account balances or bank cards. Cups and empty place settings avoid asserting which meal was ordered. Both cities are treated with equal care, preserving the original awning/harbor or planted-terrace setting.

These are imagined composite places, not photographs of verified restaurants or precise geography. They do not imply that every payment is cash. All functional prices, labels, choices and disclosures remain semantic HTML rather than generated text.

## Shared anchors

Coordinates are percentages of the entire source image, measured from its top-left. The production definitions are in `src/data/scene-art.ts`:

- Jun:46.5%,37.5%
- Menu:33.3%,85%
- Phone:60.1%,80.8%
- Wallet:74.7%,88.2%

Move or scale the image and its controls as one plane. A portrait screen cannot show every prop at full scene height simultaneously; named controls must bring the attended object into view. Avoid placing a second portrait of Jun over the illustrated Jun. Inspect actual mobile dialogue framing so it does not obscure the current subject.

The asset-only inspection is not application or mobile verification. Rendered arrival, prop interactions, reduced-motion transitions and portable decoding require their own browser checks.
