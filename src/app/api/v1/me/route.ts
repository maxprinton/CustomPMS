import { ok, withKey } from "@/lib/api/http";

/** Connectivity check: which workspace does this key belong to? */
export const GET = (req: Request) =>
  withKey(req, async (c) => {
    const { data } = await c.admin.from("workspaces").select("id, name").eq("id", c.ws).maybeSingle();
    return ok({ workspace: data, key_id: c.keyId });
  });
