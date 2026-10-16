// @vitest-environment node
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { exportPptx } from "./exportPptx";
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
  it("rejects empty decks", async () => {
    await expect(exportPptx([])).rejects.toThrow("no slides");
  });
});
