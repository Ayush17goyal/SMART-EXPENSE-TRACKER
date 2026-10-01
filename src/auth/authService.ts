import { supabase } from "../lib/supabase";

const requireClient = () => {
  if (!supabase) throw new Error("Authentication service is not configured.");
  return supabase;
};
export const authService = {
  async signUp(fullName: string, email: string, password: string) {
    return requireClient().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard`,
      },
    });
  },
  async signIn(email: string, password: string, remember: boolean) {
    localStorage.setItem("pocketwise-remember", String(remember));
    return requireClient().auth.signInWithPassword({ email, password });
  },
  async google() {
    localStorage.setItem("pocketwise-remember", "true");
    return requireClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=/dashboard`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  },
  async forgot(email: string) {
    return requireClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/reset-password`,
    });
  },
  async updatePassword(password: string) {
    return requireClient().auth.updateUser({ password });
  },
  async resend(email: string) {
    return requireClient().auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard`,
      },
    });
  },
  async signOut(scope: "local" | "global" = "local") {
    return requireClient().auth.signOut({ scope });
  },
  async deleteAccount() {
    const { data, error } = await requireClient().functions.invoke("finance", {
      body: { action: "delete-account", confirmation: "DELETE" },
    });
    if (error) throw error;
    return data;
  },
};
