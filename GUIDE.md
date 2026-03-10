# @varops/proof — User Guide

## Installation

```bash
bun add @varops/proof
```

## Quick Start

```typescript
import { Proof } from "@varops/proof";

const proof = new Proof({
  repo: "your-org/your-repo",
  githubToken: process.env.GITHUB_TOKEN,
});

const recording = await proof.capture({
  testFile: "tests/orders.spec.ts",
});

console.log(recording.path); // /tmp/proof/20260310-143012/recording.webm
```

## Recording Modes

Proof auto-detects the right recording mode based on your project:

| Mode | When | What it produces |
|------|------|-----------------|
| **visual** | Playwright config or dependency found | `.webm` video via Playwright's browser recording |
| **terminal** | Everything else | `.txt` with full PTY output (colors, formatting) via `script` |
| **test-output** | Explicit override only | Plain `.txt` with stdout/stderr |

Override auto-detection:

```typescript
const proof = new Proof({
  repo: "your-org/your-repo",
  mode: "terminal", // force terminal mode
});
```

Or via environment variable:

```bash
PROOF_MODE=visual bun run my-script.ts
```

## API

### `new Proof(config)`

```typescript
const proof = new Proof({
  repo: "your-org/your-repo",       // required: owner/repo
  githubToken: process.env.GITHUB_TOKEN, // for PR/issue attachment
  mode: "auto",                      // "visual" | "terminal" | "test-output" | "auto"
  workDir: "/tmp/proof",             // where recordings are stored
  maxVideoLength: 30,                // kill recording after N seconds
  visual: {
    viewport: { width: 1280, height: 720 },
  },
  terminal: {
    cols: 120,
    rows: 30,
  },
  retention: {
    maxAge: 604800000,               // auto-cleanup: 7 days
    maxRuns: 20,                     // auto-cleanup: keep last 20
  },
});
```

### `proof.capture(options)`

Record a single test run.

```typescript
const recording = await proof.capture({
  testFile: "tests/orders.spec.ts",
  testName: "should return order details", // optional: filter to specific test
  label: "bug-repro",                      // optional: name for the recording file
});
```

Returns:

```typescript
{
  path: "/tmp/proof/20260310-143012/bug-repro.webm",
  mode: "visual",
  duration: 4200,  // milliseconds
  label: "bug-repro",
}
```

### `proof.compare(options)`

Record before/after by checking out git refs.

```typescript
const result = await proof.compare({
  testFile: "tests/orders.spec.ts",
  beforeRef: "main",
  afterRef: "HEAD",       // default
});
```

Returns:

```typescript
{
  before: Recording,  // recording at beforeRef
  after: Recording,   // recording at afterRef
  mode: "visual",
}
```

**Note:** This stashes uncommitted changes, checks out `beforeRef`, records, checks out `afterRef`, pops the stash, and records again. Make sure your working tree is in a committable state.

### `proof.attachToPR(options)`

Post a comment on a GitHub PR with the recording(s).

```typescript
await proof.attachToPR({
  prNumber: 142,
  recordings: result,        // Recording or CompareResult
  comment: "QA Verification",
});
```

### `proof.attachToIssue(options)`

Post a comment on a GitHub issue.

```typescript
await proof.attachToIssue({
  issueNumber: 141,
  recording: recording,
  comment: "Bug reproduction",
});
```

### `proof.listRuns()`

List all stored recording runs.

```typescript
const runs = await proof.listRuns();
// [{ id: "20260310-143012", createdAt: Date, files: ["before.webm", "after.webm"], sizeBytes: 4200000 }]
```

### `proof.cleanup(options)`

Delete old recordings.

```typescript
await proof.cleanup({
  maxAge: 7 * 24 * 60 * 60 * 1000, // older than 7 days
  maxRuns: 20,                       // keep at most 20 runs
});
```

Both options are optional. If omitted, falls back to the `retention` config passed to the constructor.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | Required for PR/issue attachment |
| `PROOF_MODE` | Override auto-detection (`visual`, `terminal`, `test-output`) |
| `PROOF_WORK_DIR` | Override default work directory |

## Artifact Storage

Recordings are stored in `workDir/<run-id>/`:

```
/tmp/proof/
├── 20260310-143012/
│   ├── before.webm
│   └── after.webm
├── 20260310-151500/
│   └── bug-repro.txt
└── ...
```

Run IDs are timestamp-based (`YYYYMMDD-HHMMSS`) so parallel runs don't collide.

## System Requirements

- **Bun** (runtime)
- **Playwright** (bundled -- used for visual mode)
- **ffprobe** (for video duration extraction; part of ffmpeg)
- **script** (for terminal mode; ships with macOS and Linux)

## Example: Bug Fix Workflow

```typescript
import { Proof } from "@varops/proof";

const proof = new Proof({
  repo: "varopsco/myapp",
  githubToken: process.env.GITHUB_TOKEN,
});

// 1. Record the bug (before the fix)
// 2. Record the fix (after)
const result = await proof.compare({
  testFile: "tests/checkout.spec.ts",
  testName: "should complete payment",
  beforeRef: "main",
});

// 3. Attach to the PR
await proof.attachToPR({
  prNumber: 142,
  recordings: result,
  comment: "QA Verification",
});

// 4. Clean up old recordings
await proof.cleanup();
```
