# @varops/proof

Capture evidence that your code works. Browser videos and animated terminal replays from test execution, organized into timestamped runs with manifests and reports.

You tell it what to record. It records it. No opinions on workflow.

## Install

```bash
npm install @varops/proof
# or
bun add @varops/proof
```

## Quick Start

### TypeScript SDK

```typescript
import { Proof } from "@varops/proof";

const proof = new Proof({
  appName: "my-app",
  proofDir: "./evidence",
  run: "deploy-v2",
});

// Terminal -- capture any command
await proof.capture({
  command: "pytest tests/test_api.py -v",
  mode: "terminal",
  label: "api-tests",
  description: "API returns correct order details",
});

// Browser -- capture a Playwright test
await proof.capture({
  testFile: "tests/checkout.spec.ts",
  mode: "browser",
  label: "checkout-flow",
  description: "User completes checkout and sees confirmation",
});

await proof.report();
```

### CLI

```bash
# Terminal capture
proof capture --app my-app --command "pytest tests/" --mode terminal --label api-tests

# Browser capture
proof capture --app my-app --test-file tests/checkout.spec.ts --mode browser

# Generate report
proof report --app my-app --run deploy-v2
```

### JSON mode (for non-JS SDKs / agents)

```bash
echo '{
  "action": "capture",
  "appName": "my-app",
  "proofDir": "./evidence",
  "run": "deploy-v2",
  "captures": [
    { "command": "pytest tests/", "mode": "terminal", "label": "api-tests" },
    { "command": "go test ./...", "mode": "terminal", "label": "go-tests" }
  ]
}' | proof --json
```

Output is JSON to stdout:

```json
{
  "action": "capture",
  "appName": "my-app",
  "run": "deploy-v2",
  "recordings": [
    { "path": "/abs/path/api-tests-143012.html", "mode": "terminal", "duration": 1200, "label": "api-tests" },
    { "path": "/abs/path/go-tests-143015.html", "mode": "terminal", "duration": 3400, "label": "go-tests" }
  ]
}
```

## Modes

### `terminal`

Runs any command, captures stdout/stderr with real timestamps. Produces:

- **`.cast`** -- asciicast v2 format, compatible with any asciinema player
- **`.html`** -- self-contained player (zero external dependencies, works offline)

The HTML player includes play/pause, a speed dropdown (0.1x to 4x), a seekable progress bar, and ANSI color rendering. Initial playback speed is auto-calculated based on recording duration so fast output is still readable.

### `browser`

Runs `npx playwright test` with video recording. Collects the `.webm` and copies it to the run directory. Requires `video: 'on'` in your `playwright.config.ts`.

**Cursor highlights** -- the SDK exports a script that adds a visible cursor dot and click ripple to recordings:

```typescript
import { getCursorHighlightScript } from "@varops/proof";

test("checkout", async ({ page }) => {
  await page.addInitScript(getCursorHighlightScript());
  await page.goto("http://localhost:3000");
});
```

### Auto-detection

When `mode` is `"auto"` (the default), the SDK picks the right mode:

| Signal | Mode |
|--------|------|
| `playwright.config.*` in project | `browser` |
| `@playwright/test` or `playwright` in package.json | `browser` |
| Everything else | `terminal` |

## API

### `new Proof(config)`

```typescript
const proof = new Proof({
  appName: "my-app",         // Required. Used in directory path and manifest.
  proofDir: "./evidence",    // Base directory. Default: os.tmpdir()/proof
  run: "deploy-v2",          // Run name. Default: HHMM of init time.
  browser: {
    viewport: { width: 1280, height: 720 },
  },
  terminal: {
    cols: 120,               // Default: 120
    rows: 30,                // Default: 30
  },
});
```

### `proof.capture(options)`

```typescript
const recording = await proof.capture({
  command: "pytest tests/",          // Shell command to run (required for terminal mode)
  testFile: "tests/orders.spec.ts",  // Playwright test file (required for browser mode)
  testName: "should complete order", // Optional: specific test (passed as -g to Playwright)
  label: "order-flow",               // Optional: filename prefix (default: mode name)
  mode: "terminal",                  // Optional: "browser" | "terminal" | "auto"
  description: "Order completion",   // Optional: human-readable, stored in manifest
});

// recording.path     -> absolute path to the artifact
// recording.mode     -> "browser" | "terminal"
// recording.duration -> duration in ms
// recording.label    -> the label used
```

**Terminal mode** requires `command`. **Browser mode** requires `testFile`.

### `proof.report()`

Generates a markdown report from the run's `proof.json`. Returns the path to `report.md`.

## Output Structure

```
evidence/
  my-app/
    20260311/                       # date
      deploy-v2/                    # run
        checkout-flow-143012.webm   # browser recording
        api-tests-143015.cast       # terminal recording (asciicast)
        api-tests-143015.html       # terminal player (self-contained)
        proof.json                  # manifest
        report.md                   # generated report
```

## Manifest

Each run has a `proof.json`:

```json
{
  "version": 1,
  "appName": "my-app",
  "run": "deploy-v2",
  "createdAt": "2026-03-11T14:30:12.000Z",
  "entries": [
    {
      "timestamp": "2026-03-11T14:30:15.000Z",
      "mode": "terminal",
      "label": "api-tests",
      "command": "pytest tests/test_api.py -v",
      "duration": 1200,
      "artifact": "api-tests-143012.html",
      "description": "API returns correct order details"
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

- **Terminal mode**: No external dependencies
- **Browser mode**: `@playwright/test` installed, `video: 'on'` in Playwright config
- **Video duration**: `ffprobe` (from ffmpeg) on PATH

## License

MIT
