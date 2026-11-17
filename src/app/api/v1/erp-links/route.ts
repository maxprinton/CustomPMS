import { err, ok, readJson, withKey } from "@/lib/api/http";
import { validate, pageParams, type Fields } from "@/lib/api/validate";

// Maps a CPMS record to its record in the ERP (and back), so each system can find the other's record by id.
const TABLES: Record<string, string> = { client: "clients", project: "projects", task: "tasks", contact: "contacts", milestone: "milestones", risk: "risks", backlog_item: "backlog_items" };
const fields: Fields = {
  entity_type: { type: "enum", values: Object.keys(TABLES), required: true },
  entity_id: { type: "uuid", required: true },
  erp_system: { type: "string", max: 60 },
  erp_id: { type: "string", required: true, max: 200 },
};
const SELECT = "id, entity_type, entity_id, erp_system, erp_id, created_at";

export const GET = (req: Request) =>
  withKey(req, async (c) => {
    const { limit, offset } = pageParams(c.url);
    let q = c.admin.from("erp_links").select(SELECT, { count: "exact" }).eq("workspace_id", c.ws);
    for (const f of ["entity_type", "entity_id", "erp_system", "erp_id"]) {
      const v = c.url.searchParams.get(f);
      if (v) q = q.eq(f, v);
    }
    const { data, error, count } = await q.order("created_at").range(offset, offset + limit - 1);
    if (error) return err(400, "bad_request", error.message);
    return ok(data ?? [], 200, { total: count ?? 0, limit, offset });
  });

/** Creates or updates the link (one ERP id per record and system). */
export const POST = (req: Request) =>
  withKey(req, async (c) => {
    const j = await readJson(req);
    if (!j.ok) return j.res;
    const v = validate(j.body, fields);
    if (!v.ok) return err(422, "validation_failed", "The request has errors.", { details: v.errors });
    const { entity_type, entity_id } = v.values as { entity_type: string; entity_id: string };
    const exists = await c.admin.from(TABLES[entity_type]).select("id").eq("workspace_id", c.ws).eq("id", entity_id).maybeSingle();
    if (!exists.data) return err(422, "validation_failed", "The request has errors.", { details: [`That ${entity_type} does not exist in this workspace.`] });
    const row = { erp_system: "erp", ...v.values, workspace_id: c.ws };
    // One CPMS record has one ERP id per system: replace an older link to the same record.
    await c.admin.from("erp_links").delete().eq("workspace_id", c.ws).eq("entity_type", entity_type).eq("entity_id", entity_id).eq("erp_system", row.erp_system);
    const { data, error } = await c.admin.from("erp_links").upsert(row, { onConflict: "workspace_id,entity_type,erp_system,erp_id" }).select(SELECT).single();
    if (error) return err(422, "rejected", error.message);
    return ok(data, 201);
  });

export const DELETE = (req: Request) =>
  withKey(req, async (c) => {
    const id = c.url.searchParams.get("id");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return err(400, "bad_request", "Pass ?id=<link id>.");
    const { data } = await c.admin.from("erp_links").delete().eq("workspace_id", c.ws).eq("id", id).select("id");
    return data?.length ? ok({ deleted: id }) : err(404, "not_found", "That link was not found.");
  });
