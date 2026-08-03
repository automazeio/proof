# Proof: CLI

Use `proof` from the command line to capture terminal output and browser recordings without writing TypeScript. All output is JSON to stdout, making it easy to integrate with CI pipelines, shell scripts, and non-JS toolchains.

## Install

```bash
npm install -g @automaze/proof
# or use npx
npx @automaze/proof --help
```

## Commands

### `proof capture`

Record a terminal command or Playwright test.

```bash
# Terminal capture
proof capture --app my-app --command "pytest tests/ -v" --mode terminal

# Browser capture
proof capture --app my-app --test-file tests/checkout.spec.ts --mode browser

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

`exitCode` is the exit code of the wrapped command (`0` = success, non-zero = failure). It is always present. By default `proof capture` exits `0` even when the wrapped command fails — capturing evidence succeeded, which is distinct from the command passing. To make the CLI exit with the wrapped command's code instead, use `--fail-on-error` (see [Gating on results](#gating-on-results)).

### `proof report`

Generate a report from a previous run.

```bash
proof report --app my-app --dir ./evidence --run deploy-v2
```

Output:

```json
{
  "action": "report",
  "path": "/abs/path/report.md"
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
| `--command <cmd>` | Shell command to run | Yes (terminal mode) |
| `--test-file <file>` | Playwright test file path | Yes (browser mode) |
| `--test-name <name>` | Specific test name filter (Playwright `-g`) | No |
| `--label <label>` | Artifact filename prefix | No |
| `--mode <mode>` | `browser`, `terminal`, or `auto` | No |
| `--fail-on-error` | Exit with the wrapped command's exit code instead of `0` | No |
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

Set `"failOnError": true` at the top level of the JSON to opt into exit-code propagation. In multi-capture mode the CLI emits the full JSON for every capture, then exits with the **first** non-zero code encountered (here, `1`).

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

For a single capture, you can skip the `captures` array and put the fields at the top level:

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
  "run": "deploy-v2"
}
```

## CI examples

### GitHub Actions

```yaml
- name: Install proof
  run: npm install -g @automaze/proof

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

By default, `proof capture` exits `0` as long as the capture itself succeeded — even if the wrapped command failed its tests. This keeps proof non-intrusive: dropping it into a pipeline never changes the pipeline's pass/fail outcome.

When you want proof to *gate* on the wrapped command (a pre-push hook, a CI step that must fail when tests fail), opt in:

```bash
# Flag form
proof capture --app my-app --command "npm test" --mode terminal --fail-on-error

# Env form (useful when you can't change the command line)
PROOF_FAIL_ON_ERROR=1 proof capture --app my-app --command "npm test" --mode terminal
```

With either set, the CLI still records the run and prints the full JSON, then exits with the wrapped command's exit code. In multi-capture mode it exits with the first non-zero code encountered.

This replaces the old sentinel-file workaround (`--command "npm test; echo $? > .status"`).

## Error handling

Errors (bad input, missing manifest, spawn failure) are output as JSON to stderr:

```json
{ "error": "No proof.json found — run capture() first" }
```

The CLI exit code is `1` on a proof error and `0` on success. Note the distinction: a *proof error* (proof itself could not run) is different from the *wrapped command's* exit code, which is reported per-recording as `exitCode` and only propagated to the process exit when `--fail-on-error` / `PROOF_FAIL_ON_ERROR=1` is set.

## Environment variables

| Variable | Description |
|----------|-------------|
| `PROOF_DIR` | Override default proof directory (same as `--dir`) |
| `PROOF_MODE` | Override auto-detection (`browser` or `terminal`) |
| `PROOF_FAIL_ON_ERROR` | Set to `1` to exit with the wrapped command's exit code (same as `--fail-on-error`) |
