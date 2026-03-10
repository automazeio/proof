import { spawn } from "child_process";
import { readdir } from "fs/promises";
import { join } from "path";
import type { CaptureOptions, Recording } from "../types";

export async function captureVisual(
  options: CaptureOptions,
  runDir: string,
  config: { viewport?: { width: number; height: number }; maxVideoLength?: number },
): Promise<Recording> {
  const viewport = config.viewport ?? { width: 1280, height: 720 };
  const args = [
    "playwright",
    "test",
    options.testFile,
    "--reporter=list",
  ];
  if (options.testName) {
    args.push("-g", options.testName);
  }

  const env = {
    ...process.env,
    PLAYWRIGHT_VIDEO: "on",
    PLAYWRIGHT_VIDEO_DIR: runDir,
    PW_TEST_SCREENSHOT: "off",
  };

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("npx", args, { env, stdio: "pipe" });
    let timeout: ReturnType<typeof setTimeout> | undefined;

    if (config.maxVideoLength) {
      timeout = setTimeout(() => {
        proc.kill("SIGTERM");
      }, config.maxVideoLength * 1000);
    }

    proc.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      // Don't reject on non-zero -- the test may intentionally fail (before recording)
      resolve();
    });

    proc.on("error", (err) => {
      if (timeout) clearTimeout(timeout);
      reject(err);
    });
  });

  const files = await readdir(runDir);
  const video = files.find((f) => f.endsWith(".webm") || f.endsWith(".mp4"));
  const label = options.label ?? "recording";

  if (!video) {
    throw new Error(`No video file found in ${runDir} after Playwright run`);
  }

  const videoPath = join(runDir, video);

  return {
    path: videoPath,
    mode: "visual",
    duration: 0, // TODO: extract actual duration via ffprobe
    label,
  };
}
