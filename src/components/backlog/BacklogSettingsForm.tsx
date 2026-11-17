"use client";

import { useActionState } from "react";
import { saveBacklogSettings, type FormState } from "@/app/backlog-actions";
import type { BacklogSettings } from "@/lib/backlog/board";
import type { Dict } from "@/lib/i18n";

/** The flow limits (Now / Next / Verifying), the days in real use and the planning prompt. */
export default function BacklogSettingsForm({ settings, t, canWrite }: { settings: BacklogSettings; t: Dict; canWrite: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveBacklogSettings, null);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="label">{t.bl.nowCap}<input name="now_cap" type="number" min={1} max={10} defaultValue={settings.now_cap} disabled={!canWrite} className="input mt-1" /></label>
        <label className="label">{t.bl.nextCap}<input name="next_cap" type="number" min={1} max={50} defaultValue={settings.next_cap} disabled={!canWrite} className="input mt-1" /></label>
        <label className="label">{t.bl.verifyingCap}<input name="verifying_cap" type="number" min={1} max={20} defaultValue={settings.verifying_cap} disabled={!canWrite} className="input mt-1" /></label>
        <label className="label">{t.bl.verifyDays}<input name="verify_days" type="number" min={1} max={60} defaultValue={settings.verify_days} disabled={!canWrite} className="input mt-1" /></label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="triage_prompt" type="checkbox" defaultChecked={settings.triage_prompt} disabled={!canWrite} /> {t.bl.triagePrompt}
      </label>
      <p className="text-sm text-muted">{t.bl.capsHint}</p>
      {state?.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
      {state?.ok && <p className="text-sm text-success">{t.bl.saved}</p>}
      {canWrite && <button disabled={pending} className="btn">{t.common.save}</button>}
    </form>
  );
}
