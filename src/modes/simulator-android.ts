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
  localWebmPath: string;
}

// Uses `adb emu screenrecord` which saves directly to the host filesystem.
// `adb shell screenrecord` produces 0 frames on emulators using the gfxstream
// graphics backend (default on Apple Silicon) because the AVC encoder can't
// capture from a virtual display in that configuration.
export function startAndroidRecording(
  serial: string,
  localWebmPath: string,
  opts: { bitRate?: number; size?: string } = {},
): AndroidRecordingHandle {
  const args = ["emu", "screenrecord", "start"];
  if (opts.bitRate) args.push("--bit-rate", String(opts.bitRate));
  if (opts.size) args.push("--size", opts.size);
  args.push(localWebmPath);

  execSync(`"${ADB}" -s ${serial} ${args.join(" ")}`, { stdio: "ignore" });

  return {
    localWebmPath,
    stop: () =>
      new Promise<void>((resolve) => {
        try {
          execSync(`"${ADB}" -s ${serial} emu screenrecord stop`, { stdio: "ignore" });
        } catch { /* ignore */ }
        // Give the emulator a moment to finalize the file
        setTimeout(resolve, 1000);
      }),
  };
}

export function convertToMp4(webmPath: string, mp4Path: string): void {
  execSync(
    `ffmpeg -i "${webmPath}" -c:v libx264 -preset fast -crf 23 "${mp4Path}" -y`,
    { stdio: "ignore" },
  );
  try { require("fs").unlinkSync(webmPath); } catch { /* ignore */ }
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
