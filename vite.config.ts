// Hand-written replacement for @lovable.dev/vite-tanstack-config (removed as part of
// exiting Lovable). That package's actual source was inspected (it's a normal npm
// package, downloaded into node_modules by `bun install`) to reproduce its non-sandbox
// behavior exactly: everything here is what it did outside a Lovable sandbox — the
// sandbox-only bits (asset proxy to *.lovable.app, error reporting to Lovable's UI,
// HMR gate, dev-server bridge, build diagnostics) are genuinely dead code paths outside
// Lovable and are intentionally not reproduced.
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { devtools } from "@tanstack/devtools-vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { defineConfig, loadEnv, type UserConfig } from "vite";

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

export default defineConfig(async ({ mode, command }) => {
  const serverEnv = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, serverEnv);

  const decode = resolveEntitiesLib("lib/decode.js");
  const encode = resolveEntitiesLib("lib/encode.js");

  const isDevBuild = command === "build" && mode === "development";

  // VITE_*-prefixed env vars get inlined into the client bundle as import.meta.env.X,
  // same as Lovable's config did (envDefine: true by default).
  const viteEnv = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(viteEnv)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  let nitroPlugin: import("vite").PluginOption | undefined;
  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    nitroPlugin = nitro({
      defaultPreset: "cloudflare-module",
      experimental: { tasks: true },
      // Tasks must be registered explicitly: the vite plugin's scan root is not ./tasks, so
      // file scanning found nothing and every cron ran an empty task list (nothing executed).
      tasks: {
        "send-booking-reminders": { handler: path.resolve(process.cwd(), "tasks/send-booking-reminders.ts"), description: "Booking reminders" },
        "stale-lead-reminders": { handler: path.resolve(process.cwd(), "tasks/stale-lead-reminders.ts"), description: "Stale lead reminders" },
        "lead-alerts": { handler: path.resolve(process.cwd(), "tasks/lead-alerts.ts"), description: "SLA, silence and intake-failure alerts" },
        "work-order-timeouts": { handler: path.resolve(process.cwd(), "tasks/work-order-timeouts.ts"), description: "Send work orders on to the next UE" },
        "ue-day-end": { handler: path.resolve(process.cwd(), "tasks/ue-day-end.ts"), description: "UE day-end photo reminder" },
        "ue-compliance": { handler: path.resolve(process.cwd(), "tasks/ue-compliance.ts"), description: "Expiring UE requirements" },
      },
      // Replaces Lovable Cloud's "Jobs" schedule (send-booking-reminders, every 5 min).
      // On cloudflare-module this becomes an actual Cloudflare Cron Trigger automatically.
      scheduledTasks: {
        "*/5 * * * *": "send-booking-reminders",
        // Once/day: flags leads stuck in forhandling/uppfoljning without recent
        // activity, notifies the assigned seller in-app (see notifications system).
        "0 6 * * *": "stale-lead-reminders",
        // Every 10 min: SLA reminders for unanswered leads, silence + intake-failure alerts.
        "*/10 * * * *": ["lead-alerts", "work-order-timeouts", "ue-day-end"],
        // Daily: alerts for expiring UE insurance / ID06 / A1 / documents.
        "0 7 * * *": "ue-compliance",
      },
    });
  }

  const config: UserConfig = {
    define: envDefine,
    ...(isDevBuild
      ? {
          environments: { client: { define: { "process.env.NODE_ENV": JSON.stringify("development") } } },
          esbuild: { keepNames: true },
        }
      : {}),
    css: { transformer: "lightningcss" },
    resolve: {
      alias: {
        "@": path.resolve(process.cwd(), "src"),
        ...(decode ? { "entities/lib/decode.js": decode } : {}),
        ...(encode ? { "entities/lib/encode.js": encode } : {}),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
      ignoreOutdatedRequests: true,
    },
    server: {
      host: "::",
      port: 8080,
      watch: {
        awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 },
      },
    },
    plugins: [
      ...(mode === "development"
        ? [
            devtools({
              logging: false,
              eventBusConfig: { enabled: false },
              enhancedLogs: { enabled: false },
              consolePiping: { enabled: false },
              removeDevtoolsOnBuild: false,
              injectSource: { enabled: true },
            }),
          ]
        : []),
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      ...(nitroPlugin ? [nitroPlugin] : []),
      viteReact(),
    ],
  };
  return config;
});
