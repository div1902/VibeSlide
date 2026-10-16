import type { Bullet, Slide } from "../types";

export interface ExportPage extends Slide {
  sourceSlide: number;
  layout: "title" | "bullets" | "split" | "images";
}

/** Split dense content into continuation slides rather than discarding it. */
function chunks(text: string, limit: number): string[] {
  if (!text) return [];
  const result: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    const boundary = rest.lastIndexOf(" ", limit);
    const cut = boundary > limit / 2 ? boundary : limit;
    result.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) result.push(rest);
  return result;
}

export function layoutDeck(slides: Slide[]): ExportPage[] {
  return slides.flatMap((slide, sourceSlide) => {
    const titleParts = chunks(slide.title, 140);
    const title = titleParts[0] || "";
    const body: Bullet[] = [
      ...titleParts.slice(1).map((text) => ({ text, level: 0 })),
      ...slide.bullets.flatMap((bullet) =>
        chunks(bullet.text, 180).map((text) => ({ ...bullet, text })),
      ),
      ...slide.stats
        .filter((stat) => stat !== slide.title)
        .flatMap((stat) =>
          chunks(stat, 180).map((text) => ({ text, level: 0 })),
        ),
    ];
    const groups: Bullet[][] = [[]];
    for (const bullet of body) {
      const current = groups[groups.length - 1];
      if (
        current.length &&
        (current.length >= 5 ||
          current.reduce((size, item) => size + item.text.length, 0) +
            bullet.text.length >
            650)
      )
        groups.push([]);
      groups[groups.length - 1].push(bullet);
    }
    const pages: ExportPage[] = groups.map((bullets, index) => ({
      title: index ? `${title || "Untitled slide"} — continued` : title,
      bullets,
      stats: [],
      images: [],
      notes: slide.notes,
      sourceSlide,
      layout: sourceSlide === 0 && body.length <= 2 ? "title" : "bullets",
    }));
    if (
      slide.images.length === 1 &&
      groups.length === 1 &&
      body.reduce((size, item) => size + item.text.length, 0) < 300
    ) {
      pages[0].images = [...slide.images];
      pages[0].layout = "split";
    } else {
      for (let index = 0; index < slide.images.length; index += 2)
        pages.push({
          title,
          bullets: [],
          stats: [],
          images: slide.images.slice(index, index + 2),
          notes: slide.notes,
          sourceSlide,
          layout: "images",
        });
    }
    return pages;
  });
}
