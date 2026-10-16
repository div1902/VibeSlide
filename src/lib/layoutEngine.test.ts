import { describe, expect, it } from "vitest";
import { layoutDeck, selectSlides } from "./layoutEngine";
import type { Slide } from "../types";
const base: Slide = {
  title: "A clear story",
  bullets: [],
  stats: [],
  images: [],
  notes: "Keep this note.",
};
describe("PowerPoint layouts", () => {
  it("selects title and image layouts from content", () => {
    expect(layoutDeck([base])[0].layout).toBe("title");
    expect(
      layoutDeck([{ ...base, images: [{ dataUrl: "image", alt: "photo" }] }])[0]
        .layout,
    ).toBe("images");
  });
  it("keeps dense slides together without losing content", () => {
    const slide = {
      ...base,
      bullets: Array.from({ length: 13 }, (_, i) => ({
        text: `Point ${i}`,
        level: i % 3,
      })),
      stats: ["42%", "$3.2M"],
      images: Array.from({ length: 5 }, (_, i) => ({
        dataUrl: `image${i}`,
        alt: `${i}`,
      })),
    };
    const pages = layoutDeck([slide]);
    expect(pages).toHaveLength(1);
    expect(pages.flatMap((page) => page.bullets).slice(0, 13)).toEqual(
      slide.bullets,
    );
    expect(
      pages
        .flatMap((page) => page.bullets)
        .slice(13)
        .map((bullet) => bullet.text),
    ).toEqual(slide.stats);
    expect(pages.flatMap((page) => page.images)).toEqual(slide.images);
    expect(pages.every((page) => page.notes === base.notes)).toBe(true);
  });
  it("preserves long text verbatim without adding pages", () => {
    const text = "A useful point with detail. ".repeat(120).trim();
    const pages = layoutDeck([{ ...base, bullets: [{ text, level: 2 }] }]);
    expect(
      pages
        .flatMap((page) => page.bullets)
        .map((bullet) => bullet.text)
        .join(" "),
    ).toBe(text);
  });
});

describe("slide selection", () => {
  const slides = Array.from({ length: 6 }, (_, i) => ({
    ...base,
    title: `Slide ${i + 1}`,
  }));
  it("keeps selected slides in source order, with no duplicates", () => {
    expect(selectSlides(slides, "5, 1-3, 2").map((s) => s.title)).toEqual([
      "Slide 1",
      "Slide 2",
      "Slide 3",
      "Slide 5",
    ]);
    expect(layoutDeck(selectSlides(slides, "1, 3-4"))).toHaveLength(3);
    expect(selectSlides(slides, " all ")).toEqual(slides);
  });
  it.each(["0", "7", "4-2", "1,x", "1-99999", "-1", "2,"])(
    "rejects invalid scope %s",
    (scope) => {
      expect(() => selectSlides(slides, scope)).toThrow();
    },
  );
  it("does not duplicate a number already used as the title", () => {
    expect(
      layoutDeck([{ ...base, title: "42%", stats: ["42%", "19%"] }])[0].bullets,
    ).toEqual([{ text: "19%", level: 0 }]);
  });
});
