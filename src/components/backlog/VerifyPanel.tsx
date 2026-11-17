"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveVerifyAction } from "@/app/backlog-actions";
import type { BacklogItem, Triage } from "@/lib/backlog/board";
import TriagePrompt from "@/components/backlog/TriagePrompt";
import type { VerifyResult } from "@/lib/backlog/data";
import type { Dict } from "@/lib/i18n";

/** Items that have been Verifying long enough to be asked "did it work in real use?". */
export default function VerifyPanel({ due, t, canWrite }: { due: BacklogItem[]; t: Dict; canWrite: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const [triage, setTriage] = useState<Triage | null>(null);
  if (!due.length) return null;

  function resolve(number: number, result: VerifyResult) {
    setError("");
    start(async () => {
      const r = await resolveVerifyAction({ number, result });
      if (r.error) return setError(r.error);
      router.refresh();
      if (r.triage) setTriage(r.triage);
    });
  }

  return (
    <section className="card space-y-2 p-4">
      <h2 className="text-sm font-semibold">{t.bl.didItWorkReal}</h2>
      <ul className="space-y-2">
        {due.map((i) => (
          <li key={i.id} className="rounded-lg bg-accent-soft px-3 py-2 text-sm">
            <Link href={`/backlog/${i.number}`} className="font-medium underline">BL-{i.number}</Link> {i.title}
            {canWrite && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => resolve(i.number, "worked")} className="btn btn-sm">✅ {t.bl.worked}</button>
                <button type="button" disabled={busy} onClick={() => resolve(i.number, "failed")} className="btn-quiet">⚠ {t.bl.failed}</button>
                <button type="button" disabled={busy} onClick={() => resolve(i.number, "later")} className="btn-quiet">{t.bl.stillTesting}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-danger">{error}</p>}
      {triage && <TriagePrompt triage={triage} title={t.bl.triageNow} t={t} onClose={() => setTriage(null)} />}
    </section>
  );
}
