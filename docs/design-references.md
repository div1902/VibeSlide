# Design references and original layout rules

Reviewed on 2026-10-16. These are curated design references, **not model training, a downloaded template dataset, or a claim to reproduce any author's theme**. VibeSlide has no AI inference service. We studied published theme sources and implemented our own palettes and shared geometry. No external theme assets or web fonts are shipped.

| Source reviewed                                                                                                            | Concrete observation                                                                                      | Applied in VibeSlide                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Marp default theme](https://github.com/marp-team/marp-core/blob/main/themes/default.scss)                                 | Restrained hierarchy, consistent padding, bounded content, and a straightforward reading order            | Professional uses fixed margins, restrained decoration, clean columns, and Arial.                                                                                        |
| [Marp Gaia](https://github.com/marp-team/marp-core/blob/main/themes/gaia.scss)                                             | A coordinated light/dark color system, distinct heading scale, generous spacing, and prominent quotations | Club uses coordinated surfaces and accents, larger display headings, separate idea cards, and picture-led layouts.                                                       |
| [Reveal.js serif](https://github.com/hakimel/reveal.js/blob/e240e175232fa2de660a02bc0d7bf5f655b159bb/css/theme/serif.scss) | Warm paper-like background, dark brown text, and natural-case serif typography                            | Editorial combines warm cream, Georgia headings, fine divider rules, and images on the left.                                                                             |
| [Reveal.js night](https://github.com/hakimel/reveal.js/blob/e240e175232fa2de660a02bc0d7bf5f655b159bb/css/theme/night.scss) | Near-black background, bright text, a restrained warm accent, and strong headline contrast                | Dark Luxury uses near-black, gold rules, Georgia headlines, and calmer cover alignment. Pitch uses a different high-contrast sans palette to emphasize existing numbers. |

The Reveal.js sources are MIT-licensed; Marp publishes its theme sources in its public repository. This implementation cites design observations rather than copying theme code. Remote fonts referenced by examples are not imported. Terminal's monospaced grid is an original configuration using Courier New. Professional/Club/Pitch purpose recommendations are keyword heuristics and are always overridable.

## How the vibes differ

| Vibe               | Typography and color                              | Layout decisions                                                                |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| Professional       | Arial, cool light surfaces, navy, blue            | Left accent rail, fixed hierarchy, restrained cards, pictures on the right      |
| Club Presentation  | Impact headings, Arial body, lilac and orange     | Circular decoration, narrower headlines, picture on the left, poster-like cards |
| Pitch Deck         | Arial, dark navy, lime and teal                   | Centered cover, large existing stats, short supporting text                     |
| Editorial Magazine | Georgia headings, Arial body, cream and rust      | Fine rules, left-side images, strong serif hierarchy                            |
| Dark Luxury        | Georgia headings, Arial body, near-black and gold | Fine top/bottom framing, balanced cover, restrained surfaces                    |
| Retro Terminal     | Courier New, dark green and bright green          | Mono rhythm, straight rules, structured columns                                 |

## Practical improvements implemented

1. Show the same actual slide in each vibe card; compare content instead of unrelated placeholder examples.
2. Suggest a purpose from existing language, while letting the user choose any vibe and override each slide's layout.
3. Choose picture-led layouts when pictures exist, cards for short groups of points, and columns for dense text. Pitch layouts can foreground existing figures without inventing claims.
4. Retain every extracted picture in a contained grid and preserve text verbatim. There is no automatic rewriting, cropping, continuation-page generation, or deletion to make a layout fit.
5. Use the same scene for SVG/HTML preview and PPTX geometry, including text boxes, font sizes, image bounds, and palette.
6. Surface density warnings, block estimated overflow, allow selected-page ranges, and display input/output slide counts.

Future work remains distinct: original-file visual rendering, stronger grouped-object support, font-metric calibration against actual Office rendering, and an editor-host acceptance suite. Internet examples alone cannot validate those behaviors.
