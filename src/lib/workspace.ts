import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "member" | "viewer";

type MemberRow = { workspace_id: string; role: Role };

/** The signed-in user, their workspace and their role. Redirects to /login when signed out. */
export const getContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const member = data as unknown as MemberRow | null;
  if (!member) throw new Error("This account has no workspace.");

  const { data: ws } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", member.workspace_id)
    .maybeSingle();
  const workspaceName = (ws as unknown as { name: string } | null)?.name ?? "";

  return {
    supabase,
    user,
    workspaceId: member.workspace_id,
    role: member.role,
    canWrite: member.role !== "viewer",
    workspaceName,
  };
});
