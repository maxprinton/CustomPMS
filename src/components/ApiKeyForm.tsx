"use client";

import { useActionState } from "react";
import { createApiKey, type KeyState } from "@/app/api-actions";
import type { Dict } from "@/lib/i18n";

/** Creates an API key and shows it once. */
export default function ApiKeyForm({ t }: { t: Dict }) {
  const [state, action, pending] = useActionState<KeyState, FormData>(createApiKey, null);
  return (
    <div className="space-y-2">
      <form action={action} className="flex flex-wrap gap-2">
        <input name="name" required maxLength={80} placeholder={t.api.keyName} aria-label={t.api.keyName} className="input max-w-xs flex-1" />
        <button disabled={pending} className="btn">{t.api.create}</button>
      </form>
      {state?.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
      {state?.key && (
        <div className="rounded-lg bg-accent-soft p-3 text-sm">
          <p>{t.api.showOnce}</p>
          <code className="mt-1 block break-all font-mono">{state.key}</code>
        </div>
      )}
    </div>
  );
}
