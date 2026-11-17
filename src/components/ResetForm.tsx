"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dict } from "@/lib/i18n";

export default function ResetForm({ t }: { t: Dict["login"] }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <h1 className="text-xl font-semibold tracking-tight">{t.newPassword}</h1>
      <input type="password" required minLength={8} autoComplete="new-password" placeholder={t.password} aria-label={t.password} value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
      <button type="submit" disabled={busy} className="btn w-full">
        {busy ? t.wait : t.save}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
