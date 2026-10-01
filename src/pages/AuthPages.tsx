import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { authService } from "../auth/authService";
import { authMessage } from "../auth/authErrors";
import {
  loginSchema,
  signupSchema,
  strongPassword,
} from "../auth/authValidation";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

function Layout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-brand">
        <Link to="/" className="auth-logo" aria-label="PocketWise home">
          <img src="/pocketwise-logo.png" alt="PocketWise" />
        </Link>
        <div>
          <span className="auth-kicker">STUDENT FINANCIAL INTELLIGENCE</span>
          <h1>Make tomorrow's money decisions with clarity.</h1>
          <p>
            Your private financial command center explains what changed, what
            may happen next, and what you can do about it.
          </p>
          <div className="auth-trust">
            <ShieldCheck size={18} />
            <span>
              Encrypted sessions
              <br />
              <small>
                Your financial records stay isolated to your account.
              </small>
            </span>
          </div>
        </div>
        <small>INR · Asia/Kolkata · Private by design</small>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-head">
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          {!isSupabaseConfigured && (
            <Message kind="info">
              Authentication is not configured on this installation. Add the
              Supabase project URL and anonymous key to <code>.env.local</code>,
              then restart the server.
            </Message>
          )}
          {children}
        </div>
      </section>
    </main>
  );
}
function Message({
  kind = "error",
  children,
}: {
  kind?: "error" | "success" | "info";
  children: ReactNode;
}) {
  return (
    <div
      className={`auth-message ${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
function Password({
  value,
  onChange,
  label = "Password",
  name = "password",
  autoComplete = "current-password",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  name?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label>
      {label}
      <span className="password-field">
        <LockKeyhole size={17} />
        <input
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}
function GoogleButton({
  busy,
  setBusy,
  setError,
}: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
}) {
  return (
    <button
      className="google-button"
      disabled={busy || !isSupabaseConfigured}
      onClick={async () => {
        setBusy(true);
        try {
          const { error } = await authService.google();
          if (error) setError(authMessage(error));
        } catch (error) {
          setError(authMessage(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <span>G</span> Continue with Google
    </button>
  );
}

export function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [remember, setRemember] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const nav = useNavigate(),
    location = useLocation();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await authService.signIn(
        parsed.data.email,
        parsed.data.password,
        remember,
      );
      if (error) throw error;
      if (!data.user?.email_confirmed_at) {
        await authService.signOut();
        nav(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      nav((location.state as { from?: string })?.from ?? "/dashboard", {
        replace: true,
      });
    } catch (error) {
      setError(authMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Layout
      title="Welcome back"
      subtitle="Sign in to continue to your financial workspace."
    >
      <form className="auth-form" onSubmit={submit}>
        <label>
          Email address
          <span className="field">
            <Mail size={17} />
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </span>
        </label>
        <Password value={password} onChange={setPassword} />
        <div className="auth-row">
          <label className="auth-check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Remember me
          </label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        {error && <Message>{error}</Message>}
        <button
          className="auth-submit"
          disabled={busy || !isSupabaseConfigured}
        >
          {busy ? (
            <>
              <span className="auth-spinner" />
              Signing in…
            </>
          ) : (
            <>
              Sign in <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>
      <div className="auth-divider">
        <span>or</span>
      </div>
      <GoogleButton busy={busy} setBusy={setBusy} setError={setError} />
      <p className="auth-switch">
        New to Pocketwise? <Link to="/signup">Create an account</Link>
      </p>
    </Layout>
  );
}

export function Signup() {
  const [fullName, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const nav = useNavigate();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = signupSchema.safeParse({
      fullName,
      email,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { data, error } = await authService.signUp(
      parsed.data.fullName,
      parsed.data.email,
      parsed.data.password,
    );
    setBusy(false);
    if (error) {
      setError(authMessage(error));
      return;
    }
    if (data.session) nav("/dashboard", { replace: true });
    else
      nav(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`, {
        replace: true,
      });
  }
  return (
    <Layout
      title="Create your workspace"
      subtitle="Start with an account that belongs only to you."
    >
      <form className="auth-form" onSubmit={submit}>
        <label>
          Full name
          <span className="field">
            <span className="field-letter">A</span>
            <input
              autoComplete="name"
              required
              maxLength={80}
              value={fullName}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </span>
        </label>
        <label>
          Email address
          <span className="field">
            <Mail size={17} />
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </span>
        </label>
        <Password
          label="Password"
          name="new-password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
        <small className="password-hint">
          10+ characters with uppercase, lowercase, number, and symbol.
        </small>
        <Password
          label="Confirm password"
          name="confirm-password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirm}
        />
        {error && <Message>{error}</Message>}
        <button
          className="auth-submit"
          disabled={busy || !isSupabaseConfigured}
        >
          {busy ? (
            <>
              <span className="auth-spinner" />
              Creating account…
            </>
          ) : (
            <>
              Create account <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>
      <div className="auth-divider">
        <span>or</span>
      </div>
      <GoogleButton busy={busy} setBusy={setBusy} setError={setError} />
      <p className="auth-switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </Layout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!loginSchema.shape.email.safeParse(email).success) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    const { error } = await authService.forgot(email);
    setBusy(false);
    if (error) {
      setError(authMessage(error));
      return;
    }
    setSent(true);
  }
  return (
    <Layout
      title="Reset your password"
      subtitle="We’ll send a secure, time-limited recovery link."
    >
      {sent ? (
        <div className="auth-result">
          <CheckCircle2 />
          <h3>Check your inbox</h3>
          <p>
            If an account can receive recovery email, a link has been sent. This
            message protects account privacy.
          </p>
          <Link className="auth-submit" to="/login">
            Return to sign in
          </Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <label>
            Email address
            <span className="field">
              <Mail size={17} />
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </span>
          </label>
          {error && <Message>{error}</Message>}
          <button
            className="auth-submit"
            disabled={busy || !isSupabaseConfigured}
          >
            {busy ? "Sending…" : "Send reset link"}
          </button>
          <p className="auth-switch">
            <Link to="/login">Back to sign in</Link>
          </p>
        </form>
      )}
    </Layout>
  );
}

export function ResetPassword() {
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const valid = strongPassword.safeParse(password);
    if (!valid.success) {
      setError(valid.error.issues[0].message);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await authService.updatePassword(password);
    setBusy(false);
    if (error) {
      setError(authMessage(error));
      return;
    }
    await authService.signOut("global");
    setDone(true);
  }
  return (
    <Layout
      title="Choose a new password"
      subtitle="Your recovery link must still be valid."
    >
      {done ? (
        <div className="auth-result">
          <CheckCircle2 />
          <h3>Password updated</h3>
          <p>You can now sign in with your new password.</p>
          <Link className="auth-submit" to="/login">
            Continue to sign in
          </Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <Password
            label="New password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
          />
          <Password
            label="Confirm new password"
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
          />
          <small className="password-hint">
            10+ characters with uppercase, lowercase, number, and symbol.
          </small>
          {error && <Message>{error}</Message>}
          <button
            className="auth-submit"
            disabled={busy || !isSupabaseConfigured}
          >
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </Layout>
  );
}

export function VerifyEmail() {
  const [params] = useSearchParams(),
    email = params.get("email") ?? "",
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  return (
    <Layout
      title="Verify your email"
      subtitle="Confirm your address before opening your private workspace."
    >
      <div className="auth-result">
        <Mail />
        <h3>Check your inbox</h3>
        <p>
          We sent a verification link
          {email ? (
            <>
              {" "}
              to <b>{email}</b>
            </>
          ) : null}
          . Open it on this device to continue.
        </p>
        {status && <Message kind="info">{status}</Message>}
        <button
          className="google-button"
          disabled={busy || !email || !isSupabaseConfigured}
          onClick={async () => {
            setBusy(true);
            const { error } = await authService.resend(email);
            setBusy(false);
            setStatus(
              error
                ? authMessage(error)
                : "A new verification email has been requested.",
            );
          }}
        >
          {busy ? "Sending…" : "Resend verification email"}
        </button>
        <Link className="auth-submit" to="/login">
          Return to sign in
        </Link>
      </div>
    </Layout>
  );
}

export function AuthCallback() {
  const nav = useNavigate(),
    [params] = useSearchParams(),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) {
        setError("Authentication service is not configured.");
        return;
      }
      let { data } = await supabase.auth.getSession();
      const code = params.get("code");
      if (!data.session && code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (active) setError(authMessage(error));
          return;
        }
        data = (await supabase.auth.getSession()).data;
      }
      if (!active) return;
      if (data.session)
        nav(params.get("next") || "/dashboard", { replace: true });
      else setError("The authentication link is invalid or has expired.");
    })();
    return () => {
      active = false;
    };
  }, []);
  return (
    <Layout
      title="Completing sign in"
      subtitle="We’re securely connecting your account."
    >
      {error ? (
        <>
          <Message>{error}</Message>
          <Link className="auth-submit" to="/login">
            Return to sign in
          </Link>
        </>
      ) : (
        <div className="auth-loading inline" role="status">
          <span className="auth-spinner" />
          <p>Verifying your secure link…</p>
        </div>
      )}
    </Layout>
  );
}
