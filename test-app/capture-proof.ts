import { Proof } from "../src/index";
import { join } from "path";

const EVIDENCE_DIR = join(import.meta.dir, "evidence");

async function main() {
  console.log("=== @varops/proof — Test Evidence ===\n");

  const proof = new Proof({
    appName: "proof-test",
    proofDir: EVIDENCE_DIR,
    run: "demo",
    browser: { viewport: { width: 1280, height: 720 } },
  });

  // --- Terminal capture ---
  console.log("--- Capturing CLI proof (terminal mode) ---\n");

  const cliResult = await proof.capture({
    command: `bun test ${join(import.meta.dir, "cli/app.test.ts")}`,
    mode: "terminal",
    label: "cli-tests",
    description: "CLI app: status, order, and error handling tests",
  });

  console.log(`Terminal recording: ${cliResult.path}`);
  console.log(`Duration: ${cliResult.duration}ms\n`);

  // --- Browser capture ---
  console.log("--- Capturing Web proof (browser mode) ---\n");

  const server = Bun.serve({
    port: 3456,
    async fetch() {
      const html = await Bun.file(join(import.meta.dir, "web/index.html")).text();
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    },
  });

  console.log("Test server running on http://localhost:3456");

  try {
    const webResult = await proof.capture({
      testFile: join(import.meta.dir, "web/orders.spec.ts"),
      mode: "browser",
      label: "web-payment",
      description: "User clicks Pay Now, order confirmation appears",
    });

    console.log(`Browser recording: ${webResult.path}`);
    console.log(`Duration: ${webResult.duration}ms\n`);
  } finally {
    server.stop();
  }

  // --- Generate report ---
  const reportPath = await proof.report();
  console.log(`Report: ${reportPath}`);

  console.log("\n=== Done. ===");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
