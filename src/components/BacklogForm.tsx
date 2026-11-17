import { addBacklogItem } from "@/app/actions";
import type { Dict } from "@/lib/i18n";
import { BACKLOG_TYPES } from "@/lib/options";

export default function BacklogForm({ t, projectId, projects }: { t: Dict; projectId?: string; projects?: { id: string; name: string }[] }) {
  return (
    <form action={addBacklogItem} className="card flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-48 flex-1">
        <label className="label">
          {t.backlog.new}
          <input name="title" required className="input mt-1" />
        </label>
      </div>
      <label className="label">
        {t.backlog.type}
        <select name="type" className="input mt-1">
          {BACKLOG_TYPES.map((x) => (
            <option key={x} value={x}>{t.backlog[x]}</option>
          ))}
        </select>
      </label>
      {projectId ? (
        <input type="hidden" name="project_id" value={projectId} />
      ) : (
        <label className="label">
          {t.backlog.project}
          <select name="project_id" className="input mt-1">
            <option value="">-</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      )}
      <button className="btn">{t.common.add}</button>
    </form>
  );
}
