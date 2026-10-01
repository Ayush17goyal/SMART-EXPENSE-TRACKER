import { useState } from "react";
import {
  Cloud,
  Download,
  HardDrive,
  LogOut,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { type Ledger, paise, rupees } from "../domain/model";
import { backup, restore } from "../domain/imports";
import { adapter, localAdapter, supabase, type Mode } from "../data/storage";
import {
  Modal,
  SectionTitle,
  download,
  readableError,
  type Mutate,
} from "../components";
import { useAuth } from "../auth/AuthProvider";
import { authService } from "../auth/authService";
import { authMessage } from "../auth/authErrors";
import { strongPassword } from "../auth/authValidation";
type Incoming = { ledger: Ledger; source: "backup" | "local" | "cloud" };
export default function Settings({
  ledger: l,
  asOf,
  mode,
  mutate,
  onMode,
  onLeave,
}: {
  ledger: Ledger;
  asOf: string;
  mode: Mode;
  mutate: Mutate;
  onMode: (m: Mode) => Promise<void>;
  onLeave: () => void;
  reload: () => void;
}) {
  const [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [incoming, setIncoming] = useState<Incoming | null>(null),
    [deleting, setDeleting] = useState(false),
    [confirm, setConfirm] = useState("");
  const { user, profile, refreshProfile } = useAuth();
  const report = (e: unknown) => setError(readableError(e));
  async function saveProfile(form: HTMLFormElement) {
    const f = new FormData(form);
    try {
      if (
        await mutate((x) => {
          x.profile = {
            name: String(f.get("name")),
            trackingSince: String(f.get("tracking")),
            coverageConfirmed: f.get("coverage") === "on",
            reserve: paise(String(f.get("reserve"))),
            savingsTarget: paise(String(f.get("savings"))),
            semesterStart: String(f.get("semesterStart")) || undefined,
            semesterEnd: String(f.get("semesterEnd")) || undefined,
          };
          if (
            x.profile.semesterStart &&
            x.profile.semesterEnd &&
            x.profile.semesterStart > x.profile.semesterEnd
          )
            throw new Error("Semester end must follow the start.");
        })
      )
        setStatus("Profile updated.");
    } catch (e) {
      report(e);
    }
  }
  async function confirmTransfer() {
    if (!incoming) return;
    try {
      const next = structuredClone(incoming.ledger);
      next.preferences.aiConsent = false;
      if (incoming.source === "cloud") {
        const local = localAdapter("local"),
          old = await local.load();
        const saved = await local.save(next, old?.revision ?? 0),
          check = await local.load();
        if (JSON.stringify(check) !== JSON.stringify(saved))
          throw new Error(
            "Transfer verification failed. Source data was retained.",
          );
        await onMode("local");
      } else if (
        !(await mutate((x) =>
          Object.assign(x, { ...next, revision: x.revision }),
        ))
      )
        return;
      setIncoming(null);
      setStatus("Transfer saved. Source copy retained.");
    } catch (e) {
      report(e);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PRIVATE BY CHOICE</span>
          <h1>
            Your data. Your rules<span className="heading-dot">.</span>
          </h1>
          <p>
            Choose what you share, what stays here, and what matters to your
            plan.
          </p>
        </div>
        <button className="secondary" onClick={onLeave}>
          Switch workspace
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {status && <div className="notice">{status}</div>}
      <div className="settings-grid">
        <div>
          <section className="card">
            <SectionTitle title="Your student profile" />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveProfile(e.currentTarget);
              }}
            >
              <label>
                Preferred name
                <input
                  name="name"
                  maxLength={60}
                  required
                  defaultValue={l.profile.name}
                />
              </label>
              <label>
                Tracking since
                <input
                  type="date"
                  name="tracking"
                  max={asOf}
                  required
                  defaultValue={l.profile.trackingSince}
                />
              </label>
              <label className="checkbox">
                <input
                  name="coverage"
                  type="checkbox"
                  defaultChecked={l.profile.coverageConfirmed}
                />
                My records are reasonably complete from this date. Empty days
                can be treated as no recorded spending.
              </label>
              <div className="form-grid">
                <label>
                  Semester starts
                  <input
                    type="date"
                    name="semesterStart"
                    defaultValue={l.profile.semesterStart}
                  />
                </label>
                <label>
                  Semester ends
                  <input
                    type="date"
                    name="semesterEnd"
                    defaultValue={l.profile.semesterEnd}
                  />
                </label>
                <label>
                  Emergency reserve (₹)
                  <input
                    name="reserve"
                    inputMode="decimal"
                    required
                    defaultValue={l.profile.reserve / 100}
                  />
                </label>
                <label>
                  Monthly savings target (₹)
                  <input
                    name="savings"
                    inputMode="decimal"
                    required
                    defaultValue={l.profile.savingsTarget / 100}
                  />
                </label>
              </div>
              <button className="primary">Save profile</button>
            </form>
          </section>
          <section className="card">
            <SectionTitle title="Cash checkpoint" />
            <p>
              Enter total available cash at the <b>end of a day</b>. Only later
              transactions are applied.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  if (
                    await mutate((x) => {
                      x.checkpoint = {
                        date: String(f.get("date")),
                        amount: paise(String(f.get("amount"))),
                      };
                    })
                  )
                    setStatus("Checkpoint updated.");
                } catch (err) {
                  report(err);
                }
              }}
            >
              <div className="form-grid">
                <label>
                  End-of-day balance (₹)
                  <input
                    name="amount"
                    inputMode="decimal"
                    required
                    defaultValue={l.checkpoint ? l.checkpoint.amount / 100 : ""}
                  />
                </label>
                <label>
                  At the end of
                  <input
                    type="date"
                    name="date"
                    required
                    max={asOf}
                    defaultValue={l.checkpoint?.date ?? asOf}
                  />
                </label>
              </div>
              <button className="primary">Save checkpoint</button>
              {l.checkpoint && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    mutate((x) => {
                      x.checkpoint = null;
                    })
                  }
                >
                  Remove checkpoint
                </button>
              )}
            </form>
          </section>
          <section className="card">
            <SectionTitle title="Your categories" />
            {l.categories.map((c) => (
              <div className="list-row" key={c.id}>
                <span className="category-tag">
                  <i style={{ background: c.color }} />
                  {c.name}
                </span>
                <label className="checkbox compact">
                  <input
                    type="checkbox"
                    checked={c.essential}
                    onChange={(e) =>
                      mutate((x) => {
                        x.categories.find((v) => v.id === c.id)!.essential =
                          e.target.checked;
                      })
                    }
                  />
                  Protect as essential
                </label>
              </div>
            ))}
          </section>
        </div>
        <div>
          <section className="card security-card">
            <SectionTitle title="Account & security" />
            <div className="security-identity">
              <span className="storage-icon">
                <UserRound />
              </span>
              <div>
                <strong>
                  {profile?.full_name ||
                    user?.user_metadata?.full_name ||
                    "Pocketwise user"}
                </strong>
                <small>{user?.email}</small>
              </div>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const name = String(
                  new FormData(e.currentTarget).get("fullName") || "",
                ).trim();
                if (!name) return;
                const { error } = await supabase!
                  .from("profiles")
                  .update({
                    full_name: name,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", user!.id);
                if (error) report(error);
                else {
                  await refreshProfile();
                  setStatus("Account profile updated.");
                }
              }}
            >
              <label>
                Full name
                <input
                  name="fullName"
                  defaultValue={profile?.full_name || ""}
                  maxLength={80}
                  required
                />
              </label>
              <button className="secondary">Update account profile</button>
            </form>
            <div className="security-facts">
              <span>
                Email verification{" "}
                <b>{user?.email_confirmed_at ? "Verified" : "Required"}</b>
              </span>
              <span>
                Connected sign-in{" "}
                <b>
                  {user?.app_metadata.provider === "google"
                    ? "Google"
                    : "Email & password"}
                </b>
              </span>
            </div>
            <button
              className="secondary full"
              onClick={async () => {
                const password = prompt(
                  "Enter a new password with at least 10 characters, uppercase, lowercase, a number, and a symbol.",
                );
                if (!password) return;
                const valid = strongPassword.safeParse(password);
                if (!valid.success) {
                  setError(valid.error.issues[0].message);
                  return;
                }
                try {
                  const { error } = await authService.updatePassword(password);
                  if (error) throw error;
                  setStatus("Password updated successfully.");
                } catch (e) {
                  setError(authMessage(e));
                }
              }}
            >
              Change password
            </button>
            <button
              className="text-button"
              onClick={async () => {
                await authService.signOut("local");
                onLeave();
              }}
            >
              <LogOut size={15} />
              Log out
            </button>
            <button
              className="text-button"
              onClick={async () => {
                await authService.signOut("global");
                onLeave();
              }}
            >
              Log out from all devices
            </button>
          </section>
          <section className="card storage-card">
            <div className="storage-icon">
              {mode === "cloud" ? <Cloud /> : <HardDrive />}
            </div>
            <h2>
              {mode === "cloud" ? "Your private cloud" : "On this device"}
            </h2>
            <p>
              {mode === "cloud"
                ? "Access across devices with per-user ownership controls."
                : "Records stay in this browser. Clearing site data removes them."}
            </p>
            <div className="storage-facts">
              <span>
                <ShieldCheck size={15} />
                INR · Asia/Kolkata
              </span>
              <span>
                {mode === "demo"
                  ? "Separate synthetic data"
                  : mode === "cloud"
                    ? "Verified account required"
                    : "No account required"}
              </span>
            </div>
            {mode === "local" && (
              <button
                className="secondary full"
                onClick={() => onMode("cloud")}
              >
                Sign in to cloud
              </button>
            )}
            {mode === "cloud" && (
              <>
                <button
                  className="secondary full"
                  onClick={async () => {
                    try {
                      const local = await localAdapter("local").load();
                      if (!local)
                        throw new Error("No device-only records found.");
                      setIncoming({ ledger: local, source: "local" });
                    } catch (e) {
                      report(e);
                    }
                  }}
                >
                  Preview device-to-cloud transfer
                </button>
                <button
                  className="text-button"
                  onClick={() => setIncoming({ ledger: l, source: "cloud" })}
                >
                  Copy cloud records to this device
                </button>
                <button
                  className="text-button"
                  onClick={async () => {
                    await supabase?.auth.signOut();
                    onLeave();
                  }}
                >
                  Sign out
                </button>
              </>
            )}
          </section>
          <section className="card">
            <SectionTitle title="AI & notifications" />
            <label className="toggle-row">
              <span>
                <b>Optional cloud AI</b>
                <small>
                  {mode === "cloud"
                    ? "Minimized context may be sent to OpenAI."
                    : "Unavailable outside cloud mode."}
                </small>
              </span>
              <input
                type="checkbox"
                disabled={mode !== "cloud"}
                checked={mode === "cloud" && l.preferences.aiConsent}
                onChange={(e) =>
                  mutate((x) => {
                    x.preferences.aiConsent = e.target.checked;
                  })
                }
              />
            </label>
            <p className="fine-print">
              AI interprets language; deterministic code calculates money.
              Provider retention policies may apply.
            </p>
            <label className="toggle-row">
              <span>
                <b>Priority insights</b>
                <small>Up to three in-app alerts.</small>
              </span>
              <input
                type="checkbox"
                checked={l.preferences.alerts}
                onChange={(e) =>
                  mutate((x) => {
                    x.preferences.alerts = e.target.checked;
                  })
                }
              />
            </label>
            <label>
              Snooze until
              <input
                type="date"
                value={l.preferences.snoozedUntil ?? ""}
                onChange={(e) =>
                  mutate((x) => {
                    x.preferences.snoozedUntil = e.target.value || null;
                  })
                }
              />
            </label>
            <details>
              <summary>Category alert preferences</summary>
              {l.categories.map((c) => (
                <label className="checkbox" key={c.id}>
                  <input
                    type="checkbox"
                    checked={!l.preferences.mutedCategories.includes(c.id)}
                    onChange={(e) =>
                      mutate((x) => {
                        x.preferences.mutedCategories = e.target.checked
                          ? x.preferences.mutedCategories.filter(
                              (id) => id !== c.id,
                            )
                          : [...x.preferences.mutedCategories, c.id];
                      })
                    }
                  />
                  {c.name}
                </label>
              ))}
            </details>
          </section>
          <section className="card">
            <SectionTitle title="Backup & restore" />
            <p>Exports contain sensitive records. Keep them private.</p>
            <button
              className="secondary full"
              onClick={() =>
                download(`pocketwise-backup-${asOf}.json`, backup(l))
              }
            >
              <Download size={16} />
              Export backup
            </button>
            <label className="file-input">
              Restore backup
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  try {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 25_000_000)
                      throw new Error("Backup exceeds 25 MB.");
                    setIncoming({
                      ledger: restore(await f.text()),
                      source: "backup",
                    });
                  } catch (err) {
                    report(err);
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </section>
          <section className="card danger-zone">
            <h3>Delete your account</h3>
            <p>
              This permanently removes your account and all private financial
              records. Export a backup first.
            </p>
            <button
              className="text-button danger-text"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={15} />
              Review deletion
            </button>
          </section>
        </div>
      </div>
      {incoming && (
        <Modal
          title="Review data replacement"
          onClose={() => setIncoming(null)}
        >
          <p>
            {incoming.ledger.transactions.length} transactions ·{" "}
            {incoming.ledger.goals.length} goals ·{" "}
            {incoming.ledger.schedules.length} commitments
          </p>
          <p>
            Gross expenses:{" "}
            {rupees(
              incoming.ledger.transactions
                .filter((t) => t.type === "expense")
                .reduce((v, t) => v + t.amount, 0),
            )}
          </p>
          <div className="notice">
            The destination is replaced. The source stays intact and AI consent
            resets to off.
          </div>
          <button
            className="secondary"
            onClick={() =>
              download("pocketwise-before-transfer.json", backup(l))
            }
          >
            Back up destination
          </button>
          <button className="primary" onClick={confirmTransfer}>
            Confirm replacement
          </button>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Delete your account permanently?"
          onClose={() => setDeleting(false)}
        >
          <p>Type DELETE to confirm.</p>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <button
            className="danger"
            disabled={confirm !== "DELETE"}
            onClick={async () => {
              try {
                await authService.deleteAccount();
                onLeave();
              } catch (e) {
                report(e);
                setDeleting(false);
              }
            }}
          >
            Delete permanently
          </button>
        </Modal>
      )}
    </>
  );
}
