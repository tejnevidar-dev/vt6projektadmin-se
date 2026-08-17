// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { loadEnv } from "vite";

// entities v8 dropped the CJS `lib/` files that htmlparser2 v4-style deep
// imports rely on. Resolve the pinned 4.5.0 copy explicitly so the build is
// reproducible regardless of hoisting order.
const require = createRequire(import.meta.url);

function resolveEntitiesLib(file: string): string | undefined {
  const candidates = [
    path.resolve(process.cwd(), "node_modules/htmlparser2/node_modules/entities", file),
    path.resolve(process.cwd(), "node_modules/dom-serializer/node_modules/entities", file),
    path.resolve(process.cwd(), "node_modules/entities", file),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  try {
    return require.resolve(`entities/${file}`);
  } catch {
    return undefined;
  }
}

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, serverEnv);

  const decode = resolveEntitiesLib("lib/decode.js");
  const encode = resolveEntitiesLib("lib/encode.js");

  return {
    resolve: {
      alias: {
        ...(decode ? { "entities/lib/decode.js": decode } : {}),
        ...(encode ? { "entities/lib/encode.js": encode } : {}),
      },
    },
  };
});

