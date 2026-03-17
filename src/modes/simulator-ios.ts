import { execSync, spawn, type ChildProcess } from "child_process";

export interface SimDevice {
  udid: string;
  name: string;
  state: string;
  runtime: string;
}

export function assertIosReady(): void {
  try {
    execSync("xcrun --version", { stdio: "ignore" });
  } catch {
    throw new Error(
      "xcrun not found. Install Xcode Command Line Tools: xcode-select --install"
    );
  }

  try {
    execSync("xcrun simctl help", { stdio: "ignore" });
  } catch {
    throw new Error(
      "simctl not available. Ensure Xcode is installed and xcode-select points to it."
    );
  }
}

export function getBootedUdids(): Set<string> {
  const result = execSync("xcrun simctl list devices booted --json", { encoding: "utf-8" });
  const data = JSON.parse(result);
  const udids = new Set<string>();
  for (const devs of Object.values(data.devices)) {
    for (const dev of devs as any[]) {
      if (dev.state === "Booted") udids.add(dev.udid);
    }
  }
  return udids;
}

export function resolveIosDevice(deviceName?: string, os?: string): SimDevice {
  const result = execSync("xcrun simctl list devices --json", { encoding: "utf-8" });
  const data = JSON.parse(result);

  const devices: SimDevice[] = [];
  for (const [runtime, devs] of Object.entries(data.devices)) {
    for (const dev of devs as any[]) {
      if (!(dev as any).isAvailable) continue;
      devices.push({
        udid: dev.udid,
        name: dev.name,
        state: dev.state,
        runtime,
      });
    }
  }

  if (!deviceName) {
    const booted = devices.find((d) => d.state === "Booted");
    if (!booted) {
      throw new Error(
        "No booted iOS Simulator found. Boot one with: xcrun simctl boot <device>"
      );
    }
    return booted;
  }

  const matches = devices.filter((d) => {
    const nameMatch = d.name === deviceName;
    const osMatch = os ? d.runtime.includes(os) : true;
    return nameMatch && osMatch;
  });

  if (matches.length === 0) {
    const available = [...new Set(devices.map((d) => d.name))].join(", ");
    throw new Error(
      `No iOS Simulator found matching "${deviceName}"${os ? ` (iOS ${os})` : ""}. ` +
      `Available: ${available}`
    );
  }

  const booted = matches.find((d) => d.state === "Booted");
  if (booted) return booted;

  // Boot the first match
  const target = matches[0];
  execSync(`xcrun simctl boot ${target.udid}`);
  return { ...target, state: "Booted" };
}

export interface IosRecordingHandle {
  process: ChildProcess;
  outputPath: string;
  stop: () => Promise<string>;
}

export function startIosRecording(
  udid: string,
  outputPath: string,
  codec: string = "h264",
): IosRecordingHandle {
  const proc = spawn(
    "xcrun",
    ["simctl", "io", udid, "recordVideo", "--codec", codec, outputPath],
    { stdio: "ignore" },
  );

  return {
    process: proc,
    outputPath,
    stop: () =>
      new Promise((resolve, reject) => {
        let settled = false;

        proc.on("close", () => {
          if (!settled) {
            settled = true;
            resolve(outputPath);
          }
        });

        proc.on("error", (err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        });

        // SIGINT triggers graceful stop and file finalization
        proc.kill("SIGINT");

        // Safety timeout
        setTimeout(() => {
          if (!settled) {
            settled = true;
            if (!proc.killed) proc.kill("SIGKILL");
            resolve(outputPath);
          }
        }, 10_000);
      }),
  };
}
