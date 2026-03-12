# Skill Benchmark

Benchmark results for the `proof` agent skill, comparing agent performance **with** and **without** the skill installed.

**Model:** Claude Sonnet 4.6 | **Date:** March 12, 2026 | **Evals:** 3 scenarios, 14 assertions

---

## Results

| | With Skill | Without Skill | Delta |
|---|---|---|---|
| **Pass Rate** | 100% | 28% | **+72pp** |
| **Assertions Passed** | 14/14 | 4/14 | +10 |
| **Avg Time** | 54.4s | 31.9s | +22.5s |
| **Avg Tokens** | 18,983 | 15,304 | +3,679 |

The skill adds ~22 seconds of execution time (reading skill references) but delivers a **72-point pass rate improvement**.

---

## Eval Scenarios

### 1. Feature Done -- Create PR with Evidence

> *"I just finished the auth refactor. Tests pass with npm test. Can you help me create a PR with evidence attached?"*

| Assertion | With Skill | Without Skill |
|-----------|:---:|:---:|
| Uses `proof capture` command | Pass | Fail |
| Captures `npm test` via proof | Pass | Fail |
| Generates proof report | Pass | Fail |
| Integrates evidence with PR | Pass | Pass |

**Without skill:** Agent uses `npm test 2>&1 | tee` and embeds raw text in PR body. Functional, but no structured recording or manifest.

**With skill:** Agent runs `proof capture`, generates a report, and embeds the structured markdown report in the PR body via `$(cat report.md)`.

### 2. Direct Recording -- Capture pytest Run

> *"Capture my pytest run as evidence -- command is pytest tests/api/ -v"*

| Assertion | With Skill | Without Skill |
|-----------|:---:|:---:|
| Uses `proof capture` command | Pass | Fail |
| Captures correct pytest command | Pass | Fail |
| Specifies terminal mode | Pass | Fail |
| Includes required `--app` flag | Pass | Fail |
| Mentions output artifact | Pass | Pass |

**Without skill:** Agent suggests `tee`, `script`, pytest-html plugin, and manual metadata wrapping. Four separate options, none using proof.

**With skill:** Agent runs the exact `proof capture` command with correct flags and explains the output artifacts (`.html` player, `.cast` file, `proof.json` manifest).

### 3. Demo to PM -- Browser Recording of Checkout Flow

> *"I need to show my PM that the checkout flow works -- can you make a recording of the browser tests?"*

| Assertion | With Skill | Without Skill |
|-----------|:---:|:---:|
| Uses `proof capture` command | Pass | Fail |
| Uses browser mode | Pass | Fail |
| Asks/assumes test file | Pass | Pass |
| Mentions shareable output | Pass | Fail |
| Mentions Playwright prerequisite | Pass | Pass |

**Without skill:** Agent runs Playwright directly, suggests ffmpeg conversion to MP4, and recommends `playwright show-report`. No single portable artifact.

**With skill:** Agent uses `proof capture --mode browser`, recommends `archive.html` as a single self-contained file the PM can open anywhere, and notes the existing `video: 'on'` config.

---

## Key Findings

- **`uses_proof_capture_command`** is the most discriminating assertion: 100% with skill, 0% without. The skill uniquely teaches the `@automaze/proof` workflow.
- **Baseline agents still handle common tasks** like finding test files and embedding output in PRs -- they just use ad-hoc approaches instead of structured proof artifacts.
- **The PM demo scenario** showed the largest quality gap. Without the skill, the agent missed the self-contained `archive.html` format entirely, suggesting raw `.webm` files and ffmpeg conversion instead.
- **No flaky assertions** -- all are grounded in specific tool/flag usage that's unambiguously present or absent.
