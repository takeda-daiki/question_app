import { defineConfig } from "vite";

export default defineConfig({
  // Pre-bundle lazy features too, so opening a graph does not reload a draft in dev.
  optimizeDeps: {
    include: [
      "@xyflow/react",
      "react-markdown",
      "remark-gfm",
      "remark-math",
      "rehype-katex",
    ],
  },
});
