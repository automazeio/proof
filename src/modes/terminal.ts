import { spawn } from "child_process";
import { readFile } from "fs/promises";
import { join } from "path";
import type { CaptureOptions, Recording } from "../types";

export async function captureTerminal(
  options: CaptureOptions,
  runDir: string,
  command: string,
  config: { cols?: number; rows?: number },
): Promise<Recording> {
  const label = options.label ?? "terminal";
  const outputPath = join(runDir, `${label}.txt`);
  const startTime = Date.now();

  // macOS `script` syntax: script -q <outfile> <command>
  // Linux `script` syntax: script -q -c <command> <outfile>
  const isMac = process.platform === "darwin";
  const args = isMac
    ? ["-q", outputPath, "/bin/sh", "-c", command]
    : ["-q", "-c", command, outputPath];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("script", args, {
      stdio: "pipe",
      env: {
        ...process.env,
        COLUMNS: String(config.cols ?? 120),
        LINES: String(config.rows ?? 30),
        FORCE_COLOR: "1",
        TERM: process.env.TERM ?? "xterm-256color",
      },
    });

    proc.on("close", () => resolve());
    proc.on("error", (err) => reject(err));
  });

  const duration = Date.now() - startTime;

  // Clean up `script` header/footer lines that some systems add
  try {
    let content = await readFile(outputPath, "utf-8");
    content = content
      .replace(/^Script started.*\n/m, "")
      .replace(/\nScript done.*$/m, "");
    const { writeFile } = await import("fs/promises");
    await writeFile(outputPath, content, "utf-8");
  } catch {}

  return {
    path: outputPath,
    mode: "terminal",
    duration,
    label,
  };
}
