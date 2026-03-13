# Building an SDK for proof

This guide covers everything you need to build an SDK for proof in any language.

## How it works

SDKs are thin wrappers around the `proof` CLI binary. The binary handles all the hard work -- spawning processes, recording terminal output, managing artifacts. Your SDK just needs to:

1. Find the `proof` binary
2. Send JSON to its stdin
3. Parse JSON from its stdout
4. Return typed objects

```
Your SDK  →  spawn "proof --json"  →  write JSON to stdin  →  read JSON from stdout  →  return result
```

## JSON protocol

The CLI accepts a single JSON object on stdin and writes a single JSON object to stdout. Errors go to stderr as JSON.

### Capture

**Request:**

```json
{
  "action": "capture",
  "appName": "my-app",
  "command": "pytest tests/ -v",
  "mode": "terminal",
  "proofDir": "./evidence",
  "run": "deploy-v2",
  "label": "unit-tests",
  "description": "Unit test suite"
}
```

Required fields:
- `action` -- always `"capture"`
- `appName` -- used in directory path and manifest
- `command` -- the shell command to run (required for terminal mode)
- `mode` -- `"terminal"`, `"browser"`, or `"auto"`

Optional fields:
- `proofDir` -- where to store artifacts (default: `os.tmpdir()/proof`)
- `run` -- run identifier (default: HHMM timestamp)
- `label` -- filename prefix for the artifact
- `description` -- stored in manifest

For browser mode, use `testFile` instead of `command`:

```json
{
  "action": "capture",
  "appName": "my-app",
  "testFile": "tests/checkout.spec.ts",
  "mode": "browser",
  "testName": "should complete order"
}
```

**Response (stdout):**

```json
{
  "action": "capture",
  "appName": "my-app",
  "run": "1430",
  "recordings": [
    {
      "path": "/abs/path/unit-tests-143012.html",
      "mode": "terminal",
      "duration": 2400,
      "label": "unit-tests"
    }
  ]
}
```

### Multiple captures

Send an array of captures in one call:

```json
{
  "action": "capture",
  "appName": "my-app",
  "proofDir": "./evidence",
  "captures": [
    { "command": "pytest tests/unit/", "mode": "terminal", "label": "unit" },
    { "command": "pytest tests/api/", "mode": "terminal", "label": "api" }
  ]
}
```

Response will contain multiple entries in `recordings`.

### Report

**Request:**

```json
{
  "action": "report",
  "appName": "my-app",
  "proofDir": "./evidence",
  "run": "deploy-v2"
}
```

**Response (stdout):**

```json
{
  "action": "report",
  "path": "/abs/path/evidence/my-app/20260313/deploy-v2/report.md"
}
```

### Errors

On failure, the CLI exits with code 1 and writes JSON to stderr:

```json
{
  "error": "command not found: bad-cmd"
}
```

If stderr is not valid JSON, treat the raw string as the error message.

## What your SDK needs

### 1. Binary resolution

Find the `proof` binary. At minimum, check PATH:

```
proof_binary = which("proof")
if not found:
    raise error with install instructions
```

If you want to be extra helpful (like the Go SDK), auto-download from GitHub Releases:

1. Check PATH
2. Check `~/.proof/bin/proof-<version>` (cached download)
3. Download from `https://github.com/automazeio/proof/releases/download/v<version>/proof-<os>-<arch>`

Platform binary names:
- `proof-darwin-arm64` (macOS Apple Silicon)
- `proof-darwin-x64` (macOS Intel)
- `proof-linux-x64`
- `proof-linux-arm64`

### 2. Install error message

When the binary is missing, show all install options:

```
proof CLI not found on PATH. Install it:

  curl -fsSL https://automaze.io/install/proof | sh

  or: brew install automazeio/tap/proof
  or: npm install -g @automaze/proof
```

### 3. Types

Define these types in your language:

**Config** (constructor input):
- `app_name: string` (required)
- `proof_dir: string` (optional)
- `run: string` (optional)
- `description: string` (optional)

**CaptureOptions** (capture input):
- `command: string` (required for terminal mode)
- `test_file: string` (required for browser mode)
- `mode: string` (default: `"terminal"`)
- `label: string` (optional)
- `description: string` (optional)

**Recording** (capture output):
- `path: string`
- `mode: string`
- `duration: int` (milliseconds)
- `label: string` (optional)

**ReportOptions** (report input):
- `format: string or string[]` (optional, `"md"`, `"html"`, or `"archive"`)

### 4. The `_call` method

The core of every SDK is a single method that spawns the CLI and handles I/O:

```
function _call(payload: dict) -> dict:
    process = spawn("proof", ["--json"], stdin=PIPE, stdout=PIPE, stderr=PIPE)
    process.stdin.write(json.encode(payload))
    process.stdin.close()
    wait for process to exit

    if exit_code != 0:
        try:
            error = json.decode(process.stderr)
            raise RuntimeError(error["error"])
        catch:
            raise RuntimeError(process.stderr or "proof exited with code {exit_code}")

    return json.decode(process.stdout)
```

### 5. Field name mapping

The CLI uses camelCase. Map to your language's convention:

| CLI (JSON) | Python | Go | Ruby |
|------------|--------|----|------|
| `appName` | `app_name` | `AppName` | `app_name` |
| `proofDir` | `proof_dir` | `ProofDir` | `proof_dir` |
| `testFile` | `test_file` | `TestFile` | `test_file` |
| `testName` | `test_name` | `TestName` | `test_name` |

## Testing

### Unit tests (mock the binary)

Create a mock binary that echoes JSON responses. This lets you test without the real proof binary:

**Python:**
```python
from unittest.mock import patch, MagicMock

mock_result = MagicMock()
mock_result.returncode = 0
mock_result.stdout = '{"recordings": [{"path": "/tmp/test.html", "mode": "terminal", "duration": 100}]}'

with patch("proof.subprocess.run", return_value=mock_result):
    rec = p.capture(command="echo hi")
```

**Go:**
```go
bin := filepath.Join(t.TempDir(), "proof")
os.WriteFile(bin, []byte("#!/bin/sh\ncat <<'EOF'\n{\"recordings\":[...]}\nEOF"), 0755)
p := proof.NewWithBinary(bin, proof.Config{AppName: "test"})
```

### Integration tests (real binary)

If `proof` is on PATH, run a real capture:

```python
p = Proof(app_name="test", proof_dir=tmpdir)
rec = p.capture(command="echo hello", mode="terminal")
assert os.path.exists(rec.path)
assert rec.duration > 0
```

## Checklist

Before publishing your SDK:

- [ ] Binary found on PATH (or auto-downloaded)
- [ ] Clear error message with install instructions when binary missing
- [ ] `capture()` sends correct JSON, returns typed Recording
- [ ] `report()` sends correct JSON, returns path
- [ ] CLI errors (exit code 1) surface as exceptions/errors
- [ ] Non-JSON stderr handled gracefully
- [ ] Field names mapped to language conventions
- [ ] Zero external dependencies (stdlib only)
- [ ] Tests pass without the real binary installed
- [ ] Version matches the proof CLI version

## Reference implementations

- **Python** -- [`sdks/python/`](./python/) -- simplest example, 120 lines
- **Go** -- [`github.com/automazeio/proof-go`](https://github.com/automazeio/proof-go) -- includes auto-download
- **TypeScript** -- [`src/`](../src/) -- the CLI itself, also usable as a library
