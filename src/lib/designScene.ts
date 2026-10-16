import type { ExportPage } from "./layoutEngine";
import type { Slide } from "../types";
import { getDesign, type DesignId } from "../vibes";

export type LayoutChoice = "auto" | "clean" | "cards" | "image";
export interface DesignSelection {
  designId: DesignId;
  layouts: Record<number, LayoutChoice>;
}
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type SceneElement =
  | (Box & { kind: "shape"; shape: "rect" | "ellipse"; fill: string })
  | (Box & {
      kind: "text";
      text: string;
      color: string;
      font: string;
      size: number;
      bold: boolean;
      align: "left" | "center" | "right";
    })
  | (Box & { kind: "image"; dataUrl: string; alt: string });
export interface SlideScene {
  background: string;
  elements: SceneElement[];
  label: string;
  reason: string;
  notes?: string;
  sourceSlide: number;
}

// All geometry uses points on a 960 × 540 (16:9) canvas. The PPTX writer
// converts these same boxes to inches; the HTML preview uses them directly.
function fit(text: string, w: number, h: number, preferred: number): number {
  for (let size = preferred; size >= 9; size--) {
    const capacity = Math.max(1, Math.floor(w / (size * 0.57)));
    let lines = 0;
    for (const paragraph of text.split("\n")) {
      let used = 0;
      lines++;
      for (const word of paragraph.split(/\s+/)) {
        if (used && used + word.length + 1 > capacity) {
          lines++;
          used = 0;
        }
        lines += Math.max(0, Math.ceil(word.length / capacity) - 1);
        used =
          word.length > capacity
            ? word.length % capacity
            : used + word.length + (used ? 1 : 0);
      }
    }
    if (lines * size * 1.25 <= h) return size;
  }
  return 9;
}

export function recommendDesign(slides: Slide[]): {
  id: DesignId;
  reason: string;
} {
  const content = slides
    .map((slide) =>
      [slide.title, ...slide.bullets.map((b) => b.text)].join(" "),
    )
    .join(" ");
  if (
    /\b(club|community|members|volunteer|festival|society|campus)\b/i.test(
      content,
    )
  )
    return {
      id: "club",
      reason:
        "Your deck mentions a community or club. A welcoming, picture-led style may fit.",
    };
  if (
    /\b(investor|fundraising|startup|traction|pitch|market opportunity|seed round)\b/i.test(
      content,
    )
  )
    return {
      id: "pitch",
      reason:
        "Your deck includes pitching language. Strong headlines and highlighted numbers may fit.",
    };
  return {
    id: "professional",
    reason:
      "A clear, versatile starting point for your content. Choose the purpose that fits your audience.",
  };
}

export function createScene(
  page: ExportPage,
  designId: DesignId,
  choice: LayoutChoice = "auto",
): SlideScene {
  const design = getDesign(designId);
  const p = design.palette;
  const elements: SceneElement[] = [];
  const shape = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    type: "rect" | "ellipse" = "rect",
  ) => elements.push({ kind: "shape", shape: type, x, y, w, h, fill });
  const text = (
    value: string,
    x: number,
    y: number,
    w: number,
    h: number,
    size: number,
    color = p.text,
    heading = false,
    align: "left" | "center" | "right" = "left",
  ) => {
    if (value)
      elements.push({
        kind: "text",
        text: value,
        x,
        y,
        w,
        h,
        size: fit(value, w, h, size),
        color,
        font: heading ? design.headingFont : design.bodyFont,
        bold: heading,
        align,
      });
  };
  const image = (index: number, x: number, y: number, w: number, h: number) => {
    const asset = page.images[index];
    if (asset) elements.push({ kind: "image", ...asset, x, y, w, h });
  };
  const numeric = (value: string) =>
    /^[+−-]?\s*[$€£¥₹]?\s*\d[\d,.]*(?:\s*(?:%|[kmbt](?:illion)?|x|×))?\s*\+?$/i.test(
      value,
    );
  const short =
    page.bullets.length >= 2 &&
    page.bullets.length <= 4 &&
    page.bullets.every((b) => b.text.split(/\s+/).length <= 8);
  const hasStats = page.bullets.some((b) => numeric(b.text));
  let layout =
    choice === "auto"
      ? page.images.length
        ? "image"
        : hasStats && designId === "pitch"
          ? "stats"
          : page.layout === "title"
            ? "title"
            : short
              ? "cards"
              : "clean"
      : choice;
  if (layout === "image" && !page.images.length) layout = "clean";
  if (layout === "cards" && !page.bullets.length) layout = "title";
  // Images are always retained, including when a text layout is requested.
  const withImages = page.images.length > 0;
  if (designId === "professional") {
    shape(0, 0, 14, 540, p.accent);
    shape(46, 34, 52, 5, p.accent);
  } else if (designId === "club") {
    shape(790, 12, 150, 150, p.accent2, "ellipse");
    shape(30, 490, 75, 20, p.accent);
  } else {
    shape(46, 34, 54, 5, p.accent);
    shape(860, 32, 52, 5, p.accent2);
  }
  const isCover = layout === "title" && !withImages;
  const titleY = isCover ? 95 : 62;
  const titleH = isCover ? 180 : 98;
  const titleW = designId === "club" ? 724 : 868;
  text(
    page.title,
    46,
    titleY,
    titleW,
    titleH,
    isCover ? (designId === "club" ? 66 : 54) : 34,
    p.text,
    true,
    isCover && designId === "pitch" ? "center" : "left",
  );
  const bodyY = isCover ? 318 : 184;
  const bodyH = isCover ? 150 : 300;
  let bodyX = 46;
  let bodyW = 868;
  if (withImages) {
    if (!page.bullets.length) {
      for (let i = 0; i < page.images.length; i++) {
        const width = page.images.length === 1 ? 868 : 422;
        const x = 46 + i * 446;
        shape(x, 180, width, 310, p.surface);
        image(i, x + 12, 192, width - 24, 286);
      }
    } else {
      const imageLeft = designId === "club";
      const imageWidth = layout === "clean" ? 300 : 440;
      bodyX = imageLeft ? 46 + imageWidth + 36 : 46;
      bodyW = 868 - imageWidth - 36;
      const imageX = imageLeft ? 46 : 914 - imageWidth;
      shape(imageX, 180, imageWidth, 310, p.surface);
      for (let i = 0; i < page.images.length; i++)
        image(
          i,
          imageX + 14,
          194 + i * 146,
          imageWidth - 28,
          page.images.length > 1 ? 132 : 282,
        );
    }
  }
  if (layout === "stats" && !withImages) {
    const stats = page.bullets.filter((b) => numeric(b.text));
    const rest = page.bullets.filter((b) => !numeric(b.text));
    const width = (868 - (stats.length - 1) * 16) / stats.length;
    stats.forEach((stat, i) => {
      shape(46 + i * (width + 16), 185, width, 155, p.surface);
      text(
        stat.text,
        62 + i * (width + 16),
        212,
        width - 32,
        100,
        66,
        p.accent,
        true,
      );
    });
    rest.forEach((bullet, i) =>
      text(
        bullet.text,
        48 + bullet.level * 12,
        364 + i * (116 / Math.max(1, rest.length)),
        860 - bullet.level * 12,
        110 / Math.max(1, rest.length),
        20,
        p.muted,
      ),
    );
  } else if (layout === "cards" && page.bullets.length) {
    const columns = withImages
      ? 1
      : page.bullets.length === 3 && designId !== "club"
        ? 3
        : 2;
    const rows = Math.ceil(page.bullets.length / columns);
    const cw = (bodyW - (columns - 1) * 16) / columns;
    const ch = (bodyH - (rows - 1) * 16) / rows;
    page.bullets.forEach((bullet, i) => {
      const x = bodyX + (i % columns) * (cw + 16);
      const y = bodyY + Math.floor(i / columns) * (ch + 16);
      shape(x, y, cw, ch, p.surface);
      shape(x + 16, y + 16, 22, 4, p.accent);
      text(
        bullet.text,
        x + 16 + bullet.level * 9,
        y + 35,
        cw - 32 - bullet.level * 9,
        ch - 45,
        26,
        p.text,
        true,
      );
    });
  } else {
    const lengths = page.bullets.map((b) =>
      Math.max(1, Math.ceil(b.text.length / (withImages ? 46 : 82))),
    );
    const total = Math.max(
      1,
      lengths.reduce((a, b) => a + b, 0),
    );
    let y = bodyY;
    page.bullets.forEach((bullet, i) => {
      const h = (bodyH * lengths[i]) / total;
      const indent = bullet.level * 12;
      shape(
        bodyX + indent,
        y + 8,
        5,
        5,
        p.accent,
        designId === "club" ? "ellipse" : "rect",
      );
      text(
        bullet.text,
        bodyX + 18 + indent,
        y,
        bodyW - 18 - indent,
        h - 12,
        isCover ? 25 : 23,
        p.muted,
      );
      y += h;
    });
  }
  const labels: Record<string, [string, string]> = {
    title: [
      "Title story",
      "A spacious opening gives your headline room to lead.",
    ],
    cards: [
      "Idea cards",
      "Short points become individual cards that are easy to scan.",
    ],
    stats: [
      "Numbers first",
      "Your existing numbers take the spotlight, with supporting text below.",
    ],
    image: [
      "Picture-led",
      "Your original pictures sit alongside the same extracted text.",
    ],
    clean: [
      "Clean structure",
      "A clear reading order keeps longer text easy to follow.",
    ],
  };
  const [label, reason] = labels[layout];
  return {
    background: p.bg,
    elements,
    label,
    reason,
    notes: page.notes,
    sourceSlide: page.sourceSlide,
  };
}
