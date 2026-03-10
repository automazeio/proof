import { spawn } from "child_process";
import { readFile } from "fs/promises";
import { join } from "path";
import type { CaptureOptions, Recording } from "../types";

async function getCastDuration(castPath: string): Promise<number> {
  try {
    const content = await readFile(castPath, "utf-8");
    const lines = content.trim().split("\n");
    if (lines.length < 2) return 0;
    const lastLine = JSON.parse(lines[lines.length - 1]);
    return Math.round((lastLine[0] ?? 0) * 1000);
  } catch {
    return 0;
  }
}

export async function captureTerminal(
  options: CaptureOptions,
  runDir: string,
  command: string,
  config: { cols?: number; rows?: number; convertToGif?: boolean },
): Promise<Recording> {
  const label = options.label ?? "terminal";
  const castPath = join(runDir, `${label}.cast`);
  const cols = config.cols ?? 120;
  const rows = config.rows ?? 30;

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      "asciinema",
      ["rec", castPath, "--cols", String(cols), "--rows", String(rows), "-c", command],
      { stdio: "pipe" },
    );

    proc.on("close", () => resolve());
    proc.on("error", (err) => reject(err));
  });

  const duration = await getCastDuration(castPath);
  let finalPath = castPath;

  if (config.convertToGif) {
    const gifPath = join(runDir, `${label}.gif`);
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn("agg", [castPath, gifPath], { stdio: "pipe" });
        proc.on("close", (code) => code === 0 ? resolve() : reject(new Error("agg failed")));
        proc.on("error", (err) => reject(err));
      });
      finalPath = gifPath;
    } catch {
      // agg not available, keep .cast
    }
  }

  return {
    path: finalPath,
    mode: "terminal",
    duration,
    label,
  };
}
