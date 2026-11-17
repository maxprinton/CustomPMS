import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { getContext } from "@/lib/workspace";

type Item = { id: string; title: string; project_id: string | null };
type Milestone = { id: string; title: string; due_date: string | null; project_id: string };

export default async function DashboardPage() {
  const [{ t }, { supabase }] = await Promise.all([getDict(), getContext()]);
  const count = (table: string) => supabase.from(table).select("*", { count: "exact", head: true });
  const [projects, clients, tasks, risks, now, upcoming] = await Promise.all([
    count("projects").eq("status", "active"),
    count("clients").eq("archived", false),
    count("tasks").neq("status", "done"),
    count("risks").eq("status", "open"),
    supabase.from("backlog_items").select("id, title, project_id").eq("status", "now").order("updated_at", { ascending: false }).limit(8),
    supabase.from("milestones").select("id, title, due_date, project_id").eq("done", false).not("due_date", "is", null).order("due_date").limit(8),
  ]);
  const stats = [
    { label: t.dashboard.activeProjects, value: projects.count ?? 0, href: "/projects" },
    { label: t.dashboard.clients, value: clients.count ?? 0, href: "/clients" },
    { label: t.dashboard.openTasks, value: tasks.count ?? 0, href: "/projects" },
    { label: t.dashboard.openRisks, value: risks.count ?? 0, href: "/projects" },
  ];
  const nowItems = (now.data ?? []) as unknown as Item[];
  const milestones = (upcoming.data ?? []) as unknown as Milestone[];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t.dashboard.title}</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-4">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 font-medium">{t.dashboard.now}</h2>
          <div className="card">
            {nowItems.length === 0 && <p className="p-4 text-sm text-muted">{t.common.none}</p>}
            {nowItems.map((i) => (
              <Link key={i.id} href={i.project_id ? `/projects/${i.project_id}` : "/backlog"} className="row">
                {i.title}
              </Link>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-2 font-medium">{t.dashboard.upcoming}</h2>
          <div className="card">
            {milestones.length === 0 && <p className="p-4 text-sm text-muted">{t.common.none}</p>}
            {milestones.map((m) => (
              <Link key={m.id} href={`/projects/${m.project_id}`} className="row">
                <span>{m.title}</span>
                <span className="badge">{m.due_date}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
