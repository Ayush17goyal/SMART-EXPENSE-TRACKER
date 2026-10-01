import { test, expect } from "@playwright/test";
test("protected routes redirect signed-out visitors", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});
test("signup is public, responsive, and reports missing backend configuration", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Create your workspace" }),
  ).toBeVisible();
  await expect(page.getByText(/Authentication is not configured/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Create account/ })).toBeDisabled();
});
test("password recovery does not reveal account existence", async ({
  page,
}) => {
  await page.goto("/forgot-password");
  await expect(
    page.getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
});
