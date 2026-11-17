import Link from "next/link";
import { createNote } from "@/app/notes-actions";
import { getDict } from "@/lib/i18n";
import { NOTE_KINDS, noteText } from "@/lib/notes";
import { getContext } from "@/lib/workspace";

type Row = { id: string; title: string; kind: (typeof NOTE_KINDS)[number]; project_id: string | null; client_id: string | null; content: unknown; updated_at: string };

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ project?: string; client?: string; kind?: string; q?: string }> }) {
  const sp = await searchParams;
  const [{ t, lang }, { supabase, canWrite }] = await Promise.all([getDict(), getContext()]);
  let query = supabase.from("notes").select("id, title, kind, project_id, client_id, content, updated_at").is("deleted_at", null).order("updated_at", { ascending: false }).limit(200);
  if (sp.project) query = query.eq("project_id", sp.project);
  if (sp.client) query = query.eq("client_id", sp.client);
  if (sp.kind && (NOTE_KINDS as readonly string[]).includes(sp.kind)) query = query.eq("kind", sp.kind);
  const [n, p, c] = await Promise.all([
    query,
    supabase.from("projects").select("id, name").eq("archived", false).order("name"),
    supabase.from("clients").select("id, name").eq("archived", false).order("name"),
  ]);
  const q = (sp.q ?? "").trim().toLowerCase();
  const notes = ((n.data ?? []) as unknown as Row[]).filter((x) => !q || x.title.toLowerCase().includes(q) || noteText(x.content).toLowerCase().includes(q));
  const projects = (p.data ?? []) as unknown as { id: string; name: string }[];
  const clients = (c.data ?? []) as unknown as { id: string; name: string }[];
  const pname = new Map(projects.map((x) => [x.id, x.name]));
  const fmt = new Intl.DateTimeFormat(lang === "es" ? "es" : "en", { dateStyle: "medium" });

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t.notes.title}</h1>
      <form className="flex flex-wrap items-center gap-2" method="get">
        <input name="q" defaultValue={sp.q ?? ""} placeholder={t.notes.search} aria-label={t.notes.search} className="input input-sm w-52" />
        <select name="kind" defaultValue={sp.kind ?? ""} aria-label={t.notes.kind} className="input input-sm">
          <option value="">{t.bl.allTypes}</option>
          {NOTE_KINDS.map((k) => <option key={k} value={k}>{t.notes[k]}</option>)}
        </select>
        <select name="project" defaultValue={sp.project ?? ""} aria-label={t.notes.project} className="input input-sm">
          <option value="">{t.notes.project}: {t.common.all}</option>
          {projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <button className="btn-quiet">{t.bl.search}</button>
      </form>
      {canWrite && (
        <form action={createNote} className="card flex flex-wrap items-end gap-3 p-4">
          <label className="label min-w-48 flex-1">{t.notes.new}<input name="title" required placeholder={t.notes.titlePlaceholder} className="input mt-1" /></label>
          <label className="label">{t.notes.kind}
            <select name="kind" className="input mt-1">{NOTE_KINDS.map((k) => <option key={k} value={k}>{t.notes[k]}</option>)}</select>
          </label>
          <label className="label">{t.notes.project}
            <select name="project_id" defaultValue={sp.project ?? ""} className="input mt-1"><option value="">-</option>{projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          </label>
          <label className="label">{t.notes.client}
            <select name="client_id" defaultValue={sp.client ?? ""} className="input mt-1"><option value="">-</option>{clients.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          </label>
          <button className="btn">{t.common.add}</button>
        </form>
      )}
      <div className="card">
        {notes.length === 0 && <p className="p-4 text-sm text-muted">{t.notes.none}</p>}
        {notes.map((x) => (
          <Link key={x.id} href={`/notes/${x.id}`} className="row">
            <span className="min-w-0">
              <span className="block truncate font-medium">{x.title}</span>
              <span className="block truncate text-sm text-muted">{noteText(x.content).replace(/\s+/g, " ").slice(0, 120)}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <span className="badge">{t.notes[x.kind]}</span>
              {x.project_id && pname.get(x.project_id) && <span className="badge">{pname.get(x.project_id)}</span>}
              <span className="badge">{fmt.format(new Date(x.updated_at))}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
