# SDKs

The TypeScript SDK (`@automaze/proof`) is available today on [npm](https://www.npmjs.com/package/@automaze/proof).

We're working on thin SDKs for **Python**, **Go**, and **PHP** that wrap the proof CLI. These will let you call `proof.capture()` natively in your language without shelling out or managing JSON yourself.

The CLI already outputs structured JSON and accepts JSON via stdin, so you can integrate with any language today:

```bash
echo '{"action":"capture","appName":"my-app","command":"pytest tests/","mode":"terminal"}' | proof --json
```

SDKs will formalize this into idiomatic APIs for each language.

## Status

| Language | Status |
|----------|--------|
| TypeScript | Available -- [`@automaze/proof`](https://www.npmjs.com/package/@automaze/proof) |
| Python | Coming soon |
| Go | Coming soon |
| PHP | Coming soon |
