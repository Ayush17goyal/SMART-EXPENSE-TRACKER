import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  currency: string;
  timezone: string;
  created_at: string;
  updated_at: string;
};
type AuthState = {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
};
const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<UserProfile | null>(null),
    [isLoading, setLoading] = useState(true);
  const loadProfile = async (userId?: string) => {
    const id = userId ?? user?.id;
    if (!supabase || !id) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select(
        "id,full_name,email,avatar_url,currency,timezone,created_at,updated_at",
      )
      .eq("id", id)
      .maybeSingle();
    setProfile(data as UserProfile | null);
  };
  useEffect(() => {
    let active = true;
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client=supabase;
    const initializationTimeout = window.setTimeout(() => {
      if (active) setLoading(false);
    }, 10_000);
    client.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const current = data.session;
      const verified = current
        ? (await client.auth.getUser()).data.user
        : null;
      setSession(verified ? current : null);
      setUser(verified);
      setLoading(false);
      window.clearTimeout(initializationTimeout);
      if (verified) void loadProfile(verified.id);
    }).catch(() => {
      if (active) {
        setSession(null);
        setUser(null);
        setLoading(false);
      }
      window.clearTimeout(initializationTimeout);
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      if (next?.user) setTimeout(() => void loadProfile(next.user.id), 0);
      else setProfile(null);
      setLoading(false);
    });
    return () => {
      active = false;
      window.clearTimeout(initializationTimeout);
      data.subscription.unsubscribe();
    };
  }, []);
  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      isAuthenticated: Boolean(user && session),
      isLoading,
      refreshProfile: () => loadProfile(),
    }),
    [user, session, profile, isLoading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
