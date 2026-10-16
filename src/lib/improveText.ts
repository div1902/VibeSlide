import type { Slide } from "../types";

export interface TextSuggestion {
  id: string;
  slideIndex: number;
  bulletIndex?: number;
  original: string;
  suggested: string;
  reasons: string[];
}

/** Conservative, English-language edits. No facts, numbers, or claims are invented. */
export function improveText(original: string): {
  text: string;
  reasons: string[];
} {
  let text = original;
  const reasons: string[] = [];
  const rules: [RegExp, string][] = [
    [/\bin order to\b/gi, "to"],
    [/\bat this point in time\b/gi, "now"],
    [/\bdue to the fact that\b/gi, "because"],
    [/\bin the event that\b/gi, "if"],
    [/\bon a regular basis\b/gi, "regularly"],
    [/\bhas the ability to\b/gi, "can"],
    [/\bhave the ability to\b/gi, "can"],
    [/\bis able to\b/gi, "can"],
    [/\bare able to\b/gi, "can"],
    [/\butilize\b/gi, "use"],
    [/\butilizes\b/gi, "uses"],
    [/\butilized\b/gi, "used"],
  ];
  // Preserve quoted wording and URLs verbatim. Suggestions always require review.
  const segments = text.split(/("[^"\n]*"|“[^”\n]*”|https?:\/\/\S+)/g);
  text = segments
    .map((segment, index) => {
      if (index % 2) return segment;
      for (const [pattern, replacement] of rules) {
        segment = segment.replace(pattern, (match: string) => {
          reasons.push(`Use “${replacement}” instead of “${match}”.`);
          if (match === match.toUpperCase()) return replacement.toUpperCase();
          return /^[A-Z]/.test(match)
            ? replacement[0].toUpperCase() + replacement.slice(1)
            : replacement;
        });
      }
      return segment;
    })
    .join("");
  return { text, reasons: [...new Set(reasons)] };
}

export function suggestText(slides: Slide[]): TextSuggestion[] {
  return slides
    .flatMap((slide, slideIndex) => [
      { id: `${slideIndex}:title`, slideIndex, original: slide.title },
      ...slide.bullets.map((bullet, bulletIndex) => ({
        id: `${slideIndex}:bullet:${bulletIndex}`,
        slideIndex,
        bulletIndex,
        original: bullet.text,
      })),
    ])
    .map((field) => {
      const { text, reasons } = improveText(field.original);
      return { ...field, suggested: text, reasons };
    });
}

/** Apply only explicitly accepted edits; leave the extracted deck untouched. */
export function applyTextEdits(
  slides: Slide[],
  edits: Record<string, string>,
): Slide[] {
  return slides.map((slide, index) => ({
    ...slide,
    title: edits[`${index}:title`] ?? slide.title,
    bullets: slide.bullets.map((bullet, bulletIndex) => ({
      ...bullet,
      text: edits[`${index}:bullet:${bulletIndex}`] ?? bullet.text,
    })),
    images: slide.images.map((image) => ({ ...image })),
    stats: [...slide.stats],
  }));
}
