import { useState } from "react";
import { powerPointManifest } from "../lib/integrations";

export default function EditorScan({
  scope,
  onScope,
  onScan,
  busy,
}: {
  scope: string;
  onScope: (value: string) => void;
  onScan: (host: "powerpoint" | "canva") => void;
  busy: boolean;
}) {
  const integration =
    import.meta.env.VITE_INTEGRATION ||
    new URLSearchParams(location.search).get("integration");
  const host =
    integration === "canva" || integration === "powerpoint"
      ? integration
      : null;
  const extension = location.protocol === "chrome-extension:";
  const [error, setError] = useState("");
  const manifest = () => {
    try {
      const url = URL.createObjectURL(
        new Blob([powerPointManifest(location.href)], {
          type: "application/xml",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "vibeslide-powerpoint.xml";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The manifest could not be created.",
      );
    }
  };
  return (
    <section className="editor-scan" aria-label="Scan and integrations">
      <div>
        <span className="eyebrow green">YOUR DECK. SAME SLIDE COUNT.</span>
        <h2>
          {host
            ? `Scan ${host === "canva" ? "Canva" : "PowerPoint"}`
            : "Start with your open presentation"}
        </h2>
        <p>
          {host
            ? "Read the exported deck, choose a vibe, then download a separate redesigned copy. Your open presentation stays unchanged."
            : "Upload a PowerPoint export from Canva or PowerPoint. On desktop, add VibeSlide to Chrome for quick access while you work."}
        </p>
      </div>
      <label className="slide-scope">
        Slides to redesign
        <input
          value={scope}
          onChange={(event) => onScope(event.target.value)}
          disabled={busy}
          placeholder="all, or 1-3, 5"
          aria-describedby="scope-hint"
        />
        <small id="scope-hint">
          Use “all” or page numbers such as 1-3, 5. Numbers refer to the
          imported file. The output keeps exactly this many slides, in source
          order.
        </small>
      </label>
      {host && (
        <>
          <button
            className="button button-primary"
            disabled={busy}
            onClick={() => onScan(host)}
          >
            {busy ? "Reading your deck…" : "Scan open presentation"}
          </button>
          <p className="integration-note">
            {host === "canva"
              ? "Requires the registered Canva app. Canva prepares the export through its own service; VibeSlide processes the resulting .pptx locally. Choose all pages in Canva to use original slide numbers here."
              : "Requires the installed PowerPoint add-in and a host that supports complete-file access. Save recent changes before scanning."}
          </p>
        </>
      )}
      {!host && (
        <details className="integration-help">
          <summary>Use on iPad, Chrome, Canva, or PowerPoint</summary>
          <p>
            <strong>iPad Chrome:</strong> use this website. Export your
            presentation as .pptx, save to Files, then choose it below. Chrome
            on iPad cannot install desktop Chrome extensions.
          </p>
          <p>
            <strong>Desktop Chrome:</strong>{" "}
            {extension ? (
              "You are using the extension. Import your exported .pptx below."
            ) : (
              <a
                href={`${import.meta.env.BASE_URL}vibeslide-extension.zip`}
                download
              >
                Download the extension ZIP
              </a>
            )}{" "}
            Unzip, open chrome://extensions, enable Developer mode, and use Load
            unpacked. The extension detects the editor and guides export;
            full-deck scanning requires its editor integration.
          </p>
          <p>
            <strong>PowerPoint:</strong> download the manifest from this
            deployed HTTPS website, then install it through PowerPoint’s add-in
            upload/catalog options. Account administrators may need to enable
            custom add-ins.
          </p>
          {!extension && (
            <button className="button button-secondary" onClick={manifest}>
              Download PowerPoint manifest
            </button>
          )}
          <p>
            <strong>Canva:</strong> a developer must register VibeSlide in
            Canva’s developer portal, enable the Design Editor intent, and
            upload the app bundle. Scan uses Canva’s PowerPoint export dialog.
            This app is not yet listed in Canva’s marketplace.
          </p>
          {!extension && !host && (
            <p>
              <a
                href={`${import.meta.env.BASE_URL}vibeslide-canva.js`}
                download
              >
                Download Canva app bundle
              </a>
            </p>
          )}
          <p>
            <a
              href="https://github.com/div1902/VibeSlide/blob/main/docs/integrations.md"
              target="_blank"
              rel="noreferrer"
            >
              Installation guide and supported platforms ↗
            </a>
          </p>
        </details>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
