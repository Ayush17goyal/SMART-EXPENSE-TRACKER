export function authMessage(error: unknown) {
  const value = error instanceof Error ? error.message : String(error ?? "");
  const text = value.toLowerCase();
  if (text.includes("invalid login")) return "Email or password is incorrect.";
  if (text.includes("email not confirmed"))
    return "Verify your email before signing in.";
  if (text.includes("already registered") || text.includes("already exists"))
    return "Unable to create this account. Try signing in or resetting your password.";
  if (text.includes("rate") || text.includes("too many"))
    return "Too many attempts. Please wait a few minutes and try again.";
  if (text.includes("password"))
    return "The password could not be accepted. Check the requirements and try again.";
  if (text.includes("expired"))
    return "This link has expired. Request a new one.";
  if (text.includes("network") || text.includes("fetch"))
    return "We could not reach the authentication service. Check your connection and try again.";
  return "Authentication could not be completed. Please try again.";
}
