import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtemp, rm, readFile } from "fs/promises";
import { tmpdir } from "os";
import { existsSync } from "fs";

const CLI_PATH = join(import.meta.dir, "cli.ts");
const TEST_APP_DIR = join(import.meta.dir, "../test-app");

async function runCli(args: string[], stdin?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", CLI_PATH, ...args], {
    stdin: stdin ? new Blob([stdin]) : undefined,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, FORCE_COLOR: "0" },
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

describe("CLI", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proof-cli-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("help and usage", () => {
    test("prints usage with --help", async () => {
      const { stdout, exitCode } = await runCli(["--help"]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("@automaze/proof");
      expect(stdout).toContain("proof capture");
      expect(stdout).toContain("--app");
    });

    test("prints usage with no args", async () => {
      const { stdout, exitCode } = await runCli([]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("@automaze/proof");
    });
  });

  describe("arg validation", () => {
    test("errors when --app is missing", async () => {
      const { stderr, exitCode } = await runCli(["capture", "--command", "echo hi"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("--app is required");
    });

    test("errors when capture has no --command or --test-file", async () => {
      const { stderr, exitCode } = await runCli(["capture", "--app", "test"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("--command or --test-file is required");
    });

    test("errors on unknown action", async () => {
      const { stderr, exitCode } = await runCli(["bogus"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Unknown action");
    });
  });

  describe("capture (arg mode)", () => {
    test("captures terminal output and returns JSON", async () => {
      const { stdout, exitCode } = await runCli([
        "capture",
        "--app", "cli-test",
        "--dir", tempDir,
        "--run", "r1",
        "--command", "echo hello",
        "--mode", "terminal",
        "--label", "echo-test",
      ]);
      expect(exitCode).toBe(0);

      const result = JSON.parse(stdout);
      expect(result.action).toBe("capture");
      expect(result.appName).toBe("cli-test");
      expect(result.recordings).toHaveLength(1);
      expect(result.recordings[0].mode).toBe("terminal");
      expect(result.recordings[0].label).toBe("echo-test");
      expect(result.recordings[0].duration).toBeGreaterThanOrEqual(0);
      expect(existsSync(result.recordings[0].path)).toBe(true);
    });

    test("passes --description through to manifest", async () => {
      const { stdout, exitCode } = await runCli([
        "capture",
        "--app", "cli-test",
        "--dir", tempDir,
        "--run", "r1",
        "--command", "echo hi",
        "--mode", "terminal",
        "--description", "A test capture",
      ]);
      expect(exitCode).toBe(0);

      const result = JSON.parse(stdout);
      const manifestPath = join(tempDir, "cli-test", "*", "r1", "proof.json").replace("*", 
        new Date().toISOString().slice(0, 10).replace(/-/g, ""));
      const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(manifest.entries[0].description).toBe("A test capture");
    });
  });

  describe("JSON stdin mode", () => {
    test("captures single entry via JSON", async () => {
      const input = JSON.stringify({
        action: "capture",
        appName: "json-test",
        proofDir: tempDir,
        run: "j1",
        command: "echo json-mode",
        mode: "terminal",
        label: "json-cap",
      });

      const { stdout, exitCode } = await runCli(["--json"], input);
      expect(exitCode).toBe(0);

      const result = JSON.parse(stdout);
      expect(result.action).toBe("capture");
      expect(result.recordings).toHaveLength(1);
      expect(result.recordings[0].mode).toBe("terminal");
      expect(result.recordings[0].label).toBe("json-cap");
    });

    test("captures multiple entries via JSON captures array", async () => {
      const input = JSON.stringify({
        action: "capture",
        appName: "multi-test",
        proofDir: tempDir,
        run: "m1",
        captures: [
          { command: "echo one", mode: "terminal", label: "first" },
          { command: "echo two", mode: "terminal", label: "second" },
        ],
      });

      const { stdout, exitCode } = await runCli(["--json"], input);
      expect(exitCode).toBe(0);

      const result = JSON.parse(stdout);
      expect(result.recordings).toHaveLength(2);
      expect(result.recordings[0].label).toBe("first");
      expect(result.recordings[1].label).toBe("second");
    });

    test("generates report via JSON", async () => {
      // First capture something
      const captureInput = JSON.stringify({
        action: "capture",
        appName: "report-test",
        proofDir: tempDir,
        run: "rpt",
        command: "echo for-report",
        mode: "terminal",
      });
      await runCli(["--json"], captureInput);

      // Then generate report
      const reportInput = JSON.stringify({
        action: "report",
        appName: "report-test",
        proofDir: tempDir,
        run: "rpt",
      });
      const { stdout, exitCode } = await runCli(["--json"], reportInput);
      expect(exitCode).toBe(0);

      const result = JSON.parse(stdout);
      expect(result.action).toBe("report");
      expect(result.path).toContain("report.md");
      expect(existsSync(result.path)).toBe(true);
    });
  });

  describe("report (arg mode)", () => {
    test("generates report after capture", async () => {
      // Capture first
      await runCli([
        "capture",
        "--app", "rpt-test",
        "--dir", tempDir,
        "--run", "r1",
        "--command", "echo hi",
        "--mode", "terminal",
      ]);

      // Generate report
      const { stdout, exitCode } = await runCli([
        "report",
        "--app", "rpt-test",
        "--dir", tempDir,
        "--run", "r1",
      ]);
      expect(exitCode).toBe(0);

      const result = JSON.parse(stdout);
      expect(result.action).toBe("report");
      expect(result.path).toContain("report.md");
      expect(existsSync(result.path)).toBe(true);
    });
  });

  describe("error handling", () => {
    test("outputs JSON error on failure", async () => {
      const input = JSON.stringify({
        action: "report",
        appName: "nonexistent",
        proofDir: tempDir,
        run: "nope",
      });
      const { stderr, exitCode } = await runCli(["--json"], input);
      expect(exitCode).toBe(1);
      expect(JSON.parse(stderr).error).toContain("No proof.json found");
    });
  });
});
