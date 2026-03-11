import { readdir, rm, copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { spawn } from "child_process";
import type { CaptureOptions, Recording } from "../types";
import { getVideoDuration } from "../duration";

const CURSOR_HIGHLIGHT_SCRIPT = `
  (function() {
    function init() {
      if (document.getElementById('__proof_cursor')) return;
      const cursor = document.createElement('div');
      cursor.id = '__proof_cursor';
      cursor.style.cssText = [
        'position: fixed',
        'width: 20px',
        'height: 20px',
        'border-radius: 50%',
        'background: rgba(255, 50, 50, 0.8)',
        'border: 2px solid rgba(255, 255, 255, 0.95)',
        'pointer-events: none',
        'z-index: 2147483647',
        'transform: translate(-50%, -50%)',
        'box-shadow: 0 0 8px rgba(255,50,50,0.4), 0 0 2px rgba(0,0,0,0.3)',
        'display: none',
        'transition: left 0.08s ease-out, top 0.08s ease-out',
      ].join(';');
      document.documentElement.appendChild(cursor);

      function showCursor(x, y) {
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';
        cursor.style.display = 'block';
      }

      function spawnRipple(x, y) {
        const ripple = document.createElement('div');
        ripple.style.cssText = [
          'position: fixed',
          'pointer-events: none',
          'z-index: 2147483646',
          'border-radius: 50%',
          'border: 3px solid rgba(255, 50, 50, 0.7)',
          'width: 10px',
          'height: 10px',
          'left: ' + x + 'px',
          'top: ' + y + 'px',
          'transform: translate(-50%, -50%) scale(1)',
          'opacity: 1',
          'transition: transform 0.5s ease-out, opacity 0.5s ease-out',
        ].join(';');
        document.documentElement.appendChild(ripple);
        requestAnimationFrame(() => {
          ripple.style.transform = 'translate(-50%, -50%) scale(5)';
          ripple.style.opacity = '0';
        });
        setTimeout(() => ripple.remove(), 600);
      }

      for (const evt of ['mousemove', 'pointermove']) {
        document.addEventListener(evt, (e) => showCursor(e.clientX, e.clientY), true);
        window.addEventListener(evt, (e) => showCursor(e.clientX, e.clientY), true);
      }
      for (const evt of ['mousedown', 'pointerdown', 'click']) {
        document.addEventListener(evt, (e) => {
          showCursor(e.clientX, e.clientY);
          spawnRipple(e.clientX, e.clientY);
        }, true);
        window.addEventListener(evt, (e) => {
          showCursor(e.clientX, e.clientY);
          spawnRipple(e.clientX, e.clientY);
        }, true);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
`;

export async function captureVisual(
  options: CaptureOptions & { testFile: string },
  runDir: string,
  filePrefix: string,
  config: { viewport?: { width: number; height: number } },
): Promise<Recording> {
  const label = options.label ?? "recording";
  const testFile = options.testFile;
  const testDir = dirname(testFile);

  const configCandidates = [
    join(testDir, "playwright.config.ts"),
    join(testDir, "playwright.config.js"),
    join(testDir, "playwright.config.mjs"),
  ];
  const existingConfig = configCandidates.find((c) => existsSync(c));

  const testResultsDir = join(runDir, "pw-results");
  await mkdir(testResultsDir, { recursive: true });

  const testArgs = [
    "playwright", "test", testFile,
    "--reporter=list",
    "--output", testResultsDir,
  ];
  if (options.testName) {
    testArgs.push("-g", options.testName);
  }
  if (existingConfig) {
    testArgs.push("--config", existingConfig);
  }

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    PWDEBUG: "0",
    PLAYWRIGHT_VIDEO: "on",
  };

  let exitCode: number | null = null;
  let stderr = "";

  await new Promise<void>((resolve) => {
    const proc = spawn("npx", testArgs, {
      stdio: "pipe",
      env,
      cwd: testDir,
    });

    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("close", (code) => {
      exitCode = code;
      resolve();
    });
    proc.on("error", (err) => {
      throw new Error(`Failed to run Playwright: ${err.message}. Is @playwright/test installed?`);
    });
  });

  const videoFile = await findVideo(testResultsDir);

  if (!videoFile) {
    const hint = stderr.trim() ? `\nPlaywright output:\n${stderr.trim().split("\n").slice(-5).join("\n")}` : "";
    throw new Error(
      `No video file found after Playwright test run. Check that video: 'on' is set in playwright config.${hint}`,
    );
  }

  const ext = videoFile.endsWith(".webm") ? ".webm" : ".mp4";
  const finalPath = join(runDir, `${filePrefix}${ext}`);
  await copyFile(videoFile, finalPath);

  await rm(testResultsDir, { recursive: true, force: true });

  const duration = await getVideoDuration(finalPath);

  return {
    path: finalPath,
    mode: "browser",
    duration,
    label,
  };
}

async function findVideo(resultsDir: string): Promise<string | null> {
  if (!existsSync(resultsDir)) return null;

  const entries = await readdir(resultsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() && (entry.name.endsWith(".webm") || entry.name.endsWith(".mp4"))) {
      return join(resultsDir, entry.name);
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const subDir = join(resultsDir, entry.name);
    const files = await readdir(subDir);
    const video = files.find((f) => f.endsWith(".webm") || f.endsWith(".mp4"));
    if (video) return join(subDir, video);
  }
  return null;
}

export function getCursorHighlightScript(): string {
  return CURSOR_HIGHLIGHT_SCRIPT;
}
