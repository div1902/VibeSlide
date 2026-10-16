// The extension ships no remote editor SDKs; those run only in the hosted editor app.
export async function scanEditor(
  _host: "powerpoint" | "canva",
  _signal?: AbortSignal,
  _progress?: (percent: number) => void,
): Promise<File> {
  throw new Error(
    "Open the installed VibeSlide app inside your editor for a full-deck scan, or upload an exported .pptx here.",
  );
}
