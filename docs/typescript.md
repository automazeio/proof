# Proof: TypeScript SDK

Use `@automaze/proof` as a library to capture terminal output and browser recordings from your TypeScript/JavaScript code.

## Install

```bash
npm install @automaze/proof
```

## Basic usage

```typescript
import { Proof } from "@automaze/proof";

const proof = new Proof({ appName: "my-app" });

await proof.capture({
  command: "npm test",
  mode: "terminal",
});

await proof.report();
```

## Constructor

```typescript
const proof = new Proof({
  appName: "my-app",         // Required. Used in directory paths and manifest.
  description: "Nightly CI", // Optional. Appears in HTML reports.
  proofDir: "./evidence",    // Optional. Default: os.tmpdir()/proof
  run: "deploy-v2",          // Optional. Default: HHMM of init time.
  browser: {
    viewport: { width: 1280, height: 720 },
  },
  terminal: {
    cols: 120,               // Default: 120
    rows: 30,                // Default: 30
  },
});
```

The `run` name groups captures into a single directory. If you don't provide one, it defaults to the current time (e.g. `1430`).

## Capturing terminal output

Pass any shell command. Proof runs it, captures stdout/stderr with real timestamps, and writes two files:

- `.cast` -- asciicast v2, compatible with asciinema players
- `.html` -- self-contained player (works offline, zero dependencies)

```typescript
const recording = await proof.capture({
  command: "pytest tests/ -v",
  mode: "terminal",
  label: "api-tests",
  description: "API integration test suite",
});

console.log(recording.path);     // /abs/path/api-tests-143012.html
console.log(recording.mode);     // "terminal"
console.log(recording.duration); // 1200 (ms)
```

Works with any command: `pytest`, `go test`, `cargo test`, `bun test`, `make check`, `npm run lint` -- anything that writes to stdout.

## Capturing browser recordings

Pass a Playwright test file. Proof runs it with video enabled and collects the `.webm`.

```typescript
const recording = await proof.capture({
  testFile: "tests/checkout.spec.ts",
  mode: "browser",
  label: "checkout",
  description: "User completes checkout and sees confirmation",
});
```

Requires `video: 'on'` in your `playwright.config.ts`.

To filter to a specific test within the file:

```typescript
await proof.capture({
  testFile: "tests/checkout.spec.ts",
  testName: "should show confirmation",
  mode: "browser",
});
```

### Cursor highlights

By default, Playwright videos don't show the cursor. Proof exports a script that adds a visible red dot and click ripple:

```typescript
import { getCursorHighlightScript } from "@automaze/proof";

test("checkout", async ({ page }) => {
  await page.addInitScript(getCursorHighlightScript());
  await page.goto("http://localhost:3000");
  // ... test steps
});
```

Call `addInitScript` before `page.goto()`.

## Auto-detection

When `mode` is `"auto"` (the default), proof picks based on your project:

| Signal | Mode chosen |
|--------|-------------|
| `playwright.config.ts` or `.js` exists | `browser` |
| `@playwright/test` or `playwright` in package.json | `browser` |
| Everything else | `terminal` |

You can override with `PROOF_MODE=terminal` or `PROOF_MODE=browser`.

## Multiple captures in one run

Call `capture()` multiple times. Each recording is appended to the same `proof.json` manifest:

```typescript
const proof = new Proof({ appName: "my-app", run: "full-suite" });

await proof.capture({
  command: "npm run test:unit",
  mode: "terminal",
  label: "unit-tests",
});

await proof.capture({
  command: "npm run test:integration",
  mode: "terminal",
  label: "integration-tests",
});

await proof.capture({
  testFile: "tests/e2e/checkout.spec.ts",
  mode: "browser",
  label: "e2e-checkout",
});

await proof.report({ format: ["md", "html"] });
```

## Generating reports

```typescript
// Default: markdown
const mdPath = await proof.report();

// Specific format
const htmlPath = await proof.report({ format: "html" });

// Self-contained archive (base64 video, inlined players)
const archivePath = await proof.report({ format: "archive" });

// Multiple formats at once
const [md, html, archive] = await proof.report({
  format: ["md", "html", "archive"],
}) as string[];
```

| Format | File | Description |
|--------|------|-------------|
| `md` | `report.md` | Markdown with summary table and detail sections. Paste into PRs. |
| `html` | `report.html` | Visual HTML report with embedded video and terminal players. Needs sibling artifact files. |
| `archive` | `archive.html` | Single self-contained HTML. Videos base64-encoded, players inlined. Share anywhere. |

## Capture options reference

```typescript
await proof.capture({
  command: "...",        // Shell command (required for terminal mode)
  testFile: "...",       // Playwright test file (required for browser mode)
  testName: "...",       // Optional: Playwright -g filter for specific test
  label: "...",          // Optional: filename prefix (default: mode name)
  mode: "terminal",      // Optional: "browser" | "terminal" | "auto"
  description: "...",    // Optional: human-readable, stored in manifest
});
```

## Recording object

`capture()` returns a `Recording`:

```typescript
interface Recording {
  path: string;           // Absolute path to the artifact
  mode: "browser" | "terminal";
  duration: number;       // Duration in milliseconds
  label?: string;
}
```

## Manifest

Each run produces a `proof.json`:

```json
{
  "version": 1,
  "appName": "my-app",
  "description": "Nightly CI",
  "run": "deploy-v2",
  "createdAt": "2026-03-12T14:30:12.000Z",
  "entries": [
    {
      "timestamp": "2026-03-12T14:30:15.000Z",
      "mode": "terminal",
      "label": "api-tests",
      "command": "pytest tests/ -v",
      "duration": 1200,
      "artifact": "api-tests-143012.html",
      "description": "API integration test suite"
    }
  ]
}
```

## Error handling

Proof throws on invalid input:

```typescript
// Missing command for terminal mode
await proof.capture({ mode: "terminal" });
// Error: terminal mode requires command

// Missing testFile for browser mode
await proof.capture({ mode: "browser" });
// Error: browser mode requires testFile

// Report before any captures
await proof.report();
// Error: No proof.json found — run capture() first
```

If a captured command exits with a non-zero code, proof still records the output (including the error) and returns the recording. The exit code is not surfaced as an exception -- you get the evidence either way.
