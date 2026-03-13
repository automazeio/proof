# Distribution Plan

Three layers, separated concerns:

```
┌──────────────────────────────────────────────────────┐
│  Install methods (get the binary on PATH)             │
│  brew install automazeio/tap/proof                    │
│  curl -fsSL https://proof.automazeio.com/install | sh │
│  irm https://proof.automazeio.com/install | iex       │
│  npm install -g @automaze/proof                       │
├──────────────────────────────────────────────────────┤
│  proof binary (standalone, no runtime needed)         │
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

## 1. Binary

`bun build --compile` produces a standalone executable (~50MB) with the Bun runtime baked in. No Node.js or Bun needed on the target machine.

### Build targets

| Platform | Binary name |
|----------|-------------|
| macOS arm64 | `proof-darwin-arm64` |
| macOS x64 | `proof-darwin-x64` |
| Linux x64 | `proof-linux-x64` |
| Linux arm64 | `proof-linux-arm64` |
| Windows x64 | `proof-windows-x64.exe` |

### Release workflow

The existing `release.yml` is extended to:
1. Build binaries for all targets using `bun build --compile`
2. Create a GitHub Release with all binaries attached
3. Publish to npm (existing behavior)

---

## 2. Install methods

### Homebrew (macOS/Linux)

One tap repo for the automaze org: `automazeio/homebrew-tap`. Houses formulas for all automaze tools.

```bash
brew install automazeio/tap/proof
```

The formula downloads the right binary from GitHub Releases based on OS/arch. A separate repo (`automazeio/homebrew-tap`) with `Formula/proof.rb`.

### curl (macOS/Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/automazeio/proof/main/install.sh | sh
```

Detects OS/arch, downloads binary from GitHub Releases, installs to `~/.local/bin` (or `/usr/local/bin` if root), updates PATH.

### PowerShell (Windows)

```powershell
irm https://raw.githubusercontent.com/automazeio/proof/main/install.ps1 | iex
```

Same approach: detects arch, downloads binary, installs to `%LOCALAPPDATA%\proof\bin`, updates user PATH.

### npm (JS/TS devs)

```bash
npm install -g @automaze/proof
```

Existing behavior, unchanged. For devs who already have Node.js.

---

## 3. SDKs

SDKs are thin wrappers. They do NOT bundle the binary. They expect `proof` on PATH and raise a clear error with install instructions if missing.

### Python SDK

**Package:** `automaze-proof` on PyPI
**Dependencies:** None (stdlib only)

```python
from proof import Proof

p = Proof(app_name="my-app", proof_dir="./evidence")
recording = p.capture(command="pytest tests/ -v", mode="terminal", label="tests")
p.report()
```

Binary resolution order:
1. `proof` on PATH
2. Error with install instructions

### Go SDK

**Module:** `github.com/automazeio/proof-go`
**Dependencies:** None (stdlib only)

```go
p, _ := proof.New(proof.Config{AppName: "my-app", ProofDir: "./evidence"})
rec, _ := p.Capture(proof.CaptureOptions{Command: "go test ./...", Mode: "terminal"})
p.Report(proof.ReportOptions{})
```

Binary resolution order:
1. `proof` on PATH
2. `~/.proof/bin/proof` (auto-downloaded from GitHub Releases, cached)
3. Error with install instructions

Go auto-downloads because Go devs are less likely to have npm/brew for a testing tool. One-time ~50MB download, transparent after that.

---

## Implementation order

1. Update `release.yml` to build binaries and create GitHub Release
2. Create `install.sh` in the proof repo
3. Create `install.ps1` in the proof repo
4. Create `automazeio/homebrew-tap` repo with `Formula/proof.rb`
5. Python SDK (separate repo or `sdks/python/`)
6. Go SDK (separate repo `automazeio/proof-go`)
