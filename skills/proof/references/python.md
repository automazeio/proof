# proof: Python SDK

Use `automaze-proof` to capture test runs from Python. Zero dependencies, requires the `proof` binary on PATH.

## Install

```bash
pip install automaze-proof
```

The binary must be installed separately:

```bash
curl -fsSL https://automaze.io/install/proof | sh
```

## Basic usage

```python
from proof import Proof

p = Proof(app_name="my-app")
p.capture(command="pytest tests/ -v", mode="terminal")
p.report()
```

## Constructor

```python
p = Proof(
    app_name="my-app",         # Required. Used in directory paths and manifest.
    proof_dir="./evidence",    # Optional. Default: system temp dir + /proof
    run="deploy-v2",           # Optional. Default: HHMM of init time.
    description="Nightly CI",  # Optional. Appears in reports.
)
```

## Capturing terminal output

```python
rec = p.capture(
    command="pytest tests/ -v",
    mode="terminal",
    label="api-tests",
    description="API integration test suite",
)

print(rec.path)      # /abs/path/api-tests-143012.html
print(rec.mode)      # "terminal"
print(rec.duration)  # 1200 (ms)
print(rec.label)     # "api-tests"
```

Works with any command: `pytest`, `go test`, `cargo test`, `npm test`, `make check`.

## Capturing browser recordings

```python
rec = p.capture(
    test_file="tests/checkout.spec.ts",
    mode="browser",
    label="checkout",
    description="User completes checkout",
)
```

Requires Playwright installed with `video: 'on'` in config.

## Multiple captures

```python
p = Proof(app_name="my-app", proof_dir="./evidence", run="full-suite")

p.capture(command="pytest tests/unit/", mode="terminal", label="unit")
p.capture(command="pytest tests/api/", mode="terminal", label="api")
p.capture(command="npm run lint", mode="terminal", label="lint")

p.report()
```

## Reports

```python
# Default: markdown
path = p.report()

# Specific format
path = p.report(format="html")

# Self-contained archive
path = p.report(format="archive")
```

## pytest integration

### Session-scoped fixture

```python
# conftest.py
import pytest
from proof import Proof

@pytest.fixture(scope="session", autouse=True)
def proof_session(tmp_path_factory):
    evidence_dir = str(tmp_path_factory.mktemp("evidence"))
    p = Proof(app_name="my-service", proof_dir=evidence_dir)
    yield p
    p.report()
```

### Recording specific test suites

```python
def test_main(proof_session):
    proof_session.capture(
        command="pytest tests/unit/ -v",
        mode="terminal",
        label="unit-tests",
    )
```

## Types

```python
@dataclass
class Recording:
    path: str           # Absolute path to artifact
    mode: str           # "terminal" or "browser"
    duration: int       # Duration in milliseconds
    label: str | None   # Filename prefix
```

## Capture options

```python
p.capture(
    command="...",        # Shell command (required for terminal mode)
    test_file="...",      # Playwright test file (required for browser mode)
    test_name="...",      # Optional: Playwright -g filter
    label="...",          # Optional: filename prefix
    mode="terminal",      # Optional: "browser" | "terminal" | "auto"
    description="...",    # Optional: stored in manifest
)
```

## Error handling

```python
from proof import Proof

p = Proof(app_name="my-app")

# Missing binary
try:
    p.capture(command="echo hi", mode="terminal")
except RuntimeError as e:
    print(e)  # "proof CLI not found on PATH. Install it: ..."

# CLI error
try:
    p.capture(mode="terminal")  # missing command
except RuntimeError as e:
    print(e)  # error from proof CLI

# Report before capture
try:
    p.report()
except RuntimeError as e:
    print(e)  # "No proof.json found"
```

If a captured command exits non-zero, proof still records the output and returns the recording.
