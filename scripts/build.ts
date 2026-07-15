import pkg from "../package.json";

const external = ["playwright", "playwright-core"];
const define = { __PROOF_VERSION__: JSON.stringify(pkg.version) };

const result = await Bun.build({
  entrypoints: ["./src/index.ts", "./src/cli.ts"],
  outdir: "./dist",
  target: "node",
  external,
  define,
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
