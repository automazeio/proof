# SDKs

Thin, idiomatic SDKs that wrap the proof CLI binary. All SDKs require the `proof` binary on PATH.

## Install the binary

```bash
# macOS / Linux
curl -fsSL https://automaze.io/install/proof | sh

# Windows (PowerShell)
irm https://automaze.io/install/proof | iex

# Homebrew
brew install automazeio/tap/proof

# Node.js users
npm install -g @automaze/proof
```

## SDKs

| Language | Package | Status |
|----------|---------|--------|
| TypeScript | [`@automaze/proof`](https://www.npmjs.com/package/@automaze/proof) | Available |
| Python | `automaze-proof` | Planned |
| Go | `github.com/automazeio/proof-go` | Planned |

SDKs expect `proof` on PATH and raise a clear error with install instructions if missing. See [PLAN.md](./PLAN.md) for the full design.

You can integrate with any language today using the CLI's JSON interface:

```bash
echo '{"action":"capture","appName":"my-app","command":"pytest tests/","mode":"terminal"}' | proof --json
```
