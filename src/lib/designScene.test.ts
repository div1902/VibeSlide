import { describe, expect, it } from "vitest";
import { createScene, recommendDesign, type LayoutChoice } from "./designScene";
import { layoutDeck } from "./layoutEngine";
import { designs } from "../vibes";
import type { Slide } from "../types";

const source: Slide = {
  title: "What we have learned",
  bullets: [
    { text: "Listen before you ship", level: 0 },
    { text: "Make the details count", level: 1 },
  ],
  stats: ["42%"],
  images: [{ dataUrl: "data:image/png;base64,fixture", alt: "Our photo" }],
  notes: "These notes must stay.",
};

describe("shared preview and export scenes", () => {
  for (const design of designs)
    for (const choice of [
      "auto",
      "clean",
      "cards",
      "image",
    ] as LayoutChoice[]) {
      it(`preserves content and stays inside the slide in ${design.id}/${choice}`, () => {
        const before = structuredClone(source);
        const scenes = layoutDeck([source]).map((page) =>
          createScene(page, design.id, choice),
        );
        const texts = scenes.flatMap((scene) =>
          scene.elements.flatMap((element) =>
            element.kind === "text" ? [element.text] : [],
          ),
        );
        expect(texts).toContain(source.title);
        for (const bullet of source.bullets)
          expect(texts).toContain(bullet.text);
        expect(texts).toContain("42%");
        expect(
          scenes.flatMap((scene) =>
            scene.elements.filter((element) => element.kind === "image"),
          ),
        ).toMatchObject(source.images.map((image) => ({ ...image })));
        for (const scene of scenes) {
          expect(scene.notes).toBe(source.notes);
          for (const element of scene.elements) {
            expect(element.x).toBeGreaterThanOrEqual(0);
            expect(element.y).toBeGreaterThanOrEqual(0);
            expect(element.w).toBeGreaterThan(0);
            expect(element.h).toBeGreaterThan(0);
            expect(element.x + element.w).toBeLessThanOrEqual(960);
            expect(element.y + element.h).toBeLessThanOrEqual(540);
          }
        }
        expect(source).toEqual(before);
      });
    }
  it("keeps dense mixed content on one slide and flags small text", () => {
    const dense = {
      ...source,
      bullets: Array.from({ length: 80 }, (_, i) => ({
        text: `Point ${i}: all of this original content remains unchanged`,
        level: i % 9,
      })),
      images: Array.from({ length: 20 }, (_, i) => ({
        ...source.images[0],
        alt: `Image ${i}`,
      })),
    };
    const pages = layoutDeck([dense]);
    expect(pages).toHaveLength(1);
    for (const design of designs) {
      const scene = createScene(pages[0], design.id);
      expect(scene.elements.filter((e) => e.kind === "image")).toHaveLength(20);
      expect(scene.elements.filter((e) => e.kind === "text")).toHaveLength(82);
      expect(scene.issues.length).toBeGreaterThan(0);
      for (const e of scene.elements) {
        expect(e.w).toBeGreaterThan(0);
        expect(e.h).toBeGreaterThan(0);
        expect(e.x + e.w).toBeLessThanOrEqual(960);
        expect(e.y + e.h).toBeLessThanOrEqual(540);
      }
    }
  });
  it("flags content that cannot fit instead of truncating it", () => {
    const text = "An extremely dense document. ".repeat(20000);
    const scene = createScene(
      layoutDeck([{ ...source, images: [], bullets: [{ text, level: 0 }] }])[0],
      "professional",
    );
    expect(scene.overflow).toBe(true);
    expect(
      scene.elements.some((e) => e.kind === "text" && e.text === text),
    ).toBe(true);
  });
  it("suggests purpose from content and allows a general default", () => {
    expect(recommendDesign([{ ...source, title: "Club members" }]).id).toBe(
      "club",
    );
    expect(recommendDesign([{ ...source, title: "Investor pitch" }]).id).toBe(
      "pitch",
    );
    expect(recommendDesign([source]).id).toBe("professional");
  });
  it("changes actual image positions and text arrangements between layouts and purposes", () => {
    const page = layoutDeck([source])[0];
    const professional = createScene(page, "professional", "image");
    const club = createScene(page, "club", "image");
    const clean = createScene(page, "professional", "clean");
    expect(
      professional.elements.find((element) => element.kind === "image")!.x,
    ).not.toBe(club.elements.find((element) => element.kind === "image")!.x);
    expect(
      professional.elements.find((element) => element.kind === "image")!.w,
    ).not.toBe(clean.elements.find((element) => element.kind === "image")!.w);
    const cards = createScene({ ...page, images: [] }, "club", "cards");
    const plain = createScene({ ...page, images: [] }, "club", "clean");
    expect(
      cards.elements.filter((element) => element.kind === "shape").length,
    ).toBeGreaterThan(
      plain.elements.filter((element) => element.kind === "shape").length,
    );
  });
  it("highlights real numbers in pitch decks and keeps picture-only slides together", () => {
    const page = layoutDeck([{ ...source, images: [] }])[0];
    expect(createScene(page, "pitch").label).toBe("Numbers first");
    const images = [
      source.images[0],
      { ...source.images[0], alt: "Second picture" },
    ];
    const pages = layoutDeck([{ ...source, bullets: [], stats: [], images }]);
    expect(pages).toHaveLength(1);
    expect(pages[0].images).toEqual(images);
  });
});
