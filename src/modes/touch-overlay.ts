import { execSync, spawn } from "child_process";
import { rename, unlink } from "fs/promises";
import { existsSync } from "fs";
import type { TapEvent } from "./xcresult";

interface VideoInfo {
  width: number;
  height: number;
  duration: number;
}

export interface TapCoordinate {
  element: string;
  x: number;
  y: number;
  timestamp: string;
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

function guessScaleFactor(videoWidth: number): number {
  // iPhone Pro/Max: 1179px wide -> 393pt = 3x
  // iPhone Plus: 1284px wide -> 428pt = 3x
  // iPhone SE: 750px wide -> 375pt = 2x
  // iPad: varies, but typically 2x
  if (videoWidth >= 1170) return 3;
  if (videoWidth >= 750) return 2;
  return 2;
}

/**
 * Overlay red circle tap indicators onto the video using ffmpeg.
 * Uses exact coordinates from tap log when available, falls back to screen center.
 */
export async function overlayTouchIndicators(
  videoPath: string,
  taps: TapEvent[],
  recordingStartTime: Date,
  tapCoordinates?: TapCoordinate[],
  scaleFactor?: number,
): Promise<void> {
  if (taps.length === 0) return;

  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
  } catch {
    return;
  }

  const info = getVideoInfo(videoPath);
  const scale = scaleFactor ?? guessScaleFactor(info.width);

  // Build coordinate map from tap log (element name -> pixel position)
  const coordMap = new Map<string, { px: number; py: number }>();
  if (tapCoordinates) {
    for (const tc of tapCoordinates) {
      coordMap.set(tc.element, {
        px: Math.round(tc.x * scale),
        py: Math.round(tc.y * scale),
      });
    }
  }

  const fallbackX = Math.round(info.width / 2);
  const fallbackY = Math.round(info.height / 2);

  const relativeTaps = taps.map((tap) => {
    const coord = coordMap.get(tap.element);
    return {
      element: tap.element,
      t: (tap.timestamp.getTime() - recordingStartTime.getTime()) / 1000,
      px: coord?.px ?? fallbackX,
      py: coord?.py ?? fallbackY,
    };
  }).filter((t) => t.t >= 0 && t.t <= info.duration);

  if (relativeTaps.length === 0) return;

  // Build per-tap ffmpeg filter: each tap gets its own dot + ripple overlay
  // at its specific coordinate
  const dotR = 28;
  const ripR = dotR * 3;
  const borderW = 4;

  const filterParts: string[] = [`[0:v]null[v0]`];
  let inputIdx = 0;

  for (const tap of relativeTaps) {
    const tStart = tap.t.toFixed(3);
    const dotEnd = (tap.t + 0.4).toFixed(3);
    const ripEnd = (tap.t + 0.5).toFixed(3);

    const dotSrc = `color=c=red@0.8:s=${dotR * 2}x${dotR * 2}:d=${info.duration},format=argb,geq=a='if(lt(sqrt((X-${dotR})*(X-${dotR})+(Y-${dotR})*(Y-${dotR})),${dotR}),200,0)':r='255':g='50':b='50'`;
    const ripSrc = `color=c=red@0.6:s=${ripR * 2}x${ripR * 2}:d=${info.duration},format=argb,geq=a='if(between(sqrt((X-${ripR})*(X-${ripR})+(Y-${ripR})*(Y-${ripR})),${ripR - borderW},${ripR}),180,0)':r='255':g='50':b='50'`;

    const dotLabel = `dot${inputIdx}`;
    const ripLabel = `rip${inputIdx}`;
    const prevLabel = `v${inputIdx}`;
    const midLabel = `v${inputIdx}d`;
    const nextLabel = `v${inputIdx + 1}`;

    filterParts.push(`${dotSrc}[${dotLabel}]`);
    filterParts.push(`${ripSrc}[${ripLabel}]`);
    filterParts.push(
      `[${prevLabel}][${dotLabel}]overlay=x=${tap.px - dotR}:y=${tap.py - dotR}:enable='between(t,${tStart},${dotEnd})'[${midLabel}]`,
    );
    filterParts.push(
      `[${midLabel}][${ripLabel}]overlay=x=${tap.px - ripR}:y=${tap.py - ripR}:enable='between(t,${tStart},${ripEnd})'[${nextLabel}]`,
    );

    inputIdx++;
  }

  const finalLabel = `v${inputIdx}`;
  const filter = filterParts.join(";");

  const tmpPath = videoPath.replace(".mp4", ".tmp.mp4");

  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", [
      "-y",
      "-i", videoPath,
      "-filter_complex", filter,
      "-map", `[${finalLabel}]`,
      "-map", "0:a?",
      "-codec:a", "copy",
      "-codec:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      tmpPath,
    ], { stdio: "pipe" });

    proc.on("close", async (code) => {
      if (code === 0 && existsSync(tmpPath)) {
        try {
          await unlink(videoPath);
          await rename(tmpPath, videoPath);
        } catch {}
      } else {
        try { await unlink(tmpPath); } catch {}
      }
      resolve();
    });

    proc.on("error", () => resolve());
  });
}
