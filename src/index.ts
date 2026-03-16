import { mkdir, readFile, writeFile } from "fs/promises";
import { join, basename } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";
import { detectMode } from "./detect";
import { captureVisual } from "./modes/visual";
import { captureTerminal } from "./modes/terminal";
import { captureSimulator } from "./modes/simulator";
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
        description: this.config.description,
        run: this.runName,
        createdAt: this.initTime.toISOString(),
        entries: [entry],
      };
    }

    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  }

  async capture(options: CaptureOptions): Promise<Recording | Recording[]> {
    if (options.device && options.viewport) {
      throw new Error("device and viewport are mutually exclusive — use one or the other");
    }

    // Fan out arrays into multiple sequential captures
    const devices = options.device ? (Array.isArray(options.device) ? options.device : [options.device]) : undefined;
    const viewports = options.viewport ? (Array.isArray(options.viewport) ? options.viewport : [options.viewport]) : undefined;

    if (devices && devices.length > 1) {
      const results: Recording[] = [];
      for (const device of devices) {
        const r = await this.captureSingle({ ...options, device, label: `${options.label ?? "browser"}-${slugify(device)}` });
        results.push(r);
      }
      return results;
    }

    if (viewports && viewports.length > 1) {
      const results: Recording[] = [];
      for (const vp of viewports) {
        const r = await this.captureSingle({ ...options, viewport: vp, label: `${options.label ?? "browser"}-${vp.replace("x", "x")}` });
        results.push(r);
      }
      return results;
    }

    return this.captureSingle(options);
  }

  private async captureSingle(options: CaptureOptions): Promise<Recording> {
    const runDir = await this.ensureRunDir();
    const mode = await this.resolveMode(options.mode);
    const ts = this.formatTimestamp(new Date());
    const label = options.label ?? mode;
    const filePrefix = `${label}-${ts}`;

    // Resolve single device/viewport strings for browser mode
    const singleDevice = typeof options.device === "string" ? options.device : undefined;
    const singleViewport = typeof options.viewport === "string" ? options.viewport : undefined;

    let recording: Recording;
    switch (mode) {
      case "browser": {
        if (!options.testFile) {
          throw new Error("browser mode requires testFile");
        }

        const visualConfig: { viewport?: { width: number; height: number }; device?: string } = {};
        if (singleDevice) {
          visualConfig.device = singleDevice;
        } else if (singleViewport) {
          visualConfig.viewport = parseViewport(singleViewport);
        } else if (this.config.browser?.viewport) {
          visualConfig.viewport = this.config.browser.viewport;
        }

        recording = await captureVisual(options as CaptureOptions & { testFile: string }, runDir, filePrefix, visualConfig);
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
      case "simulator": {
        if (!options.command) {
          throw new Error("simulator mode requires command");
        }
        if (!options.platform) {
          throw new Error("simulator mode requires platform (ios or android)");
        }
        recording = await captureSimulator(
          options as CaptureOptions & { command: string },
          runDir,
          filePrefix,
        );
        break;
      }
    }

    const source = options.testFile ? basename(options.testFile) : options.command ?? mode;
    const fallbackDescriptions: Record<Exclude<RecordingMode, "auto">, string> = {
      browser: `Playwright browser test recording of ${source}${options.testName ? ` — test: "${options.testName}"` : ""}`,
      terminal: `Terminal capture: ${source}`,
      simulator: `Simulator recording (${options.platform ?? "ios"}): ${source}`,
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
      device: singleDevice,
      viewport: singleViewport,
      platform: options.platform,
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

function parseViewport(vp: string): { width: number; height: number } {
  const match = vp.match(/^(\d+)x(\d+)$/);
  if (!match) {
    throw new Error(`Invalid viewport format "${vp}" — expected "WIDTHxHEIGHT" (e.g. "390x844")`);
  }
  return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
