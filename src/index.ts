import { mkdir, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import { join, basename } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";
import { detectMode } from "./detect";
import { captureVisual } from "./modes/visual";
import { captureTerminal } from "./modes/terminal";
import type {
  ProofConfig,
  Recording,
  CaptureOptions,
  RunInfo,
  CleanupOptions,
  RecordingMode,
  ProofManifest,
  ProofEntry,
} from "./types";

export type {
  ProofConfig,
  Recording,
  CaptureOptions,
  RunInfo,
  CleanupOptions,
  RecordingMode,
  ProofManifest,
  ProofEntry,
};

export { getCursorHighlightScript } from "./modes/visual";

export class Proof {
  private config: ProofConfig;
  private runDir: string;
  private runName: string;
  private initTime: Date;

  constructor(config: ProofConfig) {
    this.config = {
      maxVideoLength: 30,
      ...config,
    };
    this.initTime = new Date();

    const root = config.proofDir ?? process.env.PROOF_DIR ?? join(tmpdir(), "proof");
    const dateStr = this.formatDate(this.initTime);
    this.runName = config.run ?? this.formatTime(this.initTime);
    this.runDir = join(root, config.appName, dateStr, this.runName);
  }

  private formatDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  }

  private formatTime(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  private formatTimestamp(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  private async ensureRunDir(): Promise<string> {
    await mkdir(this.runDir, { recursive: true });
    return this.runDir;
  }

  private async resolveMode(optMode?: RecordingMode): Promise<Exclude<RecordingMode, "auto">> {
    const envMode = process.env.PROOF_MODE as RecordingMode | undefined;
    const mode = optMode ?? envMode ?? "auto";

    if (mode !== "auto") return mode;
    return detectMode(process.cwd());
  }

  private async appendToManifest(entry: ProofEntry): Promise<void> {
    const manifestPath = join(this.runDir, "proof.json");
    let manifest: ProofManifest;

    if (existsSync(manifestPath)) {
      const raw = await readFile(manifestPath, "utf-8");
      manifest = JSON.parse(raw);
      manifest.entries.push(entry);
    } else {
      manifest = {
        version: 1,
        appName: this.config.appName,
        run: this.runName,
        createdAt: this.initTime.toISOString(),
        entries: [entry],
      };
    }

    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  }

  async capture(options: CaptureOptions): Promise<Recording> {
    const runDir = await this.ensureRunDir();
    const mode = await this.resolveMode(options.mode);
    const ts = this.formatTimestamp(new Date());
    const label = options.label ?? mode;
    const filePrefix = `${label}-${ts}`;

    let recording: Recording;
    switch (mode) {
      case "browser":
        recording = await captureVisual(options, runDir, filePrefix, {
          viewport: this.config.browser?.viewport,
          maxVideoLength: this.config.maxVideoLength,
        });
        break;
      case "terminal":
        recording = await captureTerminal(
          options,
          runDir,
          filePrefix,
          `bun test ${options.testFile}`,
          this.config.terminal ?? {},
        );
        break;
    }

    const fallbackDescriptions: Record<Exclude<RecordingMode, "auto">, string> = {
      browser: `Playwright browser test recording of ${basename(options.testFile)}${options.testName ? ` — test: "${options.testName}"` : ""}`,
      terminal: `Terminal capture of ${basename(options.testFile)}${options.testName ? ` — test: "${options.testName}"` : ""}`,
    };

    const entry: ProofEntry = {
      timestamp: new Date().toISOString(),
      mode,
      label,
      testFile: options.testFile,
      testName: options.testName,
      duration: recording.duration,
      artifact: basename(recording.path),
      description: options.description ?? fallbackDescriptions[mode],
    };

    await this.appendToManifest(entry);
    return recording;
  }

  async report(): Promise<string> {
    const manifestPath = join(this.runDir, "proof.json");
    if (!existsSync(manifestPath)) {
      throw new Error("No proof.json found — run capture() first");
    }

    const manifest: ProofManifest = JSON.parse(await readFile(manifestPath, "utf-8"));
    const lines: string[] = [];

    lines.push(`# Proof Report`);
    lines.push(``);
    lines.push(`**App:** ${manifest.appName}`);
    lines.push(`**Run:** ${manifest.run}`);
    lines.push(`**Date:** ${new Date(manifest.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);

    for (const entry of manifest.entries) {
      const time = new Date(entry.timestamp).toLocaleTimeString("en-US", { hour12: false });
      const modeIcon = entry.mode === "browser" ? "🌐" : "🖥";

      lines.push(`### ${modeIcon} ${entry.label ?? entry.mode} — ${time}`);
      lines.push(``);
      lines.push(`${entry.description}`);
      lines.push(``);
      lines.push(`| | |`);
      lines.push(`|---|---|`);
      lines.push(`| **Mode** | ${entry.mode} |`);
      lines.push(`| **Test** | \`${basename(entry.testFile)}\` |`);
      if (entry.testName) {
        lines.push(`| **Test name** | ${entry.testName} |`);
      }
      lines.push(`| **Duration** | ${(entry.duration / 1000).toFixed(1)}s |`);
      lines.push(`| **Artifact** | [${entry.artifact}](./${entry.artifact}) |`);
      lines.push(``);
    }

    lines.push(`---`);
    lines.push(`*Generated by @varops/proof*`);

    const md = lines.join("\n");
    const reportPath = join(this.runDir, "report.md");
    await writeFile(reportPath, md, "utf-8");

    return reportPath;
  }

  async listRuns(): Promise<RunInfo[]> {
    const root = this.config.proofDir ?? process.env.PROOF_DIR ?? join(tmpdir(), "proof");
    const appDir = join(root, this.config.appName);

    try {
      const runs: RunInfo[] = [];
      const dateDirs = await readdir(appDir, { withFileTypes: true });

      for (const dateEntry of dateDirs) {
        if (!dateEntry.isDirectory()) continue;
        const datePath = join(appDir, dateEntry.name);
        const runDirs = await readdir(datePath, { withFileTypes: true });

        for (const runEntry of runDirs) {
          if (!runEntry.isDirectory()) continue;
          const runPath = join(datePath, runEntry.name);
          const files = await readdir(runPath);
          const stats = await stat(runPath);
          let totalSize = 0;
          for (const file of files) {
            const s = await stat(join(runPath, file));
            totalSize += s.size;
          }
          runs.push({
            id: `${dateEntry.name}/${runEntry.name}`,
            date: dateEntry.name,
            run: runEntry.name,
            createdAt: stats.birthtime,
            files,
            sizeBytes: totalSize,
          });
        }
      }

      return runs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch {
      return [];
    }
  }

  async cleanup(options?: CleanupOptions): Promise<void> {
    const maxAge = options?.maxAge ?? this.config.retention?.maxAge;
    const maxRuns = options?.maxRuns ?? this.config.retention?.maxRuns;
    const runs = await this.listRuns();
    const root = this.config.proofDir ?? process.env.PROOF_DIR ?? join(tmpdir(), "proof");
    const appDir = join(root, this.config.appName);

    const now = Date.now();
    let toKeep = [...runs];

    if (maxAge) {
      toKeep = toKeep.filter((r) => now - r.createdAt.getTime() < maxAge);
    }

    if (maxRuns && toKeep.length > maxRuns) {
      toKeep = toKeep.slice(0, maxRuns);
    }

    const keepIds = new Set(toKeep.map((r) => r.id));
    for (const run of runs) {
      if (!keepIds.has(run.id)) {
        await rm(join(appDir, run.id), { recursive: true, force: true });
      }
    }
  }
}
