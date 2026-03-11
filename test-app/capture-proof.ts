import { Proof } from "../src/index";
import { join } from "path";
import { spawn } from "child_process";

const EVIDENCE_DIR = join(import.meta.dir, "evidence");

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Terminal mode proof ---
async function captureCliProof() {
  console.log("\n--- Capturing CLI proof (terminal mode) ---\n");

  const proof = new Proof({
    repo: "varopsco/proof",
    mode: "terminal",
    workDir: EVIDENCE_DIR,
  });

  const recording = await proof.capture({
    testFile: join(import.meta.dir, "cli/app.test.ts"),
    label: "cli-tests",
  });

  console.log(`Terminal recording: ${recording.path}`);
  console.log(`Duration: ${recording.duration}ms`);
  console.log(`Mode: ${recording.mode}`);
  return recording;
}

// --- Visual mode proof ---
async function captureWebProof() {
  console.log("\n--- Capturing Web proof (visual mode) ---\n");

  // Start a simple HTTP server for the test app
  const server = Bun.serve({
    port: 3456,
    async fetch(req) {
      const html = await Bun.file(join(import.meta.dir, "web/index.html")).text();
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    },
  });

  console.log("Test server running on http://localhost:3456");

  try {
    const proof = new Proof({
      repo: "varopsco/proof",
      mode: "visual",
      workDir: EVIDENCE_DIR,
      visual: { viewport: { width: 1280, height: 720 } },
    });

    const recording = await proof.capture({
      testFile: join(import.meta.dir, "web/orders.spec.ts"),
      label: "web-payment",
    });

    console.log(`Visual recording: ${recording.path}`);
    console.log(`Duration: ${recording.duration}ms`);
    console.log(`Mode: ${recording.mode}`);
    return recording;
  } finally {
    server.stop();
  }
}

// --- Run both ---
async function main() {
  console.log("=== @varops/proof — Test Evidence ===\n");

  const cliResult = await captureCliProof();
  const webResult = await captureWebProof();

  // List all runs
  const proof = new Proof({
    repo: "varopsco/proof",
    workDir: EVIDENCE_DIR,
  });

  const runs = await proof.listRuns();
  console.log("\n--- All runs ---");
  for (const run of runs) {
    console.log(`  ${run.id}: ${run.files.join(", ")} (${(run.sizeBytes / 1024).toFixed(1)}KB)`);
  }

  console.log("\n=== Done. Evidence captured. ===");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
