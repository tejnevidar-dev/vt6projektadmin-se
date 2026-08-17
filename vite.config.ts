// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "node:path";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, serverEnv);

  return {
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(process.cwd(), "node_modules/entities/dist/decode.js"),
        "entities/lib/encode.js": path.resolve(process.cwd(), "node_modules/entities/dist/escape.js"),
      },
    },
  };
});
