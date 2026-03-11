import { spawn } from "child_process";
import { writeFile } from "fs/promises";
import { join } from "path";
import type { CaptureOptions, Recording } from "../types";

interface CastEvent {
  time: number;
  data: string;
}

export async function captureTerminal(
  options: CaptureOptions,
  runDir: string,
  filePrefix: string,
  command: string,
  config: { cols?: number; rows?: number },
): Promise<Recording> {
  const label = options.label ?? "terminal";
  const castPath = join(runDir, `${filePrefix}.cast`);
  const htmlPath = join(runDir, `${filePrefix}.html`);
  const cols = config.cols ?? 120;
  const rows = config.rows ?? 30;

  const events: CastEvent[] = [];
  const startTime = Date.now();

  let exitCode: number | null = null;

  await new Promise<void>((resolve) => {
    const proc = spawn("/bin/sh", ["-c", command], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        COLUMNS: String(cols),
        LINES: String(rows),
        FORCE_COLOR: "1",
        TERM: "xterm-256color",
        NO_COLOR: undefined,
      },
    });

    proc.stdout.on("data", (chunk: Buffer) => {
      events.push({
        time: (Date.now() - startTime) / 1000,
        data: chunk.toString(),
      });
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      events.push({
        time: (Date.now() - startTime) / 1000,
        data: chunk.toString(),
      });
    });

    proc.on("close", (code) => { exitCode = code; resolve(); });
    proc.on("error", (err) => {
      events.push({
        time: (Date.now() - startTime) / 1000,
        data: `\x1b[31mError: ${err.message}\x1b[0m\n`,
      });
      resolve();
    });
  });

  const duration = Date.now() - startTime;
  const realDurationSec = duration / 1000;

  // Pick default speed so playback lasts at least ~2s
  const initialSpeed =
    realDurationSec < 0.2 ? 0.1 :
    realDurationSec < 0.5 ? 0.25 :
    realDurationSec < 1   ? 0.5 :
    realDurationSec < 2   ? 0.5 :
    1;

  // Write asciicast v2 file
  const header = JSON.stringify({
    version: 2,
    width: cols,
    height: rows,
    timestamp: Math.floor(startTime / 1000),
    env: { SHELL: "/bin/sh", TERM: "xterm-256color" },
  });

  const castLines = [header];
  for (const evt of events) {
    castLines.push(JSON.stringify([evt.time, "o", evt.data]));
  }
  await writeFile(castPath, castLines.join("\n") + "\n", "utf-8");

  // Write self-contained HTML player
  const castDataJson = JSON.stringify(events);
  const html = buildPlayerHtml(label, cols, rows, castDataJson, realDurationSec, initialSpeed);
  await writeFile(htmlPath, html, "utf-8");

  return {
    path: htmlPath,
    mode: "terminal",
    duration,
    label,
  };
}

function buildPlayerHtml(
  label: string,
  cols: number,
  rows: number,
  castDataJson: string,
  durationSec: number,
  initialSpeed: number,
): string {
  const speeds = [0.1, 0.25, 0.5, 1, 1.25, 1.5, 1.75, 2, 4];
  const speedOptions = speeds.map(s =>
    `<option value="${s}"${s === initialSpeed ? " selected" : ""}>${s}x</option>`
  ).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${label} — proof terminal recording</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #1a1a2e; display: flex; justify-content: center; padding: 24px; font-family: system-ui, sans-serif; }
  .player {
    background: #0d1117;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    max-width: ${Math.max(cols * 8.4 + 32, 500)}px;
    width: 100%;
  }
  .titlebar {
    background: #161b22;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid #30363d;
  }
  .dots { display: flex; gap: 6px; }
  .dot { width: 12px; height: 12px; border-radius: 50%; }
  .dot.r { background: #ff5f56; }
  .dot.y { background: #ffbd2e; }
  .dot.g { background: #27c93f; }
  .title { color: #8b949e; font-size: 13px; margin-left: 8px; }
  #terminal {
    padding: 16px;
    font-family: 'SF Mono', 'Menlo', 'Monaco', 'Cascadia Code', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.5;
    color: #e6edf3;
    white-space: pre-wrap;
    word-wrap: break-word;
    min-height: 80px;
    overflow-y: auto;
    max-height: ${rows * 22}px;
  }
  .controls {
    padding: 10px 16px;
    border-top: 1px solid #30363d;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .btn {
    background: none;
    border: 1px solid #30363d;
    color: #e6edf3;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-family: system-ui;
  }
  .btn:hover { background: #21262d; }
  .speed-select {
    background: #0d1117;
    border: 1px solid #30363d;
    color: #e6edf3;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 13px;
    font-family: system-ui;
    cursor: pointer;
  }
  .speed-select:hover { background: #21262d; }
  .progress {
    flex: 1;
    height: 4px;
    background: #21262d;
    border-radius: 2px;
    overflow: hidden;
    cursor: pointer;
  }
  .progress-bar {
    height: 100%;
    background: #58a6ff;
    width: 0%;
    transition: width 0.1s linear;
  }
  .time { color: #8b949e; font-size: 12px; font-family: monospace; min-width: 40px; text-align: right; }
</style>
</head>
<body>
<div class="player">
  <div class="titlebar">
    <div class="dots"><div class="dot r"></div><div class="dot y"></div><div class="dot g"></div></div>
    <span class="title">${label}</span>
  </div>
  <div id="terminal"></div>
  <div class="controls">
    <button class="btn" id="playBtn" onclick="toggle()">Play</button>
    <select class="speed-select" id="speedSelect" onchange="changeSpeed(this.value)">${speedOptions}</select>
    <div class="progress" onclick="seek(event)"><div class="progress-bar" id="bar"></div></div>
    <span class="time" id="time">0.0s / ${durationSec < 1 ? (durationSec * 1000).toFixed(0) + "ms" : durationSec.toFixed(1) + "s"}</span>
  </div>
</div>
<script>
const events = ${castDataJson};
const totalDuration = ${durationSec.toFixed(3)};
const realDuration = ${durationSec.toFixed(3)};
const term = document.getElementById('terminal');
const bar = document.getElementById('bar');
const timeEl = document.getElementById('time');
const playBtn = document.getElementById('playBtn');

let playing = false;
let currentIdx = 0;
let startTs = 0;
let pausedAt = 0;
let speed = ${initialSpeed};
let raf = null;

// Convert ANSI to styled HTML spans
function ansiToHtml(str) {
  const colors = ['#0d1117','#ff7b72','#3fb950','#d29922','#58a6ff','#bc8cff','#39d2e0','#e6edf3'];
  const brights = ['#484f58','#ffa198','#56d364','#e3b341','#79c0ff','#d2a8ff','#56d4dd','#f0f6fc'];
  let out = '';
  let i = 0;
  while (i < str.length) {
    if (str[i] === '\\x1b' || str.charCodeAt(i) === 0x1b) {
      const m = str.slice(i).match(/^(?:\\x1b|\\u001b|\\033|\\x1B)\\[([0-9;]*)m/);
      if (m) {
        const codes = m[1].split(';').map(Number);
        let style = '';
        for (const c of codes) {
          if (c === 0) style += 'color:#e6edf3;font-weight:normal;font-style:normal;text-decoration:none;';
          else if (c === 1) style += 'font-weight:bold;';
          else if (c === 2) style += 'opacity:0.6;';
          else if (c === 3) style += 'font-style:italic;';
          else if (c === 4) style += 'text-decoration:underline;';
          else if (c >= 30 && c <= 37) style += 'color:' + colors[c - 30] + ';';
          else if (c >= 90 && c <= 97) style += 'color:' + brights[c - 90] + ';';
        }
        if (style) out += '</span><span style="' + style + '">';
        i += m[0].length;
        continue;
      }
    }
    const ch = str[i];
    if (ch === '<') out += '&lt;';
    else if (ch === '>') out += '&gt;';
    else if (ch === '&') out += '&amp;';
    else out += ch;
    i++;
  }
  return out;
}

function renderUpTo(elapsed) {
  let html = '<span>';
  for (let j = 0; j < events.length; j++) {
    if (events[j].time > elapsed) { currentIdx = j; break; }
    html += ansiToHtml(events[j].data);
    if (j === events.length - 1) currentIdx = events.length;
  }
  html += '</span>';
  term.innerHTML = html;
  term.scrollTop = term.scrollHeight;
  const pct = totalDuration > 0 ? Math.min(100, (elapsed / totalDuration) * 100) : 100;
  bar.style.width = pct + '%';
  timeEl.textContent = elapsed.toFixed(1) + 's';
}

function tick() {
  if (!playing) return;
  const elapsed = ((Date.now() - startTs) / 1000) * speed;
  if (elapsed >= totalDuration) {
    renderUpTo(totalDuration);
    playing = false;
    playBtn.textContent = 'Replay';
    return;
  }
  renderUpTo(elapsed);
  raf = requestAnimationFrame(tick);
}

function toggle() {
  if (playing) {
    playing = false;
    pausedAt = ((Date.now() - startTs) / 1000) * speed;
    playBtn.textContent = 'Play';
    if (raf) cancelAnimationFrame(raf);
  } else {
    if (currentIdx >= events.length) {
      pausedAt = 0;
      term.innerHTML = '';
      currentIdx = 0;
    }
    playing = true;
    playBtn.textContent = 'Pause';
    startTs = Date.now() - (pausedAt / speed) * 1000;
    tick();
  }
}

function changeSpeed(val) {
  if (playing) pausedAt = ((Date.now() - startTs) / 1000) * speed;
  speed = parseFloat(val);
  if (playing) {
    startTs = Date.now() - (pausedAt / speed) * 1000;
  }
}

function seek(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  pausedAt = pct * totalDuration;
  renderUpTo(pausedAt);
  if (playing) {
    startTs = Date.now() - (pausedAt / speed) * 1000;
  }
}

// Auto-play on load
toggle();
</script>
</body>
</html>`;
}
