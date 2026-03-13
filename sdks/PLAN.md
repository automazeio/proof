# Distribution Plan

Three layers, separated concerns:

```
┌──────────────────────────────────────────────────────┐
│  Install methods (get the binary on PATH)             │
│  curl -fsSL https://automaze.io/install/proof | sh    │
│  irm https://automaze.io/install/proof | iex          │
│  brew install automazeio/tap/proof                    │
│  npm install -g @automaze/proof                       │
├──────────────────────────────────────────────────────┤
│  proof binary (standalone, ~100MB, no runtime needed) │
│  Built with: bun build --compile                      │
│  Hosted on: GitHub Releases                           │
├──────────────────────────────────────────────────────┤
│  SDKs (thin wrappers, expect binary on PATH)          │
│  Python: pip install automaze-proof                    │
│  Go:     go get github.com/automazeio/proof-go        │
│  TS:     npm install @automaze/proof                   │
└──────────────────────────────────────────────────────┘
```

---

## 1. Binary ✅

`bun build --compile` produces standalone executables (~100MB) with the Bun runtime baked in. No Node.js or Bun needed on the target machine.

### Build targets (shipped)

| Platform | Binary name | Status |
|----------|-------------|--------|
| macOS arm64 | `proof-darwin-arm64` | ✅ |
| macOS x64 | `proof-darwin-x64` | ✅ |
| Linux x64 | `proof-linux-x64` | ✅ |
| Linux arm64 | `proof-linux-arm64` | ✅ |
| Windows x64 | `proof-windows-x64.exe` | Planned |

### Release workflow (shipped)

`.github/workflows/release.yml` triggers on `v*` tags:
1. Builds binaries for all targets using `bun build --compile` (parallel matrix)
2. Creates GitHub Release with all binaries attached
3. Publishes to npm with OIDC trusted publishing

---

## 2. Install methods ✅

### curl (macOS/Linux) ✅

```bash
curl -fsSL https://automaze.io/install/proof | sh
```

`install/install.sh` -- POSIX-compatible, detects OS/arch, downloads binary from GitHub Releases, installs to `~/.local/bin` (or `/usr/local/bin` if root), updates PATH.

### PowerShell (Windows) ✅

```powershell
irm https://automaze.io/install/proof | iex
```

`install/install.ps1` -- detects arch, downloads binary, installs to `%LOCALAPPDATA%\proof\bin`, updates user PATH.

### Homebrew ✅

```bash
brew install automazeio/tap/proof
```

`automazeio/homebrew-tap` repo with `Formula/proof.rb`. Downloads `install.sh` and runs it, then moves the binary into Homebrew's `bin/` for proper `brew uninstall` support.

### npm ✅

```bash
npm install -g @automaze/proof
```

For JS/TS devs who already have Node.js.

---

## 3. SDKs

SDKs are thin wrappers around `proof --json`. They do NOT bundle the binary. They expect `proof` on PATH and raise a clear error with install instructions if missing.

### Python SDK

**Package:** `automaze-proof` on PyPI
**Repo:** `sdks/python/` (or separate repo `automazeio/proof-python`)
**Min version:** Python 3.9+
**Dependencies:** None (stdlib only -- `subprocess`, `json`, `dataclasses`)

#### Target API

```python
from proof import Proof

p = Proof(
    app_name="my-app",
    proof_dir="./evidence",
    run="deploy-v2",
    description="Pre-deploy verification",
)

recording = p.capture(
    command="pytest tests/ -v",
    mode="terminal",
    label="api-tests",
    description="API test suite",
)

print(recording.path)      # /abs/path/api-tests-143012.html
print(recording.mode)      # "terminal"
print(recording.duration)  # 4300

# Multiple captures in one run
p.capture(command="pytest tests/unit/ -v", label="unit")
p.capture(command="pytest tests/integration/ -v", label="integration")

# Generate report
report_path = p.report()
report_paths = p.report(format=["md", "html", "archive"])
```

#### pytest fixture

```python
# conftest.py
import pytest
from proof import Proof

@pytest.fixture(scope="session", autouse=True)
def proof_session():
    p = Proof(app_name="my-app", proof_dir="./evidence")
    yield p
    p.report()
```

#### Implementation

```python
import subprocess
import json
import shutil
from dataclasses import dataclass
from typing import Optional, Union, List

INSTALL_HELP = """proof CLI not found on PATH. Install it:

  curl -fsSL https://automaze.io/install/proof | sh

  or: brew install automazeio/tap/proof
  or: npm install -g @automaze/proof
"""


def _find_binary() -> str:
    bin = shutil.which("proof")
    if not bin:
        raise RuntimeError(INSTALL_HELP)
    return bin


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
        self._bin = _find_binary()
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

    def report(
        self,
        format: Optional[Union[str, List[str]]] = None,
    ) -> Union[str, List[str]]:
        payload = {
            "action": "report",
            "appName": self._app_name,
        }
        if self._proof_dir:
            payload["proofDir"] = self._proof_dir
        if self._run:
            payload["run"] = self._run
        if format:
            payload["format"] = format

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
            try:
                error = json.loads(proc.stderr)
                msg = error.get("error", proc.stderr)
            except json.JSONDecodeError:
                msg = proc.stderr or f"proof exited with code {proc.returncode}"
            raise RuntimeError(msg)
        return json.loads(proc.stdout)
```

#### Package structure

```
sdks/python/
├── pyproject.toml
├── proof/
│   ├── __init__.py     # Proof class, Recording dataclass
│   └── py.typed        # PEP 561 marker
└── tests/
    └── test_proof.py
```

#### pyproject.toml

```toml
[project]
name = "automaze-proof"
version = "0.1.0"
description = "Capture visual evidence of test execution"
requires-python = ">=3.9"
dependencies = []
license = "Apache-2.0"

[project.urls]
Homepage = "https://github.com/automazeio/proof"
```

---

### Go SDK

**Module:** `github.com/automazeio/proof-go`
**Min version:** Go 1.21+
**Dependencies:** None (stdlib only -- `os/exec`, `encoding/json`)

#### Binary resolution

Go devs are less likely to have brew/npm. The Go SDK auto-downloads the binary on first use:

1. `proof` on PATH -- use it
2. `~/.proof/bin/proof-<version>` -- cached from previous download
3. Download from GitHub Releases, cache locally

One-time ~100MB download, transparent after that.

#### Target API

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
        panic(err)
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

    reportPath, _ := p.Report(proof.ReportOptions{})
    fmt.Println(reportPath)
}
```

#### go test integration

```go
func TestMain(m *testing.M) {
    p, _ := proof.New(proof.Config{
        AppName:  "my-service",
        ProofDir: "./evidence",
    })

    p.Capture(proof.CaptureOptions{
        Command: "go test ./... -v -count=1",
        Mode:    "terminal",
        Label:   "all-tests",
    })

    code := m.Run()
    p.Report(proof.ReportOptions{})
    os.Exit(code)
}
```

#### Implementation

```go
package proof

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
    "os/exec"
    "path/filepath"
    "runtime"
)

const version = "0.20260313.0"

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
    Format string
}

type Proof struct {
    bin    string
    config Config
}

func New(cfg Config) (*Proof, error) {
    bin, err := resolveBinary()
    if err != nil {
        return nil, err
    }
    return &Proof{bin: bin, config: cfg}, nil
}

func resolveBinary() (string, error) {
    // 1. Check PATH
    if bin, err := exec.LookPath("proof"); err == nil {
        return bin, nil
    }

    // 2. Check cache
    home, _ := os.UserHomeDir()
    cacheDir := filepath.Join(home, ".proof", "bin")
    cached := filepath.Join(cacheDir, fmt.Sprintf("proof-%s", version))
    if _, err := os.Stat(cached); err == nil {
        return cached, nil
    }

    // 3. Download from GitHub Releases
    osName := runtime.GOOS
    arch := runtime.GOARCH
    if arch == "amd64" {
        arch = "x64"
    }

    url := fmt.Sprintf(
        "https://github.com/automazeio/proof/releases/download/v%s/proof-%s-%s",
        version, osName, arch,
    )

    os.MkdirAll(cacheDir, 0755)
    if err := downloadFile(url, cached); err != nil {
        return "", fmt.Errorf(
            "proof binary not found. Install it:\n\n"+
                "  curl -fsSL https://automaze.io/install/proof | sh\n\n"+
                "  or: brew install automazeio/tap/proof\n"+
                "  or: go to https://github.com/automazeio/proof/releases\n\n"+
                "Auto-download failed: %w", err,
        )
    }
    os.Chmod(cached, 0755)
    return cached, nil
}

func downloadFile(url, dest string) error {
    resp, err := http.Get(url)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    if resp.StatusCode != 200 {
        return fmt.Errorf("HTTP %d from %s", resp.StatusCode, url)
    }
    f, err := os.Create(dest)
    if err != nil {
        return err
    }
    defer f.Close()
    _, err = io.Copy(f, resp.Body)
    return err
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
            var errResp struct {
                Error string `json:"error"`
            }
            json.Unmarshal(exitErr.Stderr, &errResp)
            return fmt.Errorf("proof: %s", errResp.Error)
        }
        return err
    }
    return json.Unmarshal(out, dest)
}
```

#### Package structure

```
github.com/automazeio/proof-go/
├── go.mod
├── proof/
│   ├── proof.go        # Proof struct, Capture, Report
│   └── download.go     # Binary resolution + caching
└── proof_test.go
```

---

## Implementation order

1. ~~Update `release.yml` to build binaries and create GitHub Release~~ ✅
2. ~~Create `install/install.sh`~~ ✅
3. ~~Create `install/install.ps1`~~ ✅
4. ~~Create `automazeio/homebrew-tap` repo with `Formula/proof.rb`~~ ✅
5. **Python SDK** -- `sdks/python/`, publish to PyPI as `automaze-proof`
6. **Go SDK** -- separate repo `automazeio/proof-go`, publish module
