import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema, strongPassword } from "./authValidation";

describe("authentication validation", () => {
  it("rejects malformed login email", () =>
    expect(loginSchema.safeParse({ email: "bad", password: "x" }).success).toBe(
      false,
    ));
  it("requires a strong password", () =>
    expect(strongPassword.safeParse("student123").success).toBe(false));
  it("accepts a strong password", () =>
    expect(strongPassword.safeParse("Student#2026").success).toBe(true));
  it("rejects mismatched signup passwords", () =>
    expect(
      signupSchema.safeParse({
        fullName: "Alex Student",
        email: "alex@example.com",
        password: "Student#2026",
        confirmPassword: "Student#2027",
      }).success,
    ).toBe(false));
});
