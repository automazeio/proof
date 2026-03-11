const args = process.argv.slice(2);
const command = args[0];

if (command === "status") {
  console.log("\x1b[32m✓\x1b[0m Server is running");
  console.log(`  Uptime: 4h 23m`);
  console.log(`  Requests: 12,847`);
  console.log(`  Errors: 0`);
  process.exit(0);
}

if (command === "order") {
  const orderId = args[1] ?? "12345";
  console.log(`\x1b[36mFetching order ${orderId}...\x1b[0m`);
  console.log(JSON.stringify({ id: orderId, status: "paid", total: "$42.00" }, null, 2));
  process.exit(0);
}

console.error(`\x1b[31mUnknown command: ${command}\x1b[0m`);
console.error("Usage: bun run app.ts <status|order> [id]");
process.exit(1);
