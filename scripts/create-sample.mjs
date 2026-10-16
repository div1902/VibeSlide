import pptxgen from "pptxgenjs";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

// Encode a small abstract landscape as a PNG using only Node's standard library.
// This gives the fixture a visible image without network assets or image tooling.
function landscapePng() {
  const width = 400;
  const height = 260;
  const pixels = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let color = [232, 218, 188];
      if ((x - 300) ** 2 + (y - 78) ** 2 < 36 ** 2) color = [226, 125, 75];
      if (y > 182 - 40 * Math.sin(x / 90)) color = [149, 163, 111];
      if (y > 222 - 48 * Math.cos((x - 70) / 105)) color = [66, 89, 62];
      const offset = y * (width * 3 + 1) + 1 + x * 3;
      pixels.set(color, offset);
    }
  }
  function chunk(type, data) {
    const name = Buffer.from(type);
    const content = Buffer.concat([name, data]);
    let crc = 0xffffffff;
    for (const byte of content) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length, 0);
    content.copy(result, 4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
    return result;
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2; // 8-bit RGB, standard non-interlaced PNG.
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}

// A real, locally generated PowerPoint fixture. No remote assets are needed.
const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "VibeSlide";
pptx.subject = "A small deck for testing browser-side content extraction";
pptx.title = "A fresh perspective";
pptx.company = "VibeSlide";
pptx.lang = "en-US";
pptx.theme = { headFontFace: "Georgia", bodyFontFace: "Arial", lang: "en-US" };

function slide(title) {
  const page = pptx.addSlide();
  page.background = { color: "F4F0E4" };
  page.addText(title, {
    x: 0.7,
    y: 0.65,
    w: 11.8,
    h: 0.7,
    fontFace: "Georgia",
    fontSize: 32,
    color: "283527",
    margin: 0,
  });
  return page;
}

const intro = slide("A fresh perspective");
intro.addText("Small ideas. Meaningful momentum.", {
  x: 0.7,
  y: 2,
  w: 10.5,
  h: 0.6,
  fontSize: 22,
  color: "53614D",
  margin: 0,
});
intro.addText("The quarterly story, minus the corporate wallpaper.", {
  x: 0.7,
  y: 3,
  w: 10.5,
  h: 0.6,
  fontSize: 18,
  color: "53614D",
  margin: 0,
});
intro.addNotes(
  "Welcome the team. This deck is a safe sample for trying the VibeSlide parser.",
);

const focus = slide("Three things worth talking about");
focus.addText(
  [
    {
      text: "Build things people love",
      options: { bullet: { indent: 18 }, breakLine: true, indentLevel: 0 },
    },
    {
      text: "Listen before you ship",
      options: { bullet: { indent: 18 }, breakLine: true, indentLevel: 1 },
    },
    {
      text: "Make the details count",
      options: { bullet: { indent: 18 }, breakLine: true, indentLevel: 0 },
    },
  ],
  {
    x: 0.7,
    y: 2.1,
    w: 11,
    h: 2.5,
    fontSize: 24,
    color: "283527",
    paraSpaceAfterPt: 20,
  },
);
focus.addNotes("The second bullet is nested one level beneath the first.");

const momentum = slide("The numbers tell a story");
momentum.addText("42%", {
  x: 0.7,
  y: 2.1,
  w: 4.2,
  h: 1.1,
  fontSize: 64,
  color: "72894F",
  margin: 0,
});
momentum.addText("More people coming back", {
  x: 0.7,
  y: 3.4,
  w: 4.7,
  h: 0.6,
  fontSize: 20,
  color: "53614D",
  margin: 0,
});
momentum.addText("$3.2M", {
  x: 6.8,
  y: 2.1,
  w: 5.2,
  h: 1.1,
  fontSize: 64,
  color: "C76B45",
  margin: 0,
});
momentum.addText("A little proof of momentum", {
  x: 6.8,
  y: 3.4,
  w: 5.2,
  h: 0.6,
  fontSize: 20,
  color: "53614D",
  margin: 0,
});

const visual = slide("Make room for a new point of view");
visual.addText("Good stories leave space for the unexpected.", {
  x: 0.7,
  y: 2.2,
  w: 5.1,
  h: 1.4,
  fontSize: 24,
  color: "53614D",
  margin: 0,
});
visual.addImage({
  data: `image/png;base64,${landscapePng()}`,
  x: 7,
  y: 2,
  w: 4.5,
  h: 2.925,
  altText: "An abstract landscape in warm orange and green",
});
visual.addNotes(
  "A locally generated landscape demonstrates embedded media extraction without external requests.",
);

const output = fileURLToPath(new URL("../public/sample.pptx", import.meta.url));
await mkdir(fileURLToPath(new URL("../public/", import.meta.url)), {
  recursive: true,
});
await pptx.writeFile({ fileName: output, compression: true });
console.log(`Created ${output} (4 slides)`);
