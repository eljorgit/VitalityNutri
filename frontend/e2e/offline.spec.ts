import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./test-helpers";

test.describe("Offline PWA Flow", () => {
  test("displays offline notification badge when offline", async ({ page, context }) => {
    await setupApiMocks(page);
    await page.goto("/calendar");

    // Go offline
    await context.setOffline(true);

    // Trigger offline event in page context to notify listeners
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // Check that offline banner appears
    await expect(page.getByTestId("offline-banner")).toBeVisible({ timeout: 5000 });

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });

    // Check that offline banner disappears
    await expect(page.getByTestId("offline-banner")).not.toBeVisible({ timeout: 5000 });
  });
});
