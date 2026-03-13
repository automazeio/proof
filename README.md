# Proof

[![Automaze](https://img.shields.io/badge/By-automaze.io-4b3baf)](https://automaze.io)
&nbsp;
[![Agent Skill](https://img.shields.io/badge/+-Agent%20Skill-ee9e33)](https://github.com/automazeio/proof/tree/main/skills)
[![GitHub Issues](https://img.shields.io/badge/+-GitHub%20Issues-1f2328)](https://github.com/automazeio/proof)
&nbsp;
[![Apache License](https://img.shields.io/badge/License-Apache%202.0-28a745)](https://github.com/automazeio/proof/blob/main/LICENSE)
&nbsp;
[![Follow on 𝕏](https://img.shields.io/badge/𝕏-@aroussi-1c9bf0)](http://x.com/intent/follow?screen_name=aroussi)
&nbsp;
[![Star this repo](https://img.shields.io/github/stars/automazeio/proof.svg?style=social&label=Star%20this%20repo&maxAge=60)](https://github.com/automazeio/proof)

### A 10-second recording of your tests passing is worth more than a 200-line diff.

`proof` captures terminal output and browser interactions as shareable evidence -- animated HTML replays, videos, and structured reports. Run your tests through proof, get artifacts you can attach to PRs, send to stakeholders, or keep as a record.

![Proof](https://raw.githubusercontent.com/automazeio/proof/main/screenshot.webp)

## Get started

```bash
# macOS / Linux
curl -fsSL https://automaze.io/install/proof | sh

# Windows (PowerShell)
irm https://automaze.io/install/proof | iex

# Homebrew
brew install automazeio/tap/proof
```

Or install via npm (requires Node.js):

```bash
npm install -g @automaze/proof
```

## What it produces

**Terminal capture** -- runs any command, records output with real timing into a self-contained HTML player. No dependencies, works offline, plays anywhere.

**Browser capture** -- runs Playwright tests with video recording, collects `.webm` files with optional cursor highlighting.

**Report** -- a `proof.json` manifest per run, plus a generated markdown summary linking to all artifacts.

## Quick start

```typescript
import { Proof } from "@automaze/proof";

const proof = new Proof({ appName: "my-app", proofDir: "./evidence" });

await proof.capture({
  command: "npm test",
  mode: "terminal",
  label: "unit-tests",
});

await proof.report();
// -> evidence/my-app/20260312/1430/report.md
```

That's it. `evidence/` now contains an animated HTML replay of your test run and a manifest describing what was captured.

## Terminal mode

Runs any shell command. Captures stdout/stderr with real timestamps. Produces:

- **`.cast`** -- asciicast v2, compatible with asciinema players
- **`.html`** -- self-contained player with play/pause, speed control (0.1x--4x), seek bar, and ANSI color rendering

Playback speed auto-adjusts based on recording duration so fast output is still readable at first play.

```typescript
await proof.capture({
  command: "pytest tests/ -v",
  mode: "terminal",
  label: "api-tests",
  description: "API integration tests",
});
```

Works with any test runner or command: `pytest`, `go test`, `cargo test`, `bun test`, `make check` -- anything that writes to stdout.

## Browser mode

Runs a Playwright test file with video recording enabled. Collects the `.webm` and copies it to the run directory.

```typescript
await proof.capture({
  testFile: "tests/checkout.spec.ts",
  mode: "browser",
  label: "checkout",
  description: "User completes checkout flow",
});
```

Requires `video: 'on'` in your `playwright.config.ts`.

**Cursor highlights** -- optional. Adds a visible red cursor dot and click ripple to recordings:

```typescript
import { getCursorHighlightScript } from "@automaze/proof";

test("checkout", async ({ page }) => {
  await page.addInitScript(getCursorHighlightScript());
  await page.goto("http://localhost:3000");
});
```

## CLI

For non-TypeScript projects or CI pipelines:

```bash
# Capture terminal output
proof capture --app my-app --command "pytest tests/" --mode terminal --label tests

# Capture a Playwright test
proof capture --app my-app --test-file tests/checkout.spec.ts --mode browser

# Generate report
proof report --app my-app
```

For automation, pipe JSON to stdin for multi-capture runs:

```bash
echo '{
  "action": "capture",
  "appName": "my-app",
  "captures": [
    { "command": "pytest tests/", "mode": "terminal", "label": "api" },
    { "command": "go test ./...", "mode": "terminal", "label": "go" }
  ]
}' | proof --json
```

All CLI output is JSON to stdout.

## API reference

### `new Proof(config)`

```typescript
const proof = new Proof({
  appName: "my-app",       // Required. Used in directory path and manifest.
  proofDir: "./evidence",  // Default: os.tmpdir()/proof
  run: "deploy-v2",        // Default: HHMM of init time
  browser: {
    viewport: { width: 1280, height: 720 },
  },
  terminal: {
    cols: 120,             // Default: 120
    rows: 30,              // Default: 30
  },
});
```

### `proof.capture(options)`

```typescript
const recording = await proof.capture({
  command: "pytest tests/",          // Required for terminal mode
  testFile: "tests/orders.spec.ts",  // Required for browser mode
  testName: "should complete order", // Optional: Playwright -g filter
  label: "order-flow",               // Optional: filename prefix
  mode: "terminal",                  // "browser" | "terminal" | "auto"
  description: "Order flow tests",   // Optional: stored in manifest
});

recording.path      // absolute path to artifact
recording.mode      // "browser" | "terminal"
recording.duration  // ms
```

### `proof.report()`

Generates a markdown report from `proof.json`. Returns the report file path.

## Output structure

```
evidence/my-app/20260312/deploy-v2/
  unit-tests-143012.cast       # asciicast recording
  unit-tests-143012.html       # animated HTML player
  checkout-143015.webm         # browser video
  proof.json                   # manifest (all entries)
  report.md                    # generated summary
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `PROOF_DIR` | Override default proof directory |
| `PROOF_MODE` | Override auto-detection (`browser` or `terminal`) |

## Requirements

- **Terminal mode**: No external dependencies
- **Browser mode**: `@playwright/test`, `video: 'on'` in Playwright config
- **Video duration**: `ffprobe` on PATH

## Agent Skill

Proof ships with an [agent skill](./skills/proof/) that teaches AI coding agents how to use it. When installed, agents automatically use `proof capture` instead of ad-hoc approaches like `tee` or raw Playwright runs.

**Benchmark** (Claude Sonnet 4.6, 3 eval scenarios, 14 assertions):

| | With Skill | Without Skill |
|---|---|---|
| **Pass Rate** | 100% | 28% |
| **Assertions Passed** | 14/14 | 4/14 |

The skill delivers a **+72 point pass rate improvement**. [Full benchmark results](./BENCHMARK.md)

---

## Support This Project

**Proof was developed at [Automaze](https://automaze.io) for developers who ship, by developers who ship**.

If Proof helps your team ship better software:

- ⭐ **[Star this repository](https://github.com/automazeio/proof)** to show your support
- 🐦 **[Follow @aroussi on X](https://x.com/aroussi)** for updates and tips


> [!TIP]
> **Ship faster with Automaze.** We partner with founders to bring their vision to life, scale their business, and optimize for success.
>
> **[Visit Automaze to book a call with me ›](https://automaze.io)**


## Other tools by Automaze

- [VibeProxy](https://github.com/automazeio/vibeproxy) - Native macOS menu bar app to use Claude Max & ChatGPT subscriptions with AI coding tools
- [CCPM](https://github.com/automazeio/ccpm) - Project management system for Claude Code using GitHub Issues and Git worktrees for parallel agent execution
- [Open Royalties](https://github.com/automazeio/open-royalties) - The missing funding framework for bootstrappers, indie hackers, and creators

---

## License

Apache 2.0. See [LICENSE](./LICENSE).
