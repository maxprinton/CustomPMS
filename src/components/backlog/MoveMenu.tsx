"use client";

import { useState } from "react";
import { moveItemAction, type BacklogActionResult } from "@/app/backlog-actions";
import { SIZES, moveOptions, type BacklogSize, type BacklogStatus, type Caps, type Missing } from "@/lib/backlog/rules";
import { countsFor, type BacklogItem } from "@/lib/backlog/board";
import type { Dict } from "@/lib/i18n";

/** Asks only for what the move still needs (size, spec link, reason), then moves the item. */
export function MoveForm({ item, to, missing, t, onCancel, onResult }: {
  item: BacklogItem;
  to: BacklogStatus;
  missing: Missing[];
  t: Dict;
  onCancel: () => void;
  onResult: (r: BacklogActionResult) => void;
}) {
  const [size, setSize] = useState<BacklogSize | "">(item.size ?? "");
  const [spec, setSpec] = useState(item.spec_link ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sizeLabel = { S: t.bl.sizeS, M: t.bl.sizeM, L: t.bl.sizeL };

  async function go() {
    setError("");
    if (missing.includes("size") && !size) return setError(t.bl.pickSizeFirst);
    if (missing.includes("spec_link") && !spec.trim()) return setError(t.bl.addSpecFirst);
    if (missing.includes("reason") && !reason.trim()) return setError(t.bl.giveReasonFirst);
    setBusy(true);
    const r = await moveItemAction({
      number: item.number,
      to,
      size: missing.includes("size") ? (size as BacklogSize) : undefined,
      spec_link: missing.includes("spec_link") ? spec.trim() : undefined,
      parked_reason: missing.includes("reason") ? reason.trim() : undefined,
    });
    setBusy(false);
    if (r.error) return setError(r.error);
    onResult(r);
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">BL-{item.number} → {t.board[to]}</p>
      {missing.includes("size") && (
        <label className="label">
          {t.bl.size}
          <select value={size} onChange={(e) => setSize(e.target.value as BacklogSize | "")} className="input mt-1">
            <option value="">{t.bl.sizePick}</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>{sizeLabel[s]}</option>
            ))}
          </select>
        </label>
      )}
      {missing.includes("spec_link") && (
        <label className="label">
          {t.bl.specLink}
          <input value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="docs/SPEC.md" className="input mt-1" />
        </label>
      )}
      {missing.includes("reason") && (
        <label className="label">
          {t.bl.reason}
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="input mt-1" />
        </label>
      )}
      {error && <p className="text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={go} className="btn btn-sm">{busy ? t.bl.moving : t.bl.move}</button>
        <button type="button" onClick={onCancel} className="btn-quiet">{t.bl.cancel}</button>
      </div>
    </div>
  );
}

/** "Move": the statuses this item can go to right now, with the plain reason when one is blocked. */
export default function MoveMenu({ item, items, caps, t, onResult }: {
  item: BacklogItem;
  items: BacklogItem[];
  caps: Caps;
  t: Dict;
  onResult: (r: BacklogActionResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<{ to: BacklogStatus; missing: Missing[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const options = moveOptions(item, countsFor(items, item.id), caps);
  const need = (m: Missing) => (m === "spec_link" ? t.bl.specLink : m === "size" ? t.bl.size : t.bl.reason);

  async function choose(to: BacklogStatus, missing: Missing[]) {
    if (missing.length) return setPending({ to, missing });
    setBusy(true);
    const r = await moveItemAction({ number: item.number, to });
    setBusy(false);
    setOpen(false);
    onResult(r);
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => { setOpen(!open); setPending(null); }} aria-expanded={open} disabled={busy} className="btn-quiet">
        {t.bl.move} ▾
      </button>
      {open && (
        <div className="card absolute right-0 z-30 mt-1 w-72 max-w-[85vw] p-2 shadow-lg">
          {pending ? (
            <MoveForm item={item} to={pending.to} missing={pending.missing} t={t} onCancel={() => setPending(null)} onResult={(r) => { setPending(null); setOpen(false); onResult(r); }} />
          ) : (
            <ul className="space-y-1">
              {options.map((o) => (
                <li key={o.to}>
                  <button type="button" disabled={!o.ok} onClick={() => choose(o.to, o.missing)} className="flex w-full flex-col rounded-lg px-2 py-1.5 text-left text-sm hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-60">
                    <span className="font-medium">
                      → {t.board[o.to]}
                      {o.reopen ? ` (${t.bl.reopen})` : ""}
                      {o.ok && o.missing.length ? <span className="font-normal text-muted"> · {t.bl.needs} {o.missing.map(need).join(" + ")}</span> : null}
                    </span>
                    {!o.ok && <span className="text-xs text-muted">{o.message}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
