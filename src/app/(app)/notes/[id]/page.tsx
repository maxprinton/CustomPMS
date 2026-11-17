import Link from "next/link";
import { notFound } from "next/navigation";
import TagsBox from "@/components/TagsBox";
import { deleteNote, saveNote } from "@/app/notes-actions";
import { getDict } from "@/lib/i18n";
import { NOTE_KINDS, noteText } from "@/lib/notes";
import { getContext } from "@/lib/workspace";

type Note = { id: string; title: string; kind: (typeof NOTE_KINDS)[number]; project_id: string | null; client_id: string | null; content: unknown; updated_at: string };

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ t, lang }, { supabase, canWrite }] = await Promise.all([getDict(), getContext()]);
  const [n, p, c] = await Promise.all([
    supabase.from("notes").select("id, title, kind, project_id, client_id, content, updated_at").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("projects").select("id, name").eq("archived", false).order("name"),
    supabase.from("clients").select("id, name").eq("archived", false).order("name"),
  ]);
  const note = n.data as unknown as Note | null;
  if (!note) notFound();
  const projects = (p.data ?? []) as unknown as { id: string; name: string }[];
  const clients = (c.data ?? []) as unknown as { id: string; name: string }[];
  const fmt = new Intl.DateTimeFormat(lang === "es" ? "es" : "en", { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <p className="text-sm"><Link href="/notes" className="underline">← {t.notes.back}</Link></p>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <form action={saveNote} className="card space-y-3 p-4">
          <input type="hidden" name="id" value={note.id} />
          <fieldset disabled={!canWrite} className="space-y-3">
            <label className="label">{t.common.name}<input name="title" required defaultValue={note.title} className="input mt-1" /></label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="label">{t.notes.kind}
                <select name="kind" defaultValue={note.kind} className="input mt-1">{NOTE_KINDS.map((k) => <option key={k} value={k}>{t.notes[k]}</option>)}</select>
              </label>
              <label className="label">{t.notes.project}
                <select name="project_id" defaultValue={note.project_id ?? ""} className="input mt-1"><option value="">-</option>{projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              </label>
              <label className="label">{t.notes.client}
                <select name="client_id" defaultValue={note.client_id ?? ""} className="input mt-1"><option value="">-</option>{clients.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              </label>
            </div>
            <label className="label">{t.notes.body}<textarea name="body" rows={18} defaultValue={noteText(note.content)} className="input mt-1 font-mono text-sm" /></label>
          </fieldset>
          <p className="text-xs text-muted">{t.notes.updated}: {fmt.format(new Date(note.updated_at))}</p>
          {canWrite && <button className="btn">{t.common.save}</button>}
        </form>
        <div className="space-y-3">
          <TagsBox supabase={supabase} entityType="note" entityId={note.id} path={`/notes/${note.id}`} t={t} canWrite={canWrite} />
          {canWrite && (
            <form action={deleteNote}>
              <input type="hidden" name="id" value={note.id} />
              <button className="btn-quiet">{t.notes.delete}</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
