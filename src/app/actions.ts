"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/workspace";
import { LANG_COOKIE } from "@/lib/i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import { FILES_BUCKET, buildProfile, detailsFromForm, fillDocument, safeFileName, type ProjectForDocs } from "@/lib/documents";
import { METHODS, PHASES, PROJECT_STATUSES, TASK_STATUSES, pick } from "@/lib/options";

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

export async function saveDocDetails(fd: FormData) {
  const { supabase } = await getContext();
  const id = str(fd, "id");
  if (!id) return;
  fail((await supabase.from("projects").update({ profile: detailsFromForm((k) => str(fd, k)) }).eq("id", id)).error);
  revalidatePath(`/projects/${id}`);
}

/** Makes a working copy of one template file for a project, with every blank the engine is sure about filled in. */
export async function makeCopy(fd: FormData) {
  const { supabase, workspaceId, workspaceName } = await getContext();
  const project_id = str(fd, "project_id");
  const file_id = str(fd, "file_id");
  if (!project_id || !file_id) return;
  const admin = createAdminClient();
  if (!admin) throw new Error("File storage is not set up yet.");

  const [f, p] = await Promise.all([
    supabase.from("template_files").select("id, template_id, lang, storage_path, file_name, mime").eq("id", file_id).maybeSingle(),
    supabase.from("projects").select("id, name, code, method, objective, sponsor, start_date, end_date, budget, profile, client_id").eq("id", project_id).maybeSingle(),
  ]);
  const file = f.data as unknown as { id: string; template_id: string; lang: "en" | "es"; storage_path: string; file_name: string | null; mime: string | null } | null;
  const project = p.data as unknown as (ProjectForDocs & { id: string; client_id: string | null }) | null;
  if (!file || !project) throw new Error("Template or project not found.");

  const [t, c, k, m, r] = await Promise.all([
    supabase.from("templates").select("code, name, name_es").eq("id", file.template_id).maybeSingle(),
    project.client_id ? supabase.from("clients").select("name").eq("id", project.client_id).maybeSingle() : Promise.resolve({ data: null }),
    project.client_id ? supabase.from("contacts").select("name, role_title, email").eq("client_id", project.client_id).order("name") : Promise.resolve({ data: [] }),
    supabase.from("milestones").select("title, due_date").eq("project_id", project_id).order("due_date", { nullsFirst: false }),
    supabase.from("risks").select("title, response").eq("project_id", project_id).order("score", { ascending: false, nullsFirst: false }),
  ]);
  const template = t.data as unknown as { code: string; name: string; name_es: string | null } | null;
  const profile = buildProfile({
    project,
    clientName: (c.data as unknown as { name: string } | null)?.name ?? null,
    workspaceName,
    contacts: (k.data ?? []) as unknown as { name: string; role_title: string | null; email: string | null }[],
    milestones: (m.data ?? []) as unknown as { title: string; due_date: string | null }[],
    risks: (r.data ?? []) as unknown as { title: string; response: string | null }[],
  });

  const original = await admin.storage.from(FILES_BUCKET).download(file.storage_path);
  if (original.error || !original.data) throw new Error("Could not read the template file.");
  const sourceName = file.file_name ?? "template";
  const result = await fillDocument(sourceName, new Uint8Array(await original.data.arrayBuffer()), profile, file.lang);

  const id = crypto.randomUUID();
  const file_name = safeFileName(`${project.code || project.name}-${sourceName}`);
  const storage_path = `ws/${workspaceId}/copies/${id}/${file_name}`;
  const title = `${template?.code ?? ""} ${(file.lang === "es" && template?.name_es) || template?.name || sourceName}`.trim();
  fail(
    (
      await supabase.from("template_copies").insert({
        id,
        workspace_id: workspaceId,
        template_id: file.template_id,
        project_id,
        client_id: project.client_id,
        title,
        lang: file.lang,
        source_file_id: file.id,
        storage_path,
        file_name,
        filled: { filled: result.filled, skipped: result.skipped, fillable: result.fillable },
        filled_at: new Date().toISOString(),
      })
    ).error
  );
  const up = await admin.storage.from(FILES_BUCKET).upload(storage_path, result.bytes, { contentType: file.mime ?? "application/octet-stream" });
  if (up.error) {
    await supabase.from("template_copies").delete().eq("id", id);
    throw new Error("Could not save the filled copy.");
  }
  revalidatePath(`/projects/${project_id}`);
}
