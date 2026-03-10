import { spawn } from "child_process";
import { writeFile } from "fs/promises";
import { join } from "path";
import type { CaptureOptions, Recording } from "../types";

export async function captureOutput(
  options: CaptureOptions,
  runDir: string,
  command: string,
): Promise<Recording> {
  const label = options.label ?? "test-output";
  let stdout = "";
  let stderr = "";

  const startTime = Date.now();

  await new Promise<void>((resolve) => {
    const proc = spawn(command, { shell: true, stdio: "pipe" });

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", () => resolve());
    proc.on("error", () => resolve());
  });

  const duration = Date.now() - startTime;
  const outputPath = join(runDir, `${label}.txt`);
  const content = [stdout, stderr].filter(Boolean).join("\n---\n");

  await writeFile(outputPath, content, "utf-8");

  return {
    path: outputPath,
    mode: "test-output",
    duration,
    label,
  };
}
