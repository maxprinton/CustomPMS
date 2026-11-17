"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addIdea } from "@/app/backlog-actions";
import { TYPES, type BacklogType } from "@/lib/backlog/rules";
import type { Dict } from "@/lib/i18n";

/** One sentence into the Inbox. With `projectId` the item belongs to that project. */
export default function QuickAdd({ t, projects, projectId }: { t: Dict; projects?: { id: string; name: string }[]; projectId?: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<BacklogType>("feature");
  const [project, setProject] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    start(async () => {
      const r = await addIdea({ title, type, project_id: projectId ?? (project || null) });
      if (r.error) return setError(r.error);
      setTitle("");
      setInfo(`${r.message} ${t.bl.saved.toLowerCase()}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="card flex flex-wrap items-end gap-3 p-4">
      <label className="label min-w-48 flex-1">
        {t.backlog.new}
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} placeholder={t.bl.ideaPlaceholder} className="input mt-1" />
      </label>
      <label className="label">
        {t.backlog.type}
        <select value={type} onChange={(e) => setType(e.target.value as BacklogType)} className="input mt-1">
          {TYPES.map((x) => (
            <option key={x} value={x}>{t.backlog[x]}</option>
          ))}
        </select>
      </label>
      {!projectId && projects && (
        <label className="label">
          {t.backlog.project}
          <select value={project} onChange={(e) => setProject(e.target.value)} className="input mt-1">
            <option value="">-</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      )}
      <button disabled={busy} className="btn">{t.common.add}</button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
      {info && <p className="w-full text-sm text-success">{info}</p>}
    </form>
  );
}
