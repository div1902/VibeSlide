# Use VibeSlide on iPad and desktop

VibeSlide rebuilds a **separate** PowerPoint from extracted content. It does not replace slides in your open Canva or PowerPoint document. Text edits are opt-in. The selected input slide count and order are retained; dense slides never generate continuation pages.

## What is available

| Platform                 | Available path                                                                   | Full open-deck scan                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| iPad Chrome              | Open the deployed website, export a .pptx to Files, choose the file              | Desktop Chrome extensions cannot run on iPad. Use file import.                                                 |
| Desktop Chrome extension | Detect Canva/PowerPoint tab, guide export, locally import, preview, and download | Requires a separately installed editor app/add-in; the extension itself cannot extract a complete canvas deck. |
| PowerPoint add-in        | Hosted task pane; read the complete compressed .pptx using Office.js             | Requires manifest installation and a supported Office host/account. Errors offer file import.                  |
| Canva app                | Design Editor app bundle; request a PPTX export via Canva's SDK                  | Requires Canva developer registration/preview or approved distribution. Canva may prompt for pages.            |

The file workflow and adapter tests run without editor accounts. The extension ZIP, permissions, CSP, editor detection, and popup logic were checked separately. The cloud Chromium administrator policy blocked loading unpacked extensions, so actual desktop installation remains unverified. **The editor adapters have not been validated inside an authenticated Canva or PowerPoint session.** Registration, marketplace review, tenant policies, host API availability, and download restrictions must be checked there before promising production support. Native PowerPoint on iPad is not a tested integration target.

## No terminal needed for the file workflow

1. Open your deployed VibeSlide HTTPS website on iPad or desktop.
2. In Canva, use **Share → Download → Microsoft PowerPoint (.pptx)**. In PowerPoint, download/save a PowerPoint copy. Save it to Files on iPad.
3. In VibeSlide, leave **Slides to redesign** as `all` or enter a range such as `1-3, 5`.
4. Choose the file. Select Professional, Club Presentation, Pitch Deck, Editorial Magazine, Dark Luxury, or Retro Terminal. Each card uses your actual content.
5. Review all pages. Choose **Create new .pptx**, then **Download .pptx**.

VibeSlide does not host itself. If the repository is already connected to Vercel, pushes to `main` trigger your configured deployment. Otherwise import `div1902/VibeSlide` in Vercel using the Vite preset, `npm run build`, and output `dist`. No server or secrets are needed. The GitHub repository URL alone is not a runnable website.

## Install the desktop Chrome extension

1. On the deployed website, expand **Use on iPad, Chrome, Canva, or PowerPoint** and download the extension ZIP.
2. Unzip it into a folder on your desktop computer.
3. Open `chrome://extensions`, enable **Developer mode**, and select **Load unpacked**. Choose the extracted folder containing `manifest.json`.
4. Pin VibeSlide. Open a Canva/PowerPoint browser tab, click VibeSlide, and choose **Scan current tab**.
5. Follow the editor-specific instructions, or import an exported deck into the bundled app.

This is an unpacked developer extension, not a Chrome Web Store listing. It requests only `activeTab`; it does not inject content scripts, read cookies, traverse your tabs, or upload files. Its content security policy blocks external connections and remote code. It bundles the app, fixture, and fonts fall back to system fonts; editor SDKs are excluded from the extension build. Once installed, file import and export work offline.

## Install the PowerPoint add-in

1. Deploy VibeSlide over HTTPS. Open that website and download the **PowerPoint manifest** from the integration instructions. The app fills in its actual deployed URL, including any path prefix.
2. Use PowerPoint's available custom add-in upload/sideload or organizational catalog mechanism to install the XML manifest. These options vary by Office host and account; your administrator may have to enable custom add-ins.
3. Open VibeSlide in PowerPoint. Save recent changes, select a range if needed, and choose **Scan open presentation**.
4. The add-in loads Microsoft's official Office.js library, requests `FileType.Compressed`, reads 64 KiB slices, closes the temporary Office file, and parses it locally. The manifest requests **ReadAllDocument**, sufficient for underlying OOXML access. It does not request write access.
5. Choose a vibe and download a new .pptx. Import/open that copy in PowerPoint yourself.

If Office does not support complete-file access, denies it, or times out, the task pane shows an error and retains the file-import alternative. A scan is never simulated from visible text or a screenshot.

Microsoft references: [whole-file access](https://github.com/OfficeDev/office-js-docs-pr/blob/main/docs/develop/get-the-whole-document-from-an-add-in-for-powerpoint-or-word.md), [permission tiers](https://github.com/OfficeDev/office-js-docs-pr/blob/main/docs/develop/requesting-permissions-for-api-use-in-content-and-task-pane-add-ins.md).

## Register the Canva app

1. Download **Canva app bundle** from the deployed website, or build `dist/vibeslide-canva.js` with `npm run build:canva`.
2. Create an app in the [Canva developer portal](https://www.canva.com/developers/apps), enable the **Design Editor** intent, and upload the JavaScript bundle using the portal's app-source controls. Do not register the ordinary Vite HTML page as the production bundle.
3. Use Canva's Preview/Open flow on a presentation. For wider distribution, complete Canva's current app review or team distribution process.
4. Choose **Scan open presentation**. `requestExport({ acceptedFileTypes: ['pptx'] })` opens Canva's export flow. Export **all pages** if you want the VibeSlide range field to refer to the original Canva page numbers.
5. The app reads the returned HTTPS export into memory and applies the same parser, previews, and download flow. If Canva restricts downloading in its embedded host, export the original .pptx and use the standalone website.

The Canva bundle registers `prepareDesignEditor`, bundles React and SDK dependencies in a single IIFE, and includes CSS. It needs no API key or backend. Canva prepares exports through its own service; VibeSlide makes no additional upload. The export URL is not persisted or logged. Canva's conversion to PowerPoint can flatten or change content before VibeSlide sees it. Slide counts refer to the exported file, not an independently verified count of the live Canva design.

Official sources: [Canva starter kit](https://github.com/canva-sdks/canva-apps-sdk-starter-kit), [requestExport](https://www.canva.dev/docs/apps/api/design-request-export/), installed `@canva/design` type declarations.

## Content fidelity and limits

- Exactly one output slide per selected input slide, in presentation order. A broken slide stops parsing instead of silently reducing the count.
- Extracted text is not rewritten automatically; supported raster pictures are contained rather than cropped; speaker notes are retained. Original text-box order is read from OOXML and may not match visual reading order in complex designs.
- Unsupported grouped objects, charts, tables, SmartArt, SVG/EMF, animations, and inherited master/layout content are not reconstructed. Reading notes flag detected unsupported objects. Check them before export; this is not a lossless importer.
- Dense content shrinks within the same page, with small-text warnings. If content cannot fit the estimated bounds at all, export stops with a clear message rather than removing text or adding slides. Font rendering can differ in Office.
- All output pages are 16:9. Original aspect ratio, formatting, animations, and editing structure are not retained.
- Scope examples: `all`, `1-3`, `1, 3-5`. Duplicates are removed and source order is preserved. The preview/download renumbers the selected slides starting from 1.
