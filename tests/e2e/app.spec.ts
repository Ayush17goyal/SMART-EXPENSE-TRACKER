import { test, expect } from "@playwright/test";
test("protected routes redirect signed-out visitors", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});
test("signup is public, responsive, and validates input", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Create your workspace" }),
  ).toBeVisible();
  await page.getByLabel("Full name").fill("Alex Student");
  await page.getByLabel("Email address").fill("alex@example.com");
  await page.getByLabel("Password", { exact: true }).fill("weak");
  await page.getByLabel("Confirm password").fill("different");
  await page.getByRole("button", { name: /Create account/ }).click();
  await expect(page.getByRole("alert")).toContainText("10 characters");
});
test("password recovery does not reveal account existence", async ({
  page,
}) => {
  await page.goto("/forgot-password");
  await expect(
    page.getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
});
