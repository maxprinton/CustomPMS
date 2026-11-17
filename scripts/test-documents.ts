// Run: node --no-warnings --experimental-transform-types --import ./scripts/alias-loader.mjs scripts/test-documents.ts <fixtures dir>
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildProfile, detailsForForm, detailsFromForm, fillDocument, safeFileName } from "@/lib/documents";
import { readZip } from "@/lib/xlsx-fill";

const dir = process.argv[2];
if (!dir) throw new Error("Pass the fixtures folder.");
let failed = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (!cond) failed++;
  console.log(`${cond ? "ok  " : "FAIL"} ${name} ${extra}`);
};

const typed: Record<string, string> = { project_manager: "Max P.", scope_in: "New website\nTraining", assumptions: "Budget approved" };
const details = detailsFromForm((k) => typed[k] ?? "");
const profile = buildProfile({
  project: { name: "Warehouse Wi-Fi", code: "WH-01", method: "hybrid", objective: "Cover the whole warehouse by March", sponsor: "Ana Lopez", start_date: "2027-01-10", end_date: "2027-03-31", budget: 12000, profile: details },
  clientName: "LV Parts",
  workspaceName: "My workspace",
  contacts: [{ name: "Luis", role_title: "IT lead", email: null }],
  milestones: [{ title: "Survey done", due_date: "2027-01-20" }, { title: "Go live", due_date: null }],
  risks: [{ title: "Late hardware", response: "Order early" }],
});
ok("profile scalars", profile.scalars.project_name?.en === "Warehouse Wi-Fi" && profile.scalars.customer?.en === "LV Parts" && profile.scalars.approach?.es === "Híbrido");
ok("profile keeps details", profile.scalars.project_manager?.en === "Max P." && profile.lists.scope_in?.length === 2);
ok("profile tables", profile.tables.milestones?.length === 2 && profile.tables.risks?.[0].response?.en === "Order early" && profile.tables.stakeholders?.[0].role?.en === "IT lead");
ok("details round trip", detailsForForm(details).scope_in === "New website\nTraining");
ok("safe name", safeFileName("es-PLN-06-Cronograma e hitos (Gantt).xlsx") === "es-PLN-06-Cronograma-e-hitos-Gantt.xlsx", safeFileName("es-PLN-06-Cronograma e hitos (Gantt).xlsx"));

const dec = new TextDecoder();
for (const f of readdirSync(dir)) {
  const bytes = new Uint8Array(readFileSync(join(dir, f)));
  const lang = f.includes("-es") ? "es" : "en";
  const r = await fillDocument(f, bytes, profile, lang);
  let text = "";
  if (/\.(docx|xlsx|pptx)$/.test(f)) {
    for (const e of readZip(r.bytes)) if (/\.xml$/.test(e.name)) text += typeof e.content === "string" ? e.content : dec.decode(e.content);
  } else {
    text = dec.decode(r.bytes);
  }
  ok(`fill ${f}`, r.fillable && r.filled > 0 && text.includes("Warehouse Wi-Fi"), `filled=${r.filled} skipped=${r.skipped.length}`);
}
const odd = await fillDocument("photo.png", new Uint8Array([1, 2, 3]), profile, "en");
ok("unknown file passes through", !odd.fillable && odd.bytes.length === 3);
const broken = await fillDocument("broken.docx", new Uint8Array([1, 2, 3]), profile, "en");
ok("broken file passes through", !broken.fillable && broken.bytes.length === 3);
if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log("all passed");
