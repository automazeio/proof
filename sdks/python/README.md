# automaze-proof

Python SDK for [proof](https://github.com/automazeio/proof) -- capture visual evidence of test execution.

Thin wrapper around the `proof` CLI. Requires the binary on PATH.

## Install

```bash
pip install automaze-proof
```

The `proof` binary must be installed separately:

```bash
curl -fsSL https://automaze.io/install/proof | sh
```

## Usage

```python
from proof import Proof

p = Proof(app_name="my-app", proof_dir="./evidence")

recording = p.capture(
    command="pytest tests/ -v",
    mode="terminal",
    label="unit-tests",
)

print(recording.path)      # /abs/path/unit-tests-143012.html
print(recording.duration)  # 4300

p.report()
```

### pytest fixture

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

## API

### `Proof(app_name, proof_dir=None, run=None, description=None)`

### `proof.capture(command, mode="terminal", label=None, description=None) -> Recording`

### `proof.report(format=None) -> str | list[str]`

### `Recording` (dataclass)
- `path: str`
- `mode: str`
- `duration: int`
- `label: str | None`
