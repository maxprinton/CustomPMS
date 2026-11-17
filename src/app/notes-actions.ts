"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/workspace";
import { NOTE_KINDS, TAG_ENTITIES, cleanTagName, toContent, type NoteKind, type TagEntity } from "@/lib/notes";
import { pick } from "@/lib/options";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}
const orNull = (v: string) => (v === "" ? null : v);
function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function createNote(fd: FormData) {
  const { supabase, workspaceId } = await getContext();
  const { data, error } = await supabase
    .from("notes")
    .insert({
      workspace_id: workspaceId,
      title: str(fd, "title") || "Untitled",
      kind: pick(NOTE_KINDS, str(fd, "kind"), "note"),
      project_id: orNull(str(fd, "project_id")),
      client_id: orNull(str(fd, "client_id")),
    })
    .select("id")
    .single();
  fail(error);
  revalidatePath("/notes");
  redirect(`/notes/${(data as unknown as { id: string }).id}`);
}

export async function saveNote(fd: FormData) {
  const { supabase } = await getContext();
  const id = str(fd, "id");
  if (!id) return;
  const kind: NoteKind = pick(NOTE_KINDS, str(fd, "kind"), "note");
  fail(
    (
      await supabase
        .from("notes")
        .update({
          title: str(fd, "title") || "Untitled",
          kind,
          project_id: orNull(str(fd, "project_id")),
          client_id: orNull(str(fd, "client_id")),
          content: toContent(String(fd.get("body") ?? "")),
        })
        .eq("id", id)
    ).error
  );
  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
}

export async function deleteNote(fd: FormData) {
  const { supabase } = await getContext();
  const id = str(fd, "id");
  if (!id) return;
  fail((await supabase.from("notes").update({ deleted_at: new Date().toISOString() }).eq("id", id)).error);
  revalidatePath("/notes");
  redirect("/notes");
}

/** Adds a tag (created on first use) to a note, project or client. */
export async function addTag(fd: FormData) {
  const { supabase, workspaceId } = await getContext();
  const entity = pick(TAG_ENTITIES, str(fd, "entity_type"), "note") as TagEntity;
  const entity_id = str(fd, "entity_id");
  const name = cleanTagName(str(fd, "name"));
  if (!entity_id || !name) return;
  const found = await supabase.from("tags").select("id").eq("workspace_id", workspaceId).ilike("name", name).maybeSingle();
  let tagId = (found.data as unknown as { id: string } | null)?.id;
  if (!tagId) {
    const made = await supabase.from("tags").insert({ workspace_id: workspaceId, name }).select("id").single();
    fail(made.error);
    tagId = (made.data as unknown as { id: string }).id;
  }
  const link = await supabase.from("links").upsert({ workspace_id: workspaceId, tag_id: tagId, entity_type: entity, entity_id }, { onConflict: "tag_id,entity_type,entity_id", ignoreDuplicates: true });
  fail(link.error);
  revalidatePath(str(fd, "path") || "/notes");
}

export async function removeTag(fd: FormData) {
  const { supabase } = await getContext();
  const id = str(fd, "link_id");
  if (!id) return;
  fail((await supabase.from("links").delete().eq("id", id)).error);
  revalidatePath(str(fd, "path") || "/notes");
}
