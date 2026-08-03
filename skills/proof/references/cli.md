# proof CLI

Use `proof` from the command line to capture terminal output and browser recordings. All output is JSON to stdout, making it easy to integrate with CI pipelines, shell scripts, and any language.

## Install

```bash
# macOS / Linux
curl -fsSL https://automaze.io/install/proof | sh

# Homebrew
brew install automazeio/tap/proof

# npm (if you have Node.js)
npm install -g @automaze/proof
```

## Commands

### `proof capture`

Record a terminal command, Playwright test, or mobile simulator.

```bash
# Terminal capture (interactive HTML player)
proof capture --app my-app --command "pytest tests/ -v" --mode terminal

# Terminal capture as MP4 video (embed in Linear / Jira)
proof capture --app my-app --command "pytest tests/ -v" --mode terminal --format video

# Browser capture
proof capture --app my-app --test-file tests/checkout.spec.ts --mode browser

# iOS Simulator capture
proof capture --app my-app --mode simulator --platform ios \
  --device-name "iPhone 17 Pro" \
  --command "xcodebuild test -project MyApp.xcodeproj -scheme MyApp \
    -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
    -parallel-testing-enabled NO -disable-concurrent-destination-testing"

# Android emulator capture
proof capture --app my-app --mode simulator --platform android \
  --command "./gradlew connectedAndroidTest"

# With all options
proof capture \
  --app my-app \
  --dir ./evidence \
  --run deploy-v2 \
  --command "npm test" \
  --mode terminal \
  --label unit-tests \
  --description "Unit test suite"
```

Output (JSON to stdout):

```json
{
  "action": "capture",
  "appName": "my-app",
  "run": "deploy-v2",
  "recordings": [
    {
      "path": "/abs/path/unit-tests-143012.html",
      "mode": "terminal",
      "duration": 1200,
      "label": "unit-tests",
      "exitCode": 0
    }
  ]
}
```

`exitCode` is the wrapped command's exit code (`0` = success), always present. By default the CLI exits `0` regardless; pass `--fail-on-error` to propagate it (see [Gating on results](#gating-on-results)).

### `proof report`

Generate a report from a previous run.

```bash
proof report --app my-app --dir ./evidence --run deploy-v2
proof report --app my-app --dir ./evidence --run deploy-v2 --format html
proof report --app my-app --dir ./evidence --run deploy-v2 --format md,html,archive
```

Output:

```json
{
  "action": "report",
  "paths": ["/abs/path/report.md"]
}
```

### `proof --help`

Print usage information.

### `proof --version`

Print the installed version.

## Options

| Option | Description | Required |
|--------|-------------|----------|
| `--app <name>` | App name. Used in directory paths and manifest. | Yes |
| `--dir <path>` | Proof directory. Default: `$TMPDIR/proof` | No |
| `--run <name>` | Run name. Default: HHMM of current time | No |
| `--command <cmd>` | Shell command to run | Yes (terminal / simulator mode) |
| `--test-file <file>` | Playwright test file path | Yes (browser mode) |
| `--test-name <name>` | Specific test name filter (Playwright `-g`) | No |
| `--label <label>` | Artifact filename prefix | No |
| `--mode <mode>` | `browser`, `terminal`, `simulator`, or `auto` | No |
| `--fail-on-error` | Exit with the wrapped command's exit code instead of `0` | No |
| `--platform <p>` | `ios` or `android` | Yes (simulator mode) |
| `--device-name <n>` | Simulator/AVD name to boot (uses running device if omitted) | No |
| `--os <version>` | iOS version filter, e.g. `18.4` | No |
| `--codec <codec>` | iOS recording codec: `h264` (default) or `hevc` | No |
| `--format <fmt>` | Capture: `video` or `raw` (terminal mode only; default `raw`). Report: `md`, `html`, `archive` (comma-separated for multiple) | No |
| `--description <text>` | Human-readable description stored in manifest | No |

## JSON stdin mode

For automation and multi-capture runs, pipe JSON to stdin:

```bash
echo '{
  "action": "capture",
  "appName": "my-app",
  "proofDir": "./evidence",
  "run": "nightly",
  "captures": [
    { "command": "pytest tests/", "mode": "terminal", "label": "python" },
    { "command": "go test ./...", "mode": "terminal", "label": "go" },
    { "command": "cargo test", "mode": "terminal", "label": "rust" }
  ]
}' | proof --json
```

Output:

```json
{
  "action": "capture",
  "appName": "my-app",
  "run": "nightly",
  "recordings": [
    { "path": "...", "mode": "terminal", "duration": 800, "label": "python", "exitCode": 0 },
    { "path": "...", "mode": "terminal", "duration": 1200, "label": "go", "exitCode": 1 },
    { "path": "...", "mode": "terminal", "duration": 3400, "label": "rust", "exitCode": 0 }
  ]
}
```

Add `"failOnError": true` at the top level to propagate exit codes; in multi-capture mode the CLI exits with the first non-zero code after emitting the full JSON.

### JSON input format

```json
{
  "action": "capture",
  "appName": "my-app",
  "proofDir": "./evidence",
  "run": "deploy-v2",
  "browser": { "viewport": { "width": 1280, "height": 720 } },
  "terminal": { "cols": 120, "rows": 30 },
  "captures": [
    {
      "command": "npm test",
      "mode": "terminal",
      "label": "tests",
      "description": "Unit tests"
    }
  ]
}
```

For a single capture, skip the `captures` array and put fields at the top level:

```json
{
  "action": "capture",
  "appName": "my-app",
  "command": "npm test",
  "mode": "terminal"
}
```

For reports:

```json
{
  "action": "report",
  "appName": "my-app",
  "proofDir": "./evidence",
  "run": "deploy-v2",
  "format": "html"
}
```

## CI examples

### GitHub Actions

```yaml
- name: Install proof
  run: curl -fsSL https://automaze.io/install/proof | sh

- name: Run tests with proof
  run: |
    proof capture --app my-app --dir ./evidence --run ${{ github.run_id }} \
      --command "pytest tests/ -v" --mode terminal --label tests

- name: Generate report
  run: proof report --app my-app --dir ./evidence --run ${{ github.run_id }}

- name: Upload evidence
  uses: actions/upload-artifact@v4
  with:
    name: proof-evidence
    path: evidence/
```

### Shell script

```bash
#!/bin/bash
APP="my-app"
RUN="$(date +%Y%m%d-%H%M)"
DIR="./evidence"

proof capture --app "$APP" --dir "$DIR" --run "$RUN" \
  --command "npm test" --mode terminal --label unit

proof capture --app "$APP" --dir "$DIR" --run "$RUN" \
  --command "npm run test:e2e" --mode terminal --label e2e

proof report --app "$APP" --dir "$DIR" --run "$RUN"

echo "Evidence saved to $DIR/$APP/*/$RUN/"
```

## Gating on results

`proof capture` exits `0` by default even when the wrapped command fails — capturing evidence is independent of the tests passing, so proof never changes a pipeline's outcome unless asked. Read each recording's `exitCode` to know whether the command passed.

To make proof exit with the wrapped command's code (pre-push hooks, CI gates), opt in:

```bash
proof capture --app my-app --command "npm test" --mode terminal --fail-on-error
# or, when you can't edit the flags:
PROOF_FAIL_ON_ERROR=1 proof capture --app my-app --command "npm test" --mode terminal
```

In JSON stdin mode set `"failOnError": true`. The CLI prints the full JSON for every capture, then exits with the first non-zero code. This supersedes the old `--command "npm test; echo $? > .status"` sentinel-file workaround.

## Error handling

Errors (bad input, missing manifest, spawn failure) are output as JSON to stderr:

```json
{ "error": "No proof.json found — run capture() first" }
```

The CLI exit code is `1` on a *proof error* and `0` on success. This is distinct from the *wrapped command's* exit code, which is reported per-recording as `exitCode` and only affects the process exit when `--fail-on-error` / `PROOF_FAIL_ON_ERROR=1` is set.

## Environment variables

| Variable | Description |
|----------|-------------|
| `PROOF_DIR` | Override default proof directory (same as `--dir`) |
| `PROOF_MODE` | Override auto-detection (`browser` or `terminal`) |
| `PROOF_FAIL_ON_ERROR` | Set to `1` to exit with the wrapped command's exit code (same as `--fail-on-error`) |
| `PROOF_TAP_LOG` | Path to Android tap log JSON (default: `/tmp/proof-android-taps.json`) |
