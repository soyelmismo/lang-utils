// ============================================
// Lang Utils - Build script (esbuild)
// Bundles TypeScript sources into a dist/ folder
// ready to be loaded as a browser extension.
//
// Targets:
//   --target=firefox   Firefox MV3 (background.scripts)
//   --target=chrome    Chrome MV3  (background.service_worker)
//   (default)          Cross-browser MV3 (works on Firefox 121+ and Chrome 88+)
//
// Use --watch for incremental rebuilds.
// ============================================

import { build, context } from "esbuild";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");

// Parse CLI args
const args = process.argv.slice(2);
const watch = args.includes("--watch");
const targetArg = args.find((a) => a.startsWith("--target="));
const target = targetArg ? targetArg.split("=")[1] : "default"; // "firefox" | "chrome" | "default"

/** Recursively copy a directory, ignoring nothing. */
async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else {
      await fs.copyFile(s, d);
    }
  }
}

/** Remove a directory recursively. */
async function rmDir(p) {
  await fs.rm(p, { recursive: true, force: true });
}

/** Read and patch manifest.json for the requested target. */
async function writeManifest() {
  const manifestPath = path.join(SRC, "manifest.json");
  const raw = await fs.readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(raw);

  // Manifest V3 cross-browser tweaks
  if (target === "chrome") {
    // Chrome requires service_worker (not scripts)
    manifest.background = {
      service_worker: "background.js",
      type: "module",
    };
    // Chrome MV3 doesn't support browser_specific_settings
    delete manifest.browser_specific_settings;
  } else if (target === "firefox") {
    // Firefox MV3 with strict_min_version >= 142: use scripts only (event page)
    // The validator flags service_worker as unsupported on Firefox.
    manifest.background = {
      scripts: ["background.js"],
    };
    // Keep browser_specific_settings for Firefox
  } else {
    // Cross-browser default: service_worker (Chrome) + scripts (Firefox)
    // Firefox 121+ supports service_worker too, but for max compat we use scripts.
    // To target both: we keep service_worker in manifest, and Firefox will use it
    // since v121+. For older Firefox, use --target=firefox.
    manifest.background = {
      service_worker: "background.js",
      type: "module",
    };
  }

  await fs.writeFile(
    path.join(DIST, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8"
  );
  console.log(`  ✓ manifest.json (${target})`);
}

/** Copy static assets: icons, _locales, HTML, CSS. */
async function copyStatic() {
  // Icons
  await copyDir(path.join(SRC, "icons"), path.join(DIST, "icons"));
  console.log("  ✓ icons/");

  // Locales
  await copyDir(path.join(SRC, "_locales"), path.join(DIST, "_locales"));
  console.log("  ✓ _locales/");

  // HTML + CSS files for popup, options, chatbot
  for (const page of ["popup", "options", "chatbot"]) {
    const htmlSrc = path.join(SRC, page, `${page}.html`);
    const cssSrc = path.join(SRC, page, `${page}.css`);
    try {
      await fs.access(htmlSrc);
      await fs.mkdir(path.join(DIST, page), { recursive: true });
      await fs.copyFile(htmlSrc, path.join(DIST, page, `${page}.html`));
      console.log(`  ✓ ${page}/${page}.html`);
    } catch {
      // Page doesn't exist, skip
    }
    try {
      await fs.access(cssSrc);
      await fs.mkdir(path.join(DIST, page), { recursive: true });
      await fs.copyFile(cssSrc, path.join(DIST, page, `${page}.css`));
      console.log(`  ✓ ${page}/${page}.css`);
    } catch {
      // CSS doesn't exist, skip
    }
  }

  // Theme CSS (shared)
  const themeCssSrc = path.join(SRC, "styles", "themes.css");
  try {
    await fs.access(themeCssSrc);
    await fs.mkdir(path.join(DIST, "styles"), { recursive: true });
    await fs.copyFile(themeCssSrc, path.join(DIST, "styles", "themes.css"));
    console.log("  ✓ styles/themes.css");
  } catch {
    // No theme CSS, skip
  }
}

// esbuild entry points
const ENTRY_POINTS = [
  { in: path.join(SRC, "background", "index.ts"), out: "background" },
  { in: path.join(SRC, "content", "index.ts"), out: "content" },
  { in: path.join(SRC, "popup", "popup.ts"), out: "popup/popup" },
  { in: path.join(SRC, "options", "options.ts"), out: "options/options" },
  { in: path.join(SRC, "chatbot", "chatbot.ts"), out: "chatbot/chatbot" },
];

const commonOptions = {
  bundle: true,
  format: "iife",
  target: ["chrome109", "firefox109", "safari16"],
  platform: "browser",
  logLevel: "info",
  sourcemap: false,
  minify: !watch,
  legalComments: "none",
  define: {
    "process.env.NODE_ENV": watch ? '"development"' : '"production"',
  },
  loader: {
    ".css": "text",
    ".json": "json",
  },
};

async function buildAll() {
  console.log("Building Lang Utils (" + target + ")...");

  // Clean dist
  await rmDir(DIST);
  await fs.mkdir(DIST, { recursive: true });

  // Bundle TS entry points
  const entryConfigs = ENTRY_POINTS.map((ep) => ({
    ...commonOptions,
    entryPoints: [ep.in],
    outfile: path.join(DIST, ep.out + ".js"),
  }));

  if (watch) {
    const ctx = await context({
      ...commonOptions,
      entryPoints: ENTRY_POINTS.map((ep) => ep.in),
      outdir: DIST,
      // Preserve directory structure for entry points
      entryNames: "[dir]/[name]",
    });
    await ctx.watch();
    console.log("  ✓ Watching for changes...");
  } else {
    for (const cfg of entryConfigs) {
      await build(cfg);
    }
    console.log("  ✓ TypeScript bundles built");
  }

  // Static assets (in watch mode, do once — TODO: also watch)
  if (!watch) {
    await writeManifest();
    await copyStatic();
    console.log("Build complete → dist/");
  } else {
    // Still need static files for the very first watch run
    await writeManifest();
    await copyStatic();
  }
}

buildAll().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
