import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages serves project sites from /<repository-name>/.
  // Override with VITE_BASE_PATH only when deploying to a custom subpath.
  base: process.env.VITE_BASE_PATH ?? "/route-mind-forklift/",
  server: {
    host: "0.0.0.0",
    port: 8081,
    strictPort: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
