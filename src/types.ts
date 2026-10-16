export interface Bullet {
  text: string;
  /** PowerPoint paragraph level: 0 is the outermost level. */
  level: number;
}

export interface SlideImage {
  dataUrl: string;
  alt: string;
}

export interface Slide {
  title: string;
  bullets: Bullet[];
  images: SlideImage[];
  stats: string[];
  notes?: string;
}

export interface ParseProgress {
  percent: number;
  message: string;
}
