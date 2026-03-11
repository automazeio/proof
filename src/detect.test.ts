import { describe, test, expect } from "bun:test";
import { detectMode } from "./detect";
import { join } from "path";
import { mkdtemp, writeFile, mkdir, rm } from "fs/promises";
import { tmpdir } from "os";

describe("detectMode", () => {
  let tempDir: string;

  async function makeTempDir() {
    tempDir = await mkdtemp(join(tmpdir(), "proof-test-"));
    return tempDir;
  }

  async function cleanup() {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  }

  test("returns 'browser' when playwright.config.ts exists", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "playwright.config.ts"), "export default {};");
    expect(await detectMode(dir)).toBe("browser");
    await cleanup();
  });

  test("returns 'browser' when playwright.config.js exists", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "playwright.config.js"), "module.exports = {};");
    expect(await detectMode(dir)).toBe("browser");
    await cleanup();
  });

  test("returns 'browser' when @playwright/test is in devDependencies", async () => {
    const dir = await makeTempDir();
    const pkg = { devDependencies: { "@playwright/test": "^1.50.0" } };
    await writeFile(join(dir, "package.json"), JSON.stringify(pkg));
    expect(await detectMode(dir)).toBe("browser");
    await cleanup();
  });

  test("returns 'browser' when playwright is in dependencies", async () => {
    const dir = await makeTempDir();
    const pkg = { dependencies: { playwright: "^1.50.0" } };
    await writeFile(join(dir, "package.json"), JSON.stringify(pkg));
    expect(await detectMode(dir)).toBe("browser");
    await cleanup();
  });

  test("returns 'terminal' when no playwright signals found", async () => {
    const dir = await makeTempDir();
    expect(await detectMode(dir)).toBe("terminal");
    await cleanup();
  });

  test("returns 'terminal' when package.json has no playwright deps", async () => {
    const dir = await makeTempDir();
    const pkg = { dependencies: { express: "^4.0.0" } };
    await writeFile(join(dir, "package.json"), JSON.stringify(pkg));
    expect(await detectMode(dir)).toBe("terminal");
    await cleanup();
  });
});
