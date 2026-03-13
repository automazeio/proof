# SDKs

The TypeScript SDK (`@automaze/proof`) is available today on [npm](https://www.npmjs.com/package/@automaze/proof).

We're working on thin SDKs for **Python** and **Go** that wrap the proof CLI. These let you call `proof.capture()` natively in your language without shelling out or managing JSON yourself. See [PLAN.md](./PLAN.md) for the full design.

All SDKs require the proof CLI on PATH:

```bash
npm install -g @automaze/proof
```

In the meantime, the CLI already outputs structured JSON and accepts JSON via stdin, so you can integrate with any language today:

```bash
echo '{"action":"capture","appName":"my-app","command":"pytest tests/","mode":"terminal"}' | proof --json
```

## Status

| Language | Package | Status |
|----------|---------|--------|
| TypeScript | [`@automaze/proof`](https://www.npmjs.com/package/@automaze/proof) | Available |
| Python | `automaze-proof` | [In progress](./PLAN.md#python-sdk) |
| Go | `github.com/automazeio/proof-go` | [In progress](./PLAN.md#go-sdk) |
