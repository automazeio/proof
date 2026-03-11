# npm Publish Checklist for @varops/proof

## 1. Create the npm Organization

The package is scoped as `@varops/proof`, so you need an npm org called `varops`.

1. Go to https://www.npmjs.com/org/create
2. Create org named **varops**
3. Choose **free** (unlimited public packages) or **paid** (if you want private packages)

If you already have the org, skip this.

## 2. Login to npm

```bash
npm login
```

Verify you're logged in and part of the org:

```bash
npm whoami
npm org ls varops
```

## 3. Package Access

Scoped packages (`@varops/*`) are **private by default** on npm. To publish as public:

```bash
npm publish --access public
```

Or add to `package.json` permanently:

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

## 4. First Publish

```bash
bun run build        # tsc + bun build -> dist/
npm publish --access public
```

That's it. The `package.json` already has `"files": ["dist"]` so only the built output ships.

## 5. Verify

After publishing:

```bash
npm info @varops/proof
```

Check https://www.npmjs.com/package/@varops/proof -- the README will render as the package page.

## What's Already Configured

These are set and don't need changes:

| Field | Value | Status |
|-------|-------|--------|
| `name` | `@varops/proof` | OK |
| `version` | `0.0.1` | OK for first publish |
| `main` | `dist/index.js` | OK |
| `types` | `dist/index.d.ts` | OK |
| `exports` | `{ ".": { import, types } }` | OK |
| `files` | `["dist"]` | OK -- only dist ships |
| `license` | `MIT` | OK |
| `description` | set | OK |

## Optional: Things You Might Want to Add

These aren't blocking but are nice for the npm page:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/varopsco/proof.git"
  },
  "homepage": "https://github.com/varopsco/proof",
  "bugs": "https://github.com/varopsco/proof/issues",
  "keywords": ["proof", "evidence", "testing", "playwright", "terminal", "recording", "asciicast"],
  "author": "varops"
}
```

These make the npm page show a GitHub link, issue tracker, and help with discoverability.

## Version Bumping (for future releases)

```bash
npm version patch  # 0.0.1 -> 0.0.2
npm version minor  # 0.0.1 -> 0.1.0
npm version major  # 0.0.1 -> 1.0.0
```

Then `bun run build && npm publish`.
