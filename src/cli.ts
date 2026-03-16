#!/usr/bin/env node
import { Proof } from "./index";
import { readFile } from "fs/promises";
import { resolve } from "path";

interface CaptureArgs {
  command?: string;
  testFile?: string;
  testName?: string;
  label?: string;
  mode?: "browser" | "terminal" | "auto";
  description?: string;
  device?: string | string[];
  viewport?: string | string[];
}

interface CliInput {
  action: "capture" | "report";
  appName: string;
  proofDir?: string;
  run?: string;
  format?: string | string[];
  browser?: { viewport?: { width: number; height: number } };
  terminal?: { cols?: number; rows?: number };
  captures?: CaptureArgs[];
  // Single capture shorthand (for simple CLI usage)
  command?: string;
  testFile?: string;
  testName?: string;
  label?: string;
  mode?: "browser" | "terminal" | "auto";
  description?: string;
  device?: string | string[];
  viewport?: string | string[];
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    printUsage();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    const pkg = JSON.parse(await readFile(resolve(__dirname, "../package.json"), "utf-8"));
    console.log(pkg.version);
    process.exit(0);
  }

  // JSON mode: read from stdin
  if (args[0] === "--json" || args[0] === "-") {
    const input = await readStdin();
    const config: CliInput = JSON.parse(input);
    await runFromConfig(config);
    return;
  }

  // CLI arg mode
  const action = args[0];
  if (action !== "capture" && action !== "report") {
    console.error(`Unknown action: ${action}. Use "capture" or "report".`);
    process.exit(1);
  }

  const parsed = parseArgs(args.slice(1));

  if (!parsed.appName) {
    console.error("--app is required");
    process.exit(1);
  }

  if (action === "capture") {
    if (!parsed.command && !parsed.testFile) {
      console.error("--command or --test-file is required for capture");
      process.exit(1);
    }

    const config: CliInput = {
      action: "capture",
      appName: parsed.appName,
      proofDir: parsed.proofDir,
      run: parsed.run,
      command: parsed.command,
      testFile: parsed.testFile,
      testName: parsed.testName,
      label: parsed.label,
      mode: parsed.mode as "browser" | "terminal" | "auto" | undefined,
      description: parsed.description,
      device: parsed.device?.includes(",") ? parsed.device.split(",") : parsed.device,
      viewport: parsed.viewport?.includes(",") ? parsed.viewport.split(",") : parsed.viewport,
    };
    await runFromConfig(config);
  } else {
    const config: CliInput = {
      action: "report",
      appName: parsed.appName,
      proofDir: parsed.proofDir,
      run: parsed.run,
      format: parsed.format?.includes(",") ? parsed.format.split(",") : parsed.format,
    };
    await runFromConfig(config);
  }
}

async function runFromConfig(config: CliInput) {
  const proof = new Proof({
    appName: config.appName,
    proofDir: config.proofDir,
    run: config.run,
    browser: config.browser,
    terminal: config.terminal,
  });

  if (config.action === "report") {
    const formatOpt = config.format as any;
    const reportResult = await proof.report(formatOpt ? { format: formatOpt } : undefined);
    const paths = Array.isArray(reportResult) ? reportResult : [reportResult];
    const result = { action: "report", paths };
    console.log(JSON.stringify(result));
    return;
  }

  // Multiple captures (JSON mode)
  const captures = config.captures ?? [
    {
      command: config.command,
      testFile: config.testFile,
      testName: config.testName,
      label: config.label,
      mode: config.mode,
      description: config.description,
      device: config.device,
      viewport: config.viewport,
    },
  ];

  const results = [];
  for (const cap of captures) {
    const result = await proof.capture({
      command: cap.command,
      testFile: cap.testFile,
      testName: cap.testName,
      label: cap.label,
      mode: cap.mode,
      description: cap.description,
      device: cap.device,
      viewport: cap.viewport,
    });
    const recordings = Array.isArray(result) ? result : [result];
    for (const recording of recordings) {
      results.push({
        path: recording.path,
        mode: recording.mode,
        duration: recording.duration,
        label: recording.label,
      });
    }
  }

  const output = {
    action: "capture",
    appName: config.appName,
    run: config.run,
    recordings: results,
  };
  console.log(JSON.stringify(output));
}

function parseArgs(args: string[]): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  const map: Record<string, string> = {
    "--app": "appName",
    "--dir": "proofDir",
    "--run": "run",
    "--command": "command",
    "--test-file": "testFile",
    "--test-name": "testName",
    "--label": "label",
    "--mode": "mode",
    "--format": "format",
    "--device": "device",
    "--viewport": "viewport",
    "--description": "description",
  };

  for (let i = 0; i < args.length; i++) {
    const key = map[args[i]];
    if (key && i + 1 < args.length) {
      result[key] = args[++i];
    }
  }
  return result;
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data));
    process.stdin.resume();
  });
}

function printUsage() {
  console.log(`@automaze/proof — capture evidence of test execution

Usage:
  proof capture --app <name> --command <cmd> [options]
  proof capture --app <name> --test-file <file> --mode browser [options]
  proof report  --app <name> [--format <fmt>] [options]
  proof --json  < config.json

Options:
  --app <name>          App name (required)
  --dir <path>          Proof directory (default: $TMPDIR/proof)
  --run <name>          Run name (default: HHMM)
  --command <cmd>       Command to run (required for terminal mode)
  --test-file <file>    Playwright test file (required for browser mode)
  --test-name <name>    Specific test name filter
  --label <label>       Artifact filename prefix
  --mode <mode>         browser | terminal | auto
  --device <name>       Playwright device (e.g. "iPhone 14", comma-separated for multiple)
  --viewport <WxH>      Custom viewport (e.g. "390x844", comma-separated for multiple)
  --format <fmt>        Report format: md | html | archive (comma-separated for multiple)
  --description <text>  Human-readable description

JSON mode:
  echo '{"action":"capture","appName":"my-app","captures":[...]}' | proof --json

Output:
  JSON to stdout with recording paths and metadata.`);
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
