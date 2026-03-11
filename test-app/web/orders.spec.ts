import { test, expect } from "@playwright/test";
import { getCursorHighlightScript } from "../../src/modes/visual";

test("should complete payment", async ({ page }) => {
  await page.addInitScript(getCursorHighlightScript());
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("Order System");

  // Use evaluate to position cursor since CDP mouse events bypass DOM listeners
  const btn = page.locator("#pay-btn");
  const box = await btn.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.evaluate(({ x, y }) => {
      const c = document.getElementById("__proof_cursor");
      if (c) { c.style.left = x + "px"; c.style.top = y + "px"; c.style.display = "block"; }
    }, { x: cx, y: cy });
    await page.waitForTimeout(400);
    await page.evaluate(({ x, y }) => {
      const c = document.getElementById("__proof_cursor");
      if (c) { c.style.left = x + "px"; c.style.top = y + "px"; c.style.display = "block"; }
      // Click ripple
      const r = document.createElement("div");
      r.style.cssText = "position:fixed;pointer-events:none;z-index:2147483646;border-radius:50%;border:3px solid rgba(255,50,50,0.7);width:10px;height:10px;left:" + x + "px;top:" + y + "px;transform:translate(-50%,-50%) scale(1);opacity:1;transition:transform 0.5s ease-out,opacity 0.5s ease-out";
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = "translate(-50%,-50%) scale(5)"; r.style.opacity = "0"; });
      setTimeout(() => r.remove(), 600);
    }, { x: cx, y: cy });
  }
  await btn.click();
  await page.waitForTimeout(500);

  await expect(page.locator("#result")).toHaveText("Order #12345 confirmed. Thank you!");
  await expect(page.locator("#result")).toHaveClass(/success/);
  await page.waitForTimeout(500);
});
