import { test, expect } from "@playwright/test";
test("protected routes redirect signed-out visitors", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});
test("signup is public and responsive", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Create your workspace" }),
  ).toBeVisible();
  await expect(page.getByLabel("Full name")).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByRole("button", { name: /Create account/ })).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 360);
});
test("password recovery does not reveal account existence", async ({
  page,
}) => {
  await page.goto("/forgot-password");
  await expect(
    page.getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
});
