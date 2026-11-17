import Link from "next/link";
import { notFound } from "next/navigation";
import AutoSelect from "@/components/AutoSelect";
import Board, { type BoardItem } from "@/components/Board";
import BacklogForm from "@/components/BacklogForm";
import { addMilestone, addRisk, addTask, makeCopy, saveDocDetails, setTaskStatus, toggleMilestone, updateProject } from "@/app/actions";
import { DETAIL_LISTS, detailsForForm } from "@/lib/documents";
import { getDict } from "@/lib/i18n";
import { getContext } from "@/lib/workspace";
import { METHODS, PHASES, PROJECT_STATUSES, TASK_STATUSES } from "@/lib/options";

type Project = {
  id: string; name: string; client_id: string | null; method: string; phase: string; status: string;
  objective: string | null; sponsor: string | null; start_date: string | null; end_date: string | null; budget: number | null; profile: unknown;
};
type Copy = { id: string; title: string; lang: string; created_at: string; filled: { filled?: number; fillable?: boolean } | null };
type TFile = { id: string; template_id: string; lang: string; file_name: string | null };
type Tpl = { id: string; code: string; name: string; name_es: string | null; phase: string | null };
type Task = { id: string; title: string; status: (typeof TASK_STATUSES)[number]; due_date: string | null };
type Milestone = { id: string; title: string; due_date: string | null; done: boolean };
type Risk = { id: string; title: string; score: number | null; response: string | null };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ t }, { supabase, canWrite }] = await Promise.all([getDict(), getContext()]);
  const [p, c, tk, ms, rk, bl, cp, tf, tp] = await Promise.all([
    supabase.from("projects").select("id, name, client_id, method, phase, status, objective, sponsor, start_date, end_date, budget, profile").eq("id", id).maybeSingle(),
    supabase.from("clients").select("id, name").eq("archived", false).order("name"),
    supabase.from("tasks").select("id, title, status, due_date").eq("project_id", id).order("created_at"),
    supabase.from("milestones").select("id, title, due_date, done").eq("project_id", id).order("due_date", { nullsFirst: false }),
    supabase.from("risks").select("id, title, score, response").eq("project_id", id).order("score", { ascending: false, nullsFirst: false }),
    supabase.from("backlog_items").select("id, title, type, status, project_id").eq("project_id", id).order("updated_at", { ascending: false }),
    supabase.from("template_copies").select("id, title, lang, created_at, filled").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("template_files").select("id, template_id, lang, file_name").order("lang"),
    supabase.from("templates").select("id, code, name, name_es, phase").eq("status", "active").order("code"),
  ]);
  const project = p.data as unknown as Project | null;
  if (!project) notFound();
  const clients = (c.data ?? []) as unknown as { id: string; name: string }[];
  const tasks = (tk.data ?? []) as unknown as Task[];
  const milestones = (ms.data ?? []) as unknown as Milestone[];
  const risks = (rk.data ?? []) as unknown as Risk[];
  const backlog = (bl.data ?? []) as unknown as BoardItem[];
  const copies = (cp.data ?? []) as unknown as Copy[];
  const files = (tf.data ?? []) as unknown as TFile[];
  const templates = (tp.data ?? []) as unknown as Tpl[];
  const details = detailsForForm(project.profile);
  const ext = (name: string | null) => (name?.split(".").pop() ?? "").toLowerCase();
  const taskOptions = TASK_STATUSES.map((s) => ({ value: s, label: t.task[s] }));

  return (
    <>
      <div>
        <Link href="/projects" className="text-sm text-muted hover:underline">{t.projects.title}</Link>
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
      </div>

      <section>
        <h2 className="mb-2 font-medium">{t.projects.profile}</h2>
        <form action={updateProject} className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <input type="hidden" name="id" value={project.id} />
          <fieldset disabled={!canWrite} className="contents">
            <label className="label sm:col-span-2 lg:col-span-3">
              {t.common.name}
              <input name="name" required defaultValue={project.name} className="input mt-1" />
            </label>
            <label className="label">
              {t.projects.client}
              <select name="client_id" defaultValue={project.client_id ?? ""} className="input mt-1">
                <option value="">{t.common.noClient}</option>
                {clients.map((x) => (
                  <option key={x.id} value={x.id}>{x.name}</option>
                ))}
              </select>
            </label>
            <label className="label">
              {t.projects.method}
              <select name="method" defaultValue={project.method} className="input mt-1">
                {METHODS.map((m) => (
                  <option key={m} value={m}>{t.method[m]}</option>
                ))}
              </select>
            </label>
            <label className="label">
              {t.projects.phase}
              <select name="phase" defaultValue={project.phase} className="input mt-1">
                {PHASES.map((m) => (
                  <option key={m} value={m}>{t.phase[m]}</option>
                ))}
              </select>
            </label>
            <label className="label">
              {t.projects.status}
              <select name="status" defaultValue={project.status} className="input mt-1">
                {PROJECT_STATUSES.map((m) => (
                  <option key={m} value={m}>{t.status[m]}</option>
                ))}
              </select>
            </label>
            <label className="label">
              {t.projects.sponsor}
              <input name="sponsor" defaultValue={project.sponsor ?? ""} className="input mt-1" />
            </label>
            <label className="label">
              {t.projects.budget}
              <input name="budget" type="number" step="0.01" min="0" defaultValue={project.budget ?? ""} className="input mt-1" />
            </label>
            <label className="label">
              {t.projects.start}
              <input name="start_date" type="date" defaultValue={project.start_date ?? ""} className="input mt-1" />
            </label>
            <label className="label">
              {t.projects.end}
              <input name="end_date" type="date" defaultValue={project.end_date ?? ""} className="input mt-1" />
            </label>
            <label className="label sm:col-span-2 lg:col-span-3">
              {t.projects.objective}
              <textarea name="objective" rows={3} defaultValue={project.objective ?? ""} className="input mt-1" />
            </label>
            {canWrite && <button className="btn justify-self-start">{t.common.save}</button>}
          </fieldset>
        </form>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 font-medium">{t.projects.tasks}</h2>
          <div className="card">
            {tasks.length === 0 && <p className="p-4 text-sm text-muted">{t.common.none}</p>}
            {tasks.map((x) => (
              <div key={x.id} className="row">
                <div>
                  <p className={x.status === "done" ? "text-muted line-through" : ""}>{x.title}</p>
                  {x.due_date && <p className="text-sm text-muted">{t.projects.due}: {x.due_date}</p>}
                </div>
                {canWrite ? (
                  <form action={setTaskStatus}>
                    <input type="hidden" name="id" value={x.id} />
                    <input type="hidden" name="project_id" value={project.id} />
                    <AutoSelect name="status" value={x.status} options={taskOptions} label={t.projects.status} />
                  </form>
                ) : (
                  <span className="badge">{t.task[x.status]}</span>
                )}
              </div>
            ))}
          </div>
          {canWrite && (
            <form action={addTask} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="project_id" value={project.id} />
              <input name="title" required className="input min-w-40 flex-1" placeholder={t.projects.tasks} aria-label={t.projects.tasks} />
              <input name="due_date" type="date" className="input w-auto" aria-label={t.projects.due} />
              <button className="btn">{t.common.add}</button>
            </form>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-medium">{t.projects.milestones}</h2>
          <div className="card">
            {milestones.length === 0 && <p className="p-4 text-sm text-muted">{t.common.none}</p>}
            {milestones.map((x) => (
              <div key={x.id} className="row">
                <div>
                  <p className={x.done ? "text-muted line-through" : ""}>{x.title}</p>
                  {x.due_date && <p className="text-sm text-muted">{t.projects.due}: {x.due_date}</p>}
                </div>
                {canWrite && (
                  <form action={toggleMilestone}>
                    <input type="hidden" name="id" value={x.id} />
                    <input type="hidden" name="project_id" value={project.id} />
                    <input type="hidden" name="done" value={x.done ? "false" : "true"} />
                    <button className={`chip ${x.done ? "chip-active" : ""}`} aria-pressed={x.done}>{t.projects.done}</button>
                  </form>
                )}
              </div>
            ))}
          </div>
          {canWrite && (
            <form action={addMilestone} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="project_id" value={project.id} />
              <input name="title" required className="input min-w-40 flex-1" placeholder={t.projects.milestones} aria-label={t.projects.milestones} />
              <input name="due_date" type="date" className="input w-auto" aria-label={t.projects.due} />
              <button className="btn">{t.common.add}</button>
            </form>
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-2 font-medium">{t.projects.risks}</h2>
        <div className="card">
          {risks.length === 0 && <p className="p-4 text-sm text-muted">{t.common.none}</p>}
          {risks.map((x) => (
            <div key={x.id} className="row">
              <div>
                <p>{x.title}</p>
                {x.response && <p className="text-sm text-muted">{x.response}</p>}
              </div>
              {x.score !== null && <span className="badge tabular-nums">{t.projects.score}: {x.score}</span>}
            </div>
          ))}
        </div>
        {canWrite && (
          <form action={addRisk} className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_2fr_auto]">
            <input type="hidden" name="project_id" value={project.id} />
            <input name="title" required className="input" placeholder={t.projects.risks} aria-label={t.projects.risks} />
            <input name="probability" type="number" min="1" max="5" className="input" placeholder={t.projects.probability} aria-label={t.projects.probability} />
            <input name="impact" type="number" min="1" max="5" className="input" placeholder={t.projects.impact} aria-label={t.projects.impact} />
            <input name="response" className="input" placeholder={t.projects.response} aria-label={t.projects.response} />
            <button className="btn">{t.common.add}</button>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">{t.docs.title}</h2>
        <details className="card p-4">
          <summary className="cursor-pointer font-medium">{t.docs.details}</summary>
          <p className="mt-2 text-sm text-muted">{t.docs.detailsHint}</p>
          <form action={saveDocDetails} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="id" value={project.id} />
            <fieldset disabled={!canWrite} className="contents">
              <label className="label">
                {t.docs.organization}
                <input name="organization" defaultValue={details.organization} className="input mt-1" />
              </label>
              <label className="label">
                {t.docs.manager}
                <input name="project_manager" defaultValue={details.project_manager} className="input mt-1" />
              </label>
              <label className="label">
                {t.docs.preparedBy}
                <input name="prepared_by" defaultValue={details.prepared_by} className="input mt-1" />
              </label>
              {DETAIL_LISTS.map((k) => (
                <label key={k} className="label">
                  {t.docs[k]} ({t.docs.onePerLine})
                  <textarea name={k} rows={3} defaultValue={details[k]} className="input mt-1" />
                </label>
              ))}
              {canWrite && <button className="btn justify-self-start self-end">{t.common.save}</button>}
            </fieldset>
          </form>
        </details>
        {canWrite && files.length > 0 && (
          <form action={makeCopy} className="card flex flex-wrap items-end gap-3 p-4">
            <input type="hidden" name="project_id" value={project.id} />
            <label className="label min-w-48 flex-1">
              {t.docs.choose}
              <select name="file_id" required className="input mt-1">
                {templates.map((tpl) =>
                  files
                    .filter((f) => f.template_id === tpl.id)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {tpl.code} · {(f.lang === "es" && tpl.name_es) || tpl.name} ({f.lang.toUpperCase()} .{ext(f.file_name)})
                      </option>
                    ))
                )}
              </select>
            </label>
            <button className="btn">{t.docs.create}</button>
          </form>
        )}
        <div className="card">
          {copies.length === 0 && <p className="p-4 text-sm text-muted">{t.common.none}</p>}
          {copies.map((x) => (
            <div key={x.id} className="row">
              <div className="min-w-0">
                <p>{x.title}</p>
                <p className="text-sm text-muted">
                  {x.created_at.slice(0, 10)} · {x.lang.toUpperCase()} · {x.filled?.filled ? `${x.filled.filled} ${t.docs.blanks}` : t.docs.notFilled}
                </p>
              </div>
              <a href={`/api/files/copy/${x.id}`} className="chip shrink-0">{t.docs.download}</a>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">{t.projects.backlog}</h2>
        {canWrite && <BacklogForm t={t} projectId={project.id} />}
        <Board items={backlog} t={t} canWrite={canWrite} />
      </section>
    </>
  );
}
