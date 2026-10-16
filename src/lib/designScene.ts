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
  issues: string[];
  overflow: boolean;
}
let measuringContext: CanvasRenderingContext2D | null | undefined;
function measure(value: string, size: number, font: string, bold: boolean) {
  if (measuringContext === undefined)
    measuringContext =
      typeof CanvasRenderingContext2D !== "undefined"
        ? document.createElement("canvas").getContext("2d")
        : null;
  if (measuringContext) {
    measuringContext.font = `${bold ? "bold " : ""}${size}px "${font}"`;
    return measuringContext.measureText(value).width;
  }
  return [...value].reduce(
    (width, char) =>
      width +
      (/[MW@#]/.test(char) ? 0.95 : /[il.,' ]/.test(char) ? 0.3 : 0.6) * size,
    0,
  );
}
function fit(
  value: string,
  w: number,
  h: number,
  preferred: number,
  font: string,
  bold: boolean,
) {
  for (let size = preferred; size >= 4; size--) {
    let lines = 0;
    for (const paragraph of value.split("\n")) {
      lines++;
      let width = 0;
      for (const word of paragraph.split(/\s+/)) {
        const wordWidth = measure(word, size, font, bold),
          space = measure(" ", size, font, bold);
        if (width && width + space + wordWidth > w) {
          lines++;
          width = 0;
        }
        if (wordWidth > w) {
          lines += Math.ceil(wordWidth / w) - 1;
          width = wordWidth % w;
        } else width += (width ? space : 0) + wordWidth;
      }
    }
    if (lines * size * 1.25 <= h) return { size, fits: true };
  }
  return { size: 4, fits: false };
}
export function recommendDesign(slides: Slide[]): {
  id: DesignId;
  reason: string;
} {
  const value = slides
    .map((s) => [s.title, ...s.bullets.map((b) => b.text)].join(" "))
    .join(" ");
  if (
    /\b(club|community|members|volunteer|festival|society|campus)\b/i.test(
      value,
    )
  )
    return {
      id: "club",
      reason:
        "Community content suggests a welcoming, picture-led style. You can choose any vibe.",
    };
  if (
    /\b(investor|fundraising|startup|traction|pitch|market opportunity|seed round)\b/i.test(
      value,
    )
  )
    return {
      id: "pitch",
      reason:
        "Pitching language suggests strong headlines and visible numbers. No claims or figures are added.",
    };
  return {
    id: "professional",
    reason:
      "A clear, versatile starting point. Pick the vibe that fits your audience.",
  };
}

/** One shared 960 × 540 point scene for preview and PPTX. Content is never shortened. */
export function createScene(
  page: ExportPage,
  designId: DesignId,
  choice: LayoutChoice = "auto",
): SlideScene {
  const design = getDesign(designId),
    p = design.palette;
  const elements: SceneElement[] = [],
    issues: string[] = [];
  let overflow = false;
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
    preferred = 23,
    color = p.text,
    heading = false,
    align: "left" | "center" | "right" = "left",
  ) => {
    if (!value) return;
    const font = heading ? design.headingFont : design.bodyFont;
    const fitting = fit(value, w, h, preferred, font, heading);
    if (!fitting.fits) {
      overflow = true;
      issues.push(
        "Text cannot fit safely on this slide. Try Clean structure or shorten it explicitly in the optional text editor.",
      );
    } else if (fitting.size < 14)
      issues.push(
        "Dense content requires small text to keep the same slide count. Review readability before downloading.",
      );
    elements.push({
      kind: "text",
      text: value,
      x,
      y,
      w,
      h,
      size: fitting.size,
      color,
      font,
      bold: heading,
      align,
    });
  };
  const images = (x: number, y: number, w: number, h: number) => {
    if (!page.images.length) return;
    const cols = Math.min(
        page.images.length,
        Math.ceil(Math.sqrt((page.images.length * w) / h)),
      ),
      rows = Math.ceil(page.images.length / cols);
    const gap = Math.min(12, w / cols / 8, h / rows / 8),
      cw = (w - (cols - 1) * gap) / cols,
      ch = (h - (rows - 1) * gap) / rows;
    page.images.forEach((image, i) => {
      const ix = x + (i % cols) * (cw + gap),
        iy = y + Math.floor(i / cols) * (ch + gap);
      shape(ix, iy, cw, ch, p.surface);
      elements.push({
        kind: "image",
        ...image,
        x: ix + gap / 2,
        y: iy + gap / 2,
        w: cw - gap,
        h: ch - gap,
      });
    });
    if (page.images.length > 6)
      issues.push("All pictures are retained in a compact grid on this slide.");
  };
  const numeric = (value: string) =>
    /^[+−-]?\s*[$€£¥₹]?\s*\d[\d,.]*(?:\s*(?:%|[kmbt](?:illion)?|x|×))?\s*\+?$/i.test(
      value,
    );
  const stats = page.bullets.filter((b) => numeric(b.text));
  const short =
    page.bullets.length >= 2 &&
    page.bullets.length <= 4 &&
    page.bullets.every((b) => b.text.split(/\s+/).length <= 8);
  let layout: string =
    choice === "auto"
      ? page.images.length
        ? "image"
        : stats.length &&
            stats.length <= 4 &&
            page.bullets.length <= 6 &&
            designId === "pitch"
          ? "stats"
          : page.layout === "title"
            ? "title"
            : short
              ? "cards"
              : "clean"
      : choice;
  if (layout === "image" && !page.images.length) layout = "clean";
  if (layout === "cards" && page.bullets.length > 6) {
    layout = "clean";
    issues.push(
      "Dense content uses columns instead of crowded cards; every text block stays on this slide.",
    );
  }
  if (layout === "cards" && !page.bullets.length) layout = "title";
  if (designId === "professional") {
    shape(0, 0, 14, 540, p.accent);
    shape(46, 34, 52, 5, p.accent);
  } else if (designId === "club") {
    shape(790, 12, 150, 150, p.accent2, "ellipse");
    shape(30, 500, 75, 10, p.accent);
  } else if (designId === "editorial") {
    shape(46, 38, 868, 2, p.accent);
    shape(46, 505, 868, 1, p.accent);
  } else if (designId === "luxury") {
    shape(46, 30, 868, 1, p.accent);
    shape(46, 510, 868, 1, p.accent);
  } else if (designId === "terminal") {
    shape(32, 24, 896, 6, p.accent);
    shape(32, 510, 896, 2, p.accent);
  } else {
    shape(46, 34, 54, 5, p.accent);
    shape(860, 32, 52, 5, p.accent2);
  }
  const cover = layout === "title" && !page.images.length;
  const titleHeight = cover ? 160 : 100;
  text(
    page.title,
    46,
    cover ? 95 : 60,
    designId === "club" ? 724 : 868,
    titleHeight,
    cover ? 54 : 34,
    p.text,
    true,
    cover && (designId === "pitch" || designId === "luxury")
      ? "center"
      : "left",
  );
  const y = cover ? 300 : 180,
    h = cover ? 190 : 310;
  let bx = 46,
    bw = 868;
  if (page.images.length) {
    if (!page.bullets.length) images(46, 180, 868, 310);
    else {
      const iw = layout === "clean" ? 300 : 440,
        left = designId === "club" || designId === "editorial";
      bx = left ? 46 + iw + 28 : 46;
      bw = 868 - iw - 28;
      images(left ? 46 : 914 - iw, 180, iw, 310);
    }
  }
  if (layout === "stats" && !page.images.length) {
    const cw = (868 - (stats.length - 1) * 16) / stats.length;
    stats.forEach((s, i) => {
      shape(46 + i * (cw + 16), 180, cw, 150, p.surface);
      text(s.text, 60 + i * (cw + 16), 200, cw - 28, 110, 64, p.accent, true);
    });
    const other = page.bullets.filter((b) => !numeric(b.text));
    other.forEach((b, i) =>
      text(
        b.text,
        46 + b.level * 10,
        352 + i * (138 / Math.max(1, other.length)),
        868 - b.level * 10,
        130 / Math.max(1, other.length),
        21,
        p.muted,
      ),
    );
  } else if (layout === "cards" && page.bullets.length) {
    const cols = page.images.length
        ? 1
        : page.bullets.length === 3 && designId !== "club"
          ? 3
          : 2,
      rows = Math.ceil(page.bullets.length / cols);
    const gap = 12,
      cw = (bw - (cols - 1) * gap) / cols,
      ch = (h - (rows - 1) * gap) / rows;
    page.bullets.forEach((b, i) => {
      const x = bx + (i % cols) * (cw + gap),
        cy = y + Math.floor(i / cols) * (ch + gap);
      shape(x, cy, cw, ch, p.surface);
      shape(x + 12, cy + 12, 24, 3, p.accent);
      text(
        b.text,
        x + 12 + b.level * 8,
        cy + 26,
        cw - 24 - b.level * 8,
        ch - 34,
        25,
        p.text,
        true,
      );
    });
  } else {
    const cols =
      !page.images.length && page.bullets.length >= 5
        ? page.bullets.length > 18
          ? 3
          : 2
        : 1;
    const perColumn = Math.ceil(page.bullets.length / cols),
      cw = (bw - (cols - 1) * 28) / cols;
    for (let col = 0; col < cols; col++) {
      const items = page.bullets.slice(col * perColumn, (col + 1) * perColumn);
      const weights = items.map((b) =>
          Math.max(1, Math.ceil(b.text.length / Math.max(20, cw / 11))),
        ),
        total = weights.reduce((a, b) => a + b, 0);
      let cy = y;
      items.forEach((b, i) => {
        const bh = (h * weights[i]) / total,
          gap = Math.min(12, bh / 5),
          indent = b.level * Math.min(10, cw / 20),
          x = bx + col * (cw + 28);
        shape(
          x + indent,
          cy + Math.min(8, bh / 4),
          Math.min(4, bh / 4),
          Math.min(4, bh / 4),
          p.accent,
          designId === "club" ? "ellipse" : "rect",
        );
        text(
          b.text,
          x + 14 + indent,
          cy,
          cw - 14 - indent,
          bh - gap,
          cover ? 25 : 23,
          p.muted,
        );
        cy += bh;
      });
    }
  }
  const labels: Record<string, [string, string]> = {
    title: [
      "Title story",
      "A spacious opening gives your headline room to lead.",
    ],
    cards: [
      "Idea cards",
      "Related points become separate cards with a consistent reading order.",
    ],
    stats: [
      "Numbers first",
      "Your existing figures take the spotlight; no numbers are invented.",
    ],
    image: [
      "Picture-led",
      "All original pictures are contained, not cropped, beside the same extracted text.",
    ],
    clean: [
      "Clean structure",
      "Dense content uses columns while keeping exactly one output slide per input slide.",
    ],
  };
  return {
    background: p.bg,
    elements,
    label: labels[layout][0],
    reason: labels[layout][1],
    notes: page.notes,
    sourceSlide: page.sourceSlide,
    issues: [...new Set(issues)],
    overflow,
  };
}
