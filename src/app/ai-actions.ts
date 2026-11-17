"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/workspace";
import { getDict } from "@/lib/i18n";
import { AiNotConfigured, dailyLimit, getProvider } from "@/lib/ai/provider";
import { DRAFT_KINDS, buildPrompt, draftTitle, type DraftKind, type ProjectFacts } from "@/lib/ai/prompts";
import { toContent } from "@/lib/notes";
import { pick } from "@/lib/options";

export type DraftState = { error?: string } | null;

/** Drafts a document from the project's data and saves it as a note the user can edit. */
export async function draftWithAi(_prev: DraftState, fd: FormData): Promise<DraftState> {
  const { supabase, workspaceId, canWrite } = await getContext();
  const { t, lang } = await getDict();
  if (!canWrite) return { error: t.common.readOnly };
  const projectId = String(fd.get("project_id") ?? "");
  const kind: DraftKind = pick(DRAFT_KINDS, String(fd.get("kind") ?? ""), "charter");
  if (!projectId) return { error: "Project not found." };

  let provider;
  try {
    provider = getProvider();
  } catch (e) {
    return { error: e instanceof AiNotConfigured ? t.ai.noKey : String(e) };
  }

  const limit = dailyLimit();
  const day = new Date().toISOString().slice(0, 10);
  const usage = await supabase.from("ai_usage").select("calls").eq("workspace_id", workspaceId).eq("day", day).maybeSingle();
  const used = (usage.data as unknown as { calls: number } | null)?.calls ?? 0;
  if (used >= limit) return { error: t.ai.limit };

  const [p, tk, ms, rk] = await Promise.all([
    supabase.from("projects").select("name, client_id, method, phase, status, objective, sponsor, start_date, end_date, budget").eq("id", projectId).maybeSingle(),
    supabase.from("tasks").select("title, status, due_date").eq("project_id", projectId).order("created_at"),
    supabase.from("milestones").select("title, due_date, done").eq("project_id", projectId).order("due_date", { nullsFirst: false }),
    supabase.from("risks").select("title, score, response, status").eq("project_id", projectId).order("score", { ascending: false, nullsFirst: false }),
  ]);
  const proj = p.data as unknown as (Omit<ProjectFacts, "client" | "tasks" | "milestones" | "risks"> & { client_id: string | null }) | null;
  if (!proj) return { error: "Project not found." };
  const client = proj.client_id ? await supabase.from("clients").select("name").eq("id", proj.client_id).maybeSingle() : { data: null };
  const facts: ProjectFacts = {
    ...proj,
    client: (client.data as unknown as { name: string } | null)?.name ?? null,
    tasks: (tk.data ?? []) as unknown as ProjectFacts["tasks"],
    milestones: (ms.data ?? []) as unknown as ProjectFacts["milestones"],
    risks: (rk.data ?? []) as unknown as ProjectFacts["risks"],
  };

  const { system, prompt } = buildPrompt(kind, facts, lang);
  let text: string;
  try {
    text = await provider.generate({ system, prompt });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The AI failed." };
  }

  // Count the call only once it worked, then save the draft as a note.
  const bump = await supabase.from("ai_usage").upsert({ workspace_id: workspaceId, day, calls: used + 1 }, { onConflict: "workspace_id,day" });
  if (bump.error) return { error: bump.error.message };
  const labels = { charter: t.ai.charter, status_report: t.ai.status_report, risk_review: t.ai.risk_review, meeting_agenda: t.ai.meeting_agenda, lessons: t.ai.lessons };
  const note = await supabase
    .from("notes")
    .insert({ workspace_id: workspaceId, project_id: projectId, title: draftTitle(kind, facts.name, labels), kind: "note", content: toContent(text) })
    .select("id")
    .single();
  if (note.error) return { error: note.error.message };
  revalidatePath("/notes");
  redirect(`/notes/${(note.data as unknown as { id: string }).id}`);
}
