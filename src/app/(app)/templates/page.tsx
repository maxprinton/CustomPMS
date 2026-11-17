import { getDict } from "@/lib/i18n";
import { getContext } from "@/lib/workspace";

type TFile = { id: string; template_id: string; lang: string; file_name: string | null };
type Template = { id: string; code: string; name: string; name_es: string | null; phase: string | null; method: string | null; doc_type: string | null; workspace_id: string | null };

const PHASE_ORDER = ["INI", "PLN", "EXE", "MON", "CLO"];
const PHASE_KEY = { INI: "initiation", PLN: "planning", EXE: "execution", MON: "monitoring", CLO: "closing" } as const;

export default async function TemplatesPage() {
  const [{ t, lang }, { supabase }] = await Promise.all([getDict(), getContext()]);
  const { data } = await supabase.from("templates").select("id, code, name, name_es, phase, method, doc_type, workspace_id").eq("status", "active").order("code");
  const templates = (data ?? []) as unknown as Template[];
  const { data: fileRows } = await supabase.from("template_files").select("id, template_id, lang, file_name").order("lang");
  const files = (fileRows ?? []) as unknown as TFile[];
  const ext = (name: string | null) => (name?.split(".").pop() ?? "").toLowerCase();
  const phases = [...PHASE_ORDER, ...new Set(templates.map((x) => x.phase ?? "").filter((x) => !PHASE_ORDER.includes(x)))];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t.templates.title}</h1>
      {templates.length === 0 && <p className="card p-4 text-sm text-muted">{t.templates.empty}</p>}
      {phases.map((ph) => {
        const list = templates.filter((x) => (x.phase ?? "") === ph);
        if (list.length === 0) return null;
        const key = PHASE_KEY[ph as keyof typeof PHASE_KEY];
        return (
          <section key={ph}>
            <h2 className="mb-2 font-medium">
              {key ? t.phase[key] : ph || "-"} <span className="badge tabular-nums">{list.length}</span>
            </h2>
            <div className="card">
              {list.map((x) => (
                <div key={x.id} className="row">
                  <div className="min-w-0">
                    <p>{(lang === "es" && x.name_es) || x.name}</p>
                    <p className="text-sm text-muted">{x.code}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {files
                      .filter((f) => f.template_id === x.id)
                      .map((f) => (
                        <a key={f.id} href={`/api/files/template/${f.id}`} className="chip">
                          {f.lang.toUpperCase()} .{ext(f.file_name)}
                        </a>
                      ))}
                    {x.method && <span className="badge">{x.method}</span>}
                    <span className="badge">{x.workspace_id ? t.templates.mine : t.templates.builtIn}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
