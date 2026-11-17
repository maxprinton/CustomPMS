import Link from "next/link";
import type { ActivityRow } from "@/lib/backlog/data";
import type { Dict } from "@/lib/i18n";

const ICON: Record<ActivityRow["kind"], string> = { start: "▶", update: "•", finish: "✓", blocked: "⛔", note: "📝", decision: "⚖" };

function ago(iso: string, nowMs: number, days: string): string {
  const m = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} ${days}`;
}

/** What Claude is doing now and what it did lately (read-only; Claude writes it through the activity_log helper). */
export default function ActivityPanel({ rows, working, nowIso, t }: { rows: ActivityRow[]; working: ActivityRow[]; nowIso: string; t: Dict }) {
  const nowMs = new Date(nowIso).getTime();
  if (!rows.length) return null;
  return (
    <section className="card space-y-2 p-4">
      <h2 className="text-sm font-semibold">{t.bl.claudeAtWork}</h2>
      {working.length > 0 ? (
        <ul className="space-y-1">
          {working.map((w) => (
            <li key={w.id} className="rounded-lg bg-accent-soft px-3 py-2 text-sm">
              <span className="font-medium">{t.bl.workingNow}:</span> {w.text}
              {w.item && <> · <Link href={`/backlog/${w.item.number}`} className="underline">BL-{w.item.number}</Link></>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t.bl.notWorking}</p>
      )}
      <details>
        <summary className="cursor-pointer text-sm text-muted">{t.bl.recentActivity} ({rows.length})</summary>
        <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex gap-2">
              <span aria-hidden>{ICON[r.kind]}</span>
              <span>
                <span className="text-muted">{ago(r.at, nowMs, t.bl.days)} · </span>
                {r.text}
                {r.item && <> · <Link href={`/backlog/${r.item.number}`} className="underline">BL-{r.item.number}</Link></>}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
