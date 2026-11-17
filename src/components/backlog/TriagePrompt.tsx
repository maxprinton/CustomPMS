"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { moveItemAction } from "@/app/backlog-actions";
import Modal from "@/components/backlog/Modal";
import { TYPE_EMOJI, type Triage } from "@/lib/backlog/board";
import type { Dict } from "@/lib/i18n";

/** The 30-second prompt after something reaches Verifying or Done. Never blocks anything: Skip closes it. */
export default function TriagePrompt({ triage, title, t, onClose }: { triage: Triage; title: string; t: Dict; onClose: () => void }) {
  const router = useRouter();
  const [data, setData] = useState(triage);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const roomInNow = data.nowCount < data.nowCap;

  async function pull(number: number) {
    setError("");
    setBusy(number);
    const r = await moveItemAction({ number, to: "now" });
    setBusy(null);
    if (r.error) return setError(r.error);
    router.refresh();
    setData({ ...data, nowCount: data.nowCount + 1, now: [...data.now, ...data.next.filter((i) => i.number === number)], next: data.next.filter((i) => i.number !== number) });
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <section>
          <h3 className="font-medium">{t.bl.triageNow} ({data.nowCount}/{data.nowCap})</h3>
          {data.now.length ? (
            <ul className="mt-1 space-y-0.5">
              {data.now.map((i) => (
                <li key={i.number}>{TYPE_EMOJI[i.type]} BL-{i.number} {i.title}{i.size ? <span className="text-muted"> · {i.size}</span> : null}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-muted">{t.bl.nowEmpty}</p>
          )}
        </section>
        <section>
          <h3 className="font-medium">{t.bl.topNext}{data.nextCount > data.next.length ? ` (${data.nextCount} ${t.bl.inAll})` : ""}</h3>
          {data.next.length ? (
            <ul className="mt-1 space-y-1">
              {data.next.map((i) => (
                <li key={i.number} className="flex items-center justify-between gap-2">
                  <span>{TYPE_EMOJI[i.type]} BL-{i.number} {i.title}</span>
                  <button type="button" disabled={!roomInNow || busy !== null} onClick={() => pull(i.number)} className="btn-quiet shrink-0">{busy === i.number ? "..." : t.bl.pull}</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-muted">{t.bl.nextEmpty}</p>
          )}
          {!roomInNow && data.next.length > 0 && <p className="mt-1 text-xs text-muted">{t.bl.nowFull}</p>}
        </section>
        <p className="text-muted">{t.bl.inbox}: {data.inbox} · {t.bl.verifying}: {data.verifying}</p>
        {error && <p className="text-danger">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-sm">{t.bl.skip}</button>
          <button type="button" onClick={() => { onClose(); router.push("/backlog"); }} className="btn-quiet">{t.bl.openBacklog}</button>
        </div>
      </div>
    </Modal>
  );
}
