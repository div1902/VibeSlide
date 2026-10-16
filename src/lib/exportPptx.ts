import pptxgen from "pptxgenjs";
import { layoutDeck } from "./layoutEngine";
import type { Slide } from "../types";

export async function exportPptx(
  slides: Slide[],
  onProgress?: (percent: number) => void,
): Promise<ArrayBuffer> {
  if (!slides.length)
    throw new Error("There are no slides to download. Upload a deck first.");
  const deck = new pptxgen();
  deck.layout = "LAYOUT_WIDE";
  deck.author = "VibeSlide";
  deck.subject = "Rebuilt from reviewed presentation content";
  deck.title = slides[0].title || "VibeSlide presentation";
  deck.theme = { headFontFace: "Georgia", bodyFontFace: "Arial" };
  const pages = layoutDeck(slides);
  for (const [index, content] of pages.entries()) {
    const page = deck.addSlide();
    page.background = { color: "F4F0E4" };
    page.addShape(deck.ShapeType.rect, {
      x: 0.65,
      y: 0.5,
      w: 0.65,
      h: 0.07,
      fill: { color: "738B52" },
      line: { transparency: 100 },
    });
    page.addText(content.title, {
      x: 0.65,
      y: 0.85,
      w: 12,
      h: 1.15,
      fontFace: "Georgia",
      fontSize: content.layout === "title" ? 38 : 30,
      color: "283527",
      margin: 0,
      fit: "shrink",
      breakLine: false,
      valign: "middle",
    });
    const bodyWidth = content.layout === "split" ? 5.5 : 11.8;
    const bodyHeight = 4.55;
    const totalLines = content.bullets.reduce(
      (sum, bullet) =>
        sum + Math.max(1, Math.ceil(bullet.text.length / (bodyWidth * 5))),
      0,
    );
    let y = 2.2;
    for (const bullet of content.bullets) {
      const lines = Math.max(
        1,
        Math.ceil(bullet.text.length / (bodyWidth * 5)),
      );
      const h = Math.min(1.5, (bodyHeight * lines) / Math.max(totalLines, 4));
      const indent = Math.min(bullet.level, 8) * 0.22;
      page.addText(bullet.text, {
        x: 0.75 + indent,
        y,
        w: bodyWidth - indent,
        h: h - 0.1,
        fontFace: "Arial",
        fontSize: 22,
        color: "48573F",
        margin: 0,
        valign: "top",
        fit: "shrink",
        bullet: { indent: 14 },
        indentLevel: bullet.level,
        paraSpaceAfter: 8,
      });
      y += h;
    }
    for (const [imageIndex, image] of content.images.entries()) {
      const x =
        content.layout === "split"
          ? 7.1
          : content.images.length === 1
            ? 1.4
            : 0.75 + imageIndex * 6.25;
      const w =
        content.layout === "split"
          ? 5.45
          : content.images.length === 1
            ? 10.5
            : 5.8;
      page.addImage({
        data: image.dataUrl,
        altText: image.alt,
        x,
        y: 2.2,
        w,
        h: 4.55,
        sizing: { type: "contain", w, h: 4.55 },
      });
    }
    page.slideNumber = {
      x: 11.5,
      y: 7.07,
      w: 1.1,
      h: 0.2,
      fontFace: "Arial",
      fontSize: 9,
      color: "737F69",
      align: "right",
      margin: 0,
    };
    if (content.notes) page.addNotes(content.notes);
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
