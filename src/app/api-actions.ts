"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/workspace";
import { displayPrefix, generateKey, hashKey } from "@/lib/api/keys";
import { newSecret, parseEvents } from "@/lib/api/webhooks";

export type KeyState = { key?: string; error?: string } | null;

async function owner() {
  const c = await getContext();
  if (c.role !== "owner") throw new Error("Only the owner can manage keys and webhooks.");
  return c;
}

/** Creates a key. Only its hash is stored; the key is returned once. */
export async function createApiKey(_prev: KeyState, fd: FormData): Promise<KeyState> {
  try {
    const { supabase, workspaceId, user } = await owner();
    const name = String(fd.get("name") ?? "").trim().slice(0, 80);
    if (!name) return { error: "Give the key a name." };
    const key = generateKey();
    const { error } = await supabase.from("api_keys").insert({ workspace_id: workspaceId, name, key_prefix: displayPrefix(key), key_hash: hashKey(key), created_by: user.id });
    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { key };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function revokeApiKey(fd: FormData) {
  const { supabase } = await owner();
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const { error } = await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("revoked_at", null);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function addWebhook(fd: FormData) {
  const { supabase, workspaceId } = await owner();
  const url = String(fd.get("url") ?? "").trim();
  if (!/^https:\/\/[^\s]+$/.test(url)) throw new Error("The address must start with https://");
  const { error } = await supabase.from("webhooks").insert({ workspace_id: workspaceId, url, secret: newSecret(), events: parseEvents(String(fd.get("events") ?? "")) });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function deleteWebhook(fd: FormData) {
  const { supabase } = await owner();
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const { error } = await supabase.from("webhooks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
