// @vitest-environment node
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { exportPptx } from "./exportPptx";
import { createScene } from "./designScene";
import { layoutDeck } from "./layoutEngine";
import { designs } from "../vibes";
describe("PowerPoint export", () => {
  it("creates a real wide-screen deck with selected text, notes, and media", async () => {
    const fixture = await JSZip.loadAsync(await readFile("public/sample.pptx"));
    const image = Object.keys(fixture.files).find((path) =>
      /ppt\/media\/.*\.png$/.test(path),
    )!;
    const dataUrl = `data:image/png;base64,${await fixture.file(image)!.async("base64")}`;
    const progress: number[] = [];
    const data = await exportPptx(
      [
        {
          title: "Reviewed & ready",
          bullets: [{ text: "We use $3.2M to grow.", level: 1 }],
          stats: ["42%"],
          images: [{ dataUrl, alt: "Landscape" }],
          notes: "Keep these notes.",
        },
      ],
      (value) => progress.push(value),
    );
    const output = await JSZip.loadAsync(data);
    expect(
      await output.file("ppt/slides/slide1.xml")!.async("string"),
    ).toContain("We use $3.2M to grow.");
    expect(
      await output.file("ppt/slides/slide1.xml")!.async("string"),
    ).toContain("42%");
    expect(
      await output.file("ppt/notesSlides/notesSlide1.xml")!.async("string"),
    ).toContain("Keep these notes.");
    expect(
      await output.file("ppt/presentation.xml")!.async("string"),
    ).toContain('cx="12192000" cy="6858000"');
    expect(
      Object.keys(output.files).some(
        (path) => path.startsWith("ppt/media/") && path.endsWith(".png"),
      ),
    ).toBe(true);
    expect(progress.at(-1)).toBe(100);
  });
  it("exports one slide per input, including dense and empty slides", async () => {
    const slides = [
      {
        title: "Dense slide",
        bullets: Array.from({ length: 13 }, (_, i) => ({
          text: `Point ${i}`,
          level: i % 3,
        })),
        stats: ["42%"],
        images: [],
        notes: "Keep this note",
      },
      { title: "", bullets: [], stats: [], images: [] },
      {
        title: "End",
        bullets: [{ text: "Same words", level: 0 }],
        stats: [],
        images: [],
      },
    ];
    const output = await JSZip.loadAsync(await exportPptx(slides));
    expect(
      Object.keys(output.files).filter((p) =>
        /^ppt\/slides\/slide\d+\.xml$/.test(p),
      ),
    ).toHaveLength(3);
    const first = await output.file("ppt/slides/slide1.xml")!.async("string");
    for (const b of slides[0].bullets) expect(first).toContain(b.text);
    expect(first).toContain("42%");
    expect(
      await output.file("ppt/slides/slide2.xml")!.async("string"),
    ).not.toContain("<a:t>");
  });
  it("refuses unsafe estimated overflow", async () => {
    await expect(
      exportPptx([
        {
          title: "Full",
          bullets: [{ text: "too much content ".repeat(20000), level: 0 }],
          images: [],
          stats: [],
        },
      ]),
    ).rejects.toThrow("more text than fits");
  });
  it("rejects empty decks", async () => {
    await expect(exportPptx([])).rejects.toThrow("no slides");
  });
  for (const design of designs)
    it(`writes ${design.id} preview text, colors, and geometry to the deck`, async () => {
      const slides = [
        {
          title: "Same story",
          bullets: [
            { text: "Build what matters", level: 0 },
            { text: "Keep every detail", level: 0 },
          ],
          images: [],
          stats: [],
          notes: "Keep notes",
        },
      ];
      const scene = createScene(layoutDeck(slides)[0], design.id, "cards");
      const data = await exportPptx(slides, undefined, {
        designId: design.id,
        layouts: { 0: "cards" },
      });
      const zip = await JSZip.loadAsync(data);
      const xml = await zip.file("ppt/slides/slide1.xml")!.async("string");
      expect(xml).toContain(`val="${scene.background}"`);
      for (const element of scene.elements)
        if (element.kind === "text") {
          expect(xml).toContain(element.text);
          expect(xml).toContain(`typeface="${element.font}"`);
          expect(xml).toContain(
            `x="${Math.round(element.x * 12700)}" y="${Math.round(element.y * 12700)}"`,
          );
        }
    });
});
