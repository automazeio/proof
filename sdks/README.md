# proof ecosystem

One CLI binary. Three ways to use it.

```
┌───────────────────────────────────────────────────────┐
│  Install                                              │
│  curl -fsSL https://automaze.io/install/proof | sh    │
│  brew install automazeio/tap/proof                    │
│  npm install -g @automaze/proof                       │
├───────────────────────────────────────────────────────┤
│  Use from any language                                │
│  TypeScript   import { Proof } from "@automaze/proof" │
│  Python       from proof import Proof                 │
│  Go           proof.New(proof.Config{...})            │
│  Any          echo '{}' | proof --json                │
└───────────────────────────────────────────────────────┘
```

## Install the binary

```bash
# macOS / Linux
curl -fsSL https://automaze.io/install/proof | sh

# Windows (PowerShell)
irm https://automaze.io/install/proof | iex

# Homebrew
brew install automazeio/tap/proof

# npm (if you already have Node.js)
npm install -g @automaze/proof
```

## SDKs

| Language | Package | Install | Docs |
|----------|---------|---------|------|
| TypeScript | [`@automaze/proof`](https://www.npmjs.com/package/@automaze/proof) | `npm install @automaze/proof` | [SDK guide](../docs/typescript.md) |
| Python | [`automaze-proof`](https://pypi.org/project/automaze-proof/) | `pip install automaze-proof` | [README](./python/README.md) |
| Go | [`proof-go`](https://github.com/automazeio/proof-go) | `go get github.com/automazeio/proof-go` | [README](https://github.com/automazeio/proof-go) |

### TypeScript

The TypeScript SDK is the primary SDK. It wraps the proof CLI directly and ships as both a library and the CLI binary via npm.

```typescript
import { Proof } from "@automaze/proof";

const proof = new Proof({ appName: "my-app", proofDir: "./evidence" });
await proof.capture({ command: "npm test", mode: "terminal", label: "tests" });
await proof.report();
```

### Python

Zero dependencies. Requires the `proof` binary on PATH.

```python
from proof import Proof

p = Proof(app_name="my-app", proof_dir="./evidence")
p.capture(command="pytest tests/ -v", mode="terminal", label="tests")
p.report()
```

pytest fixture:

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

### Go

Zero dependencies. Auto-downloads the binary from GitHub Releases if not on PATH.

```go
p, _ := proof.New(proof.Config{AppName: "my-app", ProofDir: "./evidence"})
rec, _ := p.Capture(proof.CaptureOptions{Command: "go test ./...", Mode: "terminal", Label: "tests"})
p.Report(proof.ReportOptions{})
```

### Any language

The CLI accepts JSON on stdin and outputs JSON on stdout:

```bash
echo '{"action":"capture","appName":"my-app","command":"pytest tests/","mode":"terminal"}' | proof --json
```

Build your own SDK in any language by wrapping this interface.

## Architecture

All SDKs are thin wrappers around `proof --json`. The binary does all the work -- capture, recording, report generation. SDKs handle JSON serialization and provide idiomatic APIs.

```
Your code  →  SDK (typed API)  →  proof --json (stdin)  →  proof binary  →  JSON (stdout)  →  SDK  →  Recording
```

See [PLAN.md](./PLAN.md) for implementation details.
