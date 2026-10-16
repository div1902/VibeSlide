// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  readCanva,
  readPowerPoint,
  type OfficeFile,
  type OfficeDocument,
} from "./scanEditor";
import { powerPointManifest } from "./integrations";
import { MAX_FILE_BYTES } from "./parsePptx";

function office(
  slices = [
    [1, 2],
    [3, 4],
  ],
) {
  const close = vi.fn();
  const file: OfficeFile = {
    size: slices.flat().length,
    sliceCount: slices.length,
    closeAsync: close,
    getSliceAsync: (index, callback) =>
      callback({ status: "succeeded", value: { index, data: slices[index] } }),
  };
  const document: OfficeDocument = {
    getFileAsync: vi.fn((_type, _options, callback) =>
      callback({ status: "succeeded", value: file }),
    ),
  };
  return { file, document, close };
}
describe("PowerPoint complete-file scan", () => {
  it("assembles ordered slices byte for byte and releases the Office file", async () => {
    const mock = office(),
      progress: number[] = [];
    const result = await readPowerPoint(mock.document, undefined, (value) =>
      progress.push(value),
    );
    expect([...new Uint8Array(await result.arrayBuffer())]).toEqual([
      1, 2, 3, 4,
    ]);
    expect(result.name).toMatch(/\.pptx$/);
    expect(progress).toEqual([50, 100]);
    expect(mock.close).toHaveBeenCalledOnce();
  });
  it("closes oversize, incomplete, and failed files", async () => {
    for (const kind of ["size", "incomplete", "failed", "order"]) {
      const mock = office();
      if (kind === "size") mock.file.size = MAX_FILE_BYTES + 1;
      if (kind === "incomplete") mock.file.size = 10;
      if (kind === "failed")
        mock.file.getSliceAsync = (_, callback) =>
          callback({
            status: "failed",
            value: { index: 0, data: [] },
            error: { message: "Unavailable" },
          });
      if (kind === "order")
        mock.file.getSliceAsync = (_, callback) =>
          callback({ status: "succeeded", value: { index: 9, data: [1, 2] } });
      await expect(readPowerPoint(mock.document)).rejects.toThrow();
      expect(mock.close).toHaveBeenCalledOnce();
    }
  });
  it("cancels between slices and releases the file", async () => {
    const mock = office(),
      controller = new AbortController();
    await expect(
      readPowerPoint(mock.document, controller.signal, () =>
        controller.abort(),
      ),
    ).rejects.toThrow("cancelled");
    expect(mock.close).toHaveBeenCalledOnce();
  });
  it("releases a file that arrives after a timed-out request", async () => {
    vi.useFakeTimers();
    try {
      const mock = office();
      mock.document.getFileAsync = (_, __, cb) => {
        setTimeout(() => cb({ status: "succeeded", value: mock.file }), 31000);
      };
      const pending = expect(readPowerPoint(mock.document)).rejects.toThrow(
        "did not respond",
      );
      await vi.advanceTimersByTimeAsync(30000);
      await pending;
      await vi.advanceTimersByTimeAsync(1000);
      expect(mock.close).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
describe("Canva export scan", () => {
  it("downloads the SDK export locally with an explicit PowerPoint filename", async () => {
    const fetchFile = vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    const file = await readCanva(
      async () => ({
        status: "completed",
        title: "Our / deck",
        exportBlobs: [{ url: "https://export.canva.com/sample" }],
      }),
      undefined,
      fetchFile,
    );
    expect(file.name).toBe("Our - deck.pptx");
    expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([1, 2, 3]);
    expect(fetchFile).toHaveBeenCalledWith("https://export.canva.com/sample", {
      signal: undefined,
      credentials: "omit",
    });
  });
  it("does not fetch after cancellation or insecure export", async () => {
    const fetchFile = vi.fn();
    await expect(
      readCanva(async () => ({ status: "aborted" }), undefined, fetchFile),
    ).rejects.toThrow("cancelled");
    await expect(
      readCanva(
        async () => ({
          status: "completed",
          exportBlobs: [{ url: "http://example.com/deck" }],
        }),
        undefined,
        fetchFile,
      ),
    ).rejects.toThrow("unsupported");
    expect(fetchFile).not.toHaveBeenCalled();
  });
  it("caps exported bytes even when the server omits content-length", async () => {
    const fetchFile = vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array(MAX_FILE_BYTES + 1)));
    await expect(
      readCanva(
        async () => ({
          status: "completed",
          exportBlobs: [{ url: "https://export.canva.com/sample" }],
        }),
        undefined,
        fetchFile,
      ),
    ).rejects.toThrow("over 30 MB");
  });
});
describe("PowerPoint installation manifest", () => {
  it("uses the deployed URL and read-only document access", () => {
    const xml = powerPointManifest("https://slides.example/app/?old=query");
    expect(xml).toContain("https://slides.example/app/?integration=powerpoint");
    expect(xml).toContain("<Permissions>ReadAllDocument</Permissions>");
    expect(xml).not.toContain("ReadWrite");
  });
  it("requires HTTPS deployment", () => {
    expect(() => powerPointManifest("http://localhost:5173")).toThrow("HTTPS");
  });
});
