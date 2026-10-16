import type { Slide } from "../types";

export interface ExportPage extends Slide {
  sourceSlide: number;
  layout: "title" | "bullets" | "split" | "images";
}

/** Exactly one output page per input slide. Never split, truncate, or merge content. */
export function layoutDeck(slides: Slide[]): ExportPage[] {
  return slides.map((slide, sourceSlide) => ({
    ...slide,
    sourceSlide,
    bullets: [
      ...slide.bullets.map((bullet) => ({ ...bullet })),
      ...slide.stats
        .filter((text, index) => index !== 0 || text !== slide.title)
        .map((text) => ({ text, level: 0 })),
    ],
    stats: [],
    images: slide.images.map((image) => ({ ...image })),
    layout: slide.images.length
      ? slide.bullets.length || slide.stats.length
        ? "split"
        : "images"
      : sourceSlide === 0 && slide.bullets.length <= 2
        ? "title"
        : "bullets",
  }));
}

/** Select complete slides in source order; never treat a screenshot as a deck. */
export function selectSlides(slides: Slide[], scope = "all"): Slide[] {
  if (!scope.trim() || scope.trim().toLowerCase() === "all") return slides;
  const indices = new Set<number>();
  for (const part of scope.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("Use “all” or slide numbers such as 1-3, 5.");
    const start = Number(match[1]),
      end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > slides.length)
      throw new Error(`Choose slide numbers between 1 and ${slides.length}.`);
    for (let i = start; i <= end; i++) indices.add(i - 1);
  }
  return slides.filter((_, index) => indices.has(index));
}
