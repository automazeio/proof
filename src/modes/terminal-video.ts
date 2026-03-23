import { execSync } from "child_process";
import { existsSync } from "fs";
import { chromium } from "playwright";

/**
 * Calculate the Playwright viewport size that matches the terminal dimensions
 * so there is minimal whitespace around the recorded output.
 *
 * Values derived from the HTML player's CSS:
 *   font-size: 12px, line-height: 1.4  → charHeight = 16.8px
 *   monospace char width at 12px       → charWidth  ≈ 7.2px
 *   padding: 14px each side            → 28px total per axis
 *   controls bar                       → 40px height
 */
export function terminalViewport(cols: number, rows: number): { width: number; height: number } {
  const charWidth = 7.2;
  const lineHeight = 16.8;
  const padding = 14 * 2;
  const controls = 40;
  return {
    width: Math.ceil(cols * charWidth + padding),
    height: Math.ceil(rows * lineHeight + padding + controls),
  };
}

/**
 * Replicate the playback speed logic from captureTerminal so we know
 * how long to wait for the headless browser to finish playing.
 */
function initialPlaybackSpeed(durationSec: number): number {
  if (durationSec < 0.2) return 0.1;
  if (durationSec < 0.5) return 0.25;
  if (durationSec < 2)   return 0.5;
  return 1;
}

/**
 * Render a proof terminal HTML player to an MP4 video using a headless
 * Chromium browser. The viewport is sized to match the terminal dimensions
 * so the output has no wasted whitespace.
 *
 * Returns the path to the produced .mp4 file.
 */
export async function renderTerminalVideo(
  htmlPath: string,
  cols: number,
  rows: number,
  durationMs: number,
): Promise<string> {
  const mp4Path = htmlPath.replace(/\.html$/, ".mp4");
  const viewport = terminalViewport(cols, rows);
  const durationSec = durationMs / 1000;
  const speed = initialPlaybackSpeed(durationSec);

  // Video will land alongside the html in the same run directory
  const videoDir = htmlPath.replace(/\/[^/]+$/, "");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: videoDir, size: viewport },
  });

  const page = await context.newPage();
  await page.goto(`file://${htmlPath}`);

  // Click play — the HTML player already has initialSpeed pre-selected
  await page.click("#playBtn");

  // Wait for the full playback duration at the initial speed, plus a small
  // buffer to capture the last frame before stopping
  const playbackMs = Math.ceil(durationMs / speed) + 800;
  await page.waitForTimeout(playbackMs);

  // Capture the video path before closing (Playwright finalizes on close)
  const video = page.video();
  await context.close();
  await browser.close();

  const webmPath = await video?.path();
  if (!webmPath || !existsSync(webmPath)) {
    throw new Error(
      `Terminal video render failed: no webm file produced. ` +
      `Ensure Playwright Chromium is installed: npx playwright install chromium`
    );
  }

  // Convert webm → mp4 for maximum compatibility (Linear, Jira, Slack, etc.)
  execSync(
    `ffmpeg -i "${webmPath}" -c:v libx264 -preset fast -crf 23 -movflags +faststart "${mp4Path}" -y`,
    { stdio: "ignore" },
  );

  try { require("fs").unlinkSync(webmPath); } catch { /* non-fatal */ }

  return mp4Path;
}
