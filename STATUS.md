# Status

**Last updated:** 2026-03-11

## What's Built

### Core SDK (`src/`)

| File | Purpose |
|------|---------|
| `index.ts` | `Proof` class -- capture, report |
| `types.ts` | All TypeScript interfaces |
| `detect.ts` | Auto-detection: Playwright found = browser, otherwise terminal |
| `duration.ts` | Video duration extraction via ffprobe |
| `modes/visual.ts` | Browser capture: runs Playwright, collects .webm, cursor highlights |
| `modes/terminal.ts` | Terminal capture: pipe-based with real timestamps, asciicast .cast + self-contained HTML player |

### Tests

| File | What |
|------|------|
| `src/detect.test.ts` | Unit tests for mode auto-detection (6 tests) |
| `src/index.test.ts` | Unit tests for Proof class: capture, manifest, report (8 tests) |
| `test-app/capture-proof.ts` | E2E integration: terminal + browser capture with report generation |

### Test App (`test-app/`)

| Component | Purpose |
|-----------|---------|
| `cli/app.ts` | Simple CLI with status/order commands |
| `cli/app.test.ts` | Bun test suite (3 tests) |
| `web/index.html` | Order form page |
| `web/orders.spec.ts` | Playwright test with cursor highlight injection |
| `web/playwright.config.ts` | Video recording + slowMo config |

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Capture SDK only | No workflow opinions -- consumers decide when/how to capture |
| Modes | browser + terminal | Removed test-output (terminal supersedes it) |
| Terminal format | asciicast v2 + HTML player | Real timestamps, self-contained, zero external deps |
| Player speed | Threshold table (0.1x-1x) | Based on real duration, no timestamp manipulation |
| GitHub integration | Removed | Not the SDK's job -- belongs in the tool/agent layer |
| Compare workflow | Removed | Opinionated git stash/checkout belongs in consumers |
| Retention/cleanup | Removed | Caller's responsibility, not the SDK's |
| maxVideoLength | Removed | Test runner owns its own timeouts |
| Build | tsc + bun build | tsc for .d.ts declarations, bun build for bundled JS |

## What's Left

- [ ] Report design -- currently basic markdown, could be HTML with embedded artifacts
- [ ] npm publish setup -- package.json is ready but no publish workflow yet
- [ ] Agent/skill integration -- how tools/agents call proof during their work
- [ ] Browser mode: configurable test runner command (currently hardcoded `bun test`)
- [ ] Terminal mode: configurable command (currently hardcoded `bun test`)
