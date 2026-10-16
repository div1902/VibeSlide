export type DesignId = "professional" | "club" | "pitch";
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
}
export const designs: Design[] = [
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
export const getDesign = (id: DesignId): Design =>
  designs.find((design) => design.id === id) ?? designs[0];
