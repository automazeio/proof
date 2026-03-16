# Mental Model: @automaze/proof

## Overview

A capture SDK and CLI that records visual evidence of test execution. Two modes: **browser** (Playwright video with device emulation and cursor highlights) and **terminal** (asciicast recording with self-contained HTML player). No opinions on workflow -- just captures proof that something happened. Ships as a standalone binary with TypeScript, Python, and Go SDKs. Consumers are expected to be tools, agents, CI scripts, or non-JS SDKs that call the CLI.

## Architecture

```
Proof (class)
  |
  |-- capture(options) -----> resolveMode()
  |                              |
  |                     browser: captureVisual()   --> runs npx playwright test, collects .webm
  |                     terminal: captureTerminal() --> spawns command, records stdout/stderr with timestamps
  |                              |
  |                     appendToManifest() --> writes/updates proof.json
  |
  |-- report()         --> reads proof.json, generates report.md
```

No HTTP, no events, no database. Pure filesystem I/O. Each `Proof` instance owns a single run directory.

## Directory Structure

```
src/
  index.ts          -- Proof class: constructor, capture, report
  cli.ts            -- CLI entry point: arg parsing, JSON stdin, structured JSON output
  types.ts          -- All interfaces: ProofConfig, CaptureOptions, Recording, ProofEntry, etc.
  detect.ts         -- Auto-detection: looks for playwright config/deps, falls back to terminal
  duration.ts       -- ffprobe wrapper to get video duration
  modes/
    visual.ts       -- Browser capture: runs Playwright, collects video, cursor highlight script
    terminal.ts     -- Terminal capture: pipe-based, writes .cast + self-contained .html player

test-app/           -- Integration test app
  capture-proof.ts  -- E2E script: creates Proof instance, captures terminal + browser
  cli/
    app.ts          -- Simple CLI app (status, order commands)
    app.test.ts     -- Bun tests for the CLI app
  web/
    index.html      -- Simple order form page
    orders.spec.ts  -- Playwright test with cursor highlight injection
    playwright.config.ts -- Configures video:on, slowMo:500
```

### Evidence output structure

```
proofDir/appName/yyyymmdd/run/
  label-HHmmss.html       -- Terminal player (self-contained)
  label-HHmmss.cast       -- Asciicast v2 file
  label-HHmmss.webm       -- Browser video
  proof.json               -- Manifest with entries array
  report.md                -- Generated markdown report
```

## Data Flow

### Terminal capture
1. `spawn("/bin/sh", ["-c", command])` with `stdio: pipe`, `FORCE_COLOR=1`
2. Collect stdout/stderr chunks with `Date.now()` offsets (real timestamps)
3. Write `.cast` file (asciicast v2: JSON header + `[time, "o", data]` lines)
4. Build self-contained HTML with embedded JS player, write `.html`
5. Auto-calculate initial playback speed based on duration thresholds:
   - <0.2s: 0.1x, <0.5s: 0.25x, <1s: 0.5x, <2s: 0.5x, >=2s: 1x
6. Append entry to proof.json

### Browser capture
1. Run `npx playwright test` with `--output` flag pointing to `runDir/pw-results`
2. If `device` is set, pass `--use '{"deviceName":"iPhone 14"}'` to Playwright for device emulation (viewport + UA + touch)
3. If `viewport` is set, pass `--use '{"viewport":{"width":390,"height":844}}'` for custom size
4. If `device`/`viewport` is an array, fan out into sequential captures (one per entry), return `Recording[]`
5. Find `.webm` or `.mp4` in results directory (recursive search)
6. Copy video to run directory as `label-HHmmss.webm`
7. Clean up `pw-results` temp directory
8. Get duration via ffprobe
9. Append entry to proof.json (with `device`/`viewport` fields if set)

### Mode detection (auto)
1. Check for `playwright.config.{ts,js,mjs}` in cwd -> browser
2. Check package.json for `@playwright/test` or `playwright` dep -> browser
3. Fallback -> terminal

### CLI (cli.ts)
- **Arg mode:** `proof capture --app <name> --command <cmd> [options]`
- **JSON mode:** `echo '{"action":"capture",...}' | proof --json` -- supports multiple captures in one invocation
- All output is JSON to stdout (machine-readable for other SDKs)
- CLI uses the same `Proof` class internally

## Key Patterns & Conventions

- **Bun runtime** -- uses `bun test`, `bun run`, `bun build`
- **No external deps for terminal** -- ANSI rendering is done in the HTML player's JS, not at capture time
- **Self-contained artifacts** -- the HTML player has zero external dependencies, works offline
- **Timestamps are real** -- no stretching or manipulation of recorded timestamps. Playback speed handles readability.
- **Single manifest per run** -- `proof.json` is append-only within a run, each `capture()` call adds an entry
- **Error handling** -- capture modes surface descriptive errors (missing Playwright, no video found with stderr context)
- **Build** -- `tsc` for declarations + `bun build` for bundled JS

### Naming
- Files: kebab-case
- Types: PascalCase
- Functions: camelCase
- Mode function naming: `captureVisual` (not `captureBrowser`) -- internal name doesn't match the mode string

## Dependencies & Infrastructure

| Dependency | Why |
|---|---|
| `playwright` | Runtime dep for browser capture (spawns npx playwright test) |
| `@playwright/test` | Dev dep for the test-app's Playwright tests |
| `typescript` | Build + typecheck |
| `@types/bun` | Bun type definitions |

No other runtime dependencies. Terminal capture uses only Node/Bun built-ins. ANSI color rendering and the player UI are pure inline JS/CSS in the generated HTML.

## Gotchas & Quirks

- **`captureVisual` vs `"browser"` mode** -- the function is still named `captureVisual` internally but the mode string is `"browser"`. Same for the file `modes/visual.ts`.
- **Playwright video location** -- Playwright writes test-results relative to its config's project root, not cwd. The `--output` flag is critical to control where videos land.
- **CDP bypasses DOM events** -- `page.mouse.move()` and `page.click()` in headless Playwright don't trigger `addEventListener('mousemove')`. The cursor highlight in `orders.spec.ts` uses `page.evaluate()` to directly position the cursor element.
- **`addInitScript` timing** -- must be called before `page.goto()`. The script itself wraps in `DOMContentLoaded` because the DOM isn't ready when init scripts execute.
- **Terminal command is caller-provided** -- `capture()` requires `command` for terminal mode. The SDK doesn't know or care what test runner you use.
- **Browser mode requires `testFile`** -- the SDK controls the Playwright invocation (video output dir, reporter, config path).
- **`device` and `viewport` are mutually exclusive** -- can't set both on the same capture call.
- **Array device/viewport fans out** -- `capture()` returns `Recording[]` when given an array. Labels are auto-suffixed (e.g. `checkout-iphone-14`, `checkout-390x844`).
- **`bun.lock` changes** -- bun regenerates the lockfile format on dependency changes; the diff can be noisy.

## Lessons Learned

- **Don't stretch timestamps** -- early iterations artificially scaled terminal event times for readability. This broke fidelity. Solution: keep real timestamps, auto-calculate a slow playback speed instead.
- **`script` command is unreliable** -- first terminal implementation used `script` (macOS/Linux). Produced `^D` artifacts, platform-specific args, and raw ANSI blobs. Pipe-based capture with `spawn` is simpler and more portable.
- **ffprobe for duration** -- `duration.ts` shells out to `ffprobe -v error -show_entries format=duration`. Works for both .webm and .mp4.
- **Self-contained HTML is the right call** -- no CDN, no external player library. The HTML file works forever, offline, in any browser. Worth the ~7KB per file.
