# Status

**Last updated:** 2026-03-11

---

## Summary

`@varops/proof` is a TypeScript package that captures visual evidence of bug fixes and feature implementations. It records test runs as video (Playwright) or terminal output (`script`), and attaches them to GitHub PRs/issues so reviewers see proof the fix works -- not just the diff.

Built for internal use by **LadyBug** and **Ralph**.

---

## What's Built

### Core Package (`src/`)

| File | Purpose | Status |
|------|---------|--------|
| `index.ts` | `Proof` class — main API (capture, compare, attachToPR, attachToIssue, listRuns, cleanup) | Done |
| `types.ts` | All TypeScript interfaces (ProofConfig, Recording, CompareResult, etc.) | Done |
| `detect.ts` | Auto-detection: Playwright found = visual, otherwise = terminal | Done |
| `duration.ts` | Video duration extraction via ffprobe | Done |
| `modes/visual.ts` | Playwright Node API — launches browser, records .webm | Done |
| `modes/terminal.ts` | `script` command — PTY capture with ANSI colors to .txt | Done |
| `modes/output.ts` | Fallback — pipes stdout/stderr to .txt | Done |

### Test App (`test-app/`)

| Component | What it does |
|-----------|-------------|
| `web/index.html` | Simple order page (click Pay -> confirmation) |
| `web/orders.spec.ts` | Playwright test for the order flow |
| `web/playwright.config.ts` | Playwright config for the test app |
| `cli/app.ts` | CLI tool with status/order commands |
| `cli/app.test.ts` | Bun test suite (3 tests, all passing) |
| `capture-proof.ts` | Runs both capture modes end-to-end |
| `evidence/` | Committed recordings (`.webm` + `.txt`) |

### Docs

| File | Content |
|------|---------|
| `README.md` | Full PRD with API spec, recording modes, config, roadmap |
| `GUIDE.md` | User guide with installation, API reference, examples |
| `STATUS.md` | This file |

---

## Git History

```
cf163cf test: add test app with web + CLI proofs and captured evidence
6c6cdc1 docs: add user guide
afc78bf phase 2.5: replace asciinema with script command, zero deps
6bae8ad phase 2: Playwright Node API, video duration extraction
9f67756 status: add phased roadmap
f691101 add STATUS.md with progress tracking
8e753cc scaffold: project setup with core types, mode detection, capture modes
2f25ad3 first commit
```

---

## Roadmap

### Phase 1 — Scaffold & Core Types
- [x] PRD finalized (README.md)
- [x] Project scaffold (`package.json`, `tsconfig.json`, `.gitignore`)
- [x] Core types (`types.ts`)
- [x] Mode auto-detection (`detect.ts`)
- [x] Capture modes (visual, terminal, test-output)
- [x] `Proof` class with public API

### Phase 2 — Recording Quality
- [x] Use Playwright Node API directly (replace subprocess shelling)
- [x] Video duration extraction (ffprobe for video)
- [x] Artifact storage with run-id folders
- [x] Cleanup / retention API

### Phase 2.5 — Terminal Recording
- [x] Replace asciinema with `script` command (zero external deps)
- [x] PTY-based capture preserving colors and interactive output
- [x] Auto-cleanup of `script` header/footer noise
- [x] Simplified auto-detection (visual if Playwright, terminal otherwise)
- [x] Fixed `stdio: "inherit"` for proper PTY passthrough

### Phase 3 — GitHub Integration
- [ ] Upload video/text assets to GitHub (not just local path refs in comments)
- [ ] PR comment with embedded video links
- [ ] Issue comment attachment
- [ ] Handle repos without releases (fallback upload method)

### Phase 4 — Testing & Reliability
- [ ] Unit tests for detect, duration, capture modes, cleanup
- [ ] E2E tests using the test-app
- [ ] Error handling (missing ffprobe, Playwright not installed, git conflicts)
- [ ] Edge cases (concurrent runs, large videos, empty test output)

### Phase 5 — Integration
- [ ] Wire into LadyBug (bug reproduction + fix verification)
- [ ] Wire into Ralph (proof-of-work after task completion)
- [ ] Verify before/after comparison flow end-to-end
- [ ] Test with real PRs on real repos

### Future
- [ ] CLI wrapper for cross-language usage (`npx @varops/proof`)
- [ ] Annotated recordings (highlight the fix area)
- [ ] Video thumbnails for PR comments
- [ ] Recording diffing (visual comparison of before/after frames)
- [ ] Slack/notification embedding

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Name | proof (getproof.sh) | Short, meaningful, pairs with ladybug.sh |
| Package | `@varops/proof` | Scoped under varops org |
| Runtime | Bun | Matches ladybug/ralph stack |
| Playwright | Direct dependency | Always works, no setup friction |
| Terminal recording | `script` command | Ships with macOS/Linux, zero deps, PTY support |
| Artifact format | `.webm` (video), `.txt` (terminal) | Simple, no conversion needed |
| Artifact layout | `workDir/<run-id>/` | Timestamp-based, parallel-safe |
| Cross-language | Deferred | CLI wrapper later if needed |
| asciinema | Dropped | Not an npm package; `script` covers the use case |

---

## Known Gaps

- **GitHub upload not implemented** — comments currently reference local file paths, not uploaded assets
- **Video duration** — returns 0 if ffprobe is not installed (graceful fallback, not an error)
- **No unit tests yet** — test-app proves it works E2E but there are no isolated unit tests
- **`compare()` uses git stash/checkout** — can be destructive if working tree is dirty; needs guardrails
- **`test-output` mode is redundant** — with `script` as terminal mode, the pipe-based fallback may not be needed
