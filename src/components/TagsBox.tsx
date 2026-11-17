import { addTag, removeTag } from "@/app/notes-actions";
import type { Dict } from "@/lib/i18n";
import type { TagEntity } from "@/lib/notes";
import type { SupabaseClient } from "@supabase/supabase-js";

type LinkRow = { id: string; tags: { name: string } | { name: string }[] | null };

/** Tags on a note, project or client: chips with a remove button and a box to add one. */
export default async function TagsBox({ supabase, entityType, entityId, path, t, canWrite }: {
  supabase: SupabaseClient;
  entityType: TagEntity;
  entityId: string;
  path: string;
  t: Dict;
  canWrite: boolean;
}) {
  const { data } = await supabase.from("links").select("id, tags(name)").eq("entity_type", entityType).eq("entity_id", entityId).order("created_at");
  const rows = ((data ?? []) as unknown as LinkRow[]).map((r) => ({ id: r.id, name: Array.isArray(r.tags) ? r.tags[0]?.name : r.tags?.name })).filter((r) => r.name);
  return (
    <section className="card space-y-2 p-4">
      <h2 className="text-sm font-semibold">{t.notes.tags}</h2>
      <div className="flex flex-wrap gap-1">
        {rows.length === 0 && <p className="text-sm text-muted">{t.notes.noTags}</p>}
        {rows.map((r) => (
          <form key={r.id} action={removeTag} className="badge flex items-center gap-1">
            <input type="hidden" name="link_id" value={r.id} />
            <input type="hidden" name="path" value={path} />
            #{r.name}
            {canWrite && <button aria-label={`${t.notes.removeTag}: ${r.name}`} className="px-1">×</button>}
          </form>
        ))}
      </div>
      {canWrite && (
        <form action={addTag} className="flex gap-2">
          <input type="hidden" name="entity_type" value={entityType} />
          <input type="hidden" name="entity_id" value={entityId} />
          <input type="hidden" name="path" value={path} />
          <input name="name" required maxLength={40} placeholder={t.notes.addTag} aria-label={t.notes.addTag} className="input input-sm" />
          <button className="btn-quiet">{t.common.add}</button>
        </form>
      )}
    </section>
  );
}
