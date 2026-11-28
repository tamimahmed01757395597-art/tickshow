import { useEffect, useState, type FormEvent } from "react";
import { updatePasswordForRecovery } from "../lib/auth";
import { requireSupabase } from "../lib/supabase";
import Brand from "./Brand";
import { Icon } from "./Icon";

export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = "Reset password | TickShow";
    let active = true;
    requireSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (active) setHasSession(Boolean(data.session));
      })
      .catch(() => {
        if (active) setError("The reset link could not be verified.");
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
      document.title = "TickShow";
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await updatePasswordForRecovery(password);
      setDone(true);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "The password could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <Brand />
        <a className="auth-home-link" href="#/login"><Icon name="arrowLeft" size={16} /> Back to login</a>
      </div>
      <main className="auth-main auth-main-centered">
        <section className="auth-panel" aria-labelledby="reset-password-title">
          <div className="auth-card">
            <p className="auth-card-kicker">Account recovery</p>
            <h1 id="reset-password-title">Choose a new password</h1>
            {checking ? (
              <p className="auth-card-intro">Checking your secure reset link…</p>
            ) : !hasSession ? (
              <>
                <p className="auth-error" role="alert">
                  This reset link is invalid or expired. Request a new one.
                </p>
                <a className="button button-primary auth-submit" href="#/forgot-password">
                  Request another link
                </a>
              </>
            ) : done ? (
              <>
                <p className="auth-notice" role="status">Your password has been updated.</p>
                <a className="button button-primary auth-submit" href="#/account">Go to your account</a>
              </>
            ) : (
              <form className="auth-form" onSubmit={submit}>
                <label htmlFor="new-password">New password</label>
                <div className="auth-password-wrap">
                  <input
                    id="new-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <button className="button button-primary auth-submit" type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Update password"} <Icon name="arrowRight" size={18} />
                </button>
                {error && <p className="auth-error" role="alert">{error}</p>}
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
