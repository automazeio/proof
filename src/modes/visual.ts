import { rename, readdir } from "fs/promises";
import { join } from "path";
import type { CaptureOptions, Recording } from "../types";
import { getVideoDuration } from "../duration";

export async function captureVisual(
  options: CaptureOptions,
  runDir: string,
  config: { viewport?: { width: number; height: number }; maxVideoLength?: number },
): Promise<Recording> {
  const { chromium } = await import("playwright");

  const viewport = config.viewport ?? { width: 1280, height: 720 };
  const label = options.label ?? "recording";

  const browser = await chromium.launch();
  const context = await browser.newContext({
    recordVideo: {
      dir: runDir,
      size: viewport,
    },
    viewport,
  });

  const page = await context.newPage();

  // Run the test command and wait for it to finish
  const { spawn } = await import("child_process");
  const testArgs = ["playwright", "test", options.testFile, "--reporter=list"];
  if (options.testName) {
    testArgs.push("-g", options.testName);
  }

  await new Promise<void>((resolve) => {
    const proc = spawn("npx", testArgs, {
      stdio: "pipe",
      env: {
        ...process.env,
        PWDEBUG: "0",
      },
    });

    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (config.maxVideoLength) {
      timeout = setTimeout(() => proc.kill("SIGTERM"), config.maxVideoLength * 1000);
    }

    proc.on("close", () => {
      if (timeout) clearTimeout(timeout);
      resolve();
    });
    proc.on("error", () => {
      if (timeout) clearTimeout(timeout);
      resolve();
    });
  });

  // Close context to finalize the video
  await context.close();
  await browser.close();

  // Find and rename the video file
  const files = await readdir(runDir);
  const video = files.find((f) => f.endsWith(".webm") || f.endsWith(".mp4"));

  if (!video) {
    throw new Error(`No video file found in ${runDir} after Playwright run`);
  }

  const ext = video.endsWith(".webm") ? ".webm" : ".mp4";
  const finalPath = join(runDir, `${label}${ext}`);
  await rename(join(runDir, video), finalPath);

  const duration = await getVideoDuration(finalPath);

  return {
    path: finalPath,
    mode: "visual",
    duration,
    label,
  };
}
