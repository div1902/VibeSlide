import { build } from "vite";
import react from "@vitejs/plugin-react";
await build({
  configFile: false,
  plugins: [react()],
  define: {
    "import.meta.env.VITE_INTEGRATION": JSON.stringify("canva"),
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    copyPublicDir: false,
    lib: {
      entry: "src/canva.tsx",
      name: "VibeSlideCanva",
      formats: ["iife"],
      fileName: () => "vibeslide-canva.js",
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
