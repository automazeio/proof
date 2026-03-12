---
name: proof
description: >
  Capture visual evidence of test execution using @automaze/proof.
  Records terminal output and browser interactions as shareable artifacts.
  Use when the user wants to record test runs, generate proof reports,
  capture terminal output, or create visual evidence of code execution.
triggers:
  - proof
  - capture evidence
  - record test
  - record terminal
  - terminal recording
  - browser recording
  - proof report
  - visual evidence
  - test evidence
---

# @automaze/proof

Capture evidence that code works. Terminal replays, browser videos, structured reports.

## When to use this skill

- User asks to record or capture test execution
- User wants visual evidence of a command running
- User needs to generate a proof report
- User wants to attach test recordings to PRs or share them
- User mentions "proof", "evidence", or "capture" in the context of testing

## Installation check

Before using proof, verify it's installed:

```bash
npx @automaze/proof --help
```

If not available, install it:

```bash
npm install @automaze/proof
# or globally
npm install -g @automaze/proof
```

## Two interfaces

### 1. CLI (preferred for agents)

The CLI outputs JSON to stdout, making it ideal for agent consumption.

#### Terminal capture

Record any shell command with real timestamps and ANSI color output:

```bash
npx @automaze/proof capture \
  --app <app-name> \
  --command "<shell command>" \
  --mode terminal \
  --label <label> \
  --dir <output-dir> \
  --run <run-name> \
  --description "<what this captures>"
```

#### Browser capture

Record a Playwright test with video:

```bash
npx @automaze/proof capture \
  --app <app-name> \
  --test-file <path/to/test.spec.ts> \
  --mode browser \
  --label <label> \
  --dir <output-dir>
```

Requires `@playwright/test` installed and `video: 'on'` in playwright config.

#### Generate report

```bash
npx @automaze/proof report \
  --app <app-name> \
  --dir <output-dir> \
  --run <run-name>
```

#### JSON stdin mode (multi-capture)

For multiple captures in one invocation:

```bash
echo '{
  "action": "capture",
  "appName": "<app-name>",
  "proofDir": "<output-dir>",
  "run": "<run-name>",
  "captures": [
    { "command": "npm test", "mode": "terminal", "label": "unit" },
    { "command": "npm run lint", "mode": "terminal", "label": "lint" }
  ]
}' | npx @automaze/proof --json
```

#### CLI output format

All CLI output is JSON to stdout:

```json
{
  "action": "capture",
  "appName": "my-app",
  "run": "deploy-v2",
  "recordings": [
    {
      "path": "/absolute/path/to/unit-143012.html",
      "mode": "terminal",
      "duration": 1200,
      "label": "unit"
    }
  ]
}
```

### 2. TypeScript SDK

For programmatic usage within Node.js/Bun scripts:

```typescript
import { Proof } from "@automaze/proof";

const proof = new Proof({
  appName: "my-app",
  description: "Optional run description",
  proofDir: "./evidence",
  run: "deploy-v2",
});

// Terminal capture
await proof.capture({
  command: "npm test",
  mode: "terminal",
  label: "unit-tests",
  description: "Unit test suite",
});

// Browser capture
await proof.capture({
  testFile: "tests/checkout.spec.ts",
  mode: "browser",
  label: "checkout",
});

// Generate reports (md is default)
await proof.report();
await proof.report({ format: "html" });
await proof.report({ format: "archive" });
await proof.report({ format: ["md", "html", "archive"] });
```

## Report formats

| Format | File | Use case |
|--------|------|----------|
| `md` | `report.md` | Default. Markdown summary, paste into PRs |
| `html` | `report.html` | Visual HTML report with embedded media. Needs sibling artifact files |
| `archive` | `archive.html` | Single self-contained HTML. Videos base64-encoded, players inlined. Fully portable |

## Output structure

```
<proofDir>/<appName>/<YYYYMMDD>/<run>/
  label-HHMMSS.cast        # asciicast v2 recording
  label-HHMMSS.html        # self-contained terminal player
  label-HHMMSS.webm        # browser video (if browser mode)
  proof.json                # manifest with all entries
  report.md                 # generated report
```

## Common workflows for agents

### Record test execution after making changes

```bash
# After implementing a feature, capture the test run
npx @automaze/proof capture \
  --app my-app \
  --command "npm test" \
  --mode terminal \
  --label tests \
  --dir ./evidence \
  --run "$(date +%H%M)" \
  --description "Tests after implementing feature X"
```

### Record multiple test suites

```bash
echo '{
  "action": "capture",
  "appName": "my-app",
  "proofDir": "./evidence",
  "run": "full-suite",
  "captures": [
    { "command": "npm run test:unit", "mode": "terminal", "label": "unit", "description": "Unit tests" },
    { "command": "npm run test:integration", "mode": "terminal", "label": "integration", "description": "Integration tests" },
    { "command": "npm run lint", "mode": "terminal", "label": "lint", "description": "Linting" }
  ]
}' | npx @automaze/proof --json
```

### Generate a report to attach to a PR

```bash
npx @automaze/proof report --app my-app --dir ./evidence --run full-suite
# Returns JSON with path to report.md
```

## Key constraints

- Terminal mode requires `--command`
- Browser mode requires `--test-file`
- `--app` is always required
- CLI always outputs JSON to stdout, errors go to stderr as JSON
- The `proof.json` manifest is append-only within a run
- Report generation requires at least one capture in the run

## Environment variables

| Variable | Description |
|----------|-------------|
| `PROOF_DIR` | Override default proof directory |
| `PROOF_MODE` | Force `browser` or `terminal` mode |

## References

- [TypeScript SDK guide](references/typescript.md)
- [CLI guide](references/cli.md)
