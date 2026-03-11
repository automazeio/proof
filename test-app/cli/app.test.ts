import { describe, test, expect } from "bun:test";
import { $ } from "bun";

describe("CLI app", () => {
  test("status command returns success", async () => {
    const result = await $`bun run ${import.meta.dir}/app.ts status`.text();
    expect(result).toContain("Server is running");
    expect(result).toContain("Errors: 0");
  });

  test("order command returns order details", async () => {
    const result = await $`bun run ${import.meta.dir}/app.ts order 999`.text();
    expect(result).toContain('"id": "999"');
    expect(result).toContain('"status": "paid"');
  });

  test("unknown command fails", async () => {
    try {
      await $`bun run ${import.meta.dir}/app.ts nope`.text();
      expect(false).toBe(true); // should not reach
    } catch (e: any) {
      expect(e.stderr?.toString()).toContain("Unknown command");
    }
  });
});
