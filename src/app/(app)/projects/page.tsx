import Link from "next/link";
import { createProject } from "@/app/actions";
import { getDict } from "@/lib/i18n";
import { getContext } from "@/lib/workspace";
import { METHODS } from "@/lib/options";

type Project = { id: string; name: string; status: "active" | "on_hold" | "done" | "cancelled"; phase: "initiation" | "planning" | "execution" | "monitoring" | "closing"; client_id: string | null };
type Client = { id: string; name: string };

export default async function ProjectsPage() {
  const [{ t }, { supabase, canWrite }] = await Promise.all([getDict(), getContext()]);
  const [p, c] = await Promise.all([
    supabase.from("projects").select("id, name, status, phase, client_id").eq("archived", false).order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").eq("archived", false).order("name"),
  ]);
  const projects = (p.data ?? []) as unknown as Project[];
  const clients = (c.data ?? []) as unknown as Client[];
  const clientName = new Map(clients.map((x) => [x.id, x.name]));

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t.projects.title}</h1>
      {canWrite && (
        <form action={createProject} className="card flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-48 flex-1">
            <label className="label" htmlFor="project-name">{t.projects.new}</label>
            <input id="project-name" name="name" required className="input" placeholder={t.common.name} />
          </div>
          <div>
            <label className="label" htmlFor="project-client">{t.projects.client}</label>
            <select id="project-client" name="client_id" className="input">
              <option value="">{t.common.noClient}</option>
              {clients.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="project-method">{t.projects.method}</label>
            <select id="project-method" name="method" className="input">
              {METHODS.map((m) => (
                <option key={m} value={m}>{t.method[m]}</option>
              ))}
            </select>
          </div>
          <button className="btn">{t.common.add}</button>
        </form>
      )}
      <div className="card">
        {projects.length === 0 && <p className="p-4 text-sm text-muted">{t.common.none}</p>}
        {projects.map((x) => (
          <Link key={x.id} href={`/projects/${x.id}`} className="row">
            <div>
              <p>{x.name}</p>
              <p className="text-sm text-muted">{(x.client_id && clientName.get(x.client_id)) || t.common.noClient}</p>
            </div>
            <div className="flex gap-1">
              <span className="badge">{t.phase[x.phase]}</span>
              <span className="badge">{t.status[x.status]}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
