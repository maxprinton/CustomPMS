// What the Backlog and Dashboard panels need in one go (server only): steps, test missions, items due for the real-use check.
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectTests, listItems, listSteps, listTests, loadSettings, type StepRow, type TestRow } from "@/lib/backlog/data";
import { capsFrom, verifyDueItems, type BacklogItem, type BacklogSettings } from "@/lib/backlog/board";
import type { Caps } from "@/lib/backlog/rules";

export type Panels = {
  items: BacklogItem[];
  settings: BacklogSettings;
  caps: Caps;
  due: BacklogItem[];
  pendingSteps: StepRow[];
  recentSteps: StepRow[];
  tests: TestRow[];
  nowIso: string;
  error?: string;
};

export async function loadPanels(sb: SupabaseClient, ws: string, opts: { allTests?: boolean } = {}): Promise<Panels> {
  const now = new Date();
  try {
    await detectTests(sb, ws);
  } catch {
    // detection is a convenience; the page still works without it
  }
  const [list, settings, pendingSteps, recentSteps, tests] = await Promise.all([
    listItems(sb, ws),
    loadSettings(sb, ws),
    listSteps(sb, ws, { status: "pending" }),
    listSteps(sb, ws, { status: "done", limit: 8 }),
    listTests(sb, ws, opts.allTests ? {} : { open: true }),
  ]);
  const ordered = [...tests.filter((x) => x.status === "detected"), ...tests.filter((x) => x.status !== "detected")];
  return {
    items: list.items,
    settings,
    caps: capsFrom(settings),
    due: verifyDueItems(list.items, now, settings.verify_days),
    pendingSteps,
    recentSteps,
    tests: ordered,
    nowIso: now.toISOString(),
    error: list.error,
  };
}
