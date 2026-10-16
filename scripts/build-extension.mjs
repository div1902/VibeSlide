import { execFileSync } from "node:child_process";
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import JSZip from "jszip";
// Build from the same application source with relative URLs and no hosted SDK code.
execFileSync(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "build",
    "--base=./",
    "--outDir=dist-extension",
    "--emptyOutDir",
  ],
  { stdio: "inherit", env: { ...process.env, VIBESLIDE_EXTENSION: "1" } },
);
await cp("extension", "dist-extension", { recursive: true });
const zip = new JSZip();
async function add(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`,
      name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) await add(path, `${name}/`);
    else zip.file(name, await readFile(path));
  }
}
await add("dist-extension");
await mkdir("dist", { recursive: true });
await writeFile(
  "dist/vibeslide-extension.zip",
  await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
);
console.log(
  "Chrome extension: dist-extension/ and dist/vibeslide-extension.zip",
);
