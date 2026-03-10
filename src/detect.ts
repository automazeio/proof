import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import type { RecordingMode } from "./types";

const VISUAL_CONFIG_PATTERNS = [
  "playwright.config.ts",
  "playwright.config.js",
  "playwright.config.mjs",
];

export async function detectMode(projectDir: string): Promise<Exclude<RecordingMode, "auto">> {
  for (const config of VISUAL_CONFIG_PATTERNS) {
    if (existsSync(join(projectDir, config))) {
      return "visual";
    }
  }

  const pkgPath = join(projectDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      };
      if (allDeps["@playwright/test"] || allDeps["playwright"]) {
        return "visual";
      }
    } catch {}
  }

  // No visual framework detected — fall back to terminal capture via `script`
  return "terminal";
}
