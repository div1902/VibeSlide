export type DesignId =
  "professional" | "club" | "pitch" | "editorial" | "luxury" | "terminal";
export interface Design {
  id: DesignId;
  name: string;
  description: string;
  palette: {
    bg: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    accent2: string;
  };
  headingFont: string;
  bodyFont: string;
  features?: string[];
}
export const designs: Design[] = [
  {
    id: "editorial",
    name: "Editorial Magazine",
    description:
      "Cream paper, serif headlines, fine rules, and generous image space.",
    palette: {
      bg: "F5F0E4",
      surface: "E8DFCE",
      text: "302D28",
      muted: "514B42",
      accent: "A3432C",
      accent2: "D5BC91",
    },
    headingFont: "Georgia",
    bodyFont: "Arial",
    features: ["Serif hierarchy", "Image-led spreads", "Fine divider rules"],
  },
  {
    id: "luxury",
    name: "Dark Luxury",
    description:
      "Near-black backgrounds, restrained gold, and spacious serif typography.",
    palette: {
      bg: "151515",
      surface: "292622",
      text: "F7F0E3",
      muted: "D0C7B7",
      accent: "D4B76A",
      accent2: "AE9053",
    },
    headingFont: "Georgia",
    bodyFont: "Arial",
    features: ["Restrained gold", "Fine frames", "Balanced headlines"],
  },
  {
    id: "terminal",
    name: "Retro Terminal",
    description:
      "A disciplined mono grid with green accents and minimal decoration.",
    palette: {
      bg: "101810",
      surface: "1C2B1B",
      text: "D2F6CD",
      muted: "ABD1A5",
      accent: "81E878",
      accent2: "D8DC82",
    },
    headingFont: "Courier New",
    bodyFont: "Courier New",
    features: ["Monospaced grid", "High contrast", "Structured columns"],
  },
  {
    id: "professional",
    name: "Professional",
    description:
      "Clear hierarchy, generous space, and structured business layouts.",
    palette: {
      bg: "F5F7FC",
      surface: "E5EBF7",
      text: "172D50",
      muted: "42577B",
      accent: "285CE6",
      accent2: "BBD4FF",
    },
    headingFont: "Arial",
    bodyFont: "Arial",
  },
  {
    id: "club",
    name: "Club Presentation",
    description:
      "Bold posters, playful cards, and picture-led community stories.",
    palette: {
      bg: "EDE5FF",
      surface: "DAC8FA",
      text: "30174F",
      muted: "52366F",
      accent: "7439BC",
      accent2: "FFAB64",
    },
    headingFont: "Impact",
    bodyFont: "Arial",
  },
  {
    id: "pitch",
    name: "Pitch Deck",
    description:
      "High contrast, strong headlines, and a spotlight on your numbers.",
    palette: {
      bg: "111C2B",
      surface: "213247",
      text: "F3F7EE",
      muted: "C0CFD8",
      accent: "C9F16D",
      accent2: "66CCC1",
    },
    headingFont: "Arial",
    bodyFont: "Arial",
  },
];
designs.sort(
  (a, b) =>
    [
      "professional",
      "club",
      "pitch",
      "editorial",
      "luxury",
      "terminal",
    ].indexOf(a.id) -
    [
      "professional",
      "club",
      "pitch",
      "editorial",
      "luxury",
      "terminal",
    ].indexOf(b.id),
);
export const getDesign = (id: DesignId): Design =>
  designs.find((design) => design.id === id) ?? designs[0];
