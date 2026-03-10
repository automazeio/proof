# @varops/proof

> Visual proof of work for automated code changes.

**Domain:** getproof.sh

A shared QA recording module that captures video evidence of bug fixes and feature implementations. Used by LadyBug and TenX to attach before/after recordings to PRs and issues — so reviewers see what changed, not just the diff.

---

## Problem

When an AI agent fixes a bug or implements a feature, the PR shows code changes. But code changes don't answer: "does this actually work?" A reviewer has to check out the branch, run the app, and manually verify. That's the bottleneck.

A 10-second video of the fix working is worth more than a 200-line diff.

---

## Solution

A single TypeScript package that:

1. Runs tests with video recording enabled
2. Captures before/after recordings for bug fixes
3. Uploads recordings to GitHub PRs and issues
4. Auto-detects the right recording mode (browser, terminal, test output)

---

## Recording Modes

### 1. Visual (Playwright)

For web apps and anything with a browser UI. Runs Playwright tests with `video: 'on'` and captures `.webm` files.

```
Before: User clicks "Pay" → 500 error page
After:  User clicks "Pay" → Order confirmation
```

### 2. Terminal (asciinema)

For CLIs, APIs, and backend services. Captures terminal sessions as `.cast` files, convertible to `.gif` for embedding.

```
Before: $ curl /api/orders/123 → 500 Internal Server Error
After:  $ curl /api/orders/123 → {"id": 123, "status": "paid"}
```

### 3. Test Output (fallback)

For anything without visual or terminal tests. Captures formatted test output with pass/fail status and timing.

```
Before: ✗ test_get_order — TypeError: NoneType not subscriptable (0.3s)
After:  ✓ test_get_order — 200 OK (0.2s)
```

### Auto-Detection

The recorder auto-detects which mode to use based on the project:

| Signal | Mode |
|--------|------|
| `playwright.config.*` exists | Visual |
| Test file imports `@playwright/test` | Visual |
| Test command includes `playwright` | Visual |
| `.asciinema` config or terminal test patterns | Terminal |
| Everything else | Test output |

Projects can override auto-detection via config.

---

## API

```typescript
import { Proof } from '@varops/proof';

const proof = new Proof({
  repo: 'your-org/your-repo',
  githubToken: process.env.GITHUB_TOKEN,
  mode: 'auto',    // 'visual' | 'terminal' | 'test-output' | 'auto'
  workDir: '/tmp/proof', // optional: base directory for all recordings (default: os.tmpdir()/proof)
});
```

### Capture a single recording

```typescript
const video = await proof.capture({
  testFile: 'tests/orders.spec.ts',
  testName: 'should return order details', // optional: specific test
  label: 'bug-repro',                      // optional: label for the recording
});
// Returns: { path: '/tmp/proof/bug-repro.webm', mode: 'visual', duration: 4200 }
```

### Before/after comparison

```typescript
const result = await proof.compare({
  testFile: 'tests/orders.spec.ts',
  beforeRef: 'main',         // git ref for the "before" state
  afterRef: 'HEAD',          // git ref for the "after" state (default: HEAD)
});
// Returns: { before: Recording, after: Recording, mode: 'visual' }
```

### Attach to a GitHub PR

```typescript
await proof.attachToPR({
  prNumber: 142,
  recordings: result,         // single Recording or compare result
  comment: 'QA verification', // optional header text
});
```

Produces a PR comment like:

```markdown
## QA Verification

### Before (main)
https://github.com/your-org/your-repo/assets/video-before.webm

### After (ladybug/fix-a3f2)
https://github.com/your-org/your-repo/assets/video-after.webm

*Recorded by @varops/proof*
```

### Attach to a GitHub issue

```typescript
await proof.attachToIssue({
  issueNumber: 141,
  recording: video,
  comment: 'Bug reproduction',
});
```

### Run a test suite with recording

```typescript
const results = await proof.recordSuite({
  command: 'npx playwright test',       // or 'pytest', 'bun test', etc.
  captureVideo: true,
  captureOutput: true,
});
// Returns: { videos: Recording[], output: string, passed: boolean }
```

### Artifact storage and cleanup

Every `capture()` or `compare()` call writes recordings under `workDir/<run-id>/`. The run ID is a timestamp-based identifier so parallel runs don't collide.

```typescript
// List all stored runs
const runs = await proof.listRuns();
// [{ id: '20250310-143012', createdAt: Date, files: ['before.webm', 'after.webm'], sizeBytes: 4_200_000 }]

// Clean up old recordings
await proof.cleanup({
  maxAge: 7 * 24 * 60 * 60 * 1000, // delete runs older than 7 days
  maxRuns: 20,                       // keep at most 20 recent runs
});
```

Directory layout:

```
<workDir>/
├── 20250310-143012/
│   ├── before.webm
│   └── after.webm
├── 20250310-151500/
│   └── bug-repro.webm
└── ...
```

---

## How It Works

### Visual Recording Flow

```
1. Checkout beforeRef (if doing comparison)
2. Start Playwright with video: 'on', viewport configured
3. Run specified test(s)
4. Collect .webm from test-results/
5. Checkout afterRef
6. Repeat steps 2-4
7. Upload both videos to GitHub
8. Post PR/issue comment with embedded videos
```

### Terminal Recording Flow

```
1. Start asciinema recording
2. Run test command
3. Stop recording → .cast file
4. Convert to .gif via agg (asciinema gif generator)
5. Upload and attach
```

### GitHub Upload

Videos are uploaded as GitHub release assets or via the GitHub API's asset upload endpoint, then referenced in PR/issue comments via markdown. For repos without releases, falls back to comment-embedded links.

---

## Configuration

### Package config (`proof.config.ts` or in `package.json`)

```typescript
export default {
  mode: 'auto',
  visual: {
    viewport: { width: 1280, height: 720 },
    videosOnFailureOnly: false,
  },
  terminal: {
    cols: 120,
    rows: 30,
    convertToGif: true,
  },
  github: {
    uploadMethod: 'assets', // 'assets' | 'comment-link'
  },
  maxVideoLength: 30, // seconds — kill recording after this
  workDir: '/tmp/proof', // base directory for recordings (default: os.tmpdir()/proof)
  retention: {
    maxAge: 604800000, // 7 days in ms — auto-cleanup threshold
    maxRuns: 20,       // keep at most N recent runs
  },
};
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | Required for uploading to GitHub |
| `PROOF_MODE` | Override auto-detection |
| `PROOF_MAX_LENGTH` | Max video duration in seconds |
| `PROOF_WORK_DIR` | Override default work directory for recordings |

---

## Integration Points

### LadyBug

**`github` mode:** Record bug reproduction + fix verification, attach both to the PR.

```
Error → Investigate → Record bug (before) → Fix → Record fix (after) → PR with videos
```

**`tenx` mode:** Record bug reproduction only, attach to the GitHub issue. TenX gets the video as context.

```
Error → Investigate → Record bug → Issue with video → TenX picks up
```

### TenX

**Verifier Agent:** After execution, run the relevant tests with recording. Attach to the PR as proof of work.

```
Task done → Verifier runs tests with proof → Videos attached to PR
```

**Before/after for bug fixes:** When a task is a bug fix, record the failing test before the fix and the passing test after.

**Feature demos:** For UI features, record a walkthrough of the new behavior.

---

## Package Structure

```
@varops/proof/
├── src/
│   ├── index.ts          — Public API (Proof class)
│   ├── capture.ts        — Run tests with recording enabled
│   ├── compare.ts        — Before/after git-ref-based comparison
│   ├── attach.ts         — Upload to GitHub PRs/issues
│   ├── detect.ts         — Auto-detect recording mode
│   ├── modes/
│   │   ├── visual.ts     — Playwright video capture
│   │   ├── terminal.ts   — asciinema terminal capture
│   │   └── output.ts     — Test output capture (fallback)
│   └── types.ts          — Shared types and interfaces
├── package.json
├── tsconfig.json
└── PRD.md
```

---

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **Visual recording:** Playwright (peer dependency — projects bring their own)
- **Terminal recording:** asciinema + agg (bundled or peer dependency)
- **GitHub:** Octokit (@octokit/rest)
- **Distribution:** npm package (`@varops/proof`)

---

## Non-Goals

- Not a test runner — it wraps existing test commands with recording
- Not a CI system — it produces artifacts, doesn't decide pass/fail
- Not a video editor — raw recordings, no post-processing beyond gif conversion
- Not a screenshot tool — video captures behavior, not static state

---

## Roadmap

- [ ] Core: Visual recording via Playwright
- [ ] Core: Terminal recording via asciinema
- [ ] Core: Test output capture (fallback mode)
- [ ] Core: Auto-detection of recording mode
- [ ] Core: GitHub PR/issue attachment
- [ ] Core: Before/after comparison with git refs
- [ ] Integration: LadyBug (`github` + `tenx` modes)
- [ ] Integration: TenX (Verifier Agent)
- [ ] Future: Annotated recordings (highlight the fix area)
- [ ] Future: Video thumbnail generation for PR comments
- [ ] Future: Slack/notification embedding
- [ ] Future: Recording diffing (visual comparison of before/after frames)
- [ ] Future: CLI wrapper for cross-language usage (any language shells out to `npx @varops/proof`)
