---
name: proof
description: >
  Use proof to capture test runs as shareable, replayable evidence artifacts.
  Invoke this skill whenever the user wants to preserve or share proof that tests passed —
  not just run tests, but document and share the results. Works from any language:
  standalone binary, TypeScript, Python, or Go SDKs. Key use cases: attaching terminal
  output to a PR so reviewers can replay the test session instead of trusting a screenshot;
  generating a markdown proof report to embed in PR descriptions or tickets; recording a
  browser test run as a self-contained HTML video to share with a PM or QA team; recording
  an iOS Simulator or Android emulator screen while XCUITest or Espresso tests run, with
  automatic tap indicator overlays; or creating an audit trail that ties passing tests to a
  specific git commit. Trigger on phrases like "attach evidence to PR", "save test output
  as artifact", "replayable test recording", "proof report", "record my test run", "share
  test results", "visual proof tests pass", "terminal recording of tests", "record iOS
  simulator", "record Android emulator", "capture mobile tests", or whenever someone wants
  reviewers or stakeholders to see test execution without re-running it themselves. Also
  trigger when the user mentions proof, @automaze/proof, or automaze-proof directly.
---

# proof

Capture evidence that code works. Terminal replays, browser videos, structured reports.

## When to use this skill

- User asks to record or capture test execution
- User wants visual evidence of a command running
- User needs to generate a proof report
- User wants to attach test recordings to PRs or share them
- User wants to record an iOS Simulator or Android emulator while running mobile UI tests
- User mentions "proof", "evidence", or "capture" in the context of testing

## Install

proof ships as a standalone binary. No Node.js required.

```bash
# macOS / Linux
curl -fsSL https://automaze.io/install/proof | sh

# Homebrew
brew install automazeio/tap/proof

# npm (if you have Node.js)
npm install -g @automaze/proof

# Verify
proof --version
```

## Choose your interface

| Interface | Install | Best for |
|-----------|---------|----------|
| CLI binary | `curl` / `brew` | Shell scripts, CI, any language |
| TypeScript SDK | `npm install @automaze/proof` | Node.js / Bun projects |
| Python SDK | `pip install automaze-proof` | Python projects, pytest |
| Go SDK | `go get github.com/automazeio/proof-go` | Go projects |

All SDKs are thin wrappers around the same CLI binary.

## CLI (works everywhere)

The CLI outputs JSON to stdout, making it ideal for agent consumption and scripting.

### Terminal capture

```bash
proof capture \
  --app <app-name> \
  --command "<shell command>" \
  --mode terminal \
  --label <label> \
  --dir <output-dir> \
  --run <run-name> \
  --description "<what this captures>"
```

### Browser capture

```bash
proof capture \
  --app <app-name> \
  --test-file <path/to/test.spec.ts> \
  --mode browser \
  --label <label> \
  --dir <output-dir>
```

### Simulator capture (iOS)

Records the iOS Simulator screen while running XCUITest (or any command). Requires Xcode and at least one simulator runtime installed locally.

```bash
proof capture \
  --app <app-name> \
  --mode simulator \
  --platform ios \
  --device-name "iPhone 17 Pro" \
  --command "xcodebuild test \
    -project MyApp.xcodeproj \
    -scheme MyApp \
    -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
    -parallel-testing-enabled NO \
    -disable-concurrent-destination-testing" \
  --label ui-tests \
  --dir <output-dir>
```

For pixel-accurate tap indicators, add `ProofTapLogger.swift` to the XCUITest target and replace `element.tap()` with `element.proofTap()`. Proof reads the tap log after the test and overlays red dot + ripple rings at the correct positions.

### Simulator capture (Android)

Records the Android emulator screen while running Espresso or any command. Requires Android SDK and at least one AVD created locally.

```bash
proof capture \
  --app <app-name> \
  --mode simulator \
  --platform android \
  --device-name "Pixel_3a" \
  --command "./gradlew connectedAndroidTest" \
  --label ui-tests \
  --dir <output-dir>
```

For tap indicators, write a JSON tap log from your test script:

```bash
cat > /tmp/proof-android-taps.json << 'EOF'
[
  { "element": "Login", "x": 540, "y": 1200, "offsetMs": 1000 },
  { "element": "Submit", "x": 540, "y": 1800, "offsetMs": 3500 }
]
EOF
```

Proof reads `$PROOF_TAP_LOG` (default `/tmp/proof-android-taps.json`) after recording and overlays indicators.

### Generate report

```bash
proof report --app <app-name> --dir <output-dir> --run <run-name> --format md
proof report --app <app-name> --dir <output-dir> --run <run-name> --format html
proof report --app <app-name> --dir <output-dir> --run <run-name> --format md,html,archive
```

### JSON stdin mode (multi-capture)

```bash
echo '{
  "action": "capture",
  "appName": "my-app",
  "proofDir": "./evidence",
  "run": "full-suite",
  "captures": [
    { "command": "npm test", "mode": "terminal", "label": "unit" },
    { "command": "npm run lint", "mode": "terminal", "label": "lint" }
  ]
}' | proof --json
```

### CLI output format

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

## TypeScript SDK

```typescript
import { Proof } from "@automaze/proof";

const proof = new Proof({
  appName: "my-app",
  proofDir: "./evidence",
  run: "deploy-v2",
});

await proof.capture({
  command: "npm test",
  mode: "terminal",
  label: "unit-tests",
  description: "Unit test suite",
});

await proof.report();
await proof.report({ format: "html" });
await proof.report({ format: "archive" });
```

See [TypeScript SDK reference](references/typescript.md) for full API.

## Python SDK

```bash
pip install automaze-proof
```

```python
from proof import Proof

p = Proof(app_name="my-app", proof_dir="./evidence", run="deploy-v2")

rec = p.capture(command="pytest tests/ -v", mode="terminal", label="tests")
print(rec.path)      # /abs/path/tests-143012.html
print(rec.duration)  # 2400

p.report()
p.report(format="html")
```

### pytest fixture

```python
# conftest.py
import pytest
from proof import Proof

@pytest.fixture(scope="session", autouse=True)
def proof_session(tmp_path_factory):
    p = Proof(app_name="my-app", proof_dir="./evidence")
    yield p
    p.report()
```

See [Python SDK reference](references/python.md) for full API.

## Go SDK

```bash
go get github.com/automazeio/proof-go
```

```go
import "github.com/automazeio/proof-go/proof"

p, err := proof.New(proof.Config{AppName: "my-app", ProofDir: "./evidence"})
rec, err := p.Capture(proof.CaptureOptions{
    Command: "go test ./...",
    Mode:    "terminal",
    Label:   "tests",
})
fmt.Println(rec.Path, rec.Duration)

p.Report(proof.ReportOptions{})
```

The Go SDK auto-downloads the binary on first use if not on PATH.

See [Go SDK reference](references/go.md) for full API.

## Report formats

| Format | File | Use case |
|--------|------|----------|
| `md` | `report.md` | Default. Markdown summary, paste into PRs |
| `html` | `report.html` | Visual HTML report with embedded media |
| `archive` | `archive.html` | Single self-contained HTML. Fully portable |

## Output structure

```
<proofDir>/<appName>/<YYYYMMDD>/<run>/
  label-HHMMSS.cast        # asciicast v2 recording
  label-HHMMSS.html        # self-contained terminal player
  label-HHMMSS.webm        # browser video (if browser mode)
  proof.json                # manifest with all entries
  report.md                 # generated report
```

## Common agent workflows

### Record test execution after making changes

```bash
proof capture --app my-app --command "npm test" --mode terminal \
  --label tests --dir ./evidence --run "$(date +%H%M)" \
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
    { "command": "npm run test:unit", "mode": "terminal", "label": "unit" },
    { "command": "npm run test:integration", "mode": "terminal", "label": "integration" },
    { "command": "npm run lint", "mode": "terminal", "label": "lint" }
  ]
}' | proof --json
```

### Generate report for a PR

```bash
proof report --app my-app --dir ./evidence --run full-suite --format md
```

## Key constraints

- Terminal mode requires `--command`
- Browser mode requires `--test-file`
- Simulator mode requires `--command` and `--platform`
- `--app` is always required
- CLI always outputs JSON to stdout, errors go to stderr
- Report generation requires at least one capture in the run
- Simulator mode requires the simulator/emulator to be installed locally -- proof does not download or provision them
- For iOS xcodebuild tests, always pass `-parallel-testing-enabled NO -disable-concurrent-destination-testing` or the recording will capture an idle screen (xcodebuild clones the simulator by default)

## References

- [CLI guide](references/cli.md)
- [TypeScript SDK](references/typescript.md)
- [Python SDK](references/python.md)
- [Go SDK](references/go.md)
