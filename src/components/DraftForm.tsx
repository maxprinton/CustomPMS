"use client";

import { useActionState } from "react";
import { draftWithAi, type DraftState } from "@/app/ai-actions";
import { DRAFT_KINDS } from "@/lib/ai/prompts";
import type { Dict } from "@/lib/i18n";

/** "Draft with AI": pick what to write, get a note back. */
export default function DraftForm({ projectId, t, left }: { projectId: string; t: Dict; left: number }) {
  const [state, action, pending] = useActionState<DraftState, FormData>(draftWithAi, null);
  return (
    <form action={action} className="card space-y-2 p-4">
      <h2 className="font-medium">{t.ai.title}</h2>
      <p className="text-sm text-muted">{t.ai.hint}</p>
      <input type="hidden" name="project_id" value={projectId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="label">{t.ai.kind}
          <select name="kind" className="input mt-1">
            {DRAFT_KINDS.map((k) => <option key={k} value={k}>{t.ai[k]}</option>)}
          </select>
        </label>
        <button disabled={pending || left <= 0} className="btn">{pending ? t.ai.running : t.ai.run}</button>
        <span className="text-sm text-muted">{left} {t.ai.left}</span>
      </div>
      {state?.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
    </form>
  );
}
