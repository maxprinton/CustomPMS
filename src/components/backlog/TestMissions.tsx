"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerMission, markMissionDone } from "@/app/backlog-actions";
import type { TestRow } from "@/lib/backlog/data";
import type { Dict } from "@/lib/i18n";

/** Test missions: what to try (with steps), the automatic "you did it" detection and the "did it work?" pop-up. */
export default function TestMissions({ tests, t, canWrite, full = false }: { tests: TestRow[]; t: Dict; canWrite: boolean; full?: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const [problemFor, setProblemFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [hidden, setHidden] = useState<string[]>([]);

  const detected = tests.filter((x) => x.status === "detected" && !hidden.includes(x.id));
  const pending = tests.filter((x) => x.status === "pending");
  const answered = tests.filter((x) => x.status === "worked" || x.status === "problem" || x.status === "skipped");
  const shownPending = full ? pending : pending.slice(0, Math.max(0, 3 - detected.length));
  if (!detected.length && !shownPending.length && !(full && answered.length)) return null;
  const popup = canWrite ? detected[0] : undefined;

  function answer(id: string, result: "worked" | "problem" | "skipped") {
    setError("");
    start(async () => {
      const r = await answerMission(id, result, result === "problem" ? note : undefined);
      if (r.error) setError(r.error);
      else {
        setProblemFor(null);
        setNote("");
        router.refresh();
      }
    });
  }
  function did(id: string) {
    setError("");
    start(async () => {
      const r = await markMissionDone(id);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <>
      {popup && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="card w-full max-w-md p-4 shadow-xl">
            <p className="text-xs font-medium text-muted">{t.bl.missionComplete}</p>
            <h3 className="mt-1 text-base font-semibold">{popup.title}</h3>
            <p className="mt-1 text-sm text-muted">{t.bl.sawYouUse}</p>
            {problemFor === popup.id ? (
              <div className="mt-3 space-y-2">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} placeholder={t.bl.problemPrompt} className="input" />
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => answer(popup.id, "problem")} className="btn btn-sm">{t.bl.sendProblem}</button>
                  <button type="button" disabled={busy} onClick={() => setProblemFor(null)} className="btn-quiet">{t.bl.cancel}</button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => answer(popup.id, "worked")} className="btn btn-sm">✅ {t.bl.worked}</button>
                <button type="button" disabled={busy} onClick={() => setProblemFor(popup.id)} className="btn-quiet">⚠ {t.bl.problem}</button>
                <button type="button" onClick={() => setHidden((h) => [...h, popup.id])} className="btn-quiet">{t.bl.later}</button>
              </div>
            )}
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          </div>
        </div>
      )}

      <section className="card space-y-2 p-4">
        <h2 className="text-sm font-semibold">{t.bl.missions}{pending.length + detected.length ? ` (${pending.length + detected.length} ${t.bl.open})` : ""}</h2>
        <ul className="space-y-2">
          {detected.map((x) => (
            <li key={x.id} className="rounded-lg bg-accent-soft px-3 py-2 text-sm">
              <span className="font-medium">{x.title}</span> <span className="text-muted">· {t.bl.usedWaiting}</span>
              {canWrite && (
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={busy} onClick={() => answer(x.id, "worked")} className="btn btn-sm">✅ {t.bl.worked}</button>
                  <button type="button" disabled={busy} onClick={() => { setHidden((h) => h.filter((y) => y !== x.id)); setProblemFor(x.id); }} className="btn-quiet">⚠ {t.bl.problem}</button>
                </div>
              )}
            </li>
          ))}
          {shownPending.map((x) => (
            <li key={x.id} className="rounded-lg border border-line px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="font-medium">{x.title}</span>
                {x.item && <Link href={`/backlog/${x.item.number}`} className="underline">BL-{x.item.number}</Link>}
              </div>
              <details className="mt-1">
                <summary className="cursor-pointer text-muted">{t.bl.howTo}</summary>
                <p className="mt-1 whitespace-pre-line text-muted">{x.how_to}</p>
              </details>
              {canWrite && <button type="button" disabled={busy} onClick={() => did(x.id)} className="btn-quiet mt-2">{t.bl.didIt}</button>}
              {x.probe && <p className="mt-1 text-xs text-muted">{t.bl.autoMarked}</p>}
            </li>
          ))}
        </ul>
        {!full && pending.length > shownPending.length && (
          <p className="text-sm"><Link href="/backlog" className="underline">{t.bl.allMissions}</Link></p>
        )}
        {error && !popup && <p className="text-sm text-danger">{error}</p>}
        {full && answered.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm text-muted">{t.bl.answered} ({answered.length})</summary>
            <ul className="mt-2 space-y-1 text-sm">
              {answered.map((x) => (
                <li key={x.id} className="flex flex-wrap gap-x-2">
                  <span>{x.status === "worked" ? "✅" : x.status === "problem" ? "⚠" : "↷"}</span>
                  <span>{x.title}</span>
                  {x.bug_number && <Link href={`/backlog/${x.bug_number}`} className="underline">BL-{x.bug_number}</Link>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </>
  );
}
