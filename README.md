# VibeSlide

Make your deck look like you meant it.

A client-side PowerPoint restyling app, built one working stage at a time with Vite, React, TypeScript, and plain CSS. **Current flow: upload → preview designs for your audience → choose a layout → download a rebuilt PowerPoint.** No backend, account, API keys, external fonts, or file uploads are required.

## Run locally

Use Node.js **22.12+ or 24 LTS** and npm.

```sh
npm ci
npm run dev
```

Open the local address Vite prints (normally port 5173). Drop a `.pptx`, use **Choose a file**, or select **Try our sample**. The bundled `public/sample.pptx` is a real four-slide presentation with nested bullet levels, stats, an embedded image, and speaker notes.

After parsing, compare **Professional**, **Club Presentation**, and **Pitch Deck** cards. All three show your actual extracted slide content. Pick a design for the whole deck, navigate with the preview arrows, keyboard arrows, or page strip, and choose **Suggested layout**, **Clean structure**, **Idea cards**, or **Picture-led** for each original slide. Pictures are retained in every layout. Suggestions use simple content rules; your selected purpose always takes precedence. All preview pages, including continuation pages, are available before download.

For optional wording changes, expand **Optional: edit wording or inspect extracted content**, choose a slide, and open **Improve text**. Review the original and suggested wording, optionally type your own version, then choose **Use this version** or **Keep original** for each title or text block. Suggestions use conservative English phrase substitutions locally; no AI service is called and no edits are automatically accepted. Text inside double quotes and URLs is left unchanged. Numbers and notes are not rewritten.

Choose **Create new .pptx**, wait for generation, then tap **Download .pptx** to save the prepared file. This explicit download link works with mobile browsers, including Safari’s download flow. If you change the design, a layout, or a selected edit, generate a fresh file. With no selected edits, export rebuilds the extracted content as-is. The new deck uses your selected purpose-based design, system fonts, and 16:9 pages. The browser SVG/HTML preview and PptxGenJS writer both consume the same slide scene: text, fonts, colors, image containment, and positions. PowerPoint font rendering can vary slightly across devices. Dense text and extra images get continuation slides; original styling, charts, animations, and unsupported objects cannot be restored. The original file is untouched.

Switch to **JSON** or **Content** to inspect the selected version. **Download JSON** exports the entire `Slide[]`, including complete image data URLs. Image data is abbreviated only in the on-screen JSON inspector. This is a content inspector, not a rendering of the original PowerPoint slide.

```sh
npm test          # Parsing, suggestions, layout pagination, and PPTX export tests
npm run build    # Strict TypeScript check and production build into dist/
npm run preview  # Serve the production build locally
npm run fixture  # Regenerate public/sample.pptx with PptxGenJS
```

## What the parser does

`src/lib/parsePptx.ts` uses JSZip and the browser's DOMParser to read `ppt/slides/slideN.xml` in numeric order. Its public API is:

```ts
import { parsePptx } from "./src/lib/parsePptx";

const slides = await parsePptx(file, {
  onProgress: ({ percent, message }) => {},
  onWarning: (message) => {},
  signal: abortController.signal, // optional
});
```

Each returned slide has this shape:

```ts
interface Slide {
  title: string;
  bullets: { text: string; level: number }[];
  images: { dataUrl: string; alt: string }[];
  stats: string[];
  notes?: string;
}
```

- Titles prefer the first populated `title`/`ctrTitle` placeholder; otherwise the first text paragraph is used. Remaining paragraphs in that text box are preserved.
- Text runs are joined, XML entities are decoded, line breaks and paragraph indentation levels (0–8) are preserved. Body paragraphs are stored in `bullets`, including paragraphs that lack a visible bullet marker.
- Standalone numbers, percentages, and currency values such as `42%` and `$3.2M` are extracted to `stats`; sentences containing numbers stay in body text.
- Embedded raster images resolve through each slide's relationships to `ppt/media` and become data URLs. Linked images are never fetched. Unsupported media such as EMF/SVG are skipped with a reading note.
- Speaker notes are read through notes-slide relationships; slide-number, date, header, and footer placeholders are excluded.
- Animations, grouped shapes (including their children), tables, charts, SmartArt, OLE objects, master/layout text, and original styling are intentionally ignored. This is a best-effort content extractor, not a lossless PowerPoint importer. Strict OOXML namespaces and inherited master/layout content are not supported in this first stage.
- Malformed slides are skipped with warnings; a completely unreadable deck gets a clear error. Blank slides remain blank. The original archive is never edited.

For browser safety, uploads are limited to **30 MB / 300 slides**, with at most 5,000 ZIP entries, 20 MB per expanded entry, and 150 MB expanded total. The ZIP directory is checked before extraction. Encrypted, multipart, and ZIP64 archives are rejected. Parsing is asynchronous and cancellable between slide reads; ZIP inflation itself runs on the browser's main thread.

Only the app and its static sample are requested from the host. Selected file content is read in browser memory, never posted to a service or saved in browser storage. Generated JSON downloads are local. The app does not render slide content as HTML or execute embedded content.

## Files

```text
src/
  App.tsx                 Upload, progress, errors, and JSON/content inspector
  main.tsx                React entry point
  styles.css              Responsive interface; no UI library or remote fonts
  types.ts                Shared content types
  lib/
    parsePptx.ts          Read-only PowerPoint content extraction
    parsePptx.test.ts     Valid, malformed, and unsupported input coverage
    improveText.ts       Local suggestions and immutable selected edits
    layoutEngine.ts      Content pagination and export layout selection
    exportPptx.ts        Write the shared scene with PptxGenJS
    designScene.ts       Shared scene geometry and content-based suggestions
  components/
    TextReview.tsx       Optional wording review
    DesignStudio.tsx     Purpose cards, layout choices, and slide navigation
    SlidePreview.tsx     Responsive rendering of the shared scene
  vibes/
    index.ts             Professional, Club Presentation, and Pitch Deck
public/
  sample.pptx             Real four-slide fixture
  favicon.svg
scripts/
  create-sample.mjs       Rebuild the fixture using PptxGenJS
```

React, React DOM, JSZip, and PptxGenJS are the application dependencies. PptxGenJS is loaded on demand when you create a new PowerPoint and also generates the sample fixture. Vitest and jsdom provide DOM-based parser tests. The lockfile is committed for repeatable installation.

## Deploy to Vercel

1. Import this repository into Vercel and select the **Vite** framework preset.
2. Use `npm run build` as the build command and `dist` as the output directory. The install command is `npm ci`.
3. Deploy. No environment variables, server functions, or rewrite rules are needed; the app is a single page without client-side routes.

The `dist/` directory can also be served by any static host. Use HTTPS in production. Nothing requires a backend.

## Next stages

The original six aesthetic vibes, before/after comparison slider, custom image palettes, and roast/share cards remain future stages. The current purpose-based designs support title, clean text, cards, highlighted numbers, and image layouts, with shared previews and PowerPoint export. The landing artwork is illustrative; the design studio uses uploaded content.
