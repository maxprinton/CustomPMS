"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { placeItemAction, type BacklogActionResult } from "@/app/backlog-actions";
import MoveMenu from "@/components/backlog/MoveMenu";
import TriagePrompt from "@/components/backlog/TriagePrompt";
import { BOARD_ORDER, STATUS_ORDER, TYPE_EMOJI, daysSince, filterItems, groupByStatus, rankScore, type BacklogItem, type Triage } from "@/lib/backlog/board";
import { TYPES, type BacklogStatus, type BacklogType, type Caps } from "@/lib/backlog/rules";
import type { Dict } from "@/lib/i18n";

/** The backlog as a board or a list, with search and a type filter. `allItems` feeds the caps (they count the whole workspace). */
export default function BacklogBoard({ items, allItems, caps, t, canWrite, projectNames, compact = false }: {
  items: BacklogItem[];
  allItems: BacklogItem[];
  caps: Caps;
  t: Dict;
  canWrite: boolean;
  projectNames: Record<string, string>;
  compact?: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [type, setType] = useState<BacklogType | "">("");
  const [error, setError] = useState("");
  const [triage, setTriage] = useState<{ data: Triage; title: string } | null>(null);
  const now = useMemo(() => new Date(), []);

  const shown = useMemo(() => filterItems(items, { q, type }), [items, q, type]);
  const groups = useMemo(() => groupByStatus(shown), [shown]);

  function onResult(r: BacklogActionResult) {
    setError(r.error ?? "");
    if (r.error) return;
    router.refresh();
    if (r.triage) setTriage({ data: r.triage, title: r.item?.status === "done" ? `BL-${r.item.number} ${t.board.done}` : t.bl.triageNow });
  }

  async function place(number: number, target: number, where: "before" | "after") {
    const r = await placeItemAction({ number, target, where });
    setError(r.error ?? "");
    if (!r.error) router.refresh();
  }

  function Card({ item, column }: { item: BacklogItem; column: BacklogItem[] }) {
    const idx = column.findIndex((c) => c.id === item.id);
    const score = rankScore(item);
    const stale = item.status === "next" ? daysSince(item.status_changed_at, now) : 0;
    return (
      <div className="card space-y-2 p-3">
        <p className="text-sm">
          <Link href={`/backlog/${item.number}`} className="font-medium underline-offset-2 hover:underline">BL-{item.number}</Link>{" "}
          <span aria-hidden>{TYPE_EMOJI[item.type]}</span> {item.title}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <span className="badge">{t.backlog[item.type]}</span>
          {item.size && <span className="badge">{item.size}</span>}
          {score !== null && <span className="badge">{score}</span>}
          {item.reopened_count > 0 && <span className="badge">↺ {item.reopened_count}</span>}
          {item.project_id && projectNames[item.project_id] && <span className="badge">{projectNames[item.project_id]}</span>}
          {stale >= 30 && <span className="badge">{t.bl.stale} {stale} {t.bl.days}</span>}
        </div>
        {canWrite && (
          <div className="flex items-center gap-1">
            <MoveMenu item={item} items={allItems} caps={caps} t={t} onResult={onResult} />
            {idx > 0 && <button type="button" className="btn-quiet" aria-label={t.bl.moveUp} onClick={() => place(item.number, column[idx - 1].number, "before")}>↑</button>}
            {idx >= 0 && idx < column.length - 1 && <button type="button" className="btn-quiet" aria-label={t.bl.moveDown} onClick={() => place(item.number, column[idx + 1].number, "after")}>↓</button>}
          </div>
        )}
      </div>
    );
  }

  const order: BacklogStatus[] = view === "board" ? BOARD_ORDER : STATUS_ORDER;
  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            <button type="button" className={`chip ${view === "board" ? "chip-active" : ""}`} onClick={() => setView("board")}>{t.bl.board}</button>
            <button type="button" className={`chip ${view === "list" ? "chip-active" : ""}`} onClick={() => setView("list")}>{t.bl.list}</button>
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.bl.search} aria-label={t.bl.search} className="input input-sm w-44" />
          <select value={type} onChange={(e) => setType(e.target.value as BacklogType | "")} aria-label={t.backlog.type} className="input input-sm">
            <option value="">{t.bl.allTypes}</option>
            {TYPES.map((x) => (
              <option key={x} value={x}>{t.backlog[x]}</option>
            ))}
          </select>
        </div>
      )}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      {view === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {order.map((status) => {
            const col = groups[status];
            const cap = status === "now" ? caps.now : status === "next" ? caps.next : status === "verifying" ? caps.verifying : null;
            const used = status === "now" ? col.filter((i) => i.type !== "bug").length : col.length;
            return (
              <section key={status} className="w-64 shrink-0">
                <h3 className="mb-2 flex items-center justify-between text-sm font-medium">
                  {t.board[status]}
                  <span className="badge tabular-nums">{cap ? `${used}/${cap}` : col.length}</span>
                </h3>
                <div className="space-y-2">
                  {col.length === 0 && <p className="text-xs text-muted">{t.bl.empty}</p>}
                  {col.map((i) => <Card key={i.id} item={i} column={col} />)}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-5">
          {order.map((status) => {
            const col = groups[status];
            if (!col.length) return null;
            return (
              <section key={status}>
                <h3 className="mb-2 text-sm font-medium">{t.board[status]} <span className="badge">{col.length}</span></h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {col.map((i) => <Card key={i.id} item={i} column={col} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {triage && <TriagePrompt triage={triage.data} title={triage.title} t={t} onClose={() => setTriage(null)} />}
    </div>
  );
}
