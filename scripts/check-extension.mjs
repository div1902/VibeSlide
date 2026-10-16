import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { JSDOM } from "jsdom";
import { detectEditor } from "../extension/detectEditor.js";
const zip = await JSZip.loadAsync(
  await readFile("dist/vibeslide-extension.zip"),
);
const manifest = JSON.parse(await zip.file("manifest.json").async("string"));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ["activeTab"]);
assert.ok(
  manifest.content_security_policy.extension_pages.includes(
    "connect-src 'self'",
  ),
);
for (const name of [
  "index.html",
  "popup.html",
  "popup.js",
  "detectEditor.js",
  "sample.pptx",
])
  assert.ok(zip.file(name), name);
for (const name of Object.keys(zip.files).filter((n) => n.endsWith(".js"))) {
  const source = await zip.file(name).async("string");
  assert.ok(
    !source.includes("appsforoffice.microsoft.com"),
    "Remote Office SDK excluded",
  );
  assert.ok(!source.includes("acceptedFileTypes"), "Canva export SDK excluded");
}
assert.equal(detectEditor("https://www.canva.com/design/abc/edit"), "canva");
assert.equal(
  detectEditor("https://powerpoint.cloud.microsoft/presentation/abc"),
  "powerpoint",
);
assert.equal(detectEditor("https://canva.com.attacker.example/design"), null);
assert.equal(detectEditor("file:///tmp/deck.pptx"), null);
const dom = new JSDOM(await readFile("extension/popup.html", "utf8"), {
  runScripts: "outside-only",
});
let opened = "";
dom.window.chrome = {
  tabs: {
    query: async () => [{ url: "https://www.canva.com/design/abc/edit" }],
    create: ({ url }) => {
      opened = url;
    },
  },
  runtime: { getURL: (path) => `chrome-extension://test/${path}` },
};
dom.window.detectEditor = detectEditor;
dom.window.eval(
  (await readFile("extension/popup.js", "utf8")).replace(
    'const { detectEditor } = await import("./detectEditor.js");',
    "const detectEditor = window.detectEditor;",
  ),
);
dom.window.document.querySelector("#scan").click();
await new Promise((r) => setTimeout(r, 10));
assert.equal(dom.window.document.querySelector("#result").hidden, false);
assert.match(
  dom.window.document.querySelector("#guidance").textContent,
  /registered VibeSlide app/,
);
dom.window.document.querySelector("#open").click();
assert.match(opened, /integration=extension&source=canva/);
console.log(
  "Extension ZIP, CSP, permissions, excluded SDKs, editor detection, and popup checks passed",
);
