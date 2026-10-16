import { describe, expect, it } from "vitest";
import { layoutDeck } from "./layoutEngine";
import type { Slide } from "../types";
const base: Slide = {
  title: "A clear story",
  bullets: [],
  stats: [],
  images: [],
  notes: "Keep this note.",
};
describe("PowerPoint layouts", () => {
  it("selects title and split layouts from content", () => {
    expect(layoutDeck([base])[0].layout).toBe("title");
    expect(
      layoutDeck([{ ...base, images: [{ dataUrl: "image", alt: "photo" }] }])[0]
        .layout,
    ).toBe("split");
  });
  it("paginates without losing content", () => {
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
    expect(pages.length).toBeGreaterThan(1);
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
    expect(
      pages.every(
        (page) => page.notes === base.notes && page.bullets.length <= 5,
      ),
    ).toBe(true);
  });
  it("preserves long text across continuation pages", () => {
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
