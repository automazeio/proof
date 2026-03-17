# Mental Model: @automaze/proof

## Overview

A capture SDK and CLI that records visual evidence of test execution. Three modes: **browser** (Playwright video with device emulation and cursor highlights), **terminal** (asciicast recording with self-contained HTML player), and **simulator** (iOS Simulator screen recording with tap indicator overlays). No opinions on workflow -- just captures proof that something happened. Ships as a standalone binary with TypeScript, Python, and Go SDKs. Consumers are expected to be tools, agents, CI scripts, or non-JS SDKs that call the CLI.

## Architecture

```
Proof (class)
  |
  |-- capture(options) -----> resolveMode()
  |                              |
  |                     browser:   captureVisual()     --> runs npx playwright test, collects .webm
  |                     terminal:  captureTerminal()   --> spawns command, records stdout/stderr with timestamps
  |                     simulator: captureSimulator()  --> records iOS Simulator screen, runs command, post-processes with ffmpeg
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
    simulator.ts    -- Simulator orchestrator: start recording, run command, stop, post-process
    simulator-ios.ts -- xcrun simctl wrappers: device resolution, boot, recording lifecycle
    simulator-android.ts -- adb/emulator wrappers: device resolution, AVD boot, recording lifecycle
    xcresult.ts     -- Parses .xcresult bundles for tap activity timestamps
    touch-overlay.ts -- ffmpeg post-processing: red dot + ripple ring overlay at tap positions

test-app/           -- Integration test app
  capture-proof.ts  -- E2E script: creates Proof instance, captures terminal + browser
  cli/
    app.ts          -- Simple CLI app (status, order commands)
    app.test.ts     -- Bun tests for the CLI app
  web/
    index.html      -- Simple order form page
    orders.spec.ts  -- Playwright test with cursor highlight injection
    playwright.config.ts -- Configures video:on, slowMo:500
  ios/
    ProofTestApp/   -- SwiftUI test app (tap button, counter, reset)
      ProofTestAppUITests/
        ProofTapLogger.swift       -- XCUITest extension: element.proofTap() logs coordinates to JSON
        ProofTestAppUITests.swift  -- UI tests using proofTap() for coordinate logging
```

### Evidence output structure

```
proofDir/appName/yyyymmdd/run/
  label-HHmmss.html       -- Terminal player (self-contained)
  label-HHmmss.cast       -- Asciicast v2 file
  label-HHmmss.webm       -- Browser video
  label-HHmmss.mp4        -- Simulator video (with tap overlays if available)
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

### Simulator capture (iOS)
1. `assertIosReady()` checks xcrun + simctl are available
2. `resolveIosDevice()` finds a booted simulator or boots one by name/OS
3. `startIosRecording()` spawns `xcrun simctl io <udid> recordVideo` in background
4. Runs the user's command (typically `xcodebuild test`) via `/bin/sh -c`
5. Sleeps 500ms for final frames, then sends SIGINT to stop recording gracefully
6. **Post-processing (xcodebuild tests only):**
   a. Find latest `.xcresult` bundle, parse tap activity timestamps via `xcrun xcresulttool`
   b. Find `proof-taps.json` in simulator's app container (written by `ProofTapLogger.swift`)
   c. Scale UIKit points to video pixels (3x for iPhone Pro retina)
   d. Run ffmpeg with `geq` filter to overlay red dot + ripple ring at each tap's coordinates/time
   e. Replace original recording with overlaid version
7. Get duration via ffprobe, return Recording

#### ProofTapLogger.swift (tap coordinate logging)
- Drop-in XCUITest extension: replace `element.tap()` with `element.proofTap()`
- Logs `{element, x, y, width, height, timestamp}` to `proof-taps.json` in the app's Documents directory
- `ProofTapLogger.shared.reset()` in `setUp()` clears the log between test runs
- Coordinates are UIKit points (element center), scaled to video pixels during overlay

### Simulator capture (Android)
1. `assertAndroidReady()` checks adb is available (looks in `~/Library/Android/sdk/platform-tools/`)
2. `resolveAndroidDevice()` finds a running emulator or boots an AVD by name
3. `startAndroidRecording()` issues `adb emu screenrecord start <host-path>` -- saves directly to host
4. Runs the user's command via `/bin/sh -c`
5. Sleeps 500ms, then issues `adb emu screenrecord stop`
6. Converts `.webm` to `.mp4` via ffmpeg
7. **Post-processing (optional):** reads `$PROOF_TAP_LOG` (default `/tmp/proof-android-taps.json`)
   - Format: `[{element, x, y, offsetMs}]` where x/y are video pixel coordinates
   - Applies ffmpeg overlay with `scaleFactor=1` (video is already at native device resolution)
8. Get duration via ffprobe, return Recording

#### Why `adb emu screenrecord` not `adb shell screenrecord`
`adb shell screenrecord` uses the Android hardware AVC encoder. On Apple Silicon emulators with the `gfxstream` graphics backend, this produces 0 frames -- the encoder can't capture from a virtual display. `adb emu screenrecord` captures directly from the emulator's virtual framebuffer via the QEMU monitor protocol, bypassing the hardware encoder entirely.

### Mode detection (auto)
1. Check for `playwright.config.{ts,js,mjs}` in cwd -> browser
2. Check package.json for `@playwright/test` or `playwright` dep -> browser
3. Fallback -> terminal

### CLI (cli.ts)
- **Arg mode:** `proof capture --app <name> --command <cmd> [options]` (browser/terminal)
- **Simulator mode (iOS):** `proof capture --app <name> --command <cmd> --mode simulator --platform ios [--device-name "iPhone 17 Pro"] [--os 18.4] [--codec h264]`
- **Simulator mode (Android):** `proof capture --app <name> --command <cmd> --mode simulator --platform android [--device-name "Pixel_3a"]`
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
- **xcodebuild clones simulators** -- `xcodebuild test` clones the simulator by default for parallel testing. The recording captures the idle original, not the clone. Fix: pass `-parallel-testing-enabled NO -disable-concurrent-destination-testing`. Proof warns if these flags are missing.
- **Cloned simulators are invisible** -- xcodebuild clones don't appear in `simctl list devices`. No way to detect or record them programmatically.
- **XCUITest taps bypass UIKit** -- synthetic touches are injected at the IOKit/HID level, completely bypassing the UIKit event pipeline. No swizzle, gesture recognizer, or overlay can intercept them. That's why tap indicators use post-processing, not runtime injection.
- **simctl recordVideo captures raw framebuffer** -- iOS Simulator's built-in touch indicators (Settings > Accessibility > Touch) don't appear in recordVideo output.
- **Tap log location** -- `proof-taps.json` is written to the test runner app's Documents directory on the simulator filesystem. After the test, proof searches `~/Library/Developer/CoreSimulator/Devices/<udid>/data/Containers/Data/Application/` for the file.
- **Point-to-pixel scaling** -- UIKit coordinates are in points; video is in pixels. For iPhone Pro (3x retina), multiply by 3. `guessScaleFactor()` in touch-overlay.ts infers the scale from video resolution.
- **Android `adb shell screenrecord` produces 0 frames** -- on Apple Silicon with the gfxstream backend, the hardware AVC encoder cannot capture from a virtual display. Use `adb emu screenrecord` instead, which captures via the QEMU monitor.
- **Android tap log is caller-provided** -- unlike iOS (where proof reads the xcresult + app container automatically), Android requires the test script to write `/tmp/proof-android-taps.json`. Set `$PROOF_TAP_LOG` to override the path.
- **`adb emu screenrecord` outputs `.webm`** -- must be converted to `.mp4` via ffmpeg for consistency. The webm is deleted after conversion.

## Lessons Learned

- **Don't stretch timestamps** -- early iterations artificially scaled terminal event times for readability. This broke fidelity. Solution: keep real timestamps, auto-calculate a slow playback speed instead.
- **`script` command is unreliable** -- first terminal implementation used `script` (macOS/Linux). Produced `^D` artifacts, platform-specific args, and raw ANSI blobs. Pipe-based capture with `spawn` is simpler and more portable.
- **ffprobe for duration** -- `duration.ts` shells out to `ffprobe -v error -show_entries format=duration`. Works for both .webm and .mp4.
- **Self-contained HTML is the right call** -- no CDN, no external player library. The HTML file works forever, offline, in any browser. Worth the ~7KB per file.
- **Post-processing beats runtime overlay** -- tried multiple runtime approaches for tap indicators (swizzling, gesture recognizers, overlay windows). None work because XCUITest taps don't flow through UIKit. ffmpeg post-processing is reliable and keeps the test app unmodified.
- **SIGINT for simctl recordVideo** -- the only clean way to stop `xcrun simctl io recordVideo`. SIGTERM or SIGKILL produces a corrupt/empty file. The 500ms sleep before SIGINT ensures the last frames are captured.
- **xcresult has timestamps but no coordinates** -- `xcrun xcresulttool` gives activity summaries ("Tap button") with timestamps but no pixel coordinates. That's why ProofTapLogger.swift exists: the test itself must log where taps happened.
