import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-dom") || id.includes("react/jsx-runtime") || id.endsWith("/react/index.js") || id.endsWith("/react-dom/index.js")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/three/examples")) {
            return "vendor-three-examples";
          }
          if (id.includes("node_modules/three/src/renderers")) {
            return "vendor-three-renderers";
          }
          if (id.includes("node_modules/three")) {
            return "vendor-three";
          }
          return undefined;
        },
      },
    },
  },
});
