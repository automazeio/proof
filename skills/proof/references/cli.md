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
      "label": "unit-tests"
    }
  ]
}
```

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
    { "path": "...", "mode": "terminal", "duration": 800, "label": "python" },
    { "path": "...", "mode": "terminal", "duration": 1200, "label": "go" },
    { "path": "...", "mode": "terminal", "duration": 3400, "label": "rust" }
  ]
}
```

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

## Error handling

Errors are output as JSON to stderr:

```json
{ "error": "No proof.json found — run capture() first" }
```

The exit code is `1` on error, `0` on success.

## Environment variables

| Variable | Description |
|----------|-------------|
| `PROOF_DIR` | Override default proof directory (same as `--dir`) |
| `PROOF_MODE` | Override auto-detection (`browser` or `terminal`) |
