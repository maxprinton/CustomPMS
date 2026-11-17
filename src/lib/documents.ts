// Turns a CPMS project (its columns, its client, its milestones and risks, and the extra "document details")
// into the profile the fill engine understands, then fills a template file with it.
import { cleanProfile, resolveValues, type Bi, type ProfileData } from "@/lib/file-templates/fields";
import { autoItems } from "@/lib/file-templates/fill/common";
import { fillFile, fillKindOf, scanFile, type FillReport } from "@/lib/file-templates/fill";
import type { Lang } from "@/lib/file-templates/types";

export const FILES_BUCKET = "cpms-files";

export type ProjectForDocs = {
  name: string;
  code: string | null;
  method: string;
  objective: string | null;
  sponsor: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  profile: unknown;
};

export type DocsContext = {
  project: ProjectForDocs;
  clientName: string | null;
  workspaceName: string;
  contacts: { name: string; role_title: string | null; email: string | null }[];
  milestones: { title: string; due_date: string | null }[];
  risks: { title: string; response: string | null }[];
};

const APPROACH: Record<string, Bi> = {
  predictive: { en: "Predictive", es: "Predictivo" },
  agile: { en: "Agile", es: "Ágil" },
  hybrid: { en: "Hybrid", es: "Híbrido" },
};

const one = (v: string | null | undefined): Bi | null => (v && v.trim() ? { en: v.trim() } : null);

/** Extra details typed on the project page (kept in projects.profile) plus everything the project already knows. */
export function buildProfile(ctx: DocsContext): ProfileData {
  const p = cleanProfile(ctx.project.profile);
  const set = (key: string, v: Bi | null) => {
    if (v) p.scalars[key] = v;
  };
  set("project_name", one(ctx.project.name));
  set("project_code", one(ctx.project.code));
  set("project_goal", one(ctx.project.objective));
  set("sponsor", one(ctx.project.sponsor));
  set("customer", one(ctx.clientName));
  set("approach", APPROACH[ctx.project.method] ?? null);
  set("start_date", one(ctx.project.start_date));
  set("end_date", one(ctx.project.end_date));
  if (ctx.project.budget !== null) set("budget", one(String(ctx.project.budget)));
  if (!p.scalars.organization) set("organization", one(ctx.workspaceName));

  const rows = (list: Record<string, string | null>[]) =>
    list
      .map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, { en: (v as string).trim() }])) as Record<string, Bi>)
      .filter((r) => Object.keys(r).length);
  const milestones = rows(ctx.milestones.map((m) => ({ name: m.title, date: m.due_date })));
  if (milestones.length) p.tables.milestones = milestones;
  const risks = rows(ctx.risks.map((r) => ({ risk: r.title, response: r.response })));
  if (risks.length) p.tables.risks = risks;
  const stakeholders = rows(ctx.contacts.map((c) => ({ name: c.name, role: c.role_title })));
  if (stakeholders.length && !p.tables.stakeholders) p.tables.stakeholders = stakeholders;
  return p;
}

export const DETAIL_SCALARS = ["organization", "project_manager", "prepared_by"] as const;
export const DETAIL_LISTS = ["scope_in", "scope_out", "success_criteria", "assumptions", "constraints"] as const;

/** The "document details" form: three one-line fields and five lists typed one item per line. */
export function detailsFromForm(get: (key: string) => string): ProfileData {
  const scalars: Record<string, string> = {};
  for (const k of DETAIL_SCALARS) scalars[k] = get(k);
  const lists: Record<string, string[]> = {};
  for (const k of DETAIL_LISTS) lists[k] = get(k).split("\n").map((x) => x.trim()).filter(Boolean);
  return cleanProfile({ scalars, lists });
}

export function detailsForForm(profile: unknown): Record<string, string> {
  const p = cleanProfile(profile);
  const out: Record<string, string> = {};
  for (const k of DETAIL_SCALARS) out[k] = p.scalars[k]?.en ?? p.scalars[k]?.es ?? "";
  for (const k of DETAIL_LISTS) out[k] = (p.lists[k] ?? []).map((x) => x.en ?? x.es ?? "").join("\n");
  return out;
}

export type FillResult = { bytes: Uint8Array; filled: number; skipped: string[]; fillable: boolean };

/** Fills every blank the engine is sure about. Files it cannot read come back unchanged. */
export async function fillDocument(fileName: string, bytes: Uint8Array, profile: ProfileData, lang: Lang, version = 1): Promise<FillResult> {
  if (!fillKindOf(fileName)) return { bytes, filled: 0, skipped: [], fillable: false };
  const report: FillReport = { filled: 0, skipped: [] };
  try {
    const items = autoItems(await scanFile(fileName, bytes));
    if (!items.length) return { bytes, filled: 0, skipped: [], fillable: true };
    const values = resolveValues(profile, lang, { version: `${version}.0` });
    const out = await fillFile(fileName, bytes, items, values, report);
    return { bytes: out, filled: report.filled, skipped: report.skipped.slice(0, 30), fillable: true };
  } catch {
    return { bytes, filled: 0, skipped: [], fillable: false };
  }
}

export function safeFileName(name: string) {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
  return cleaned.slice(-120) || "file";
}
