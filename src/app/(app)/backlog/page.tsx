import Link from "next/link";
import Board, { type BoardItem } from "@/components/Board";
import BacklogForm from "@/components/BacklogForm";
import { getDict } from "@/lib/i18n";
import { getContext } from "@/lib/workspace";

export default async function BacklogPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const [{ t }, { supabase, canWrite }] = await Promise.all([getDict(), getContext()]);
  let query = supabase.from("backlog_items").select("id, title, type, status, project_id").order("updated_at", { ascending: false });
  if (project) query = query.eq("project_id", project);
  const [i, p] = await Promise.all([query, supabase.from("projects").select("id, name").eq("archived", false).order("name")]);
  const items = (i.data ?? []) as unknown as BoardItem[];
  const projects = (p.data ?? []) as unknown as { id: string; name: string }[];
  const names = new Map(projects.map((x) => [x.id, x.name]));

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t.backlog.title}</h1>
      <div className="flex flex-wrap gap-1">
        <Link href="/backlog" className={`chip ${project ? "" : "chip-active"}`}>{t.common.all}</Link>
        {projects.map((x) => (
          <Link key={x.id} href={`/backlog?project=${x.id}`} className={`chip ${project === x.id ? "chip-active" : ""}`}>{x.name}</Link>
        ))}
      </div>
      {canWrite && <BacklogForm t={t} projects={projects} />}
      <Board items={items} t={t} canWrite={canWrite} projectNames={names} />
    </>
  );
}
