import { describe, expect, it } from "vitest";
import { applyTextEdits, improveText, suggestText } from "./improveText";
import type { Slide } from "../types";
const slide: Slide = {
  title: "In order to grow",
  bullets: [{ text: "We utilize $3.2M to grow 42%.", level: 1 }],
  stats: ["42%"],
  images: [{ dataUrl: "data:image/png;base64,abc", alt: "Chart" }],
  notes: "Private notes",
};
describe("text improvement", () => {
  it("simplifies phrasing without changing figures or negation", () => {
    expect(
      improveText(
        "We are able to utilize $3.2M in order to grow 42%, but not 50%.",
      ).text,
    ).toBe("We can use $3.2M to grow 42%, but not 50%.");
  });
  it("keeps quotes, links, and already concise text unchanged", () => {
    const text =
      'Read “utilize” at https://example.com/utilize and "in order to".';
    expect(improveText(text).text).toBe(text);
    expect(improveText("Revenue grew 42%.")).toEqual({
      text: "Revenue grew 42%.",
      reasons: [],
    });
  });
  it("applies only selected edits and preserves the source and non-text content", () => {
    const before = structuredClone(slide);
    expect(suggestText([slide])).toHaveLength(2);
    const edited = applyTextEdits([slide], {
      "0:bullet:0": "We use $3.2M to grow 42%.",
    });
    expect(edited[0]).toEqual({
      ...slide,
      bullets: [{ text: "We use $3.2M to grow 42%.", level: 1 }],
    });
    expect(slide).toEqual(before);
    expect(applyTextEdits([slide], {})).toEqual([slide]);
  });
});
