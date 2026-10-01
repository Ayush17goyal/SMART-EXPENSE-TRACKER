import { useState, useEffect } from "react";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CircleHelp,
  Command,
  Compass,
  LayoutDashboard,
  Leaf,
  LockKeyhole,
  Moon,
  Plus,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Sun,
  Wallet,
  X,
} from "lucide-react";
import {
  emptyLedger,
  today,
  type Ledger,
  type Transaction,
} from "./domain/model";
import { DEMO_DATE, demoLedger } from "./domain/demo";
import {
  adapter,
  calculate,
  supabase,
  releaseWorker,
  type Mode,
} from "./data/storage";
import { EvidenceModal, Modal, readableError, type Mutate } from "./components";
import type { Evidence } from "./domain/engine";
import Today from "./views/Today";
import Transactions, { ExpenseForm } from "./views/Transactions";
import Plan from "./views/Plan";
import Explore from "./views/Explore";
import Settings from "./views/Settings";
import { ProtectedRoute, PublicOnlyRoute } from "./auth/ProtectedRoute";
import { useAuth } from "./auth/AuthProvider";
import {
  AuthCallback,
  ForgotPassword,
  Login,
  ResetPassword,
  Signup,
  VerifyEmail,
} from "./pages/AuthPages";

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnlyRoute>
            <Signup />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnlyRoute>
            <ForgotPassword />
          </PublicOnlyRoute>
        }
      />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <CloudDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function CloudDashboard() {
  localStorage.setItem("pocketwise-mode", "cloud");
  return <DashboardApp />;
}

function DashboardApp() {
  const { profile, user } = useAuth();
  const [mode, setMode] = useState<Mode>("cloud");
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    localStorage.getItem("pocketwise-theme") === "light" ? "light" : "dark",
  );
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState(false);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [help, setHelp] = useState(false);
  const [notice, setNotice] = useState("");
  const [sessionKey, setSessionKey] = useState(0);
  const nav = useNavigate(),
    client = useQueryClient();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("pocketwise-theme", theme);
  }, [theme]);
  const asOf = mode === "demo" ? DEMO_DATE : today();
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_OUT" ||
        event === "SIGNED_IN" ||
        event === "USER_UPDATED"
      ) {
        client.clear();
        setLedger(null);
        setSessionKey((v) => v + 1);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [client]);
  useEffect(() => {
    let canceled = false;
    setLedger(null);
    setError("");
    if (!mode) return;
    localStorage.setItem("pocketwise-mode", mode);
    (async () => {
      if (mode === "cloud") {
        const session = await supabase?.auth.getSession();
        if (!session?.data.session) {
          if (!canceled) nav("/login", { replace: true });
          return;
        }
      }
      const data = await adapter(mode).load();
      if (!canceled) {
        const next = data ?? emptyLedger(asOf);
        if (!data)
          next.profile.name =
            profile?.full_name || user?.user_metadata?.full_name || "Student";
        setLedger(next);
      }
    })().catch((e) => !canceled && setError(readableError(e)));
    return () => {
      canceled = true;
    };
  }, [mode, sessionKey, profile?.full_name, user?.id]);
  const analysis = useQuery({
    queryKey: ["analysis", mode, sessionKey, ledger?.revision],
    queryFn: () => calculate(ledger!, asOf, mode!),
    enabled: !!ledger && !!mode,
  });
  const mutate: Mutate = async (fn) => {
    if (!ledger || !mode || busy) return false;
    setBusy(true);
    try {
      const next = structuredClone(ledger);
      fn(next);
      const result = await adapter(mode).save(next, ledger.revision);
      setLedger(result);
      setNotice("Changes saved");
      return true;
    } catch (e) {
      setError(readableError(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(t);
  }, [notice]);
  async function choose(m: Mode) {
    setError("");
    if (m === "demo") {
      try {
        const store = adapter("demo");
        if (!(await store.load())) await store.save(demoLedger(), 0);
      } catch (e) {
        setError(readableError(e));
        return;
      }
    }
    client.clear();
    releaseWorker();
    setMode(m);
    nav("/");
  }
  function leave() {
    client.clear();
    setLedger(null);
    void supabase?.auth
      .signOut()
      .finally(() => nav("/login", { replace: true }));
  }
  const navs = [
    ["/dashboard", "Today", LayoutDashboard],
    ["/transactions", "Transactions", Wallet],
    ["/plan", "Plan", BookOpen],
    ["/explore", "Explore", Compass],
    ["/settings", "Settings", SettingsIcon],
  ] as const;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <span className="workspace-label">YOUR WORKSPACE</span>
        <nav aria-label="Main navigation">
          {navs.map(([path, label, Icon]) => (
            <NavLink key={path} to={path} end={path === "/dashboard"}>
              <Icon size={19} />
              {label}
              {label === "Explore" && <span className="nav-new">NEW</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="small-orb">
            <Leaf size={19} />
          </div>
          <h3>
            Small steps.
            <br />
            Better money habits.
          </h3>
          <p>Your next good decision starts with a little clarity.</p>
          <button onClick={() => nav("/explore")} className="text-button">
            Meet your digital twin <ArrowUpRight size={15} />
          </button>
        </div>
        <button className="sidebar-help" onClick={() => setHelp(true)}>
          <CircleHelp size={17} /> A quick guide
        </button>
        <div className="sidebar-user">
          <span className="avatar">
            {ledger?.profile.name.slice(0, 1) || "S"}
          </span>
          <div>
            <strong>{ledger?.profile.name ?? "Student"}</strong>
            <small>
              {mode === "demo"
                ? "Demo workspace"
                : mode === "local"
                  ? "Device-only workspace"
                  : "Private cloud workspace"}
            </small>
          </div>
          <LockKeyhole size={14} />
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            My workspace <span>/</span> <strong>Financial overview</strong>
          </div>
          <div className="top-actions">
            <span className="storage-badge">
              <span />
              {mode === "demo"
                ? "SYNTHETIC DEMO"
                : mode === "local"
                  ? "ON THIS DEVICE"
                  : "PRIVATE CLOUD"}
            </span>
            <button
              className="icon-button"
              aria-label="View insights"
              onClick={() => nav("/explore")}
            >
              <Bell size={18} />
            </button>
            <span className="avatar small">
              {ledger?.profile.name.slice(0, 1) || "S"}
            </span>
          </div>
        </header>
        {mode === "demo" && (
          <div className="demo-strip">
            <span>
              <Sparkles size={13} /> Demo data · September 20, 2026 · Separate
              from your finances
            </span>
            <button onClick={leave}>
              Choose workspace <ArrowRight size={13} />
            </button>
          </div>
        )}
        <main className="content">
          {error && (
            <div className="error" role="alert">
              {error}
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={15} />
              </button>
              <button
                className="text-button"
                onClick={() => setSessionKey((v) => v + 1)}
              >
                Reload data
              </button>
            </div>
          )}
          {analysis.error && (
            <div className="error" role="alert">
              {readableError(analysis.error)}
              <button onClick={() => analysis.refetch()}>Retry analysis</button>
            </div>
          )}
          {ledger && analysis.data ? (
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/dashboard"
                element={
                  <Today
                    ledger={ledger}
                    a={analysis.data}
                    onEvidence={setEvidence}
                    onAdd={() => setAdd(true)}
                    mutate={mutate}
                  />
                }
              />
              <Route
                path="/financial-health"
                element={
                  <Today
                    ledger={ledger}
                    a={analysis.data}
                    onEvidence={setEvidence}
                    onAdd={() => setAdd(true)}
                    mutate={mutate}
                  />
                }
              />
              <Route
                path="/transactions"
                element={
                  <Transactions
                    ledger={ledger}
                    asOf={asOf}
                    mutate={mutate}
                    onAdd={() => setAdd(true)}
                  />
                }
              />
              <Route
                path="/plan"
                element={
                  <Plan
                    ledger={ledger}
                    asOf={asOf}
                    a={analysis.data}
                    mutate={mutate}
                  />
                }
              />
              <Route
                path="/explore"
                element={
                  <Explore
                    ledger={ledger}
                    asOf={asOf}
                    a={analysis.data}
                    mutate={mutate}
                    onEvidence={setEvidence}
                    mode={mode}
                  />
                }
              />
              <Route
                path="/settings"
                element={
                  <Settings
                    ledger={ledger}
                    asOf={asOf}
                    mode={mode}
                    mutate={mutate}
                    onMode={choose}
                    onLeave={leave}
                    reload={() => setSessionKey((v) => v + 1)}
                  />
                }
              />
              <Route
                path="*"
                element={
                  <div className="empty">
                    <h1>Page not found</h1>
                    <button onClick={() => nav("/dashboard")}>
                      Back to Today
                    </button>
                  </div>
                }
              />
            </Routes>
          ) : (
            <div className="loading">
              <Leaf size={32} />
              <h2>Getting your financial picture ready…</h2>
              <p>Reading your records and calculating the details.</p>
              <button className="text-button" onClick={leave}>
                Choose another workspace
              </button>
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>
            <ShieldCheck size={13} /> Your numbers. Explained.
          </span>
          <span>
            INR · Asia/Kolkata <span className="footer-dot">·</span> Pocketwise
          </span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navs.map(([path, label, Icon]) => (
          <NavLink key={path} to={path} end={path === "/dashboard"}>
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      {busy && (
        <div className="saving" role="status">
          Saving…
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {add && ledger && (
        <ExpenseForm
          ledger={ledger}
          asOf={asOf}
          onClose={() => setAdd(false)}
          onSave={async (t: Transaction) => {
            if (
              await mutate((l) => {
                l.transactions.push(t);
              })
            )
              setAdd(false);
          }}
        />
      )}
      {evidence && ledger && (
        <EvidenceModal
          value={evidence}
          ledger={ledger}
          onClose={() => setEvidence(null)}
        />
      )}{" "}
      {help && (
        <Modal title="Your next good decision" onClose={() => setHelp(false)}>
          <div className="guide">
            <p>
              <b>1. Make your records useful.</b> Add expenses or import CSV.
              Confirm how complete your history is in Settings.
            </p>
            <p>
              <b>2. Define your plan.</b> Set your budget, allowance,
              commitments, and a cash checkpoint.
            </p>
            <p>
              <b>3. Understand what changed.</b> Every insight opens its dates,
              calculation, and source transactions.
            </p>
            <p>
              <b>4. Try a decision.</b> Explore compares a scenario without
              changing your real records.
            </p>
            <div className="notice">
              Device-only data stays in this browser. Export a backup regularly;
              clearing browser data removes it.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Logo() {
  return (
    <>
      <div className="logo">
        <span>
          <Command size={22} />
        </span>
        pocketwise<span className="logo-dot">.</span>
      </div>
      <ThemeToggle />
    </>
  );
}
function ThemeToggle() {
  const [light, setLight] = useState(
    () => localStorage.getItem("pocketwise-theme") === "light",
  );
  useEffect(() => {
    const theme = light ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("pocketwise-theme", theme);
  }, [light]);
  return (
    <button
      className="theme-toggle"
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      onClick={() => setLight((v) => !v)}
    >
      {light ? <Moon size={14} /> : <Sun size={14} />}{" "}
      {light ? "Dark theme" : "Light theme"}
    </button>
  );
}
