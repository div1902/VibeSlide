import { File as NodeFile } from "node:buffer";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, parsePptx, PptxParseError } from "./parsePptx";

const p = "http://schemas.openxmlformats.org/presentationml/2006/main";
const a = "http://schemas.openxmlformats.org/drawingml/2006/main";
const r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const rel = "http://schemas.openxmlformats.org/package/2006/relationships";

const text = (content: string, level = 0) =>
  `<a:p><a:pPr lvl="${level}"/><a:r><a:t>${content}</a:t></a:r></a:p>`;
const shape = (paragraphs: string, placeholder = "") =>
  `<p:sp><p:nvSpPr><p:cNvPr id="1" name="Text"/><p:cNvSpPr/><p:nvPr>${placeholder ? `<p:ph type="${placeholder}"/>` : ""}</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`;
const slideXml = (content: string) =>
  `<?xml version="1.0"?><p:sld xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:cSld><p:spTree>${content}</p:spTree></p:cSld></p:sld>`;

function file(bytes: Uint8Array | string, name = "test.pptx"): File {
  return new NodeFile([bytes], name) as unknown as File;
}

function deck() {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
  );
  zip.file("ppt/presentation.xml", `<p:presentation xmlns:p="${p}"/>`);
  return zip;
}

const toFile = async (zip: JSZip) =>
  file(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));

describe("parsePptx", () => {
  it("extracts a real generated fixture, including nested bullets, stats, media, and notes", async () => {
    const bytes = await readFile(resolve("public/sample.pptx"));
    const slides = await parsePptx(file(bytes, "sample.pptx"));
    expect(slides).toHaveLength(4);
    expect(slides[0].title).toBe("A fresh perspective");
    expect(slides[0].notes).toContain("Welcome the team.");
    expect(slides[1].bullets).toEqual([
      { text: "Build things people love", level: 0 },
      { text: "Listen before you ship", level: 1 },
      { text: "Make the details count", level: 0 },
    ]);
    expect(slides[2].stats).toEqual(["42%", "$3.2M"]);
    expect(slides[3].images).toEqual([
      {
        dataUrl: expect.stringMatching(/^data:image\/png;base64,/),
        alt: "An abstract landscape in warm orange and green",
      },
    ]);
    expect(slides[3].notes).not.toMatch(/^4$/);
  });

  it("sorts slide1, slide2, slide10 numerically, regardless of archive entry order", async () => {
    const zip = deck();
    for (const number of [10, 2, 1])
      zip.file(
        `ppt/slides/slide${number}.xml`,
        slideXml(shape(text(`Slide ${number}`))),
      );
    expect(
      (await parsePptx(await toFile(zip))).map((slide) => slide.title),
    ).toEqual(["Slide 1", "Slide 2", "Slide 10"]);
  });

  it("prefers a title placeholder over earlier text, joins styled runs, and decodes XML", async () => {
    const zip = deck();
    zip.file(
      "ppt/slides/slide1.xml",
      slideXml(
        shape(text("Earlier body text", 2)) +
          shape(
            "<a:p><a:r><a:t>Good </a:t></a:r><a:r><a:t>ideas &amp; impact</a:t></a:r></a:p>",
            "title",
          ),
      ),
    );
    expect((await parsePptx(await toFile(zip)))[0]).toMatchObject({
      title: "Good ideas & impact",
      bullets: [{ text: "Earlier body text", level: 2 }],
    });
  });

  it("uses the first paragraph as fallback title and keeps the rest of its text box", async () => {
    const zip = deck();
    zip.file(
      "ppt/slides/slide1.xml",
      slideXml(
        shape(
          text("Fallback title") +
            text("First body line") +
            text("Nested detail", 1),
        ),
      ),
    );
    expect((await parsePptx(await toFile(zip)))[0]).toMatchObject({
      title: "Fallback title",
      bullets: [
        { text: "First body line", level: 0 },
        { text: "Nested detail", level: 1 },
      ],
    });
  });

  it("extracts only standalone stats and leaves prose containing numbers as body text", async () => {
    const zip = deck();
    zip.file(
      "ppt/slides/slide1.xml",
      slideXml(
        shape(text("Results")) +
          shape(
            text("42%") +
              text("$3.2M") +
              text("120") +
              text("Revenue grew 42% this year"),
          ),
      ),
    );
    expect((await parsePptx(await toFile(zip)))[0]).toMatchObject({
      stats: ["42%", "$3.2M", "120"],
      bullets: [{ text: "Revenue grew 42% this year", level: 0 }],
    });
  });

  it("preserves a standalone numeric title in stats as well as the title", async () => {
    const zip = deck();
    zip.file("ppt/slides/slide1.xml", slideXml(shape(text("42%"), "title")));
    expect((await parsePptx(await toFile(zip)))[0]).toMatchObject({
      title: "42%",
      stats: ["42%"],
    });
  });

  it("skips grouped shapes, tables, animations, and footer placeholders", async () => {
    const zip = deck();
    zip.file(
      "ppt/slides/slide1.xml",
      slideXml(
        `<p:grpSp>${shape(text("Grouped content"))}</p:grpSp>` +
          shape(text("Footer"), "ftr") +
          shape(text("Real title")) +
          "<p:graphicFrame/>",
      ),
    );
    expect((await parsePptx(await toFile(zip)))[0]).toEqual({
      title: "Real title",
      bullets: [],
      images: [],
      stats: [],
    });
  });

  it("resolves embedded image relationships and never reads externally linked images", async () => {
    const zip = deck();
    const picture = (id: string) =>
      `<p:pic><p:nvPicPr><p:cNvPr id="2" name="Image" descr="Our logo"/></p:nvPicPr><p:blipFill><a:blip r:embed="${id}"/></p:blipFill></p:pic>`;
    zip.file(
      "ppt/slides/slide1.xml",
      slideXml(shape(text("Images")) + picture("rId1") + picture("rId2")),
    );
    zip.file(
      "ppt/slides/_rels/slide1.xml.rels",
      `<Relationships xmlns="${rel}"><Relationship Id="rId1" Type="${r}/image" Target="../media/logo.png"/><Relationship Id="rId2" Type="${r}/image" Target="https://example.com/private.png" TargetMode="External"/></Relationships>`,
    );
    zip.file("ppt/media/logo.png", new Uint8Array([137, 80, 78, 71]));
    const warnings: string[] = [];
    const [slide] = await parsePptx(await toFile(zip), {
      onWarning: (warning) => warnings.push(warning),
    });
    expect(slide.images).toEqual([
      { dataUrl: "data:image/png;base64,iVBORw==", alt: "Our logo" },
    ]);
    expect(warnings).toEqual([
      "Slide 1: A linked or missing image was skipped.",
    ]);
  });

  it("skips a malformed slide and unsupported images without losing other slides", async () => {
    const zip = deck();
    zip.file("ppt/slides/slide1.xml", "<broken");
    zip.file(
      "ppt/slides/slide2.xml",
      slideXml(
        shape(text("Kept")) +
          '<p:pic><p:blipFill><a:blip r:embed="rId1"/></p:blipFill></p:pic>',
      ),
    );
    zip.file(
      "ppt/slides/_rels/slide2.xml.rels",
      `<Relationships xmlns="${rel}"><Relationship Id="rId1" Type="${r}/image" Target="../media/odd.emf"/></Relationships>`,
    );
    zip.file("ppt/media/odd.emf", "unsupported");
    const warnings: string[] = [];
    expect(
      (
        await parsePptx(await toFile(zip), {
          onWarning: (warning) => warnings.push(warning),
        })
      ).map((slide) => slide.title),
    ).toEqual(["Kept"]);
    expect(warnings).toHaveLength(2);
  });

  it("keeps readable text when the relationships part is damaged", async () => {
    const zip = deck();
    zip.file("ppt/slides/slide1.xml", slideXml(shape(text("Readable"))));
    zip.file("ppt/slides/_rels/slide1.xml.rels", "<broken");
    expect((await parsePptx(await toFile(zip)))[0].title).toBe("Readable");
  });

  it.each(["notes.txt", "old.ppt", "photo.png"])(
    "rejects %s with a friendly type error",
    async (name) => {
      await expect(parsePptx(file("not a deck", name))).rejects.toThrow(
        ".pptx PowerPoint",
      );
    },
  );

  it("rejects empty, oversized, and corrupt decks", async () => {
    await expect(parsePptx(file(""))).rejects.toThrow("empty");
    const large = file("placeholder");
    Object.defineProperty(large, "size", { value: MAX_FILE_BYTES + 1 });
    await expect(parsePptx(large)).rejects.toThrow("over 30 MB");
    await expect(
      parsePptx(file("I am definitely not a ZIP")),
    ).rejects.toBeInstanceOf(PptxParseError);
  });

  it("rejects renamed ZIP files, empty presentations, and decks with no readable slides", async () => {
    const fake = new JSZip();
    fake.file("hello.txt", "hello");
    await expect(parsePptx(await toFile(fake))).rejects.toThrow(
      "not a PowerPoint",
    );
    await expect(parsePptx(await toFile(deck()))).rejects.toThrow("no slides");
    const bad = deck();
    bad.file("ppt/slides/slide1.xml", "<broken");
    await expect(parsePptx(await toFile(bad))).rejects.toThrow(
      "None of the slides",
    );
  });

  it("rejects oversized expanded entries before inflation", async () => {
    const zip = deck();
    zip.file("ppt/slides/slide1.xml", slideXml(shape(text("Title"))));
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const view = new DataView(bytes.buffer);
    for (let offset = 0; offset < bytes.length - 46; offset++) {
      if (view.getUint32(offset, true) === 0x02014b50) {
        view.setUint32(offset + 24, 21 * 1024 * 1024, true);
        break;
      }
    }
    await expect(parsePptx(file(bytes))).rejects.toThrow("safe reading limit");
  });

  it("reports progress through 100% and supports cancellation", async () => {
    const zip = deck();
    zip.file("ppt/slides/slide1.xml", slideXml(shape(text("Title"))));
    const input = await toFile(zip);
    const progress: number[] = [];
    await parsePptx(input, {
      onProgress: ({ percent }) => progress.push(percent),
    });
    expect(progress[0]).toBe(5);
    expect(progress.at(-1)).toBe(100);
    const controller = new AbortController();
    controller.abort();
    await expect(
      parsePptx(input, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("preserves blank slides instead of inventing content and accepts uppercase extensions", async () => {
    const zip = deck();
    zip.file("ppt/slides/slide1.xml", slideXml(""));
    const bytes = await zip.generateAsync({ type: "uint8array" });
    expect(await parsePptx(file(bytes, "DECK.PPTX"))).toEqual([
      { title: "", bullets: [], images: [], stats: [] },
    ]);
  });
});
