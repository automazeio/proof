import { execSync, spawn } from "child_process";
import { rename, unlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import type { TapEvent } from "./xcresult";

interface VideoInfo {
  width: number;
  height: number;
  duration: number;
}

function getVideoInfo(videoPath: string): VideoInfo {
  const result = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -show_entries format=duration -of json "${videoPath}"`,
    { encoding: "utf-8" },
  );
  const data = JSON.parse(result);
  return {
    width: data.streams?.[0]?.width ?? 1170,
    height: data.streams?.[0]?.height ?? 2532,
    duration: parseFloat(data.format?.duration ?? "0"),
  };
}

/**
 * Overlay red circle tap indicators onto the video using ffmpeg.
 * Each tap shows a red dot at screen center that fades in/out, plus an expanding ripple ring.
 */
export async function overlayTouchIndicators(
  videoPath: string,
  taps: TapEvent[],
  recordingStartTime: Date,
): Promise<void> {
  if (taps.length === 0) return;

  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
  } catch {
    return;
  }

  const info = getVideoInfo(videoPath);

  const relativeTaps = taps.map((tap) => ({
    element: tap.element,
    t: (tap.timestamp.getTime() - recordingStartTime.getTime()) / 1000,
  })).filter((t) => t.t >= 0 && t.t <= info.duration);

  if (relativeTaps.length === 0) return;

  // Generate the enable expression: show overlay when any tap is active
  // Each tap shows for 0.4 seconds
  const dotEnable = relativeTaps
    .map((tap) => `between(t,${tap.t.toFixed(3)},${(tap.t + 0.4).toFixed(3)})`)
    .join("+");

  const rippleEnable = relativeTaps
    .map((tap) => `between(t,${tap.t.toFixed(3)},${(tap.t + 0.5).toFixed(3)})`)
    .join("+");

  // Position: center of screen
  const cx = Math.round(info.width / 2);
  const cy = Math.round(info.height / 2);

  // Use drawtext with a large Unicode filled circle (U+2B24) as an approximation
  // For the dot: solid red circle
  // For the ripple: hollow circle outline
  const dotSize = 28;
  const rippleSize = 18;

  // Build a complex filtergraph using color sources and overlay
  // Dot: small red filled circle overlay
  const dotR = dotSize;
  const dotFilter = `color=c=red@0.8:s=${dotR * 2}x${dotR * 2}:d=${info.duration},format=argb,geq=a='if(lt(sqrt((X-${dotR})*(X-${dotR})+(Y-${dotR})*(Y-${dotR})),${dotR}),200,0)':r='255':g='50':b='50'`;

  // Ripple: expanding red ring overlay (static for simplicity)
  const ripR = dotR * 3;
  const borderW = 4;
  const rippleFilter = `color=c=red@0.6:s=${ripR * 2}x${ripR * 2}:d=${info.duration},format=argb,geq=a='if(between(sqrt((X-${ripR})*(X-${ripR})+(Y-${ripR})*(Y-${ripR})),${ripR - borderW},${ripR}),180,0)':r='255':g='50':b='50'`;

  const filter = [
    `[0:v]null[main]`,
    `${dotFilter}[dot]`,
    `${rippleFilter}[ripple]`,
    `[main][dot]overlay=x=${cx - dotR}:y=${cy - dotR}:enable='${dotEnable}'[withdot]`,
    `[withdot][ripple]overlay=x=${cx - ripR}:y=${cy - ripR}:enable='${rippleEnable}'[out]`,
  ].join(";");

  const tmpPath = videoPath.replace(".mp4", ".tmp.mp4");

  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-y",
      "-i", videoPath,
      "-filter_complex", filter,
      "-map", "[out]",
      "-map", "0:a?",
      "-codec:a", "copy",
      "-codec:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      tmpPath,
    ], { stdio: "pipe" });

    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => stderr += d.toString());

    proc.on("close", async (code) => {
      if (code === 0 && existsSync(tmpPath)) {
        try {
          await unlink(videoPath);
          await rename(tmpPath, videoPath);
          resolve();
        } catch (err) {
          reject(err);
        }
      } else {
        try { await unlink(tmpPath); } catch {}
        resolve(); // Don't fail the capture
      }
    });

    proc.on("error", () => resolve());
  });
}
