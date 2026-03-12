import { mkdir, readFile, writeFile } from "fs/promises";
import { join, basename } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";
import { detectMode } from "./detect";
import { captureVisual } from "./modes/visual";
import { captureTerminal } from "./modes/terminal";
import { generateReport } from "./report";
import type {
  ProofConfig,
  Recording,
  CaptureOptions,
  RecordingMode,
  ProofManifest,
  ProofEntry,
  ReportFormat,
  ReportOptions,
} from "./types";

export type {
  ProofConfig,
  Recording,
  CaptureOptions,
  RecordingMode,
  ProofManifest,
  ProofEntry,
  ReportFormat,
  ReportOptions,
};

export { getCursorHighlightScript } from "./modes/visual";

export class Proof {
  private config: ProofConfig;
  private runDir: string;
  private runName: string;
  private initTime: Date;

  constructor(config: ProofConfig) {
    this.config = config;
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
      case "browser": {
        if (!options.testFile) {
          throw new Error("browser mode requires testFile");
        }
        recording = await captureVisual(options as CaptureOptions & { testFile: string }, runDir, filePrefix, {
          viewport: this.config.browser?.viewport,
        });
        break;
      }
      case "terminal": {
        if (!options.command) {
          throw new Error("terminal mode requires command");
        }
        recording = await captureTerminal(
          options,
          runDir,
          filePrefix,
          options.command,
          this.config.terminal ?? {},
        );
        break;
      }
    }

    const source = options.testFile ? basename(options.testFile) : options.command ?? mode;
    const fallbackDescriptions: Record<Exclude<RecordingMode, "auto">, string> = {
      browser: `Playwright browser test recording of ${source}${options.testName ? ` — test: "${options.testName}"` : ""}`,
      terminal: `Terminal capture: ${source}`,
    };

    const entry: ProofEntry = {
      timestamp: new Date().toISOString(),
      mode,
      label,
      command: options.command,
      testFile: options.testFile,
      testName: options.testName,
      duration: recording.duration,
      artifact: basename(recording.path),
      description: options.description ?? fallbackDescriptions[mode],
    };

    await this.appendToManifest(entry);
    return recording;
  }

  async report(options?: ReportOptions): Promise<string | string[]> {
    const manifestPath = join(this.runDir, "proof.json");
    if (!existsSync(manifestPath)) {
      throw new Error("No proof.json found — run capture() first");
    }

    const manifest: ProofManifest = JSON.parse(await readFile(manifestPath, "utf-8"));
    const formatInput = options?.format ?? "md";
    const formats: ReportFormat[] = Array.isArray(formatInput) ? formatInput : [formatInput];

    const paths: string[] = [];
    for (const format of formats) {
      const path = await generateReport(manifest, this.runDir, format);
      paths.push(path);
    }

    return Array.isArray(formatInput) ? paths : paths[0];
  }
}
