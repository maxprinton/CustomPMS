import { createHmac, randomBytes } from "node:crypto";

// Outgoing webhooks: JSON body, signed with the webhook's secret (HMAC-SHA256) so the receiver can check it came from CPMS.
export const WEBHOOK_EVENTS = [
  "client.created", "client.updated",
  "project.created", "project.updated",
  "task.created", "task.updated",
  "backlog.created", "backlog.moved",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const newSecret = () => "whsec_" + randomBytes(24).toString("base64url");
export const signBody = (secret: string, body: string) => "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
/** An empty list means "all events". */
export const matchesEvent = (events: string[] | null | undefined, event: string) => !events || events.length === 0 || events.includes(event);

export function parseEvents(raw: string): string[] {
  return raw.split(/[\s,]+/).map((e) => e.trim()).filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
}

type Admin = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Sends one event to every matching active webhook of the workspace and logs each delivery. Never throws. */
export async function dispatchEvent(admin: Admin | null, workspaceId: string, event: WebhookEvent, data: unknown, fetchImpl: typeof fetch = fetch): Promise<number> {
  if (!admin) return 0;
  try {
    const { data: hooks } = await admin.from("webhooks").select("id, url, secret, events").eq("workspace_id", workspaceId).eq("active", true);
    const targets = ((hooks ?? []) as { id: string; url: string; secret: string; events: string[] }[]).filter((h) => matchesEvent(h.events, event));
    const body = JSON.stringify({ event, workspace_id: workspaceId, sent_at: new Date().toISOString(), data });
    await Promise.all(
      targets.map(async (h) => {
        let status: number | null = null;
        let error: string | null = null;
        try {
          const res = await fetchImpl(h.url, {
            method: "POST",
            headers: { "content-type": "application/json", "x-cpms-event": event, "x-cpms-signature": signBody(h.secret, body) },
            body,
            signal: AbortSignal.timeout(5000),
          });
          status = res.status;
          if (!res.ok) error = `HTTP ${res.status}`;
        } catch (e) {
          error = e instanceof Error ? e.message.slice(0, 200) : "failed";
        }
        await admin.from("webhook_deliveries").insert({ workspace_id: workspaceId, webhook_id: h.id, event, status_code: status, error });
      })
    );
    return targets.length;
  } catch {
    return 0;
  }
}
