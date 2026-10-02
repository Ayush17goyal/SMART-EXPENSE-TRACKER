import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isBrowser = typeof window !== "undefined";
const memory = new Map<string, string>();

const authStorage = {
  getItem(key: string) {
    if (!isBrowser) return memory.get(key) ?? null;
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (!isBrowser) {
      memory.set(key, value);
      return;
    }
    const remember = window.localStorage.getItem("pocketwise-remember") === "true";
    (remember ? window.localStorage : window.sessionStorage).setItem(key, value);
    (remember ? window.sessionStorage : window.localStorage).removeItem(key);
  },
  removeItem(key: string) {
    if (!isBrowser) {
      memory.delete(key);
      return;
    }
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: isBrowser,
          autoRefreshToken: isBrowser,
          detectSessionInUrl: isBrowser,
          storage: authStorage,
        },
      })
    : null;
export const isSupabaseConfigured = Boolean(supabase);
