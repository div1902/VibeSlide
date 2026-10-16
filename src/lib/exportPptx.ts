import pptxgen from "pptxgenjs";
import { layoutDeck } from "./layoutEngine";
import { createScene, type DesignSelection } from "./designScene";
import { getDesign } from "../vibes";
import type { Slide } from "../types";

export async function exportPptx(
  slides: Slide[],
  onProgress?: (percent: number) => void,
  selection: DesignSelection = { designId: "professional", layouts: {} },
): Promise<ArrayBuffer> {
  if (!slides.length)
    throw new Error("There are no slides to download. Upload a deck first.");
  const deck = new pptxgen();
  const design = getDesign(selection.designId);
  deck.layout = "LAYOUT_WIDE";
  deck.author = "VibeSlide";
  deck.subject = `${design.name} — rebuilt from your extracted content`;
  deck.title = slides[0].title || "VibeSlide presentation";
  deck.theme = {
    headFontFace: design.headingFont,
    bodyFontFace: design.bodyFont,
  };
  const pages = layoutDeck(slides);
  for (const [index, content] of pages.entries()) {
    const scene = createScene(
      content,
      selection.designId,
      selection.layouts[content.sourceSlide] ?? "auto",
    );
    if (scene.overflow)
      throw new Error(
        `Slide ${content.sourceSlide + 1} has more text than fits safely. Choose Clean structure or edit the text before downloading.`,
      );
    const page = deck.addSlide();
    page.background = { color: scene.background };
    for (const element of scene.elements) {
      const box = {
        x: element.x / 72,
        y: element.y / 72,
        w: element.w / 72,
        h: element.h / 72,
      };
      if (element.kind === "shape")
        page.addShape(
          element.shape === "ellipse"
            ? deck.ShapeType.ellipse
            : deck.ShapeType.rect,
          {
            ...box,
            fill: { color: element.fill },
            line: { transparency: 100 },
          },
        );
      else if (element.kind === "image")
        page.addImage({
          ...box,
          data: element.dataUrl,
          altText: element.alt,
          sizing: { type: "contain", w: box.w, h: box.h },
        });
      else
        page.addText(element.text, {
          ...box,
          color: element.color,
          fontFace: element.font,
          fontSize: element.size,
          bold: element.bold,
          align: element.align,
          valign: "top",
          margin: 0,
          fit: "shrink",
          lineSpacingMultiple: 1.25,
          breakLine: false,
        });
    }
    if (scene.notes) page.addNotes(scene.notes);
    onProgress?.(Math.round(((index + 1) / pages.length) * 90));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  const data = await deck.write({
    outputType: "arraybuffer",
    compression: true,
  });
  onProgress?.(100);
  return data as ArrayBuffer;
}
