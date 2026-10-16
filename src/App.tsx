import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_FILE_BYTES, parsePptx } from "./lib/parsePptx";
import { applyTextEdits, suggestText } from "./lib/improveText";
import EditorScan from "./components/EditorScan";
import { scanEditor } from "./lib/scanEditor";
import { selectSlides } from "./lib/layoutEngine";
import TextReview from "./components/TextReview";
import DesignStudio from "./components/DesignStudio";
import { recommendDesign, type DesignSelection } from "./lib/designScene";
import type { ParseProgress, Slide } from "./types";

type IconName =
  | "upload"
  | "arrow"
  | "lock"
  | "file"
  | "check"
  | "close"
  | "download"
  | "chevron"
  | "image"
  | "spark";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5" />
        <path d="M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h16m-6-6 6 6-6 6" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8m-8 4h5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8" cy="8" r="1.5" />
        <path d="m3 17 6-6 4 4 3-3 5 5" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function Brand() {
  return (
    <a
      className="brand"
      href={`${import.meta.env.BASE_URL}index.html`}
      aria-label="VibeSlide home"
    >
      <span className="brand-mark">
        v
        <span>
          <Icon name="arrow" size={10} />
        </span>
      </span>
      VibeSlide<span className="brand-dot">.</span>
    </a>
  );
}

function DeckArtwork() {
  return (
    <div
      className="deck-art"
      aria-label="Illustration of possible future slide styles"
    >
      <div className="art-orbit orbit-one" />
      <div className="art-orbit orbit-two" />
      <span className="art-star star-one">✳</span>
      <span className="art-star star-two">+</span>
      <div className="mini-slide mini-back">
        <span className="mini-label">QUARTERLY REVIEW</span>
        <div className="mini-back-title">
          Good ideas.
          <br />
          Bigger impact.
        </div>
        <div className="bar-chart">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <span className="mini-page">01 / 06</span>
      </div>
      <div className="mini-slide mini-front">
        <div className="mini-top">
          <span>THE NEXT CHAPTER</span>
          <Icon name="arrow" size={14} />
        </div>
        <div className="mini-headline">
          A fresh
          <br />
          <em>perspective.</em>
        </div>
        <div className="mini-bottom">
          <span>Same story. A whole new feeling.</span>
          <span>01 —</span>
        </div>
        <div className="sunburst" />
      </div>
      <span className="art-caption">
        <span className="tiny-spark">✦</span> YOUR CONTENT. NEW ENERGY.
      </span>
      <span className="art-note">a taste of what’s next</span>
    </div>
  );
}

function Steps({ complete }: { complete: boolean }) {
  return (
    <ol className="steps" aria-label="Deck restyling stages">
      <li className="step active">
        <span className="step-number">
          {complete ? <Icon name="check" size={14} /> : "01"}
        </span>
        <span>Upload your deck</span>
        <span className="step-tag">{complete ? "DONE" : "START HERE"}</span>
      </li>
      <li className="step-line" aria-hidden="true" />
      <li className={complete ? "step active" : "step future"}>
        <span className="step-number">02</span>
        <span>Choose your design</span>
      </li>
      <li className="step-line" aria-hidden="true" />
      <li className="step future">
        <span className="step-number">03</span>
        <span>Download your deck</span>
      </li>
    </ol>
  );
}

function downloadJson(slides: Slide[], filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(slides, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename.replace(/\.pptx$/i, "")}-extracted.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ExtractedDeck({
  slides: originalSlides,
  filename,
  warnings,
  onReset,
}: {
  slides: Slide[];
  filename: string;
  warnings: string[];
  onReset: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const [view, setView] = useState<"json" | "content" | "review">("review");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [designSelection, setDesignSelection] = useState<DesignSelection>(
    () => ({ designId: recommendDesign(originalSlides).id, layouts: {} }),
  );
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [exportError, setExportError] = useState("");
  const [prepared, setPrepared] = useState<string | null>(null);
  const mounted = useRef(true);
  const slides = useMemo(
    () => applyTextEdits(originalSlides, edits),
    [originalSlides, edits],
  );
  const suggestions = useMemo(
    () => suggestText(originalSlides),
    [originalSlides],
  );
  const available = suggestions.filter(
    (item) => item.original !== item.suggested,
  ).length;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(
    () => () => {
      if (prepared) URL.revokeObjectURL(prepared);
    },
    [prepared],
  );
  function changeEdit(id: string, value?: string) {
    setEdits((current) => {
      const next = { ...current };
      if (value === undefined) delete next[id];
      else next[id] = value;
      return next;
    });
    setPrepared(null);
    setExportError("");
  }
  function changeDesign(next: DesignSelection) {
    setDesignSelection(next);
    setPrepared(null);
    setExportError("");
  }
  async function preparePowerPoint() {
    setExportError("");
    setExportProgress(0);
    try {
      const { exportPptx } = await import("./lib/exportPptx");
      const data = await exportPptx(
        slides,
        (percent) => {
          if (mounted.current) setExportProgress(percent);
        },
        designSelection,
      );
      if (mounted.current)
        setPrepared(
          URL.createObjectURL(
            new Blob([data], {
              type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            }),
          ),
        );
    } catch (cause) {
      if (mounted.current)
        setExportError(
          cause instanceof Error
            ? cause.message
            : "We couldn’t rebuild this deck. An extracted image may be unsupported. You can still download the reviewed JSON or try another deck.",
        );
    } finally {
      if (mounted.current) setExportProgress(null);
    }
  }
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const current = slides[selected];
  const imageCount = slides.reduce(
    (count, slide) => count + slide.images.length,
    0,
  );
  const bulletCount = slides.reduce(
    (count, slide) => count + slide.bullets.length,
    0,
  );
  const json = JSON.stringify(
    current,
    (key, value: unknown) => {
      if (key === "dataUrl" && typeof value === "string" && value.length > 120)
        return `${value.slice(0, 65)}… [${value.length.toLocaleString()} characters; full data in JSON download]`;
      return value;
    },
    2,
  );

  return (
    <section className="results" aria-labelledby="results-title">
      <div className="result-heading">
        <div>
          <span className="eyebrow green">
            <Icon name="check" size={15} /> DECK UNPACKED
          </span>
          <h2 id="results-title" ref={heading} tabIndex={-1}>
            Your content. A whole new look.
          </h2>
          <p className="result-filename">{filename}</p>
        </div>
        <button
          className="button button-secondary"
          onClick={onReset}
          disabled={exportProgress !== null}
        >
          <Icon name="upload" size={16} /> Upload another
        </button>
      </div>
      <div className="deck-summary">
        <span>
          <strong>{slides.length}</strong> slides
        </span>
        <span>
          <strong>{bulletCount}</strong> text blocks
        </span>
        <span>
          <strong>{imageCount}</strong> images
        </span>
        <span className="summary-private">
          <Icon name="lock" size={13} /> Still just on your device
        </span>
      </div>
      {warnings.length > 0 && (
        <details className="warnings">
          <summary>
            {warnings.length} reading {warnings.length === 1 ? "note" : "notes"}{" "}
            — some content was skipped
          </summary>
          <ul>
            {warnings.slice(0, 8).map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
          {warnings.length > 8 && (
            <p>
              And {warnings.length - 8} more. The remaining readable content is
              shown below.
            </p>
          )}
        </details>
      )}
      <DesignStudio
        slides={slides}
        selection={designSelection}
        onChange={changeDesign}
        disabled={exportProgress !== null}
      />
      <details className="optional-text-tools">
        <summary>Optional: edit wording or inspect extracted content</summary>
        <div className="review-summary">
          <span>
            <strong>{available}</strong> wording suggestions ·{" "}
            <strong>{Object.keys(edits).length}</strong> edits selected
          </span>
          <span>Your wording stays unchanged unless you select an edit.</span>
        </div>
        <div className="inspector">
          <nav className="slide-list" aria-label="Extracted slides">
            <div className="list-heading">
              YOUR SLIDES <span>{String(slides.length).padStart(2, "0")}</span>
            </div>
            {slides.map((slide, index) => (
              <button
                key={index}
                className={`slide-item ${selected === index ? "selected" : ""}`}
                aria-current={selected === index ? "true" : undefined}
                onClick={() => setSelected(index)}
              >
                <span className="slide-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{slide.title || "Untitled slide"}</span>
                <Icon name="chevron" size={14} />
              </button>
            ))}
          </nav>
          <div className="inspector-main">
            <div className="inspector-toolbar">
              <span>SLIDE {String(selected + 1).padStart(2, "0")}</span>
              <div
                className="view-toggle"
                role="group"
                aria-label="Content display"
              >
                <button
                  aria-pressed={view === "review"}
                  onClick={() => setView("review")}
                >
                  Improve text
                </button>
                <button
                  aria-pressed={view === "json"}
                  onClick={() => setView("json")}
                >
                  JSON
                </button>
                <button
                  aria-pressed={view === "content"}
                  onClick={() => setView("content")}
                >
                  Content
                </button>
              </div>
            </div>
            {view === "json" ? (
              <pre
                className="json-code"
                tabIndex={0}
                aria-label={`Extracted JSON for slide ${selected + 1}`}
              >
                <code>{json}</code>
              </pre>
            ) : view === "review" ? (
              <TextReview
                suggestions={suggestions.filter(
                  (item) => item.slideIndex === selected,
                )}
                edits={edits}
                onApply={(id, value) => changeEdit(id, value)}
                onKeep={(id) => changeEdit(id)}
                disabled={exportProgress !== null}
              />
            ) : (
              <article className="content-preview">
                <h3>{current.title || "Untitled slide"}</h3>
                {current.bullets.length > 0 && (
                  <ul>
                    {current.bullets.map((bullet, index) => (
                      <li
                        key={index}
                        style={{ marginLeft: `${bullet.level * 16}px` }}
                      >
                        {bullet.text}
                        <span className="level-label">
                          level {bullet.level}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {current.stats.length > 0 && (
                  <div className="stat-list">
                    {current.stats.map((stat, index) => (
                      <span key={index}>{stat}</span>
                    ))}
                  </div>
                )}
                {current.images.map((image, index) => (
                  <img
                    className="extracted-image"
                    key={index}
                    src={image.dataUrl}
                    alt={image.alt}
                  />
                ))}
                {current.notes && (
                  <div className="speaker-notes">
                    <span>SPEAKER NOTES</span>
                    <p>{current.notes}</p>
                  </div>
                )}
                {!current.title &&
                  !current.bullets.length &&
                  !current.images.length &&
                  !current.stats.length && (
                    <p className="muted">
                      No supported text or images on this slide.
                    </p>
                  )}
              </article>
            )}
            <div className="inspector-footnote">
              {view === "json"
                ? "Image data is shortened here. Download JSON for complete data URLs."
                : view === "review"
                  ? "Edits are optional. Unselected text, numbers, images, and notes are kept as extracted."
                  : "Content shows your selected edits. Original formatting is not retained."}
            </div>
          </div>
        </div>
      </details>
      <div className="result-footer">
        <div>
          <Icon name="spark" size={18} />
          <span>
            Your content. Your chosen design.
            <small>
              Download the design you previewed, with your text and pictures.
            </small>
          </span>
        </div>
        <div className="download-actions">
          <button
            className="button button-secondary"
            onClick={() => downloadJson(slides, filename)}
          >
            <Icon name="download" size={16} /> Download JSON
          </button>
          {prepared ? (
            <a
              className="button button-primary"
              href={prepared}
              download={`${filename.replace(/\.pptx$/i, "")}-${designSelection.designId}.pptx`}
            >
              Download .pptx <Icon name="download" size={16} />
            </a>
          ) : (
            <button
              className="button button-primary"
              disabled={exportProgress !== null}
              onClick={() => void preparePowerPoint()}
            >
              {exportProgress === null
                ? "Create new .pptx"
                : `Building… ${exportProgress}%`}
            </button>
          )}
        </div>
      </div>
      <p className="export-note">
        Rebuilt in your chosen design from extracted content. Original
        formatting, grouped shapes, charts, and animations are not preserved.
        Your source file stays untouched.
      </p>
      {exportProgress !== null && (
        <div className="export-progress" role="status">
          <span>Building your PowerPoint… {exportProgress}%</span>
          <progress
            aria-label="Generating PowerPoint"
            max={100}
            value={exportProgress}
          />
        </div>
      )}
      {prepared && (
        <p className="export-ready" role="status">
          Your new PowerPoint is ready. Tap “Download .pptx” to save it to your
          device.
        </p>
      )}
      {exportError && (
        <p className="error-message" role="alert">
          {exportError}
        </p>
      )}
    </section>
  );
}

export default function App() {
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [filename, setFilename] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const [dragging, setDragging] = useState(false);
  const [scope, setScope] = useState("all");

  useEffect(() => () => controller.current?.abort(), []);

  function reset() {
    controller.current?.abort();
    controller.current = null;
    setProgress(null);
    setSlides(null);
    setError("");
    setWarnings([]);
    if (input.current) input.current.value = "";
  }

  async function readDeck(file: File, job: AbortController) {
    const messages: string[] = [];
    const result = await parsePptx(file, {
      signal: job.signal,
      onProgress: (next) => {
        if (!job.signal.aborted) setProgress(next);
      },
      onWarning: (warning) => {
        if (messages.length < 100) messages.push(warning);
      },
    });
    if (job.signal.aborted) return;
    setSlides(selectSlides(result, scope));
    setFilename(file.name);
    setWarnings(messages);
    setProgress(null);
  }

  async function openFile(file?: File, sample = false) {
    if (!file && !sample) return;
    controller.current?.abort();
    const job = new AbortController();
    controller.current = job;
    setError("");
    setSlides(null);
    setWarnings([]);
    setProgress({
      percent: 1,
      message: sample ? "Getting the sample deck…" : "Getting your deck ready…",
    });
    try {
      if (sample) {
        const response = await fetch(`${import.meta.env.BASE_URL}sample.pptx`, {
          signal: job.signal,
        });
        if (!response.ok)
          throw new Error(
            "The sample deck could not be loaded. Please try uploading your own .pptx.",
          );
        file = new File([await response.blob()], "sample.pptx", {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        });
      }
      await readDeck(file!, job);
    } catch (cause) {
      if (job.signal.aborted) return;
      setProgress(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Something went wrong while reading this file. Please try another .pptx.",
      );
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function scanOpenDeck(host: "powerpoint" | "canva") {
    controller.current?.abort();
    const job = new AbortController();
    controller.current = job;
    setError("");
    setWarnings([]);
    setSlides(null);
    setProgress({
      percent: 1,
      message: "Waiting for the editor to export your deck…",
    });
    try {
      const file = await scanEditor(host, job.signal, (percent) => {
        if (!job.signal.aborted)
          setProgress({ percent, message: "Reading the open presentation…" });
      });
      if (!job.signal.aborted) await readDeck(file, job);
    } catch (cause) {
      if (!job.signal.aborted) {
        setProgress(null);
        setError(
          cause instanceof Error
            ? cause.message
            : "The editor could not export this deck. Try uploading a .pptx.",
        );
      }
    }
  }

  function receiveFiles(files: FileList | null) {
    setDragging(false);
    if (!files?.length) return;
    if (files.length > 1) {
      setError("One deck at a time, please. Choose a single .pptx file.");
      return;
    }
    void openFile(files[0]);
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <Brand />
        <div className="header-right">
          <span className="local-badge">
            <span /> 100% in your browser
          </span>
          <a className="header-cta" href="#workspace">
            Let’s make it slide <Icon name="arrow" size={17} />
          </a>
        </div>
      </header>
      <main>
        <section
          className={`hero ${slides || import.meta.env.VITE_INTEGRATION || new URLSearchParams(location.search).has("integration") ? "hero-hidden" : ""}`}
        >
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="status-dot" /> BIG IDEAS DESERVE BETTER SLIDES
            </span>
            <h1>
              Make your deck
              <br />
              look like you
              <br />
              <em>meant it.</em>
              <span className="headline-star">✳</span>
            </h1>
            <p>
              Your story deserves a little main-character energy.
              <br className="desktop-break" /> Start with your PowerPoint. We’ll
              find the good stuff.
            </p>
            <div className="hero-details">
              <span>
                <Icon name="lock" size={14} /> Your files stay yours
              </span>
              <span className="detail-dot">·</span>
              <span>No sign-up. No uploads.</span>
            </div>
          </div>
          <DeckArtwork />
        </section>
        <section
          className="workspace"
          id="workspace"
          aria-label="Deck workspace"
        >
          <div className="workspace-top">
            <Steps complete={!!slides} />
            <span className="workspace-status">
              YOUR PRIVATE DECK WORKSPACE
            </span>
          </div>
          {!slides && (
            <EditorScan
              scope={scope}
              onScope={setScope}
              onScan={(host) => void scanOpenDeck(host)}
              busy={!!progress}
            />
          )}
          {slides ? (
            <ExtractedDeck
              key={filename}
              slides={slides}
              filename={filename}
              warnings={warnings}
              onReset={reset}
            />
          ) : (
            <div className="upload-section">
              <div className="upload-copy">
                <span className="section-index">THE FIRST MOVE</span>
                <h2>
                  Good deck.
                  <br />
                  <span>Great potential.</span>
                </h2>
                <p>
                  Drop in your presentation. We’ll pull out the words, images,
                  and numbers that make it yours.
                </p>
                <ul className="upload-features">
                  <li>
                    <span>
                      <Icon name="check" size={13} />
                    </span>{" "}
                    Text &amp; bullet structure
                  </li>
                  <li>
                    <span>
                      <Icon name="check" size={13} />
                    </span>{" "}
                    Images &amp; key stats
                  </li>
                  <li>
                    <span>
                      <Icon name="check" size={13} />
                    </span>{" "}
                    Speaker notes, too
                  </li>
                </ul>
                <div className="stage-note">
                  <span className="stage-dot" /> First up: see what’s inside
                  your deck.
                  <br />
                  <span className="stage-note-indent">
                    Choose your edits. Download a fresh deck.
                  </span>
                </div>
              </div>
              <div className="upload-area">
                <input
                  ref={input}
                  id="deck-file"
                  type="file"
                  accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  onChange={(event) => receiveFiles(event.target.files)}
                  className="visually-hidden"
                  tabIndex={-1}
                  aria-label="Upload a PowerPoint presentation"
                />
                <div
                  className={`drop-zone ${dragging ? "dragging" : ""} ${progress ? "processing" : ""} ${error ? "has-error" : ""}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    if (!progress) setDragging(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = progress ? "none" : "copy";
                  }}
                  onDragLeave={(event) => {
                    if (
                      !(event.relatedTarget instanceof Node) ||
                      !event.currentTarget.contains(event.relatedTarget)
                    )
                      setDragging(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    if (!progress) receiveFiles(event.dataTransfer.files);
                  }}
                >
                  {progress ? (
                    <div
                      className="progress-content"
                      role="status"
                      aria-live="polite"
                    >
                      <div className="upload-icon processing-icon">
                        <Icon name="file" size={28} />
                      </div>
                      <h3>Finding the good stuff.</h3>
                      <p>{progress.message}</p>
                      <div
                        className="progress-track"
                        role="progressbar"
                        aria-label="Reading presentation"
                        aria-valuenow={progress.percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span style={{ width: `${progress.percent}%` }} />
                      </div>
                      <span className="progress-percent">
                        {progress.percent}%
                      </span>
                      <button
                        className="text-button cancel-button"
                        onClick={reset}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="upload-icon">
                        <Icon name="upload" size={26} />
                        <span className="icon-spark">✦</span>
                      </div>
                      <h3>
                        {dragging ? "This is the spot." : "Drop your deck here"}
                      </h3>
                      <p>Give that .pptx a fresh start.</p>
                      <button
                        className="button button-primary choose-file"
                        onClick={() => input.current?.click()}
                      >
                        Choose a file <Icon name="arrow" size={17} />
                      </button>
                      <span className="file-limit">
                        .pptx only <span>·</span> Up to{" "}
                        {MAX_FILE_BYTES / 1024 / 1024} MB
                      </span>
                    </>
                  )}
                </div>
                {error && (
                  <div className="error-message" role="alert">
                    <span className="error-symbol">!</span>
                    <p>{error}</p>
                    <button
                      className="icon-button"
                      aria-label="Dismiss error"
                      onClick={() => setError("")}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                )}
                {import.meta.env.VITE_INTEGRATION !== "canva" && (
                  <div className="sample-prompt">
                    <span>No deck handy?</span>
                    <button
                      className="text-button"
                      disabled={!!progress}
                      onClick={() => void openFile(undefined, true)}
                    >
                      Try our sample <Icon name="arrow" size={14} />
                    </button>
                    <a
                      className="sample-download"
                      href={`${import.meta.env.BASE_URL}sample.pptx`}
                      download
                      aria-label="Download the sample PowerPoint"
                    >
                      <Icon name="download" size={15} />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
        <div className="trust-row">
          <span>
            <Icon name="lock" size={15} /> Local by design. Private by default.
          </span>
          <p>
            Your presentation never leaves your browser. No server, no storage,
            no surprises.
          </p>
        </div>
      </main>
      <footer className="site-footer">
        <Brand />
        <span>A little less corporate. A little more you.</span>
        <span className="footer-version">
          EARLY DAYS, GOOD VIBES <Icon name="arrow" size={17} />
        </span>
      </footer>
    </div>
  );
}
