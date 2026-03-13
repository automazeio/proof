# SDK Plan: Python & Go

Thin, idiomatic SDKs that wrap the `proof` CLI binary. No reimplementation of capture logic -- the binary does the work, the SDKs provide a native API and handle JSON serialization.

**Key principle: `pip install automaze-proof` and `go get` are the only install steps.** No npm, no Node.js, no extra dependencies.

## Binary distribution

The proof CLI is compiled to standalone binaries using `bun build --compile`. This produces a single executable with the Bun runtime baked in -- no Node.js or Bun needed on the target machine.

### Build targets

| Platform | Binary | Size (est.) |
|----------|--------|-------------|
| `darwin-arm64` | `proof-darwin-arm64` | ~50MB |
| `darwin-x64` | `proof-darwin-x64` | ~50MB |
| `linux-x64` | `proof-linux-x64` | ~50MB |
| `linux-arm64` | `proof-linux-arm64` | ~50MB |
| `windows-x64` | `proof-windows-x64.exe` | ~50MB |

### Build command

```bash
bun build --compile --target=bun-linux-x64 ./src/cli.ts --outfile proof-linux-x64
bun build --compile --target=bun-darwin-arm64 ./src/cli.ts --outfile proof-darwin-arm64
# ... etc for each platform
```

### Where binaries live

Binaries are attached to GitHub Releases as assets. Each release tag (e.g. `v0.20260312.1`) includes all platform binaries.

The release workflow (`.github/workflows/release.yml`) builds binaries for all targets and uploads them alongside the npm publish step.

---

## Architecture

```
┌─────────────┐     JSON stdin      ┌──────────────────┐
│  Python SDK │ ──────────────────▶  │  proof binary     │
│  pip install│ ◀────────────────── │  (bundled in pip  │
└─────────────┘     JSON stdout     │   or auto-fetched)│
                                    └──────────────────┘
┌─────────────┐     JSON stdin      ┌──────────────────┐
│   Go SDK    │ ──────────────────▶  │  proof binary     │
│  go get     │ ◀────────────────── │  (auto-fetched on │
└─────────────┘     JSON stdout     │   first use)      │
                                    └──────────────────┘
```

Each SDK:
1. Locates or downloads the proof binary for the current platform
2. Spawns `proof --json` as a subprocess
3. Sends a JSON payload to stdin
4. Parses JSON response from stdout
5. Returns typed native objects

---

## Python SDK

**Package:** `automaze-proof` on PyPI
**Min version:** Python 3.9+
**Dependencies:** None (stdlib only)

### Binary bundling strategy

The pip package includes platform-specific binaries using Python's wheel platform tags. Each wheel ships the correct binary for its platform:

```
automaze_proof-0.1.0-py3-none-macosx_11_0_arm64.whl  → contains proof-darwin-arm64
automaze_proof-0.1.0-py3-none-macosx_10_9_x86_64.whl → contains proof-darwin-x64
automaze_proof-0.1.0-py3-none-manylinux_2_17_x86_64.whl → contains proof-linux-x64
automaze_proof-0.1.0-py3-none-manylinux_2_17_aarch64.whl → contains proof-linux-arm64
```

The SDK resolves the binary path at runtime:

```python
import importlib.resources
bin_path = importlib.resources.files("proof") / "bin" / "proof"
```

This is the same pattern used by `ruff`, `uv`, and `esbuild` Python packages.

### Install experience

```bash
pip install automaze-proof
```

That's it. The binary is included in the wheel. No npm, no Node.js.

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

# Multiple captures in one run
p.capture(command="pytest tests/unit/ -v", mode="terminal", label="unit")
p.capture(command="pytest tests/integration/ -v", mode="terminal", label="integration")

# Generate report
report_path = p.report()
report_paths = p.report(format=["md", "html", "archive"])
```

### pytest fixture

```python
# conftest.py
import pytest
from proof import Proof

@pytest.fixture(scope="session", autouse=True)
def proof_session():
    """Capture the entire test session as proof."""
    p = Proof(app_name="my-app", proof_dir="./evidence")
    yield p
    p.report()
```

Or for individual test capture:

```python
from proof import Proof

def test_order_creation():
    p = Proof(app_name="my-app", proof_dir="./evidence")
    recording = p.capture(
        command="pytest tests/test_orders.py -v",
        mode="terminal",
        label="orders",
    )
    assert recording.duration > 0
```

### Implementation

```python
# proof/__init__.py
import subprocess
import json
import sys
import platform
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Union, List


def _find_binary() -> str:
    """Find the bundled proof binary."""
    pkg_dir = Path(__file__).parent
    bin_name = "proof.exe" if sys.platform == "win32" else "proof"
    bin_path = pkg_dir / "bin" / bin_name
    if bin_path.exists():
        return str(bin_path)
    raise RuntimeError("proof binary not found in package. Reinstall with: pip install automaze-proof")


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

### Package structure

```
sdks/python/
├── pyproject.toml
├── build_wheels.py          # Downloads binaries from GH release, builds per-platform wheels
├── proof/
│   ├── __init__.py          # Proof class, Recording dataclass
│   ├── bin/
│   │   └── proof            # Platform-specific binary (injected at wheel build time)
│   └── py.typed             # PEP 561 marker
└── tests/
    └── test_proof.py
```

### pyproject.toml (key parts)

```toml
[project]
name = "automaze-proof"
version = "0.1.0"
description = "Capture visual evidence of test execution"
requires-python = ">=3.9"
dependencies = []

[tool.setuptools.package-data]
proof = ["bin/*"]
```

---

## Go SDK

**Module:** `github.com/automazeio/proof-go`
**Min version:** Go 1.21+
**Dependencies:** None (stdlib only)

### Binary resolution strategy

Go modules can't bundle large binaries cleanly. Instead, the Go SDK auto-downloads the correct binary on first use:

1. `proof.New()` checks `~/.proof/bin/proof-<version>` for the cached binary
2. If missing, downloads from `https://github.com/automazeio/proof/releases/download/v<version>/proof-<os>-<arch>`
3. Marks it executable, caches it
4. Subsequent calls use the cached binary instantly

The version is pinned in the Go module source so it matches the SDK release.

Fallback order:
1. `~/.proof/bin/proof-<version>` (cached download)
2. `proof` on PATH (if user installed globally via npm or has the binary)
3. Auto-download from GitHub Releases

### Install experience

```bash
go get github.com/automazeio/proof-go
```

First `proof.New()` call downloads the binary (~50MB, one time). After that it's instant.

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

    // Generate report
    reportPath, _ := p.Report(proof.ReportOptions{})
    fmt.Println(reportPath)
}
```

### go test integration

```go
package mypackage_test

import (
    "os"
    "testing"
    "github.com/automazeio/proof-go/proof"
)

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

### Implementation (key parts)

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

const version = "0.20260312.1"

func New(cfg Config) (*Proof, error) {
    bin, err := resolveBinary()
    if err != nil {
        return nil, err
    }
    return &Proof{bin: bin, config: cfg}, nil
}

func resolveBinary() (string, error) {
    // 1. Check cache
    cacheDir := filepath.Join(homeDir(), ".proof", "bin")
    cached := filepath.Join(cacheDir, fmt.Sprintf("proof-%s", version))
    if _, err := os.Stat(cached); err == nil {
        return cached, nil
    }

    // 2. Check PATH
    if bin, err := exec.LookPath("proof"); err == nil {
        return bin, nil
    }

    // 3. Download from GitHub Releases
    osName := runtime.GOOS   // "darwin", "linux", "windows"
    arch := runtime.GOARCH    // "arm64", "amd64"
    if arch == "amd64" {
        arch = "x64"
    }

    url := fmt.Sprintf(
        "https://github.com/automazeio/proof/releases/download/v%s/proof-%s-%s",
        version, osName, arch,
    )

    os.MkdirAll(cacheDir, 0755)
    if err := downloadFile(url, cached); err != nil {
        return "", fmt.Errorf("failed to download proof binary: %w\nInstall manually: npm install -g @automaze/proof", err)
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
```

### Package structure

```
sdks/go/   (or separate repo: github.com/automazeio/proof-go)
├── go.mod
├── proof.go              # Proof struct, Capture, Report, binary resolution
├── download.go           # Binary download + caching logic
└── proof_test.go
```

---

## Release workflow

### Binary build step (added to release.yml)

```yaml
- name: Build standalone binaries
  run: |
    bun build --compile --target=bun-darwin-arm64 ./src/cli.ts --outfile proof-darwin-arm64
    bun build --compile --target=bun-darwin-x64 ./src/cli.ts --outfile proof-darwin-x64
    bun build --compile --target=bun-linux-x64 ./src/cli.ts --outfile proof-linux-x64
    bun build --compile --target=bun-linux-arm64 ./src/cli.ts --outfile proof-linux-arm64

- name: Upload binaries to release
  uses: softprops/action-gh-release@v2
  with:
    tag_name: ${{ github.ref_name }}
    files: |
      proof-darwin-arm64
      proof-darwin-x64
      proof-linux-x64
      proof-linux-arm64
```

### Python wheel build

A separate workflow or script (`build_wheels.py`) that:
1. Downloads all platform binaries from the GitHub Release
2. Builds a platform-tagged wheel for each, embedding the correct binary
3. Publishes all wheels to PyPI

### Go module release

Tag `proof-go` module with the same version. The pinned `version` constant in the Go source matches the GitHub Release tag so the binary download URL resolves correctly.

---

## Scope & non-goals

**In scope:**
- Standalone binary distribution (no Node.js/npm required for end users)
- Platform-specific pip wheels with bundled binary
- Go auto-download with local caching
- Typed wrappers around `proof --json`
- Zero external dependencies in both SDKs

**Not in scope (v1):**
- Reimplementing capture/terminal/report logic natively
- Browser mode from non-JS SDKs (Playwright is Node-only)
- Windows support (can add later)
- pytest plugin (start with fixture pattern, consider plugin later)

---

## Implementation order

1. **Add `bun build --compile` to release workflow** -- produce binaries for all platforms
2. **Python SDK** -- bundled binary in pip wheels, publish to PyPI
3. **Go SDK** -- auto-download binary on first use, publish module
4. **Test both** against the same 3 eval scenarios from the skill benchmark

---

## Open questions

1. **Binary size.** `bun build --compile` produces ~50MB binaries. Acceptable for Python wheels (ruff is ~20MB, uv is ~30MB) but worth monitoring. Compression in the wheel format helps.
2. **Go download on first use.** Is a 50MB download on first `proof.New()` acceptable? Alternative: provide a `proof-go install` CLI command that users run once. But that's another install step.
3. **Version pinning.** Should the Go SDK pin to a specific proof version, or allow users to override? Pinned is safer (guaranteed compatibility), override is more flexible.
