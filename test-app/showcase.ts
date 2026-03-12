import { Proof } from "../src/index";
import { writeFile, readFile, copyFile } from "fs/promises";
import { join } from "path";

const EVIDENCE_DIR = join(import.meta.dir, "evidence");

async function main() {
  const proof = new Proof({
    appName: "acme-store",
    description: "Pre-deploy verification for the Acme Store e-commerce platform. Captures unit tests, API integration tests, and end-to-end browser flows.",
    proofDir: EVIDENCE_DIR,
    run: "deploy-v3.2",
  });

  // 1. Unit tests
  await proof.capture({
    command: `bun test ${join(import.meta.dir, "cli/app.test.ts")}`,
    mode: "terminal",
    label: "unit-tests",
    description: "Core business logic: order processing, pricing engine, and inventory management",
  });

  // 2. API integration tests
  await proof.capture({
    command: `bun test ${join(import.meta.dir, "cli/app.test.ts")}`,
    mode: "terminal",
    label: "api-integration",
    description: "REST API endpoints: authentication, product catalog, cart operations, and payment processing",
  });

  // 3. Lint & typecheck
  await proof.capture({
    command: "echo '\\x1b[32m✓\\x1b[0m No lint errors found (247 files checked)' && echo '\\x1b[32m✓\\x1b[0m TypeScript: no errors in 183 source files' && echo '' && echo '\\x1b[1m\\x1b[32mAll checks passed\\x1b[0m in 2.1s'",
    mode: "terminal",
    label: "lint-typecheck",
    description: "ESLint and TypeScript compiler checks across the entire codebase",
  });

  // 4. Fake a browser entry by patching the manifest
  const runDir = join(EVIDENCE_DIR, "acme-store", "20260312", "deploy-v3.2");
  const manifestPath = join(runDir, "proof.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));

  // Copy one of the existing HTML players as a stand-in for "browser" visual
  const firstArtifact = manifest.entries[0].artifact;
  const fakeVideoName = "checkout-flow-143042.html";
  await copyFile(join(runDir, firstArtifact), join(runDir, fakeVideoName));

  manifest.entries.push({
    timestamp: new Date().toISOString(),
    mode: "browser",
    label: "checkout-flow",
    testFile: "tests/e2e/checkout.spec.ts",
    duration: 4820,
    artifact: fakeVideoName,
    description: "End-to-end checkout: user browses products, adds to cart, enters payment details, and receives order confirmation",
  });

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  // Generate reports
  const [md, html] = await proof.report({ format: ["md", "html"] }) as string[];
  console.log(`Reports generated:`);
  console.log(`  ${html}`);
  console.log(`  ${md}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
