import { test, expect } from "@playwright/test";

test("should complete payment", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("Order System");
  await page.click("#pay-btn");
  await expect(page.locator("#result")).toHaveText("Order #12345 confirmed. Thank you!");
  await expect(page.locator("#result")).toHaveClass(/success/);
});
