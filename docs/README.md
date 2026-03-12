# Proof docs

Capture evidence that your code works. Terminal replays, browser videos, structured reports.

## Guides

- **[TypeScript SDK](./typescript.md)** – use proof as a library in Node.js, Bun, or Deno projects
- **[CLI](./cli.md)** – use proof from the command line, CI pipelines, or non-JS projects

## Install

```bash
npm install @automaze/proof
# or
bun add @automaze/proof
```

The CLI is included – after install, `proof` is available as a command.

## Concepts

**Proof** records what happened when your code ran and organizes the evidence into shareable artifacts.

**Modes:**

| Mode | What it captures | Artifacts |
|------|-----------------|-----------|
| `terminal` | stdout/stderr from any shell command | `.cast` (asciicast) + `.html` (self-contained player) |
| `browser` | Playwright test execution with video | `.webm` video |
| `auto` | Auto-detects based on project setup | depends on detection |

**Runs** group captures together. Each run gets a directory with all artifacts, a `proof.json` manifest, and optional reports.

**Reports** summarize a run in one of three formats:

| Format | File | Use case |
|--------|------|----------|
| `md` | `report.md` | Paste into PRs, renders on GitHub |
| `html` | `report.html` | Visual report with embedded media (needs sibling files) |
| `archive` | `archive.html` | Single self-contained file -- email it, drop it in Slack |

## Output structure

```
evidence/
  my-app/
    20260312/
      deploy-v2/
        api-tests-143012.cast       # asciicast recording
        api-tests-143012.html       # self-contained HTML player
        checkout-143015.webm        # browser video
        proof.json                  # manifest
        report.md                   # generated report
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `PROOF_DIR` | Override default proof directory |
| `PROOF_MODE` | Override auto-detection (`browser` or `terminal`) |

## Requirements

- **Terminal mode**: No external dependencies
- **Browser mode**: `@playwright/test` installed, `video: 'on'` in Playwright config
- **Video duration**: `ffprobe` (from ffmpeg) on PATH

## License

Apache 2.0
