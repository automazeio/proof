# SDK Plan: Python & Go

Thin, idiomatic SDKs that wrap the `proof` CLI. No reimplementation of capture logic -- the CLI does the work, the SDKs provide a native API and handle JSON serialization.

## Architecture

```
┌─────────────┐     JSON stdin      ┌──────────┐
│  Python SDK │ ──────────────────▶  │          │
│  proof-py   │ ◀────────────────── │  proof   │
└─────────────┘     JSON stdout     │  CLI     │
                                    │  (Node)  │
┌─────────────┐     JSON stdin      │          │
│   Go SDK    │ ──────────────────▶  │          │
│  proof-go   │ ◀────────────────── │          │
└─────────────┘     JSON stdout     └──────────┘
```

Each SDK:
1. Spawns `proof --json` as a subprocess
2. Sends a JSON payload to stdin
3. Parses JSON response from stdout
4. Returns typed native objects

The CLI must be installed separately (`npm install -g @automaze/proof`). SDKs raise a clear error if it's not found on PATH.

---

## Prerequisite

Both SDKs require the proof CLI on PATH:

```bash
npm install -g @automaze/proof
```

SDKs should check for this at init time and raise a helpful error:

```
proof CLI not found. Install it with: npm install -g @automaze/proof
```

---

## Python SDK

**Package:** `automaze-proof` on PyPI
**Min version:** Python 3.9+
**Dependencies:** None (stdlib only -- `subprocess`, `json`, `dataclasses`)

### Target API

```python
from proof import Proof

p = Proof(
    app_name="my-app",
    proof_dir="./evidence",
    run="deploy-v2",
    description="Pre-deploy verification",
)

# Capture a command
recording = p.capture(
    command="pytest tests/ -v",
    mode="terminal",
    label="api-tests",
    description="API test suite",
)

print(recording.path)      # /abs/path/api-tests-143012.html
print(recording.mode)      # "terminal"
print(recording.duration)  # 4300

# Multiple captures
p.capture(command="pytest tests/unit/ -v", mode="terminal", label="unit")
p.capture(command="pytest tests/integration/ -v", mode="terminal", label="integration")

# Generate report
report_path = p.report()
report_paths = p.report(format=["md", "html", "archive"])
```

### pytest integration

A pytest plugin that auto-captures the test session:

```python
# conftest.py
import pytest
from proof import Proof

@pytest.fixture(scope="session", autouse=True)
def proof_capture(request):
    """Capture the entire test session as proof."""
    p = Proof(app_name="my-app", proof_dir="./evidence")
    yield p
    # After all tests, generate a report
    p.report()


# Or as a decorator for individual tests
from proof import capture

@capture(app_name="my-app", label="test-orders")
def test_order_creation():
    ...
```

Or a simpler CLI-based approach via pytest flags:

```bash
# Run pytest through proof (no code changes needed)
proof capture --app my-app --command "pytest tests/ -v" --mode terminal --label tests
```

### Implementation

```python
# proof/__init__.py
import subprocess
import json
import shutil
from dataclasses import dataclass
from typing import Optional


@dataclass
class Recording:
    path: str
    mode: str
    duration: int
    label: Optional[str] = None


class Proof:
    def __init__(
        self,
        app_name: str,
        proof_dir: Optional[str] = None,
        run: Optional[str] = None,
        description: Optional[str] = None,
    ):
        self._bin = shutil.which("proof")
        if not self._bin:
            raise RuntimeError(
                "proof CLI not found. Install it with: npm install -g @automaze/proof"
            )
        self._app_name = app_name
        self._proof_dir = proof_dir
        self._run = run
        self._description = description

    def capture(
        self,
        command: str,
        mode: str = "terminal",
        label: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Recording:
        payload = {
            "action": "capture",
            "appName": self._app_name,
            "command": command,
            "mode": mode,
        }
        if self._proof_dir:
            payload["proofDir"] = self._proof_dir
        if self._run:
            payload["run"] = self._run
        if label:
            payload["label"] = label
        if description:
            payload["description"] = description

        result = self._call(payload)
        rec = result["recordings"][0]
        return Recording(
            path=rec["path"],
            mode=rec["mode"],
            duration=rec["duration"],
            label=rec.get("label"),
        )

    def report(self, format=None):
        payload = {
            "action": "report",
            "appName": self._app_name,
        }
        if self._proof_dir:
            payload["proofDir"] = self._proof_dir
        if self._run:
            payload["run"] = self._run

        result = self._call(payload)
        return result["path"]

    def _call(self, payload: dict) -> dict:
        proc = subprocess.run(
            [self._bin, "--json"],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            error = json.loads(proc.stderr) if proc.stderr else {}
            raise RuntimeError(error.get("error", f"proof exited with code {proc.returncode}"))
        return json.loads(proc.stdout)
```

### File structure

```
sdks/python/
├── pyproject.toml
├── proof/
│   ├── __init__.py       # Proof class, Recording dataclass
│   └── py.typed          # PEP 561 marker
└── tests/
    └── test_proof.py
```

---

## Go SDK

**Module:** `github.com/automazeio/proof-go`
**Min version:** Go 1.21+
**Dependencies:** None (stdlib only -- `os/exec`, `encoding/json`)

### Target API

```go
package main

import (
    "fmt"
    "github.com/automazeio/proof-go/proof"
)

func main() {
    p, err := proof.New(proof.Config{
        AppName:  "my-app",
        ProofDir: "./evidence",
        Run:      "deploy-v2",
    })
    if err != nil {
        panic(err) // proof CLI not found
    }

    rec, err := p.Capture(proof.CaptureOptions{
        Command:     "go test ./... -v",
        Mode:        "terminal",
        Label:       "go-tests",
        Description: "Go test suite",
    })
    if err != nil {
        panic(err)
    }

    fmt.Println(rec.Path)     // /abs/path/go-tests-143012.html
    fmt.Println(rec.Mode)     // "terminal"
    fmt.Println(rec.Duration) // 4300
}
```

### go test integration

A `TestMain` wrapper that captures the entire test run:

```go
package mypackage_test

import (
    "os"
    "testing"
    "github.com/automazeio/proof-go/proof"
)

func TestMain(m *testing.M) {
    p, err := proof.New(proof.Config{
        AppName:  "my-app",
        ProofDir: "./evidence",
    })
    if err != nil {
        os.Exit(1)
    }

    _, err = p.Capture(proof.CaptureOptions{
        Command: "go test ./... -v",
        Mode:    "terminal",
        Label:   "tests",
    })

    code := m.Run()
    p.Report(proof.ReportOptions{})
    os.Exit(code)
}
```

Or, again, the simpler no-code approach:

```bash
proof capture --app my-app --command "go test ./... -v" --mode terminal --label tests
```

### Implementation

```go
package proof

import (
    "encoding/json"
    "fmt"
    "os/exec"
)

type Config struct {
    AppName     string
    ProofDir    string
    Run         string
    Description string
}

type CaptureOptions struct {
    Command     string
    Mode        string
    Label       string
    Description string
}

type Recording struct {
    Path     string `json:"path"`
    Mode     string `json:"mode"`
    Duration int    `json:"duration"`
    Label    string `json:"label,omitempty"`
}

type ReportOptions struct {
    Format string // "md", "html", "archive"
}

type Proof struct {
    bin    string
    config Config
}

func New(cfg Config) (*Proof, error) {
    bin, err := exec.LookPath("proof")
    if err != nil {
        return nil, fmt.Errorf("proof CLI not found. Install it with: npm install -g @automaze/proof")
    }
    return &Proof{bin: bin, config: cfg}, nil
}

func (p *Proof) Capture(opts CaptureOptions) (*Recording, error) {
    payload := map[string]interface{}{
        "action":  "capture",
        "appName": p.config.AppName,
        "command": opts.Command,
        "mode":    opts.Mode,
    }
    if p.config.ProofDir != "" {
        payload["proofDir"] = p.config.ProofDir
    }
    if p.config.Run != "" {
        payload["run"] = p.config.Run
    }
    if opts.Label != "" {
        payload["label"] = opts.Label
    }
    if opts.Description != "" {
        payload["description"] = opts.Description
    }

    var result struct {
        Recordings []Recording `json:"recordings"`
    }
    if err := p.call(payload, &result); err != nil {
        return nil, err
    }
    if len(result.Recordings) == 0 {
        return nil, fmt.Errorf("no recordings returned")
    }
    return &result.Recordings[0], nil
}

func (p *Proof) Report(opts ReportOptions) (string, error) {
    payload := map[string]interface{}{
        "action":  "report",
        "appName": p.config.AppName,
    }
    if p.config.ProofDir != "" {
        payload["proofDir"] = p.config.ProofDir
    }
    if p.config.Run != "" {
        payload["run"] = p.config.Run
    }

    var result struct {
        Path string `json:"path"`
    }
    if err := p.call(payload, &result); err != nil {
        return "", err
    }
    return result.Path, nil
}

func (p *Proof) call(payload map[string]interface{}, dest interface{}) error {
    input, err := json.Marshal(payload)
    if err != nil {
        return err
    }

    cmd := exec.Command(p.bin, "--json")
    cmd.Stdin = bytes.NewReader(input)

    out, err := cmd.Output()
    if err != nil {
        if exitErr, ok := err.(*exec.ExitError); ok {
            var errResp struct{ Error string `json:"error"` }
            json.Unmarshal(exitErr.Stderr, &errResp)
            return fmt.Errorf("proof: %s", errResp.Error)
        }
        return err
    }
    return json.Unmarshal(out, dest)
}
```

### File structure

```
sdks/go/
├── go.mod
├── proof/
│   └── proof.go          # Proof struct, Capture, Report
└── proof_test.go
```

---

## Scope & non-goals

**In scope:**
- Typed wrappers around `proof --json`
- Native error handling (exceptions in Python, error returns in Go)
- CLI binary discovery and validation
- Zero external dependencies

**Not in scope (for v1):**
- Reimplementing capture/terminal/report logic
- Browser mode from non-JS SDKs (Playwright is Node-only)
- Auto-installing the CLI
- Bundling the CLI binary

---

## Release plan

1. **Python first** -- broader audience, faster to iterate, pytest integration is the main use case
2. **Go second** -- `go test` integration, same pattern
3. Both published under the `automaze` org (PyPI: `automaze-proof`, Go: `github.com/automazeio/proof-go`)
4. Each SDK gets its own repo for clean versioning and CI

---

## Open questions

1. **pytest plugin vs fixture?** A `conftest.py` fixture is simpler and more explicit. A pytest plugin (`pytest-proof`) would auto-capture without code changes but adds complexity. Start with the fixture, consider the plugin later.
2. **Report format param in SDKs?** The CLI currently only supports `md` via the arg mode report command. JSON stdin mode would need a `format` field added. Worth doing before SDK release.
3. **Should SDKs accept `npx @automaze/proof` as fallback?** If `proof` isn't on PATH but `npx` is, the SDK could shell out via npx. Adds latency (~2s cold start) but removes the global install requirement.
