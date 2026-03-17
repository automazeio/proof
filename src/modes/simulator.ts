import { spawn } from "child_process";
import { join } from "path";
import { stat } from "fs/promises";
import { existsSync } from "fs";
import { assertIosReady, resolveIosDevice, startIosRecording } from "./simulator-ios";
import { getVideoDuration } from "../duration";
import type { CaptureOptions, Recording } from "../types";

const XCODEBUILD_CLONE_WARNING =
  "Hint: xcodebuild test clones the simulator by default, which means the " +
  "recording captures an idle screen. Add these flags to your xcodebuild command: " +
  "-parallel-testing-enabled NO -disable-concurrent-destination-testing";

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

  // Warn if xcodebuild test is detected without clone-prevention flags
  if (isXcodebuildTest(options.command) && !hasClonePreventionFlags(options.command)) {
    console.error(`\n⚠️  ${XCODEBUILD_CLONE_WARNING}\n`);
  }

  const outputPath = join(runDir, `${filePrefix}.mp4`);

  // Start recording the booted simulator
  const recording = startIosRecording(
    device.udid,
    outputPath,
    options.simulator?.codec,
  );

  // Run the user's command
  await runCommand(options.command);

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
    const hint = isXcodebuildTest(options.command)
      ? ` ${XCODEBUILD_CLONE_WARNING}`
      : "";
    throw new Error(
      `Recording file is empty at ${outputPath}. ` +
      `Check that the simulator screen was visible during recording.${hint}`
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

function isXcodebuildTest(command: string): boolean {
  return /xcodebuild\s+.*\btest\b/.test(command) ||
    /xcodebuild\s+.*\btest-without-building\b/.test(command);
}

function hasClonePreventionFlags(command: string): boolean {
  return command.includes("-parallel-testing-enabled NO") ||
    command.includes("-disable-concurrent-destination-testing");
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
