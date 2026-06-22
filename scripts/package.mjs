// ============================================
// Lang Utils - Package script
// Builds and packages the extension into
// distributable .zip (Chrome) and .xpi (Firefox)
// archives under ./releases/.
//
// Usage:
//   node scripts/package.mjs                  # build both targets
//   node scripts/package.mjs --target=chrome  # Chrome only
//   node scripts/package.mjs --target=firefox # Firefox only
//   node scripts/package.mjs --no-build       # skip the rebuild step
// ============================================

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const RELEASES = path.join(ROOT, "releases");

// Parse CLI args
const args = process.argv.slice(2);
const targetArg = args.find((a) => a.startsWith("--target="));
const target = targetArg ? targetArg.split("=")[1] : "all"; // "chrome" | "firefox" | "all"
const noBuild = args.includes("--no-build");

if (!["chrome", "firefox", "all"].includes(target)) {
  console.error(`✗ Unknown --target=${target}. Use chrome, firefox or all.`);
  process.exit(1);
}

// Read version from package.json
const pkg = JSON.parse(
  await fs.readFile(path.join(ROOT, "package.json"), "utf-8")
);
const VERSION = pkg.version;

/** Run a child process and stream its output. */
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", ...opts });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`));
    });
  });
}

/** Build for a given target by invoking scripts/build.mjs. */
async function buildFor(buildTarget) {
  console.log(`\n▶ Building (${buildTarget})...`);
  await run("node", [path.join("scripts", "build.mjs"), `--target=${buildTarget}`]);
}

/** Copy dist/ to a fresh staging directory and zip it. */
async function packageFor(buildTarget, archiveName, ext) {
  const stage = path.join(RELEASES, `stage-${buildTarget}`);
  await fs.rm(stage, { recursive: true, force: true });
  await fs.mkdir(stage, { recursive: true });

  // Copy dist → stage
  await fs.cp(DIST, stage, { recursive: true });

  const archivePath = path.join(RELEASES, archiveName);
  await fs.rm(archivePath, { force: true });

  console.log(`▶ Packaging ${buildTarget} → ${archiveName}`);
  // zip [-r] archive sources — run inside the staging dir so the archive
  // contains files at the root (no `dist/` prefix).
  await run("zip", ["-r", "-X", "-q", archivePath, "."], { cwd: stage });

  const stat = await fs.stat(archivePath);
  console.log(`  ✓ ${archiveName}  (${formatBytes(stat.size)})`);
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  await fs.mkdir(RELEASES, { recursive: true });

  const targets =
    target === "all"
      ? ["chrome", "firefox"]
      : [target];

  for (const t of targets) {
    if (!noBuild) await buildFor(t);

    // Firefox AMO accepts .zip, but the canonical Firefox extension archive
    // is .xpi. Both are the same zip format.
    const archiveName =
      t === "chrome"
        ? `lang-utils-${VERSION}.chrome.zip`
        : `lang-utils-${VERSION}.firefox.xpi`;

    await packageFor(t, archiveName, t);
  }

  console.log(`\n✓ Done. Artifacts in ${path.relative(ROOT, RELEASES)}/`);
  const entries = await fs.readdir(RELEASES);
  for (const e of entries) {
    if (e.startsWith("stage-")) continue;
    const stat = await fs.stat(path.join(RELEASES, e));
    console.log(`    ${e}  (${formatBytes(stat.size)})`);
  }
}

main().catch((err) => {
  console.error("\n✗ Packaging failed:", err.message);
  process.exit(1);
});
