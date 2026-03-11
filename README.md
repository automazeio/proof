# @varops/proof

Visual proof of work for automated code changes.

A TypeScript SDK that captures evidence of test execution -- browser video recordings and animated terminal replays. You tell it what to record, it records it. No opinions on workflow.

## Install

```bash
bun add @varops/proof
```

## Quick Start

```typescript
import { Proof } from "@varops/proof";

const proof = new Proof({
  appName: "my-app",
  proofDir: "./evidence",
  run: "deploy-v2",
});

// Record a Playwright browser test
await proof.capture({
  testFile: "tests/checkout.spec.ts",
  mode: "browser",
  label: "checkout-flow",
  description: "User completes checkout and sees confirmation",
});

// Record a terminal test
await proof.capture({
  testFile: "tests/api.test.ts",
  mode: "terminal",
  label: "api-tests",
  description: "API returns correct order details",
});

// Generate a markdown report
await proof.report();
```

## Recording Modes

### Browser

Runs `npx playwright test` with video recording enabled. Collects the `.webm` video and copies it to the run directory. Requires `video: 'on'` in your `playwright.config.ts`.

The SDK exports a cursor highlight script that adds a visible red dot cursor and click ripple effect to recordings:

```typescript
import { getCursorHighlightScript } from "@varops/proof";

// In your Playwright test:
test("checkout", async ({ page }) => {
  await page.addInitScript(getCursorHighlightScript());
  await page.goto("http://localhost:3000");
  // ... your test
});
```

### Terminal

Spawns the test command, captures stdout/stderr with real timestamps, and produces:

- A `.cast` file (asciicast v2 format, compatible with asciinema players)
- A self-contained `.html` file with an embedded player

The HTML player features:
- Play/pause/replay controls
- Speed dropdown (0.1x to 4x)
- Seekable progress bar
- ANSI color rendering
- Auto-calculated initial speed for readable playback

### Auto-Detection

When `mode` is omitted or set to `"auto"`, the SDK detects the right mode:

| Signal | Mode |
|--------|------|
| `playwright.config.*` exists | `browser` |
| `@playwright/test` or `playwright` in deps | `browser` |
| Everything else | `terminal` |

## API

### `new Proof(config)`

```typescript
interface ProofConfig {
  appName: string;           // Used in directory path and manifest
  proofDir?: string;         // Base directory (default: os.tmpdir()/proof)
  run?: string;              // Run name (default: HHMM of init time)
  browser?: {
    viewport?: { width: number; height: number };
  };
  terminal?: {
    cols?: number;           // Default: 120
    rows?: number;           // Default: 30
  };
  maxVideoLength?: number;   // Kill browser recording after N seconds (default: 30)
  retention?: {
    maxAge?: number;         // Max age in ms for cleanup
    maxRuns?: number;        // Max runs to keep
  };
}
```

### `proof.capture(options): Promise<Recording>`

```typescript
interface CaptureOptions {
  testFile: string;          // Path to the test file
  testName?: string;         // Specific test name (passed as -g to Playwright)
  label?: string;            // Filename prefix (default: mode name)
  mode?: RecordingMode;      // "browser" | "terminal" | "auto"
  description?: string;      // Human-readable description for the manifest
}

interface Recording {
  path: string;              // Absolute path to the artifact
  mode: "browser" | "terminal";
  duration: number;          // Duration in ms
  label?: string;
}
```

### `proof.report(): Promise<string>`

Generates a markdown report from the run's `proof.json` manifest. Returns the path to `report.md`.

### `proof.listRuns(): Promise<RunInfo[]>`

Lists all runs for the configured `appName`, sorted by most recent.

### `proof.cleanup(options?): Promise<void>`

Removes old runs based on `maxAge` and/or `maxRuns`.

## Evidence Directory Structure

```
proofDir/
  appName/
    20260311/                  # date (yyyymmdd)
      deploy-v2/               # run name
        checkout-flow-143012.webm
        api-tests-143012.cast
        api-tests-143012.html
        proof.json             # manifest with all entries
        report.md              # generated report
```

## Manifest Format

Each run produces a `proof.json`:

```json
{
  "version": 1,
  "appName": "my-app",
  "run": "deploy-v2",
  "createdAt": "2026-03-11T14:30:12.000Z",
  "entries": [
    {
      "timestamp": "2026-03-11T14:30:15.000Z",
      "mode": "browser",
      "label": "checkout-flow",
      "testFile": "tests/checkout.spec.ts",
      "duration": 2520,
      "artifact": "checkout-flow-143012.webm",
      "description": "User completes checkout and sees confirmation"
    }
  ]
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PROOF_DIR` | Override default proof directory |
| `PROOF_MODE` | Override auto-detection (`browser` or `terminal`) |

## Requirements

- **Browser mode:** `@playwright/test` installed, `video: 'on'` in Playwright config
- **Terminal mode:** No external dependencies
- **Video duration detection:** `ffprobe` (from ffmpeg) on PATH
