import AutoSelect from "@/components/AutoSelect";
import { moveBacklogItem } from "@/app/actions";
import type { Dict } from "@/lib/i18n";
import { BACKLOG_STATUSES } from "@/lib/options";

export type BoardItem = {
  id: string;
  title: string;
  type: "bug" | "feature" | "improvement" | "big_idea";
  status: (typeof BACKLOG_STATUSES)[number];
  project_id: string | null;
};

export default function Board({ items, t, canWrite, projectNames }: { items: BoardItem[]; t: Dict; canWrite: boolean; projectNames?: Map<string, string> }) {
  const options = BACKLOG_STATUSES.map((s) => ({ value: s, label: t.board[s] }));
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {BACKLOG_STATUSES.map((status) => {
        const col = items.filter((i) => i.status === status);
        return (
          <section key={status} className="w-60 shrink-0">
            <h3 className="mb-2 flex items-center justify-between text-sm font-medium">
              {t.board[status]}
              <span className="badge tabular-nums">{col.length}</span>
            </h3>
            <div className="space-y-2">
              {col.map((i) => (
                <div key={i.id} className="card space-y-2 p-3">
                  <p className="text-sm">{i.title}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="badge">{t.backlog[i.type]}</span>
                    {projectNames && i.project_id && projectNames.get(i.project_id) && <span className="badge">{projectNames.get(i.project_id)}</span>}
                  </div>
                  {canWrite && (
                    <form action={moveBacklogItem}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="project_id" value={i.project_id ?? ""} />
                      <AutoSelect name="status" value={i.status} options={options} label={t.projects.status} />
                    </form>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
