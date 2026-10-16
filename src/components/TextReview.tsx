import { useState } from "react";
import type { TextSuggestion } from "../lib/improveText";

function SuggestionCard({
  suggestion,
  applied,
  onApply,
  onKeep,
  disabled,
}: {
  suggestion: TextSuggestion;
  applied?: string;
  onApply: (text: string) => void;
  onKeep: () => void;
  disabled: boolean;
}) {
  const [text, setText] = useState(applied ?? suggestion.suggested);
  const changed = suggestion.original !== suggestion.suggested;
  const selected = applied !== undefined;
  return (
    <article className={`suggestion-card ${selected ? "accepted" : ""}`}>
      <div className="suggestion-heading">
        <strong>
          {suggestion.bulletIndex === undefined
            ? "Slide title"
            : `Text block ${suggestion.bulletIndex + 1}`}
        </strong>
        <span>
          {selected ? "Selected for download" : "Original will be used"}
        </span>
      </div>
      <div className="suggestion-comparison">
        <div>
          <span className="review-label">ORIGINAL</span>
          <p>{suggestion.original || "No title"}</p>
        </div>
        <label>
          <span className="review-label">
            {changed ? "SUGGESTED · EDITABLE" : "EDIT YOUR VERSION"}
          </span>
          <textarea
            aria-label={
              suggestion.bulletIndex === undefined
                ? "Improved slide title"
                : `Improved text block ${suggestion.bulletIndex + 1}`
            }
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={disabled}
            rows={3}
          />
        </label>
      </div>
      <p className="suggestion-reason">
        {suggestion.reasons.join(" ") ||
          "No automatic wording changes needed. You can still write your own version."}
      </p>
      <div className="suggestion-actions">
        <button
          className="button button-primary"
          disabled={
            disabled ||
            !text.trim() ||
            text === suggestion.original ||
            applied === text
          }
          onClick={() => {
            const value = text.trim();
            setText(value);
            onApply(value);
          }}
        >
          {applied === text ? "Selected" : "Use this version"}
        </button>
        <button
          className="button button-secondary"
          disabled={disabled}
          onClick={() => {
            onKeep();
            setText(suggestion.suggested);
          }}
        >
          Keep original
        </button>
        {selected && applied !== text && (
          <span className="muted">
            Unapplied changes — choose “Use this version” to include them.
          </span>
        )}
      </div>
    </article>
  );
}

export default function TextReview({
  suggestions,
  edits,
  onApply,
  onKeep,
  disabled,
}: {
  suggestions: TextSuggestion[];
  edits: Record<string, string>;
  onApply: (id: string, value: string) => void;
  onKeep: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="text-review">
      <p className="review-intro">
        Choose the wording you like, or write your own. Only edits you select
        are included in the new deck. Suggestions shorten common English
        phrases; review them for meaning.
      </p>
      {suggestions.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          applied={edits[suggestion.id]}
          onApply={(text) => onApply(suggestion.id, text)}
          onKeep={() => onKeep(suggestion.id)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
