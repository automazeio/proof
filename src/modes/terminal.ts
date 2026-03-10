import { spawn } from "child_process";
import { writeFile } from "fs/promises";
import { join } from "path";
import type { CaptureOptions, Recording } from "../types";

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

  let finalPath = castPath;

  if (config.convertToGif) {
    const gifPath = join(runDir, `${label}.gif`);
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn("agg", [castPath, gifPath], { stdio: "pipe" });
        proc.on("close", () => resolve());
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
    duration: 0,
    label,
  };
}
