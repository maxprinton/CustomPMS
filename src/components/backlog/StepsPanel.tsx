"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finishStep } from "@/app/backlog-actions";
import type { StepRow } from "@/lib/backlog/data";
import type { Dict } from "@/lib/i18n";

function ago(iso: string, nowMs: number, t: Dict): string {
  const m = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} ${t.bl.days}`;
}

/** "Waiting on you": steps asked outside the app (run a migration, upload changes, add keys). One tap closes one. */
export default function StepsPanel({ pending, recent, nowIso, t, canWrite }: { pending: StepRow[]; recent: StepRow[]; nowIso: string; t: Dict; canWrite: boolean }) {
  const nowMs = new Date(nowIso).getTime();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const kind: Record<StepRow["kind"], string> = { migration: t.bl.stepMigration, publish: t.bl.stepPublish, keys: t.bl.stepKeys, other: t.bl.stepOther };
  if (!pending.length && !recent.length) return null;

  function act(id: string, how: "done" | "skipped") {
    setError("");
    start(async () => {
      const r = await finishStep(id, how);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <section className="card space-y-2 p-4">
      <h2 className="text-sm font-semibold">{t.bl.waiting}{pending.length ? ` (${pending.length})` : ""}</h2>
      {pending.length === 0 ? (
        <p className="text-sm text-muted">{t.bl.nothingWaiting}</p>
      ) : (
        <ul className="space-y-2">
          {pending.map((s) => (
            <li key={s.id} className="rounded-lg bg-accent-soft px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="badge">{kind[s.kind]}</span>
                <span className="font-medium">{s.title}</span>
                {s.item && <Link href={`/backlog/${s.item.number}`} className="underline">BL-{s.item.number}</Link>}
                <span className="text-muted">{t.bl.asked} {ago(s.asked_at, nowMs, t)}</span>
              </div>
              {s.detail && <p className="mt-1 whitespace-pre-line break-words text-muted">{s.detail}</p>}
              {canWrite && (
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={busy} onClick={() => act(s.id, "done")} className="btn btn-sm">{t.bl.done}</button>
                  <button type="button" disabled={busy} onClick={() => act(s.id, "skipped")} className="btn-quiet">{t.bl.skip}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {recent.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted">{t.bl.recentSteps} ({recent.length})</summary>
          <ul className="mt-2 space-y-1.5 text-sm">
            {recent.map((s) => (
              <li key={s.id} className="flex flex-wrap gap-x-2">
                <span>{s.status === "skipped" ? "↷" : s.check_result === "mismatch" ? "⚠" : "✓"}</span>
                <span className="text-muted">{kind[s.kind]}</span>
                <span>{s.title}</span>
                {s.item && <Link href={`/backlog/${s.item.number}`} className="underline">BL-{s.item.number}</Link>}
                {s.check_result === "mismatch" && <span className="text-danger">{t.bl.flagged}: {s.check_note ?? "-"}</span>}
                {s.check_result === "verified" && <span className="text-muted">{t.bl.verified}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
