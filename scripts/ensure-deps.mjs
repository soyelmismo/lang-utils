// ============================================
// Lang Utils - Ensure dependencies are installed
// Runs automatically before package/* commands.
// ============================================

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const NODE_MODULES = path.join(ROOT, "node_modules");
const PACKAGE_JSON = path.join(ROOT, "package.json");

async function dirExists(p) {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function readPackageJson() {
  const content = await fs.readFile(PACKAGE_JSON, "utf-8");
  return JSON.parse(content);
}

async function main() {
  const pkg = await readPackageJson();
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const depNames = Object.keys(deps);

  // Quick check: does node_modules exist and have at least one dep?
  const modulesExists = await dirExists(NODE_MODULES);
  if (modulesExists) {
    // Verify at least one expected dep is present
    const entries = await fs.readdir(NODE_MODULES);
    const hasAnyDep = entries.some((e) => depNames.includes(e));
    if (hasAnyDep) {
      console.log("✓ Dependencies already installed");
      return;
    }
  }

  console.log("📦 Installing dependencies...");
  await runCommand("npm", ["install", "--prefer-offline", "--no-audit", "--no-fund"]);
  console.log("✓ Dependencies installed");
}

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", cwd: ROOT });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

main().catch((err) => {
  console.error("✗ Failed to ensure dependencies:", err.message);
  process.exit(1);
});