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
