import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Proof } from "./index";
import { join } from "path";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { existsSync } from "fs";

describe("Proof", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proof-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("constructor", () => {
    test("creates run directory path from appName, date, and run", () => {
      const proof = new Proof({
        appName: "test-app",
        proofDir: tempDir,
        run: "my-run",
      });
      expect(proof).toBeDefined();
    });

    test("uses HHMM as default run name", () => {
      const proof = new Proof({
        appName: "test-app",
        proofDir: tempDir,
      });
      expect(proof).toBeDefined();
    });
  });

  describe("capture (terminal mode)", () => {
    test("produces .cast and .html files", async () => {
      const proof = new Proof({
        appName: "test-app",
        proofDir: tempDir,
        run: "test-run",
      });

      const recording = await proof.capture({
        command: `bun test ${join(import.meta.dir, "../test-app/cli/app.test.ts")}`,
        mode: "terminal",
        label: "cli",
        description: "CLI tests",
      });

      expect(recording.mode).toBe("terminal");
      expect(recording.path).toEndWith(".html");
      expect(recording.duration).toBeGreaterThan(0);
      expect(existsSync(recording.path)).toBe(true);

      const castPath = recording.path.replace(".html", ".cast");
      expect(existsSync(castPath)).toBe(true);

      const castContent = await readFile(castPath, "utf-8");
      const lines = castContent.trim().split("\n");
      const header = JSON.parse(lines[0]);
      expect(header.version).toBe(2);
      expect(header.width).toBe(120);
      expect(header.height).toBe(30);
      expect(lines.length).toBeGreaterThan(1);

      const event = JSON.parse(lines[1]);
      expect(event).toHaveLength(3);
      expect(typeof event[0]).toBe("number");
      expect(event[1]).toBe("o");
      expect(typeof event[2]).toBe("string");
    });

    test("HTML player is self-contained", async () => {
      const proof = new Proof({
        appName: "test-app",
        proofDir: tempDir,
        run: "test-run",
      });

      const recording = await proof.capture({
        command: `bun test ${join(import.meta.dir, "../test-app/cli/app.test.ts")}`,
        mode: "terminal",
        label: "cli",
      });

      const html = await readFile(recording.path, "utf-8");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("ansiToHtml");
      expect(html).toContain("<select");
      expect(html).toContain("0.1x");
      expect(html).toContain("4x");
      expect(html).not.toContain("<script src=");
      expect(html).not.toContain("<link rel=");
    });

    test("works with any command, not just bun test", async () => {
      const proof = new Proof({
        appName: "test-app",
        proofDir: tempDir,
        run: "test-run",
      });

      const recording = await proof.capture({
        command: "echo hello && echo world",
        mode: "terminal",
        label: "echo",
      });

      expect(recording.mode).toBe("terminal");
      const castContent = await readFile(recording.path.replace(".html", ".cast"), "utf-8");
      expect(castContent).toContain("hello");
      expect(castContent).toContain("world");
    });

    test("throws if command is missing", async () => {
      const proof = new Proof({
        appName: "test-app",
        proofDir: tempDir,
        run: "test-run",
      });

      expect(
        proof.capture({ mode: "terminal", label: "fail" })
      ).rejects.toThrow("terminal mode requires command");
    });
  });

  describe("capture (browser mode)", () => {
    test("throws if testFile is missing", async () => {
      const proof = new Proof({
        appName: "test-app",
        proofDir: tempDir,
        run: "test-run",
      });

      expect(
        proof.capture({ mode: "browser", label: "fail" })
      ).rejects.toThrow("browser mode requires testFile");
    });
  });

  describe("manifest", () => {
    test("creates proof.json with entries on capture", async () => {
      const proof = new Proof({
        appName: "test-app",
        proofDir: tempDir,
        run: "test-run",
      });

      await proof.capture({
        command: `bun test ${join(import.meta.dir, "../test-app/cli/app.test.ts")}`,
        mode: "terminal",
        label: "first",
        description: "First capture",
      });

      const today = new Date();
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const manifestPath = join(tempDir, "test-app", dateStr, "test-run", "proof.json");
      expect(existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(manifest.version).toBe(1);
      expect(manifest.appName).toBe("test-app");
      expect(manifest.run).toBe("test-run");
      expect(manifest.entries).toHaveLength(1);
      expect(manifest.entries[0].label).toBe("first");
      expect(manifest.entries[0].description).toBe("First capture");
      expect(manifest.entries[0].mode).toBe("terminal");
      expect(manifest.entries[0].command).toContain("bun test");
    });

    test("appends entries on subsequent captures", async () => {
      const proof = new Proof({
        appName: "test-app",
        proofDir: tempDir,
        run: "test-run",
      });

      const testCmd = `bun test ${join(import.meta.dir, "../test-app/cli/app.test.ts")}`;

      await proof.capture({
        command: testCmd,
        mode: "terminal",
        label: "first",
      });

      await proof.capture({
        command: testCmd,
        mode: "terminal",
        label: "second",
      });

      const today = new Date();
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const manifestPath = join(tempDir, "test-app", dateStr, "test-run", "proof.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(manifest.entries).toHaveLength(2);
      expect(manifest.entries[0].label).toBe("first");
      expect(manifest.entries[1].label).toBe("second");
    });
  });

  describe("report", () => {
    test("generates report.md from manifest", async () => {
      const proof = new Proof({
        appName: "test-app",
        proofDir: tempDir,
        run: "test-run",
      });

      await proof.capture({
        command: `bun test ${join(import.meta.dir, "../test-app/cli/app.test.ts")}`,
        mode: "terminal",
        label: "cli-tests",
        description: "CLI test suite",
      });

      const reportPath = await proof.report() as string;
      expect(reportPath).toEndWith("report.md");
      expect(existsSync(reportPath)).toBe(true);

      const report = await readFile(reportPath, "utf-8");
      expect(report).toContain("# Proof Report");
      expect(report).toContain("test-app");
      expect(report).toContain("test-run");
      expect(report).toContain("CLI test suite");
      expect(report).toContain("cli-tests");
      expect(report).toContain("@varops/proof");
    });

    test("generates html report", async () => {
      const proof = new Proof({
        appName: "test-app",
        proofDir: tempDir,
        run: "test-run",
      });

      await proof.capture({
        command: `bun test ${join(import.meta.dir, "../test-app/cli/app.test.ts")}`,
        mode: "terminal",
        label: "cli-tests",
        description: "CLI test suite",
      });

      const reportPath = await proof.report({ format: "html" }) as string;
      expect(reportPath).toEndWith("report.html");
      expect(existsSync(reportPath)).toBe(true);

      const html = await readFile(reportPath, "utf-8");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Proof Report");
      expect(html).toContain("test-app");
      expect(html).toContain("CLI test suite");
      expect(html).toContain("<iframe");
    });

    test("generates archive report with inlined content", async () => {
      const proof = new Proof({
        appName: "test-app",
        proofDir: tempDir,
        run: "test-run",
      });

      await proof.capture({
        command: "echo hello",
        mode: "terminal",
        label: "echo",
      });

      const reportPath = await proof.report({ format: "archive" }) as string;
      expect(reportPath).toEndWith("archive.html");
      expect(existsSync(reportPath)).toBe(true);

      const html = await readFile(reportPath, "utf-8");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("srcdoc=");
    });

    test("generates multiple formats as array", async () => {
      const proof = new Proof({
        appName: "test-app",
        proofDir: tempDir,
        run: "test-run",
      });

      await proof.capture({
        command: "echo hello",
        mode: "terminal",
        label: "echo",
      });

      const paths = await proof.report({ format: ["md", "html"] }) as string[];
      expect(paths).toHaveLength(2);
      expect(paths[0]).toEndWith("report.md");
      expect(paths[1]).toEndWith("report.html");
    });

    test("throws if no captures have been made", async () => {
      const proof = new Proof({
        appName: "test-app",
        proofDir: tempDir,
        run: "empty-run",
      });

      expect(proof.report()).rejects.toThrow("No proof.json found");
    });
  });
});
