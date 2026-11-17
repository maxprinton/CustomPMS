import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchEvent, type WebhookEvent } from "@/lib/api/webhooks";

/** Tells the workspace's webhooks that something changed in the app (runs after the response, never breaks the action). */
export function notify(workspaceId: string, event: WebhookEvent, data: unknown) {
  const admin = createAdminClient();
  if (!admin) return;
  after(() => dispatchEvent(admin, workspaceId, event, data));
}
