import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const authStorage = {
  getItem(key: string) {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    const remember = localStorage.getItem("pocketwise-remember") === "true";
    (remember ? localStorage : sessionStorage).setItem(key, value);
    (remember ? sessionStorage : localStorage).removeItem(key);
  },
  removeItem(key: string) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: authStorage,
        },
      })
    : null;
export const isSupabaseConfigured = Boolean(supabase);
