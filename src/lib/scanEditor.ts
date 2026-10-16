import { MAX_FILE_BYTES } from "./parsePptx";

const MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
type Result<T> = { status: string; value: T; error?: { message?: string } };
export interface OfficeFile {
  size: number;
  sliceCount: number;
  getSliceAsync(
    index: number,
    callback: (result: Result<{ index: number; data: number[] }>) => void,
  ): void;
  closeAsync(callback?: () => void): void;
}
export interface OfficeDocument {
  getFileAsync(
    type: string,
    options: { sliceSize: number },
    callback: (result: Result<OfficeFile>) => void,
  ): void;
}
interface OfficeRuntime {
  onReady(callback: (info: { host: string }) => void): void;
  context: { document: OfficeDocument };
}
const cancelled = (signal?: AbortSignal) => {
  if (signal?.aborted)
    throw new Error("Scan cancelled. Your presentation has not changed.");
};
function officeCall<T>(
  run: (callback: (result: Result<T>) => void) => void,
  onLate?: (value: T) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      reject(
        new Error(
          "PowerPoint did not respond. Reopen the add-in and try again.",
        ),
      );
    }, 30000);
    try {
      run((result) => {
        if (settled) {
          if (result.status === "succeeded") onLate?.(result.value);
          return;
        }
        settled = true;
        clearTimeout(timeout);
        if (result.status === "succeeded") resolve(result.value);
        else
          reject(
            new Error(
              result.error?.message ||
                "PowerPoint could not read this deck. Save it and try again, or upload a .pptx copy.",
            ),
          );
      });
    } catch (cause) {
      settled = true;
      clearTimeout(timeout);
      reject(cause);
    }
  });
}

/** Office's complete compressed-file API; no DOM scraping or screenshot reconstruction. */
export async function readPowerPoint(
  document: OfficeDocument,
  signal?: AbortSignal,
  progress?: (percent: number) => void,
): Promise<File> {
  cancelled(signal);
  const file = await officeCall<OfficeFile>(
    (callback) =>
      document.getFileAsync("compressed", { sliceSize: 65536 }, callback),
    (late) => late.closeAsync(),
  );
  try {
    if (
      !Number.isSafeInteger(file.size) ||
      file.size <= 0 ||
      file.size > MAX_FILE_BYTES ||
      !Number.isSafeInteger(file.sliceCount) ||
      file.sliceCount < 1 ||
      file.sliceCount > 10000
    )
      throw new Error(
        "This deck is empty or over the 30 MB scan limit. Export a smaller .pptx.",
      );
    const parts: Uint8Array<ArrayBuffer>[] = [];
    let bytes = 0;
    for (let index = 0; index < file.sliceCount; index++) {
      cancelled(signal);
      const slice = await officeCall<{ index: number; data: number[] }>(
        (callback) => file.getSliceAsync(index, callback),
      );
      cancelled(signal);
      if (
        slice.index !== index ||
        !Array.isArray(slice.data) ||
        slice.data.some(
          (byte) => !Number.isInteger(byte) || byte < 0 || byte > 255,
        )
      )
        throw new Error(
          "PowerPoint returned an incomplete file. Please try scanning again.",
        );
      const part = new Uint8Array(slice.data);
      bytes += part.byteLength;
      if (bytes > MAX_FILE_BYTES || bytes > file.size)
        throw new Error(
          "The scanned file exceeded its expected size. Please export a .pptx instead.",
        );
      parts.push(part);
      progress?.(Math.round(((index + 1) / file.sliceCount) * 100));
    }
    if (bytes !== file.size)
      throw new Error(
        "PowerPoint returned an incomplete file. Please try scanning again.",
      );
    return new File(parts, "open-presentation.pptx", { type: MIME });
  } finally {
    file.closeAsync();
  }
}

let officeReady: Promise<OfficeRuntime> | undefined;
async function loadOffice(): Promise<OfficeRuntime> {
  if (location.protocol !== "https:" && location.hostname !== "localhost")
    throw new Error(
      "Open the installed VibeSlide add-in inside PowerPoint, or upload an exported .pptx below.",
    );
  if (!officeReady)
    officeReady = new Promise<OfficeRuntime>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              "Open VibeSlide as a PowerPoint add-in to scan the open deck. You can also upload a .pptx below.",
            ),
          ),
        20000,
      );
      const ready = () => {
        const office = (window as Window & { Office?: OfficeRuntime }).Office;
        if (!office) {
          clearTimeout(timer);
          reject(
            new Error(
              "PowerPoint could not load its add-in library. Try uploading a .pptx.",
            ),
          );
          return;
        }
        office.onReady((info) => {
          clearTimeout(timer);
          if (info.host !== "PowerPoint")
            reject(
              new Error(
                "Scan is available inside the PowerPoint add-in. Open it in PowerPoint or upload a .pptx.",
              ),
            );
          else resolve(office);
        });
      };
      if ((window as Window & { Office?: OfficeRuntime }).Office) ready();
      else {
        const script = document.createElement("script");
        script.src =
          "https://appsforoffice.microsoft.com/lib/1/hosted/office.js";
        script.onload = ready;
        script.onerror = () => {
          clearTimeout(timer);
          reject(
            new Error(
              "The PowerPoint library could not load. Check your connection or upload a .pptx.",
            ),
          );
        };
        document.head.append(script);
      }
    }).catch((error) => {
      officeReady = undefined;
      throw error;
    });
  return officeReady;
}

export type CanvaExport =
  | { status: "aborted" }
  | { status: "completed"; title?: string; exportBlobs: { url: string }[] };
export async function readCanva(
  request: () => Promise<CanvaExport>,
  signal?: AbortSignal,
  fetchFile: typeof fetch = fetch,
): Promise<File> {
  cancelled(signal);
  const result = await request();
  cancelled(signal);
  if (result.status !== "completed")
    throw new Error("Export cancelled. Choose Scan when you are ready.");
  if (result.exportBlobs.length !== 1)
    throw new Error(
      "Choose PowerPoint (.pptx) in Canva’s export dialog and export one presentation.",
    );
  const url = new URL(result.exportBlobs[0].url);
  if (url.protocol !== "https:")
    throw new Error(
      "Canva returned an unsupported export link. Please download and upload a .pptx instead.",
    );
  const response = await fetchFile(url.href, { signal, credentials: "omit" });
  if (!response.ok || !response.body)
    throw new Error(
      "The Canva export could not be downloaded. Please try again or upload its .pptx file.",
    );
  if (Number(response.headers.get("content-length")) > MAX_FILE_BYTES) {
    await response.body.cancel();
    throw new Error("The Canva export is over 30 MB. Export fewer pages.");
  }
  const reader = response.body.getReader(),
    parts: Uint8Array<ArrayBuffer>[] = [];
  let bytes = 0;
  try {
    while (true) {
      cancelled(signal);
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_FILE_BYTES)
        throw new Error("The Canva export is over 30 MB. Export fewer pages.");
      parts.push(new Uint8Array(value));
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  cancelled(signal);
  if (!bytes)
    throw new Error("Canva returned an empty export. Please try again.");
  const title = (result.title || "canva-presentation")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .slice(0, 100);
  return new File(parts, `${title.replace(/\.pptx$/i, "")}.pptx`, {
    type: MIME,
  });
}

export async function scanEditor(
  host: "powerpoint" | "canva",
  signal?: AbortSignal,
  progress?: (percent: number) => void,
): Promise<File> {
  if (host === "powerpoint") {
    const office = await loadOffice();
    return readPowerPoint(office.context.document, signal, progress);
  }
  if (window.parent === window)
    throw new Error(
      "Open the registered VibeSlide app inside Canva to scan. Otherwise use Canva’s Share → Download → PowerPoint, then upload it below.",
    );
  const { requestExport } = await import("@canva/design");
  return readCanva(
    () => requestExport({ acceptedFileTypes: ["pptx"] }),
    signal,
  );
}
