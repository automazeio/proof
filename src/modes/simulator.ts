import { execSync, spawn } from "child_process";
import { join } from "path";
import { stat, readFile } from "fs/promises";
import { existsSync } from "fs";
import { assertIosReady, resolveIosDevice, startIosRecording } from "./simulator-ios";
import {
  assertAndroidReady,
  resolveAndroidDevice,
  startAndroidRecording,
  convertToMp4,
  enableTouchIndicators,
  disableTouchIndicators,
} from "./simulator-android";
import { getVideoDuration } from "../duration";
import { findLatestXcresult, parseTapEvents } from "./xcresult";
import { overlayTouchIndicators, type TapCoordinate } from "./touch-overlay";
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
    return captureAndroid(options, runDir, filePrefix, label);
  }

  assertIosReady();

  const device = resolveIosDevice(
    options.simulator?.deviceName,
    options.simulator?.os,
  );

  if (isXcodebuildTest(options.command) && !hasClonePreventionFlags(options.command)) {
    console.error(`\n⚠️  ${XCODEBUILD_CLONE_WARNING}\n`);
  }

  const outputPath = join(runDir, `${filePrefix}.mp4`);
  const recordingStartTime = new Date();

  const recording = startIosRecording(
    device.udid,
    outputPath,
    options.simulator?.codec,
  );

  await runCommand(options.command);
  await sleep(500);
  await recording.stop();

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

  // Post-process: overlay touch indicators
  if (isXcodebuildTest(options.command)) {
    try {
      const xcresultPath = findLatestXcresult();
      if (xcresultPath) {
        const taps = parseTapEvents(xcresultPath);
        if (taps.length > 0) {
          const tapCoords = findTapCoordinates(device.udid);
          await overlayTouchIndicators(outputPath, taps, recordingStartTime, tapCoords ?? undefined);
        }
      }
    } catch {
      // Non-fatal
    }
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

async function captureAndroid(
  options: CaptureOptions & { command: string },
  runDir: string,
  filePrefix: string,
  label: string,
): Promise<Recording> {
  assertAndroidReady();

  const device = resolveAndroidDevice(
    options.simulator?.deviceName,
    options.simulator?.deviceId,
  );

  const outputPath = join(runDir, `${filePrefix}.mp4`);
  const webmPath = join(runDir, `${filePrefix}.webm`);

  enableTouchIndicators(device.serial);

  const recordingStartTime = new Date();
  const recording = startAndroidRecording(device.serial, webmPath, {
    bitRate: options.simulator?.bitRate,
    size: options.simulator?.size,
  });

  try {
    await runCommand(options.command);
    await sleep(500);
  } finally {
    await recording.stop();
    disableTouchIndicators(device.serial);
  }

  convertToMp4(webmPath, outputPath);

  // Post-process: overlay touch indicators from tap log if present
  try {
    const tapLog = process.env.PROOF_TAP_LOG ?? "/tmp/proof-android-taps.json";
    if (existsSync(tapLog)) {
      const entries = JSON.parse(require("fs").readFileSync(tapLog, "utf-8")) as Array<{
        element: string; x: number; y: number; offsetMs: number;
      }>;
      if (entries.length > 0) {
        const taps = entries.map((e) => ({
          element: e.element,
          timestamp: new Date(recordingStartTime.getTime() + e.offsetMs),
          durationMs: 0,
        }));
        const coords = entries.map((e) => ({
          element: e.element,
          x: e.x,
          y: e.y,
          timestamp: new Date(recordingStartTime.getTime() + e.offsetMs).toISOString(),
        }));
        await overlayTouchIndicators(outputPath, taps, recordingStartTime, coords, 1);
      }
    }
  } catch {
    // Non-fatal
  }

  if (!existsSync(outputPath)) {
    throw new Error(
      `Recording file not found at ${outputPath}. ` +
      `The emulator may have crashed during recording.`
    );
  }

  const fileStat = await stat(outputPath);
  if (fileStat.size === 0) {
    throw new Error(
      `Recording file is empty at ${outputPath}. ` +
      `Check that the emulator screen was visible during recording.`
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

function findTapCoordinates(udid: string): TapCoordinate[] | null {
  try {
    const deviceDir = join(
      process.env.HOME ?? "/",
      "Library/Developer/CoreSimulator/Devices",
      udid,
      "data/Containers/Data/Application",
    );

    // Search for proof-taps.json in the device's app containers
    const result = execSync(
      `find "${deviceDir}" -name "proof-taps.json" -maxdepth 2 2>/dev/null | head -1`,
      { encoding: "utf-8" },
    ).trim();

    if (!result || !existsSync(result)) return null;

    const data = JSON.parse(
      require("fs").readFileSync(result, "utf-8"),
    ) as TapCoordinate[];

    return data.length > 0 ? data : null;
  } catch {
    return null;
  }
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
