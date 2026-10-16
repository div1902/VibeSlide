import { useEffect, useMemo, useState } from "react";
import type { Slide } from "../types";
import { layoutDeck } from "../lib/layoutEngine";
import {
  createScene,
  recommendDesign,
  type DesignSelection,
  type LayoutChoice,
} from "../lib/designScene";
import { designs } from "../vibes";
import SlidePreview from "./SlidePreview";

const layouts: { id: LayoutChoice; name: string }[] = [
  { id: "auto", name: "Suggested layout" },
  { id: "clean", name: "Clean structure" },
  { id: "cards", name: "Idea cards" },
  { id: "image", name: "Picture-led" },
];

export default function DesignStudio({
  slides,
  selection,
  onChange,
  disabled,
}: {
  slides: Slide[];
  selection: DesignSelection;
  onChange: (selection: DesignSelection) => void;
  disabled: boolean;
}) {
  const pages = useMemo(() => layoutDeck(slides), [slides]);
  const [pageIndex, setPageIndex] = useState(0);
  const activeIndex = Math.min(pageIndex, pages.length - 1);
  const page = pages[activeIndex];
  const recommendation = useMemo(() => recommendDesign(slides), [slides]);
  const choice = selection.layouts[page.sourceSlide] ?? "auto";
  const scene = createScene(page, selection.designId, choice);
  useEffect(() => {
    const navigate = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest("input,textarea,select,[contenteditable=true]") ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        setPageIndex((index) =>
          Math.max(
            0,
            Math.min(
              pages.length - 1,
              index + (event.key === "ArrowRight" ? 1 : -1),
            ),
          ),
        );
      }
    };
    window.addEventListener("keydown", navigate);
    return () => window.removeEventListener("keydown", navigate);
  }, [pages.length]);

  return (
    <section className="design-studio" aria-labelledby="design-title">
      <div className="studio-heading">
        <div>
          <span className="eyebrow green">
            SAME STORY. A DIFFERENT FEELING.
          </span>
          <h3 id="design-title">What’s the occasion?</h3>
          <p>
            These previews use your uploaded text and pictures. Pick a purpose,
            then fine-tune the layout.
          </p>
        </div>
        <span className="design-local">
          {slides.length} in → {pages.length} out
        </span>
      </div>
      <div
        className="purpose-grid"
        role="group"
        aria-label="Presentation purpose"
      >
        {designs.map((design) => (
          <button
            key={design.id}
            className={`purpose-card ${selection.designId === design.id ? "chosen" : ""}`}
            aria-label={`Choose ${design.name}`}
            aria-pressed={selection.designId === design.id}
            disabled={disabled}
            onClick={() => onChange({ ...selection, designId: design.id })}
          >
            <SlidePreview
              scene={createScene(page, design.id, choice)}
              label={`${design.name} preview of your slide ${page.sourceSlide + 1}`}
            />
            <span className="purpose-title">
              {design.name}
              <span>
                {selection.designId === design.id
                  ? "Selected ✓"
                  : recommendation.id === design.id
                    ? "Suggested"
                    : "Try this"}
              </span>
            </span>
            <span className="purpose-description">{design.description}</span>
          </button>
        ))}
      </div>
      <p className="design-recommendation">{recommendation.reason}</p>
      <div className="studio-preview-header">
        <div>
          <strong>
            {designs.find((design) => design.id === selection.designId)!.name}
          </strong>
          <span>
            {scene.label} · Slide {page.sourceSlide + 1}
          </span>
        </div>
        <div className="preview-navigation">
          <button
            type="button"
            aria-label="Previous preview slide"
            disabled={activeIndex === 0}
            onClick={() => setPageIndex(activeIndex - 1)}
          >
            ←
          </button>
          <span aria-live="polite">
            {activeIndex + 1} / {pages.length}
          </span>
          <button
            type="button"
            aria-label="Next preview slide"
            disabled={activeIndex === pages.length - 1}
            onClick={() => setPageIndex(activeIndex + 1)}
          >
            →
          </button>
        </div>
      </div>
      <div className="main-design-preview">
        <SlidePreview
          scene={scene}
          label={`Selected ${selection.designId} design, output slide ${activeIndex + 1}`}
        />
      </div>
      <p className="layout-reason">{scene.reason}</p>
      {scene.issues.length > 0 && (
        <div className="warnings" role="status">
          {scene.issues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
        </div>
      )}
      <div className="layout-choices">
        <label htmlFor="layout-choice">
          Layout for slide {page.sourceSlide + 1}
        </label>
        <select
          id="layout-choice"
          value={choice}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...selection,
              layouts: {
                ...selection.layouts,
                [page.sourceSlide]: event.target.value as LayoutChoice,
              },
            })
          }
        >
          {layouts.map((layout) => (
            <option
              key={layout.id}
              value={layout.id}
              disabled={
                layout.id === "image" && !slides[page.sourceSlide].images.length
              }
            >
              {layout.name}
            </option>
          ))}
        </select>
      </div>
      <div className="preview-filmstrip" aria-label="Output slides">
        {pages.map((item, index) => (
          <button
            key={index}
            aria-label={`Preview output slide ${index + 1}`}
            aria-current={activeIndex === index ? "true" : undefined}
            onClick={() => setPageIndex(index)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <span>{item.title || "Untitled slide"}</span>
            {item.images.length > 0 && (
              <span aria-label="Contains pictures">▧</span>
            )}
          </button>
        ))}
      </div>
      <p className="design-footnote">
        The preview and download share the same layout. Font rendering can vary
        in PowerPoint. Slide count stays unchanged. Review any small-text
        warnings before downloading.
      </p>
    </section>
  );
}
