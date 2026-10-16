import JSZip from "jszip";
import type { Bullet, ParseProgress, Slide } from "../types";

export type { Bullet, Slide, SlideImage } from "../types";

export const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 150 * 1024 * 1024;
const MAX_PART_BYTES = 20 * 1024 * 1024;
const MAX_SLIDES = 300;

const NS = {
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
};

export class PptxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PptxParseError";
  }
}

interface ParseOptions {
  onProgress?: (progress: ParseProgress) => void;
  onWarning?: (warning: string) => void;
  signal?: AbortSignal;
  /** Explicit opt-in for callers that accept missing slides. The app never enables this. */
  allowPartial?: boolean;
}

interface Relationship {
  type: string;
  target: string;
}

const all = (parent: Document | Element, ns: string, tag: string) =>
  Array.from(parent.getElementsByTagNameNS(ns, tag));

const direct = (parent: Element, ns: string, tag: string) =>
  Array.from(parent.children).filter(
    (child) => child.namespaceURI === ns && child.localName === tag,
  );

function xml(source: string): Document {
  // Office XML never needs a DTD. Do not process embedded entities or HTML.
  if (/<!DOCTYPE|<!ENTITY/i.test(source))
    throw new Error("Unsupported XML declaration");
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (
    document.getElementsByTagName("parsererror").length ||
    document.getElementsByTagNameNS("*", "parsererror").length
  ) {
    throw new Error("Malformed XML");
  }
  return document;
}

function assertActive(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new DOMException("Reading cancelled", "AbortError");
}

/** Inspect ZIP sizes before JSZip inflates any entries. ZIP64/encrypted decks are not supported. */
function checkArchive(bytes: ArrayBuffer) {
  const view = new DataView(bytes);
  if (view.byteLength < 22 || view.getUint32(0, true) !== 0x04034b50) {
    throw new PptxParseError(
      "This file is not a readable PowerPoint deck. Please choose a valid .pptx file.",
    );
  }
  let end = -1;
  for (
    let offset = view.byteLength - 22;
    offset >= Math.max(0, view.byteLength - 65557);
    offset--
  ) {
    if (
      view.getUint32(offset, true) === 0x06054b50 &&
      offset + 22 + view.getUint16(offset + 20, true) === view.byteLength
    ) {
      end = offset;
      break;
    }
  }
  if (end < 0)
    throw new PptxParseError(
      "This deck looks incomplete or damaged. Try saving a fresh .pptx copy.",
    );
  const count = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true);
  if (
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true) ||
    count === 0xffff ||
    offset === 0xffffffff
  ) {
    throw new PptxParseError(
      "This archive format is not supported. Save the presentation as a standard .pptx.",
    );
  }
  if (count > 5000 || offset + centralSize > end) {
    throw new PptxParseError(
      "This deck is too complex to read safely. Try a smaller presentation.",
    );
  }
  let expanded = 0;
  for (let entry = 0; entry < count; entry++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) {
      throw new PptxParseError(
        "This deck looks damaged. Try saving a fresh .pptx copy.",
      );
    }
    const flags = view.getUint16(offset + 8, true);
    const size = view.getUint32(offset + 24, true);
    if (flags & 1)
      throw new PptxParseError(
        "Password-protected decks cannot be read. Save an unprotected .pptx copy first.",
      );
    expanded += size;
    if (size > MAX_PART_BYTES || expanded > MAX_EXPANDED_BYTES) {
      throw new PptxParseError(
        "This deck expands beyond the safe reading limit. Compress its images or use a smaller deck.",
      );
    }
    offset +=
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
    if (offset > end)
      throw new PptxParseError(
        "This deck looks incomplete. Try saving a fresh .pptx copy.",
      );
  }
}

function resolvePart(source: string, target: string): string | undefined {
  if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(target)) return;
  const parts = target.startsWith("/") ? [] : source.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === "..") {
      if (!parts.length) return;
      parts.pop();
    } else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

async function relationships(
  zip: JSZip,
  part: string,
): Promise<Map<string, Relationship>> {
  const separator = part.lastIndexOf("/");
  const relsPath = `${part.slice(0, separator)}/_rels/${part.slice(separator + 1)}.rels`;
  const file = zip.file(relsPath);
  const result = new Map<string, Relationship>();
  if (!file) return result;
  const document = xml(await file.async("string"));
  for (const rel of all(document, NS.rel, "Relationship")) {
    if (rel.getAttribute("TargetMode")?.toLowerCase() === "external") continue;
    const id = rel.getAttribute("Id");
    const target = resolvePart(part, rel.getAttribute("Target") ?? "");
    if (id && target)
      result.set(id, { target, type: rel.getAttribute("Type") ?? "" });
  }
  return result;
}

function paragraphs(shape: Element): Bullet[] {
  const body = direct(shape, NS.p, "txBody")[0];
  if (!body) return [];
  return direct(body, NS.a, "p").flatMap((paragraph) => {
    // Join runs without inserting spaces: a single word can span styled runs.
    const text = Array.from(paragraph.children)
      .map((node) => {
        if (node.localName === "br") return "\n";
        if (node.localName === "r" || node.localName === "fld")
          return all(node, NS.a, "t")
            .map((t) => t.textContent ?? "")
            .join("");
        return "";
      })
      .join("")
      .trim();
    const rawLevel = Number(
      direct(paragraph, NS.a, "pPr")[0]?.getAttribute("lvl") ?? 0,
    );
    const level = Number.isFinite(rawLevel)
      ? Math.min(8, Math.max(0, Math.trunc(rawLevel)))
      : 0;
    return text ? [{ text, level }] : [];
  });
}

function isStat(text: string) {
  return /^[+−-]?\s*[$€£¥₹]?\s*\d[\d,.]*(?:\s*(?:%|[kmbt](?:illion)?|x|×))?\s*\+?$/i.test(
    text,
  );
}

const imageMime: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
};

async function parseSlide(
  zip: JSZip,
  path: string,
  warn: (message: string) => void,
): Promise<Slide> {
  const document = xml(await zip.file(path)!.async("string"));
  if (
    document.documentElement.namespaceURI !== NS.p ||
    document.documentElement.localName !== "sld"
  ) {
    throw new Error("Not a slide");
  }
  const tree = all(document, NS.p, "spTree")[0];
  if (
    tree &&
    (direct(tree, NS.p, "grpSp").length ||
      direct(tree, NS.p, "graphicFrame").length ||
      direct(tree, NS.p, "oleObj").length)
  ) {
    warn(
      "Grouped objects, charts, tables, or embedded objects are unsupported and were skipped. Review this slide against the original.",
    );
  }
  const shapes = tree ? direct(tree, NS.p, "sp") : [];
  const textShapes = shapes
    .map((shape) => ({
      shape,
      paragraphs: paragraphs(shape),
      placeholder: all(shape, NS.p, "ph")[0]?.getAttribute("type"),
    }))
    .filter(
      (item) =>
        !["dt", "ftr", "sldNum", "hdr"].includes(item.placeholder ?? ""),
    );
  const titleShape =
    textShapes.find(
      (item) =>
        ["title", "ctrTitle"].includes(item.placeholder ?? "") &&
        item.paragraphs.length,
    ) ?? textShapes.find((item) => item.paragraphs.length);
  const explicitTitle = ["title", "ctrTitle"].includes(
    titleShape?.placeholder ?? "",
  );
  const title = titleShape
    ? explicitTitle
      ? titleShape.paragraphs.map((p) => p.text).join("\n")
      : titleShape.paragraphs[0].text
    : "";
  const bullets: Bullet[] = [];
  const stats: string[] = isStat(title) ? [title] : [];
  for (const item of textShapes) {
    const content =
      item === titleShape
        ? explicitTitle
          ? []
          : item.paragraphs.slice(1)
        : item.paragraphs;
    for (const paragraph of content) {
      if (isStat(paragraph.text)) stats.push(paragraph.text);
      else bullets.push(paragraph);
    }
  }
  const slide: Slide = { title, bullets, images: [], stats };
  let rels: Map<string, Relationship>;
  try {
    rels = await relationships(zip, path);
  } catch {
    warn("Some image or notes references are damaged; readable text was kept.");
    return slide;
  }

  const pictures = tree ? direct(tree, NS.p, "pic") : [];
  for (const picture of pictures) {
    try {
      const blip = all(picture, NS.a, "blip")[0];
      const relationship = rels.get(blip?.getAttributeNS(NS.r, "embed") ?? "");
      if (!relationship) {
        warn("A linked or missing image was skipped.");
        continue;
      }
      const extension =
        relationship.target.split(".").pop()?.toLowerCase() ?? "";
      const mimeType = imageMime[extension];
      const media =
        relationship.target.startsWith("ppt/media/") &&
        zip.file(relationship.target);
      if (!relationship.type.endsWith("/image") || !mimeType || !media) {
        warn("An unsupported or missing image was skipped.");
        continue;
      }
      const metadata = all(picture, NS.p, "cNvPr")[0];
      slide.images.push({
        dataUrl: `data:${mimeType};base64,${await media.async("base64")}`,
        alt:
          metadata?.getAttribute("descr") ||
          metadata?.getAttribute("name") ||
          "Slide image",
      });
    } catch {
      warn("An unreadable image was skipped.");
    }
  }
  const notesRel = [...rels.values()].find(
    (rel) =>
      rel.type.endsWith("/notesSlide") &&
      rel.target.startsWith("ppt/notesSlides/"),
  );
  const notesFile = notesRel && zip.file(notesRel.target);
  if (notesFile) {
    try {
      const notesDocument = xml(await notesFile.async("string"));
      const notesTree = all(notesDocument, NS.p, "spTree")[0];
      const notes = (notesTree ? direct(notesTree, NS.p, "sp") : [])
        .flatMap((shape) => {
          const type = all(shape, NS.p, "ph")[0]?.getAttribute("type");
          return type && type !== "body"
            ? []
            : paragraphs(shape).map((paragraph) => paragraph.text);
        })
        .join("\n");
      if (notes) slide.notes = notes;
    } catch {
      warn("Unreadable speaker notes were skipped.");
    }
  }
  return slide;
}

/** Extract content only. The source archive is never modified or uploaded. */
export async function parsePptx(
  file: File,
  options: ParseOptions = {},
): Promise<Slide[]> {
  const { onProgress, onWarning, signal } = options;
  if (!/\.pptx$/i.test(file.name))
    throw new PptxParseError(
      "That file needs a different stage. Please choose a .pptx PowerPoint file.",
    );
  if (!file.size)
    throw new PptxParseError(
      "This file is empty. Please choose a presentation with slides.",
    );
  if (file.size > MAX_FILE_BYTES)
    throw new PptxParseError(
      "This deck is over 30 MB. Compress its images or choose a smaller .pptx.",
    );
  assertActive(signal);
  onProgress?.({ percent: 5, message: "Opening your presentation…" });
  let zip: JSZip;
  try {
    const bytes = await file.arrayBuffer();
    assertActive(signal);
    checkArchive(bytes);
    zip = await JSZip.loadAsync(bytes);
  } catch (error) {
    if (
      error instanceof PptxParseError ||
      (error instanceof DOMException && error.name === "AbortError")
    )
      throw error;
    throw new PptxParseError(
      "We couldn’t open this deck. It may be damaged, encrypted, or not a real .pptx. Try saving a fresh copy.",
    );
  }
  assertActive(signal);
  if (!zip.file("[Content_Types].xml") || !zip.file("ppt/presentation.xml")) {
    throw new PptxParseError(
      "This archive is not a PowerPoint presentation. Please choose a valid .pptx.",
    );
  }
  let paths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort(
      (a, b) =>
        Number(a.match(/slide(\d+)\.xml$/)![1]) -
        Number(b.match(/slide(\d+)\.xml$/)![1]),
    );
  // Follow the presentation order, which can differ after reordering slides in PowerPoint.
  try {
    const presentation = xml(
      await zip.file("ppt/presentation.xml")!.async("string"),
    );
    const ids = all(presentation, NS.p, "sldId");
    if (ids.length) {
      const rels = await relationships(zip, "ppt/presentation.xml");
      paths = ids.map((id) => {
        const relationship = rels.get(id.getAttributeNS(NS.r, "id") ?? "");
        if (!relationship || !zip.file(relationship.target))
          throw new Error("Missing slide reference");
        return relationship.target;
      });
    }
  } catch {
    throw new PptxParseError(
      "The slide order could not be read safely. Save a fresh PowerPoint copy and try again.",
    );
  }
  if (!paths.length)
    throw new PptxParseError(
      "There are no slides in this deck. Add a slide in PowerPoint and try again.",
    );
  if (paths.length > MAX_SLIDES)
    throw new PptxParseError(
      `This deck has more than ${MAX_SLIDES} slides. Please split it into smaller decks.`,
    );
  const slides: Slide[] = [];
  for (const [index, path] of paths.entries()) {
    assertActive(signal);
    const slideNumber = index + 1;
    try {
      slides.push(
        await parseSlide(zip, path, (message) =>
          onWarning?.(`Slide ${slideNumber}: ${message}`),
        ),
      );
    } catch {
      if (!options.allowPartial)
        throw new PptxParseError(
          `Slide ${slideNumber} could not be read. To keep your slide count unchanged, scanning has stopped. Save a fresh .pptx copy and try again.`,
        );
      onWarning?.(`Slide ${slideNumber} could not be read and was skipped.`);
    }
    onProgress?.({
      percent: Math.round(10 + ((index + 1) / paths.length) * 90),
      message: `Reading slide ${index + 1} of ${paths.length}…`,
    });
    // Yield so the progress bar and cancellation remain responsive.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  assertActive(signal);
  if (!slides.length)
    throw new PptxParseError(
      "None of the slides could be read. Try saving a fresh .pptx copy in PowerPoint.",
    );
  return slides;
}
