"use server";

// Backlog: server actions for the screens (board, item page, quick add, settings, steps, test missions).
// The rules are enforced by the database trigger; src/lib/backlog/data.ts also checks them first for a plain message.
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/workspace";
import {
  addItem,
  answerTest,
  closeStep,
  markTestDone,
  listItems,
  loadSettings,
  moveItem,
  placeItem,
  removeItem,
  resolveVerify,
  saveSettings,
  updateItem,
  type ItemPatch,
  type VerifyResult,
} from "@/lib/backlog/data";
import { triageSnapshot, type BacklogItem, type Triage } from "@/lib/backlog/board";
import { SIZES, TYPES, type BacklogSize, type BacklogStatus, type BacklogType } from "@/lib/backlog/rules";

export type BacklogActionResult = { ok?: boolean; error?: string; message?: string; triage?: Triage; item?: BacklogItem };
export type FormState = { ok?: boolean; error?: string; at?: number } | null;

function refresh() {
  revalidatePath("/backlog");
  revalidatePath("/");
  revalidatePath("/projects/[id]", "page");
}

async function bctx() {
  const c = await getContext();
  if (!c.canWrite) throw new Error("You have read-only access.");
  return { supabase: c.supabase, ws: c.workspaceId };
}
const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

/** One sentence into the Inbox: the quick-add box. */
export async function addIdea(input: { title: string; type?: BacklogType; project_id?: string | null }): Promise<BacklogActionResult> {
  try {
    const c = await bctx();
    const r = await addItem(c.supabase, c.ws, { title: input.title, type: input.type, project_id: input.project_id, source: "web" });
    if (!r.ok) return { error: r.error };
    refresh();
    return { ok: true, message: `BL-${r.item.number}`, item: r.item };
  } catch (e) {
    return { error: msg(e) };
  }
}

/** Moves an item; after Verifying or Done it also returns the 30-second prompt data. */
export async function moveItemAction(input: {
  number: number;
  to: BacklogStatus;
  size?: BacklogSize | null;
  spec_link?: string | null;
  parked_reason?: string | null;
}): Promise<BacklogActionResult> {
  try {
    const c = await bctx();
    const r = await moveItem(c.supabase, c.ws, input.number, input.to, {
      size: input.size,
      spec_link: input.spec_link,
      parked_reason: input.parked_reason,
    });
    if (!r.ok) return { error: r.error };
    refresh();
    return { ok: true, item: r.item, message: r.reopened ? "reopened" : undefined, triage: await maybeTriage(c, input.to) };
  } catch (e) {
    return { error: msg(e) };
  }
}

async function maybeTriage(c: Awaited<ReturnType<typeof bctx>>, to: BacklogStatus): Promise<Triage | undefined> {
  if (to !== "verifying" && to !== "done") return undefined;
  const settings = await loadSettings(c.supabase, c.ws);
  if (!settings.triage_prompt) return undefined;
  const { items } = await listItems(c.supabase, c.ws);
  return triageSnapshot(items, settings);
}

/** The one-week check: it worked / it did not / still testing. */
export async function resolveVerifyAction(input: { number: number; result: VerifyResult }): Promise<BacklogActionResult> {
  try {
    const c = await bctx();
    const r = await resolveVerify(c.supabase, c.ws, input.number, input.result);
    if (!r.ok) return { error: r.error };
    refresh();
    return { ok: true, message: input.result, triage: input.result === "worked" ? await maybeTriage(c, "done") : undefined };
  } catch (e) {
    return { error: msg(e) };
  }
}

const num = (v: unknown): number | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return Number(v);
};

export async function saveItem(input: {
  number: number;
  title?: string;
  type?: BacklogType;
  project_id?: string | null;
  size?: BacklogSize | "" | null;
  area?: string | null;
  spec_link?: string | null;
  notes?: string | null;
  value?: number | string | null;
  effort?: number | string | null;
}): Promise<BacklogActionResult> {
  try {
    const c = await bctx();
    const size = input.size === "" ? null : input.size;
    if (size !== undefined && size !== null && !SIZES.includes(size)) return { error: "Size must be S, M or L." };
    if (input.type !== undefined && !TYPES.includes(input.type)) return { error: "Unknown type." };
    const patch: ItemPatch = {
      title: input.title,
      type: input.type,
      project_id: input.project_id,
      size,
      area: input.area,
      spec_link: input.spec_link,
      notes: input.notes,
      value: num(input.value),
      effort: num(input.effort),
    };
    const r = await updateItem(c.supabase, c.ws, input.number, patch);
    if (!r.ok) return { error: r.error };
    refresh();
    revalidatePath(`/backlog/${input.number}`);
    return { ok: true, item: r.item, message: "saved" };
  } catch (e) {
    return { error: msg(e) };
  }
}

/** Manual order inside a column (the up / down buttons). */
export async function placeItemAction(input: { number: number; target: number; where: "before" | "after" }): Promise<BacklogActionResult> {
  try {
    const c = await bctx();
    const r = await placeItem(c.supabase, c.ws, input.number, input.target, input.where);
    if (!r.ok) return { error: r.error };
    refresh();
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function deleteItemAction(input: { number: number }): Promise<BacklogActionResult> {
  try {
    const c = await bctx();
    const r = await removeItem(c.supabase, c.ws, input.number);
    if (!r.ok) return { error: r.error };
    refresh();
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function saveBacklogSettings(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const c = await bctx();
    const r = await saveSettings(c.supabase, c.ws, {
      now_cap: Number(form.get("now_cap")),
      next_cap: Number(form.get("next_cap")),
      verifying_cap: Number(form.get("verifying_cap")),
      verify_days: Number(form.get("verify_days")),
      triage_prompt: form.get("triage_prompt") === "on",
    });
    if (!r.ok) return { error: r.error };
    refresh();
    revalidatePath("/settings");
    return { ok: true, at: Date.now() };
  } catch (e) {
    return { error: msg(e) };
  }
}

/** Waiting-on-you queue: the user taps Done or Skip on a step. */
export async function finishStep(id: string, how: "done" | "skipped"): Promise<BacklogActionResult> {
  try {
    const c = await bctx();
    const r = await closeStep(c.supabase, c.ws, id, how);
    if (!r.ok) return { error: r.error };
    refresh();
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

/** Test missions: "I did it" (no automatic trace) and the "did it work?" answer. */
export async function markMissionDone(id: string): Promise<BacklogActionResult> {
  try {
    const c = await bctx();
    const r = await markTestDone(c.supabase, c.ws, id);
    if (!r.ok) return { error: r.error };
    refresh();
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function answerMission(id: string, result: "worked" | "problem" | "skipped", note?: string): Promise<BacklogActionResult> {
  try {
    const c = await bctx();
    const r = await answerTest(c.supabase, c.ws, id, result, note ?? "");
    if (!r.ok) return { error: r.error };
    refresh();
    return { ok: true, message: r.bug ? `BL-${r.bug}` : undefined };
  } catch (e) {
    return { error: msg(e) };
  }
}
