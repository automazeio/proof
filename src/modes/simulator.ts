import { spawn } from "child_process";
import { join } from "path";
import { copyFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { assertIosReady, resolveIosDevice, startIosRecording } from "./simulator-ios";
import { getVideoDuration } from "../duration";
import type { CaptureOptions, Recording } from "../types";

export async function captureSimulator(
  options: CaptureOptions & { command: string },
  runDir: string,
  filePrefix: string,
): Promise<Recording> {
  const label = options.label ?? "simulator";
  const platform = options.platform ?? "ios";

  if (platform === "android") {
    throw new Error("Android simulator capture is not yet implemented");
  }

  assertIosReady();

  const device = resolveIosDevice(
    options.simulator?.deviceName,
    options.simulator?.os,
  );

  const outputPath = join(runDir, `${filePrefix}.mp4`);

  const recording = startIosRecording(
    device.udid,
    outputPath,
    options.simulator?.codec,
  );

  // Run the user's command
  const exitCode = await runCommand(options.command);

  // Small delay to let the last frames render
  await sleep(500);

  // Stop recording
  await recording.stop();

  // Verify file exists
  if (!existsSync(outputPath)) {
    throw new Error(
      `Recording file not found at ${outputPath}. ` +
      `The simulator may have crashed during recording.`
    );
  }

  const fileStat = await stat(outputPath);
  if (fileStat.size === 0) {
    throw new Error(
      `Recording file is empty at ${outputPath}. ` +
      `Check that the simulator screen was visible during recording.`
    );
  }

  let duration: number;
  try {
    duration = await getVideoDuration(outputPath);
  } catch {
    duration = 0;
  }

  return {
    path: outputPath,
    mode: "simulator",
    duration,
    label,
  };
}

function runCommand(command: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn("/bin/sh", ["-c", command], {
      stdio: "inherit",
    });
    proc.on("close", (code) => resolve(code ?? 1));
    proc.on("error", () => resolve(1));
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
