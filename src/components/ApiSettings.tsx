import ApiKeyForm from "@/components/ApiKeyForm";
import { addWebhook, deleteWebhook, revokeApiKey } from "@/app/api-actions";
import { WEBHOOK_EVENTS } from "@/lib/api/webhooks";
import type { Dict } from "@/lib/i18n";
import type { SupabaseClient } from "@supabase/supabase-js";

type Key = { id: string; name: string; key_prefix: string; last_used_at: string | null; revoked_at: string | null; created_at: string };
type Hook = { id: string; url: string; secret: string; events: string[]; active: boolean };
type Delivery = { id: string; webhook_id: string; event: string; status_code: number | null; error: string | null; created_at: string };

/** API keys and webhooks, owner only. */
export default async function ApiSettings({ supabase, t, lang }: { supabase: SupabaseClient; t: Dict; lang: string }) {
  const [k, h, d] = await Promise.all([
    supabase.from("api_keys").select("id, name, key_prefix, last_used_at, revoked_at, created_at").order("created_at", { ascending: false }),
    supabase.from("webhooks").select("id, url, secret, events, active").order("created_at"),
    supabase.from("webhook_deliveries").select("id, webhook_id, event, status_code, error, created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  const keys = (k.data ?? []) as unknown as Key[];
  const hooks = (h.data ?? []) as unknown as Hook[];
  const deliveries = (d.data ?? []) as unknown as Delivery[];
  const fmt = new Intl.DateTimeFormat(lang === "es" ? "es" : "en", { dateStyle: "medium", timeStyle: "short" });

  return (
    <section className="card space-y-4 p-4">
      <h2 className="font-medium">{t.api.title}</h2>
      <p className="text-sm text-muted">{t.api.hint}</p>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t.api.keys}</h3>
        <ApiKeyForm t={t} />
        {keys.length === 0 && <p className="text-sm text-muted">{t.api.noKeys}</p>}
        <ul className="space-y-1 text-sm">
          {keys.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{x.name}</span>
              <code className="text-muted">{x.key_prefix}…</code>
              <span className="text-muted">{t.api.lastUsed}: {x.last_used_at ? fmt.format(new Date(x.last_used_at)) : t.api.never}</span>
              {x.revoked_at ? (
                <span className="badge">{t.api.revoked}</span>
              ) : (
                <form action={revokeApiKey}><input type="hidden" name="id" value={x.id} /><button className="btn-quiet">{t.api.revoke}</button></form>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t.api.webhooks}</h3>
        <form action={addWebhook} className="flex flex-wrap gap-2">
          <input name="url" type="url" required pattern="https://.*" placeholder={t.api.webhookUrl} aria-label={t.api.webhookUrl} className="input max-w-md flex-1" />
          <input name="events" placeholder={t.api.events} aria-label={t.api.events} className="input max-w-xs" list="cpms-events" />
          <datalist id="cpms-events">{WEBHOOK_EVENTS.map((e) => <option key={e} value={e} />)}</datalist>
          <button className="btn">{t.api.add}</button>
        </form>
        {hooks.length === 0 && <p className="text-sm text-muted">{t.api.noHooks}</p>}
        <ul className="space-y-2 text-sm">
          {hooks.map((x) => (
            <li key={x.id} className="rounded-lg border border-line p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="break-all font-medium">{x.url}</span>
                <form action={deleteWebhook}><input type="hidden" name="id" value={x.id} /><button className="btn-quiet">{t.api.delete}</button></form>
              </div>
              <p className="text-muted">{x.events.length ? x.events.join(", ") : t.common.all}</p>
              <p className="text-muted">{t.api.secret}: <code className="break-all">{x.secret}</code></p>
            </li>
          ))}
        </ul>
        {deliveries.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm text-muted">{t.api.deliveries} ({deliveries.length})</summary>
            <ul className="mt-2 space-y-1 text-sm">
              {deliveries.map((x) => (
                <li key={x.id}>{x.error ? "⚠" : "✓"} {x.event} · {x.status_code ?? "-"} · <span className="text-muted">{fmt.format(new Date(x.created_at))}</span>{x.error && <span className="text-danger"> {x.error}</span>}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
