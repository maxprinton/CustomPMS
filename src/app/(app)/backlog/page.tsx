import Link from "next/link";
import ActivityPanel from "@/components/backlog/ActivityPanel";
import BacklogBoard from "@/components/backlog/BacklogBoard";
import QuickAdd from "@/components/backlog/QuickAdd";
import StepsPanel from "@/components/backlog/StepsPanel";
import TestMissions from "@/components/backlog/TestMissions";
import VerifyPanel from "@/components/backlog/VerifyPanel";
import { listActivity } from "@/lib/backlog/data";
import { loadPanels } from "@/lib/backlog/panels";
import { getDict } from "@/lib/i18n";
import { getContext } from "@/lib/workspace";

export default async function BacklogPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const [{ t }, { supabase, canWrite, workspaceId }] = await Promise.all([getDict(), getContext()]);
  const [p, projectsRes, activity] = await Promise.all([
    loadPanels(supabase, workspaceId, { allTests: true }),
    supabase.from("projects").select("id, name").eq("archived", false).order("name"),
    listActivity(supabase, workspaceId, { limit: 30 }),
  ]);
  const projects = (projectsRes.data ?? []) as unknown as { id: string; name: string }[];
  const names = Object.fromEntries(projects.map((x) => [x.id, x.name]));
  const items = project ? p.items.filter((i) => i.project_id === project) : p.items;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t.backlog.title}</h1>
      {p.error && <p className="text-sm text-danger" role="alert">{p.error}</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        <VerifyPanel due={p.due} t={t} canWrite={canWrite} />
        <StepsPanel pending={p.pendingSteps} recent={p.recentSteps} nowIso={p.nowIso} t={t} canWrite={canWrite} />
        <TestMissions tests={p.tests} t={t} canWrite={canWrite} full />
        <ActivityPanel rows={activity.rows} working={activity.working} nowIso={p.nowIso} t={t} />
      </div>
      <div className="flex flex-wrap gap-1">
        <Link href="/backlog" className={`chip ${project ? "" : "chip-active"}`}>{t.common.all}</Link>
        {projects.map((x) => (
          <Link key={x.id} href={`/backlog?project=${x.id}`} className={`chip ${project === x.id ? "chip-active" : ""}`}>{x.name}</Link>
        ))}
      </div>
      {canWrite && <QuickAdd t={t} projects={projects} projectId={project} />}
      <BacklogBoard items={items} allItems={p.items} caps={p.caps} t={t} canWrite={canWrite} projectNames={names} />
    </>
  );
}
