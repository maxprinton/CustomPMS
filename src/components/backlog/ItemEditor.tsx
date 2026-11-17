"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteItemAction, saveItem } from "@/app/backlog-actions";
import MoveMenu from "@/components/backlog/MoveMenu";
import TriagePrompt from "@/components/backlog/TriagePrompt";
import type { BacklogItem, Triage } from "@/lib/backlog/board";
import { SIZES, TYPES, type BacklogSize, type BacklogType, type Caps } from "@/lib/backlog/rules";
import type { Dict } from "@/lib/i18n";

/** Edit the fields of one item and move it. */
export default function ItemEditor({ item, allItems, caps, projects, t, canWrite }: {
  item: BacklogItem;
  allItems: BacklogItem[];
  caps: Caps;
  projects: { id: string; name: string }[];
  t: Dict;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [triage, setTriage] = useState<Triage | null>(null);
  const [f, setF] = useState({
    title: item.title,
    type: item.type as BacklogType,
    project_id: item.project_id ?? "",
    size: (item.size ?? "") as BacklogSize | "",
    area: item.area ?? "",
    spec_link: item.spec_link ?? "",
    value: item.value ? String(item.value) : "",
    effort: item.effort ? String(item.effort) : "",
    notes: item.notes ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const sizeLabel = { S: t.bl.sizeS, M: t.bl.sizeM, L: t.bl.sizeL };

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    start(async () => {
      const r = await saveItem({ number: item.number, ...f, project_id: f.project_id || null });
      if (r.error) return setError(r.error);
      setInfo(t.bl.saved);
      router.refresh();
    });
  }
  function remove() {
    if (!confirm(t.bl.confirmDelete)) return;
    start(async () => {
      const r = await deleteItemAction({ number: item.number });
      if (r.error) return setError(r.error);
      router.push("/backlog");
    });
  }

  return (
    <form onSubmit={save} className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="badge">{t.board[item.status]}</span>
        {canWrite && (
          <MoveMenu item={item} items={allItems} caps={caps} t={t} onResult={(r) => { setError(r.error ?? ""); if (!r.error) router.refresh(); if (r.triage) setTriage(r.triage); }} />
        )}
      </div>
      <label className="label">{t.common.name}
        <input value={f.title} onChange={set("title")} required maxLength={200} disabled={!canWrite} className="input mt-1" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">{t.backlog.type}
          <select value={f.type} onChange={set("type")} disabled={!canWrite} className="input mt-1">
            {TYPES.map((x) => <option key={x} value={x}>{t.backlog[x]}</option>)}
          </select>
        </label>
        <label className="label">{t.backlog.project}
          <select value={f.project_id} onChange={set("project_id")} disabled={!canWrite} className="input mt-1">
            <option value="">{t.bl.noProject}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="label">{t.bl.size}
          <select value={f.size} onChange={set("size")} disabled={!canWrite} className="input mt-1">
            <option value="">-</option>
            {SIZES.map((s) => <option key={s} value={s}>{sizeLabel[s]}</option>)}
          </select>
        </label>
        <label className="label">{t.bl.area}
          <input value={f.area} onChange={set("area")} maxLength={60} disabled={!canWrite} className="input mt-1" />
        </label>
        <label className="label sm:col-span-2">{t.bl.specLink}
          <input value={f.spec_link} onChange={set("spec_link")} maxLength={300} disabled={!canWrite} className="input mt-1" />
        </label>
        <label className="label">{t.bl.value}
          <select value={f.value} onChange={set("value")} disabled={!canWrite} className="input mt-1">
            <option value="">-</option><option>1</option><option>2</option><option>3</option>
          </select>
        </label>
        <label className="label">{t.bl.effort}
          <select value={f.effort} onChange={set("effort")} disabled={!canWrite} className="input mt-1">
            <option value="">-</option><option>1</option><option>2</option><option>3</option>
          </select>
        </label>
      </div>
      <label className="label">{t.bl.notes}
        <textarea value={f.notes} onChange={set("notes")} rows={5} maxLength={4000} disabled={!canWrite} className="input mt-1" />
      </label>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      {info && <p className="text-sm text-success">{info}</p>}
      {canWrite && (
        <div className="flex gap-2">
          <button disabled={busy} className="btn">{t.common.save}</button>
          <button type="button" disabled={busy} onClick={remove} className="btn-quiet">{t.bl.delete}</button>
        </div>
      )}
      {triage && <TriagePrompt triage={triage} title={t.bl.triageNow} t={t} onClose={() => setTriage(null)} />}
    </form>
  );
}
