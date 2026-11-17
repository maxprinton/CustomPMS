import { NextResponse } from "next/server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bearerToken, hashKey } from "@/lib/api/keys";
import { pageParams, validate, type Fields } from "@/lib/api/validate";
import { dispatchEvent, type WebhookEvent } from "@/lib/api/webhooks";

// The API uses the admin client (no RLS), so EVERY query below filters by the key's workspace_id.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
export type Ctx = { admin: Admin; ws: string; keyId: string; req: Request; url: URL };

export const err = (status: number, code: string, message: string, extra?: object) => NextResponse.json({ error: { code, message, ...extra } }, { status });
export const ok = (data: unknown, status = 200, meta?: object) => NextResponse.json({ data, ...(meta ? { meta } : {}) }, { status });

/** Checks the Bearer key and runs the handler for that key's workspace. */
export async function withKey(req: Request, run: (c: Ctx) => Promise<Response>): Promise<Response> {
  const token = bearerToken(req.headers.get("authorization"));
  if (!token) return err(401, "unauthorized", "Send your API key as: Authorization: Bearer <key>.");
  const admin = createAdminClient();
  if (!admin) return err(503, "not_configured", "The server is missing its database key.");
  const { data } = await admin.from("api_keys").select("id, workspace_id, revoked_at").eq("key_hash", hashKey(token)).maybeSingle();
  const key = data as unknown as { id: string; workspace_id: string; revoked_at: string | null } | null;
  if (!key || key.revoked_at) return err(401, "unauthorized", "That API key is not valid.");
  after(async () => {
    await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);
  });
  try {
    return await run({ admin, ws: key.workspace_id, keyId: key.id, req, url: new URL(req.url) });
  } catch (e) {
    return err(500, "server_error", e instanceof Error ? e.message : "Something went wrong.");
  }
}

export async function readJson(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; res: Response }> {
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false, res: err(400, "bad_json", "The body is not valid JSON.") };
  }
}

export function emit(c: Ctx, event: WebhookEvent, data: unknown) {
  after(() => dispatchEvent(c.admin, c.ws, event, data));
}

const dbMessage = (e: { message: string; code?: string }) => e.message.replace(/^ERROR:\s*/i, "");
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export type ResourceConfig = {
  table: string;
  name: string; // "client" (used in event names)
  select: string;
  fields: Fields;
  filters: string[]; // columns that may be used as ?column=value
  hasUpdatedAt?: boolean;
  events?: { created: WebhookEvent; updated: WebhookEvent };
  order?: string;
  defaults?: Record<string, unknown>; // set on create (for example source: "api")
  notDeleted?: boolean; // hide rows with deleted_at set
};

/** GET (list) and POST (create) for a collection. */
export function collection(cfg: ResourceConfig) {
  return {
    GET: (req: Request) =>
      withKey(req, async (c) => {
        const { limit, offset } = pageParams(c.url);
        let q = c.admin.from(cfg.table).select(cfg.select, { count: "exact" }).eq("workspace_id", c.ws);
        if (cfg.notDeleted) q = q.is("deleted_at", null);
        for (const f of cfg.filters) {
          const v = c.url.searchParams.get(f);
          if (v !== null && v !== "") q = q.eq(f, v === "true" ? true : v === "false" ? false : v);
        }
        const since = c.url.searchParams.get("updated_since");
        if (since && cfg.hasUpdatedAt) {
          if (Number.isNaN(Date.parse(since))) return err(400, "bad_filter", "updated_since must be a date and time.");
          q = q.gte("updated_at", since);
        }
        const { data, error, count } = await q.order(cfg.order ?? "created_at", { ascending: true }).range(offset, offset + limit - 1);
        if (error) return err(400, "bad_request", dbMessage(error));
        return ok(data ?? [], 200, { total: count ?? 0, limit, offset });
      }),
    POST: (req: Request) =>
      withKey(req, async (c) => {
        const j = await readJson(req);
        if (!j.ok) return j.res;
        const v = validate(j.body, cfg.fields);
        if (!v.ok) return err(422, "validation_failed", "The request has errors.", { details: v.errors });
        const parent = await checkParents(c, v.values);
        if (parent) return parent;
        const { data, error } = await c.admin.from(cfg.table).insert({ ...cfg.defaults, ...v.values, workspace_id: c.ws }).select(cfg.select).single();
        if (error) return err(422, "rejected", dbMessage(error));
        if (cfg.events) emit(c, cfg.events.created, data);
        return ok(data, 201);
      }),
  };
}

/** GET one and PATCH for a record, by id. */
export function item(cfg: ResourceConfig) {
  const find = async (c: Ctx, id: string) => {
    if (!isUuid(id)) return null;
    let q = c.admin.from(cfg.table).select(cfg.select).eq("workspace_id", c.ws).eq("id", id);
    if (cfg.notDeleted) q = q.is("deleted_at", null);
    return (await q.maybeSingle()).data;
  };
  return {
    GET: (req: Request, { params }: { params: Promise<{ id: string }> }) =>
      withKey(req, async (c) => {
        const row = await find(c, (await params).id);
        return row ? ok(row) : err(404, "not_found", `That ${cfg.name} was not found.`);
      }),
    PATCH: (req: Request, { params }: { params: Promise<{ id: string }> }) =>
      withKey(req, async (c) => {
        const id = (await params).id;
        if (!(await find(c, id))) return err(404, "not_found", `That ${cfg.name} was not found.`);
        const j = await readJson(req);
        if (!j.ok) return j.res;
        const v = validate(j.body, cfg.fields, true);
        if (!v.ok) return err(422, "validation_failed", "The request has errors.", { details: v.errors });
        const parent = await checkParents(c, v.values);
        if (parent) return parent;
        const { data, error } = await c.admin.from(cfg.table).update(v.values).eq("workspace_id", c.ws).eq("id", id).select(cfg.select).single();
        if (error) return err(422, "rejected", dbMessage(error));
        if (cfg.events) emit(c, cfg.events.updated, data);
        return ok(data);
      }),
  };
}

const PARENTS: Record<string, string> = { client_id: "clients", project_id: "projects" };
/** A key can only point at records of its own workspace. */
async function checkParents(c: Ctx, values: Record<string, unknown>): Promise<Response | null> {
  for (const [col, table] of Object.entries(PARENTS)) {
    const id = values[col];
    if (typeof id !== "string") continue;
    const { data } = await c.admin.from(table).select("id").eq("workspace_id", c.ws).eq("id", id).maybeSingle();
    if (!data) return err(422, "validation_failed", "The request has errors.", { details: [`${col} does not exist in this workspace.`] });
  }
  return null;
}
