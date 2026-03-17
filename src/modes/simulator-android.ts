import { execSync, spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

const ADB = findAdb();
const EMULATOR = findEmulator();

function findAdb(): string {
  const sdkPath = `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`;
  if (existsSync(sdkPath)) return sdkPath;
  try {
    execSync("adb version", { stdio: "ignore" });
    return "adb";
  } catch {
    return sdkPath; // will fail with a clear error at assertAndroidReady()
  }
}

function findEmulator(): string {
  const sdkPath = `${process.env.HOME}/Library/Android/sdk/emulator/emulator`;
  if (existsSync(sdkPath)) return sdkPath;
  return "emulator";
}

export interface AndroidDevice {
  serial: string;
  avdName: string;
}

export function assertAndroidReady(): void {
  try {
    execSync(`"${ADB}" version`, { stdio: "ignore" });
  } catch {
    throw new Error(
      `adb not found. Install Android SDK platform-tools or set ANDROID_HOME. ` +
      `Tried: ${ADB}`
    );
  }
}

export function getRunningEmulators(): AndroidDevice[] {
  try {
    const output = execSync(`"${ADB}" devices`, { encoding: "utf-8" });
    const lines = output.split("\n").slice(1); // skip header
    const devices: AndroidDevice[] = [];
    for (const line of lines) {
      const [serial, state] = line.trim().split(/\s+/);
      if (!serial || state !== "device" || !serial.startsWith("emulator-")) continue;
      let avdName = serial;
      try {
        avdName = execSync(`"${ADB}" -s ${serial} emu avd name`, {
          encoding: "utf-8",
        }).split("\n")[0].trim();
      } catch {
        // ignore
      }
      devices.push({ serial, avdName });
    }
    return devices;
  } catch {
    return [];
  }
}

export function listAvds(): string[] {
  try {
    const output = execSync(`"${EMULATOR}" -list-avds`, { encoding: "utf-8" });
    return output
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function bootAvd(avdName: string): AndroidDevice {
  console.error(`Booting Android emulator: ${avdName}`);
  const proc = spawn(EMULATOR, ["-avd", avdName, "-no-audio", "-no-boot-anim"], {
    detached: true,
    stdio: "ignore",
  });
  proc.unref();

  // Wait for device to appear and fully boot
  execSync(`"${ADB}" wait-for-device`, { timeout: 120_000 });

  // Wait for boot_completed
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const val = execSync(
        `"${ADB}" shell getprop sys.boot_completed`,
        { encoding: "utf-8", timeout: 5000 },
      ).trim();
      if (val === "1") break;
    } catch {
      // not ready yet
    }
    execSync("sleep 2");
  }

  const running = getRunningEmulators();
  const match = running.find((d) => d.avdName === avdName);
  if (!match) {
    // fallback: use first running emulator
    if (running.length > 0) return running[0];
    throw new Error(`Emulator booted but not found in adb devices`);
  }
  return match;
}

export function resolveAndroidDevice(avdName?: string, deviceId?: string): AndroidDevice {
  if (deviceId) {
    return { serial: deviceId, avdName: deviceId };
  }

  const running = getRunningEmulators();

  if (!avdName) {
    if (running.length === 0) {
      const avds = listAvds();
      if (avds.length === 0) {
        throw new Error(
          "No Android emulator running and no AVDs found. " +
          "Create an AVD in Android Studio (Tools > Device Manager)."
        );
      }
      return bootAvd(avds[0]);
    }
    return running[0];
  }

  const match = running.find((d) => d.avdName === avdName);
  if (match) return match;

  const avds = listAvds();
  const avdMatch = avds.find((a) => a === avdName);
  if (!avdMatch) {
    throw new Error(
      `No AVD found matching "${avdName}". Available: ${avds.join(", ")}`
    );
  }

  return bootAvd(avdName);
}

export interface AndroidRecordingHandle {
  stop: () => Promise<void>;
  remoteFiles: string[];
}

// screenrecord has a 180s limit; we chain segments for longer recordings
const SEGMENT_DURATION = 175;

export function startAndroidRecording(
  serial: string,
  opts: { bitRate?: number; size?: string } = {},
): AndroidRecordingHandle {
  const remoteFiles: string[] = [];
  let segmentIndex = 0;
  let stopped = false;
  let currentProc: ChildProcess | null = null;
  let segmentTimer: ReturnType<typeof setTimeout> | null = null;

  function remotePathForSegment(i: number): string {
    return `/sdcard/proof-recording-${i}.mp4`;
  }

  function startSegment(): void {
    const remotePath = remotePathForSegment(segmentIndex);
    remoteFiles.push(remotePath);

    const args = ["-s", serial, "shell", "screenrecord"];
    if (opts.bitRate) args.push("--bit-rate", String(opts.bitRate));
    if (opts.size) args.push("--size", opts.size);
    args.push("--time-limit", String(SEGMENT_DURATION), remotePath);

    currentProc = spawn(ADB, args, { stdio: "ignore" });

    currentProc.on("close", () => {
      if (!stopped) {
        // Natural end of segment (hit 175s limit), start next
        segmentIndex++;
        startSegment();
      }
    });

    // Also chain proactively just before the limit
    segmentTimer = setTimeout(() => {
      if (!stopped && currentProc) {
        segmentIndex++;
        startSegment();
      }
    }, (SEGMENT_DURATION - 2) * 1000);
  }

  startSegment();

  return {
    remoteFiles,
    stop: () =>
      new Promise<void>((resolve) => {
        stopped = true;
        if (segmentTimer) clearTimeout(segmentTimer);
        if (currentProc) {
          currentProc.on("close", () => resolve());
          currentProc.kill("SIGINT");
          setTimeout(() => {
            if (currentProc && !currentProc.killed) currentProc.kill("SIGKILL");
            resolve();
          }, 10_000);
        } else {
          resolve();
        }
      }),
  };
}

export function pullAndMergeRecording(
  serial: string,
  remoteFiles: string[],
  localOutputPath: string,
): void {
  if (remoteFiles.length === 0) return;

  if (remoteFiles.length === 1) {
    execSync(`"${ADB}" -s ${serial} pull "${remoteFiles[0]}" "${localOutputPath}"`, {
      stdio: "ignore",
    });
    execSync(`"${ADB}" -s ${serial} shell rm -f "${remoteFiles[0]}"`, { stdio: "ignore" });
    return;
  }

  // Pull all segments and concatenate with ffmpeg
  const tmpDir = require("os").tmpdir();
  const localSegments: string[] = [];

  for (let i = 0; i < remoteFiles.length; i++) {
    const localSeg = join(tmpDir, `proof-seg-${i}.mp4`);
    localSegments.push(localSeg);
    execSync(`"${ADB}" -s ${serial} pull "${remoteFiles[i]}" "${localSeg}"`, {
      stdio: "ignore",
    });
    execSync(`"${ADB}" -s ${serial} shell rm -f "${remoteFiles[i]}"`, { stdio: "ignore" });
  }

  // Build ffmpeg concat list
  const concatList = join(tmpDir, "proof-concat.txt");
  const listContent = localSegments.map((f) => `file '${f}'`).join("\n");
  require("fs").writeFileSync(concatList, listContent);

  execSync(
    `ffmpeg -f concat -safe 0 -i "${concatList}" -c copy "${localOutputPath}" -y`,
    { stdio: "ignore" },
  );

  for (const seg of localSegments) {
    try { require("fs").unlinkSync(seg); } catch { /* ignore */ }
  }
  try { require("fs").unlinkSync(concatList); } catch { /* ignore */ }
}

export function enableTouchIndicators(serial: string): void {
  try {
    execSync(`"${ADB}" -s ${serial} shell settings put system show_touches 1`, {
      stdio: "ignore",
    });
  } catch { /* non-fatal */ }
}

export function disableTouchIndicators(serial: string): void {
  try {
    execSync(`"${ADB}" -s ${serial} shell settings put system show_touches 0`, {
      stdio: "ignore",
    });
  } catch { /* non-fatal */ }
}
