"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dict } from "@/lib/i18n";

type Mode = "signin" | "signup";

export default function LoginForm({ t }: { t: Dict["login"] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function onForgot() {
    setError("");
    setInfo("");
    if (!email) {
      setError(t.needEmail);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setInfo(t.resetSent);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      router.replace("/");
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
    } else if (data.session) {
      router.replace("/");
      router.refresh();
    } else {
      setInfo(t.created);
      setMode("signin");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{mode === "signin" ? t.signIn : t.create}</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input type="email" required autoComplete="email" placeholder={t.email} aria-label={t.email} value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder={t.password}
          aria-label={t.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
        <button type="submit" disabled={busy} className="btn w-full">
          {busy ? t.wait : mode === "signin" ? t.submitIn : t.submitUp}
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
        {info && <p className="text-sm text-success">{info}</p>}
      </form>
      {mode === "signin" && (
        <button type="button" onClick={onForgot} disabled={busy} className="block text-sm font-medium text-accent hover:underline">
          {t.forgot}
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError("");
        }}
        className="text-sm text-muted hover:text-fg"
      >
        {mode === "signin" ? t.toUp : t.toIn}
      </button>
    </div>
  );
}
