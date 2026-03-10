import { mkdir, readdir, rm, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { detectMode } from "./detect";
import { captureVisual } from "./modes/visual";
import { captureTerminal } from "./modes/terminal";
import { captureOutput } from "./modes/output";
import type {
  ProofConfig,
  Recording,
  CompareResult,
  CaptureOptions,
  CompareOptions,
  AttachToPROptions,
  AttachToIssueOptions,
  RecordSuiteOptions,
  RecordSuiteResult,
  RunInfo,
  CleanupOptions,
  RecordingMode,
} from "./types";

export type {
  ProofConfig,
  Recording,
  CompareResult,
  CaptureOptions,
  CompareOptions,
  AttachToPROptions,
  AttachToIssueOptions,
  RecordSuiteOptions,
  RecordSuiteResult,
  RunInfo,
  CleanupOptions,
  RecordingMode,
};

export class Proof {
  private config: ProofConfig;
  private workDir: string;

  constructor(config: ProofConfig) {
    this.config = {
      mode: "auto",
      maxVideoLength: 30,
      ...config,
    };
    this.workDir =
      config.workDir ??
      process.env.PROOF_WORK_DIR ??
      join(tmpdir(), "proof");
  }

  private generateRunId(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      "-",
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds()),
    ].join("");
  }

  private async ensureRunDir(): Promise<string> {
    const runId = this.generateRunId();
    const runDir = join(this.workDir, runId);
    await mkdir(runDir, { recursive: true });
    return runDir;
  }

  private async resolveMode(): Promise<Exclude<RecordingMode, "auto">> {
    const envMode = process.env.PROOF_MODE as RecordingMode | undefined;
    const mode = envMode ?? this.config.mode ?? "auto";

    if (mode !== "auto") return mode;
    return detectMode(process.cwd());
  }

  async capture(options: CaptureOptions): Promise<Recording> {
    const runDir = await this.ensureRunDir();
    const mode = await this.resolveMode();

    switch (mode) {
      case "visual":
        return captureVisual(options, runDir, {
          viewport: this.config.visual?.viewport,
          maxVideoLength: this.config.maxVideoLength,
        });
      case "terminal":
        return captureTerminal(
          options,
          runDir,
          `bun test ${options.testFile}`,
          this.config.terminal ?? {},
        );
      case "test-output":
        return captureOutput(options, runDir, `bun test ${options.testFile}`);
    }
  }

  async compare(options: CompareOptions): Promise<CompareResult> {
    const mode = await this.resolveMode();
    const { spawn } = await import("child_process");

    const git = (args: string[]) =>
      new Promise<void>((resolve, reject) => {
        const proc = spawn("git", args, { stdio: "pipe" });
        proc.on("close", (code) =>
          code === 0 ? resolve() : reject(new Error(`git ${args.join(" ")} failed`)),
        );
      });

    // Record before
    await git(["stash", "--include-untracked"]);
    await git(["checkout", options.beforeRef]);
    const before = await this.capture({
      testFile: options.testFile,
      testName: options.testName,
      label: "before",
    });

    // Record after
    const afterRef = options.afterRef ?? "HEAD";
    await git(["checkout", afterRef]);
    try {
      await git(["stash", "pop"]);
    } catch {}
    const after = await this.capture({
      testFile: options.testFile,
      testName: options.testName,
      label: "after",
    });

    return { before, after, mode };
  }

  async attachToPR(options: AttachToPROptions): Promise<void> {
    const { Octokit } = await import("@octokit/rest");
    const token = this.config.githubToken ?? process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token required for PR attachment");

    const [owner, repo] = this.config.repo.split("/");
    const octokit = new Octokit({ auth: token });

    const isCompare = "before" in options.recordings && "after" in options.recordings;
    let body = options.comment ? `## ${options.comment}\n\n` : "";

    if (isCompare) {
      const result = options.recordings as CompareResult;
      body += `### Before\n\`${result.before.path}\`\n\n`;
      body += `### After\n\`${result.after.path}\`\n\n`;
    } else {
      const recording = options.recordings as Recording;
      body += `\`${recording.path}\`\n\n`;
    }
    body += `*Recorded by @varops/proof*`;

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: options.prNumber,
      body,
    });
  }

  async attachToIssue(options: AttachToIssueOptions): Promise<void> {
    const { Octokit } = await import("@octokit/rest");
    const token = this.config.githubToken ?? process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GitHub token required for issue attachment");

    const [owner, repo] = this.config.repo.split("/");
    const octokit = new Octokit({ auth: token });

    let body = options.comment ? `## ${options.comment}\n\n` : "";
    body += `\`${options.recording.path}\`\n\n`;
    body += `*Recorded by @varops/proof*`;

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: options.issueNumber,
      body,
    });
  }

  async listRuns(): Promise<RunInfo[]> {
    try {
      const entries = await readdir(this.workDir, { withFileTypes: true });
      const runs: RunInfo[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const runPath = join(this.workDir, entry.name);
        const files = await readdir(runPath);
        const stats = await stat(runPath);
        let totalSize = 0;
        for (const file of files) {
          const s = await stat(join(runPath, file));
          totalSize += s.size;
        }
        runs.push({
          id: entry.name,
          createdAt: stats.birthtime,
          files,
          sizeBytes: totalSize,
        });
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
        await rm(join(this.workDir, run.id), { recursive: true, force: true });
      }
    }
  }
}
