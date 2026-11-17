"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/workspace";
import { LANG_COOKIE } from "@/lib/i18n";
import { BACKLOG_STATUSES, BACKLOG_TYPES, METHODS, PHASES, PROJECT_STATUSES, TASK_STATUSES, pick } from "@/lib/options";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}
function orNull(v: string): string | null {
  return v === "" ? null : v;
}
function level(v: string): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}
function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function setLang(fd: FormData) {
  const lang = str(fd, "lang") === "es" ? "es" : "en";
  const store = await cookies();
  store.set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function renameWorkspace(fd: FormData) {
  const { supabase, workspaceId } = await getContext();
  const name = str(fd, "name");
  if (!name) return;
  fail((await supabase.from("workspaces").update({ name }).eq("id", workspaceId)).error);
  revalidatePath("/", "layout");
}

export async function createClientRecord(fd: FormData) {
  const { supabase, workspaceId } = await getContext();
  const name = str(fd, "name");
  if (!name) return;
  const kind = str(fd, "kind") === "internal" ? "internal" : "external";
  fail((await supabase.from("clients").insert({ workspace_id: workspaceId, name, kind, notes: orNull(str(fd, "notes")) })).error);
  revalidatePath("/clients");
}

export async function createContact(fd: FormData) {
  const { supabase, workspaceId } = await getContext();
  const client_id = str(fd, "client_id");
  const name = str(fd, "name");
  if (!name || !client_id) return;
  fail(
    (
      await supabase.from("contacts").insert({
        workspace_id: workspaceId,
        client_id,
        name,
        email: orNull(str(fd, "email")),
        phone: orNull(str(fd, "phone")),
        role_title: orNull(str(fd, "role_title")),
      })
    ).error
  );
  revalidatePath(`/clients/${client_id}`);
}

export async function createProject(fd: FormData) {
  const { supabase, workspaceId } = await getContext();
  const name = str(fd, "name");
  if (!name) return;
  const { data, error } = await supabase
    .from("projects")
    .insert({
      workspace_id: workspaceId,
      name,
      client_id: orNull(str(fd, "client_id")),
      method: pick(METHODS, str(fd, "method"), "predictive"),
    })
    .select("id")
    .single();
  fail(error);
  revalidatePath("/projects");
  redirect(`/projects/${(data as unknown as { id: string }).id}`);
}

export async function updateProject(fd: FormData) {
  const { supabase } = await getContext();
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!id || !name) return;
  const budget = str(fd, "budget");
  fail(
    (
      await supabase
        .from("projects")
        .update({
          name,
          client_id: orNull(str(fd, "client_id")),
          method: pick(METHODS, str(fd, "method"), "predictive"),
          phase: pick(PHASES, str(fd, "phase"), "initiation"),
          status: pick(PROJECT_STATUSES, str(fd, "status"), "active"),
          objective: orNull(str(fd, "objective")),
          sponsor: orNull(str(fd, "sponsor")),
          start_date: orNull(str(fd, "start_date")),
          end_date: orNull(str(fd, "end_date")),
          budget: budget === "" || Number.isNaN(Number(budget)) ? null : Number(budget),
        })
        .eq("id", id)
    ).error
  );
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
}

export async function addTask(fd: FormData) {
  const { supabase, workspaceId } = await getContext();
  const project_id = str(fd, "project_id");
  const title = str(fd, "title");
  if (!title || !project_id) return;
  fail((await supabase.from("tasks").insert({ workspace_id: workspaceId, project_id, title, due_date: orNull(str(fd, "due_date")) })).error);
  revalidatePath(`/projects/${project_id}`);
}

export async function setTaskStatus(fd: FormData) {
  const { supabase } = await getContext();
  const id = str(fd, "id");
  if (!id) return;
  fail((await supabase.from("tasks").update({ status: pick(TASK_STATUSES, str(fd, "status"), "todo") }).eq("id", id)).error);
  revalidatePath(`/projects/${str(fd, "project_id")}`);
}

export async function addMilestone(fd: FormData) {
  const { supabase, workspaceId } = await getContext();
  const project_id = str(fd, "project_id");
  const title = str(fd, "title");
  if (!title || !project_id) return;
  fail((await supabase.from("milestones").insert({ workspace_id: workspaceId, project_id, title, due_date: orNull(str(fd, "due_date")) })).error);
  revalidatePath(`/projects/${project_id}`);
}

export async function toggleMilestone(fd: FormData) {
  const { supabase } = await getContext();
  const id = str(fd, "id");
  if (!id) return;
  fail((await supabase.from("milestones").update({ done: str(fd, "done") === "true" }).eq("id", id)).error);
  revalidatePath(`/projects/${str(fd, "project_id")}`);
}

export async function addRisk(fd: FormData) {
  const { supabase, workspaceId } = await getContext();
  const project_id = str(fd, "project_id");
  const title = str(fd, "title");
  if (!title || !project_id) return;
  fail(
    (
      await supabase.from("risks").insert({
        workspace_id: workspaceId,
        project_id,
        title,
        probability: level(str(fd, "probability")),
        impact: level(str(fd, "impact")),
        response: orNull(str(fd, "response")),
      })
    ).error
  );
  revalidatePath(`/projects/${project_id}`);
}

export async function addBacklogItem(fd: FormData) {
  const { supabase, workspaceId } = await getContext();
  const title = str(fd, "title");
  if (!title) return;
  const project_id = orNull(str(fd, "project_id"));
  fail(
    (
      await supabase.from("backlog_items").insert({
        workspace_id: workspaceId,
        title,
        project_id,
        type: pick(BACKLOG_TYPES, str(fd, "type"), "feature"),
      })
    ).error
  );
  revalidatePath("/backlog");
  if (project_id) revalidatePath(`/projects/${project_id}`);
}

export async function moveBacklogItem(fd: FormData) {
  const { supabase } = await getContext();
  const id = str(fd, "id");
  if (!id) return;
  fail((await supabase.from("backlog_items").update({ status: pick(BACKLOG_STATUSES, str(fd, "status"), "inbox") }).eq("id", id)).error);
  revalidatePath("/backlog");
  const project_id = str(fd, "project_id");
  if (project_id) revalidatePath(`/projects/${project_id}`);
}
