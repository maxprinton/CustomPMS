import Link from "next/link";
import { notFound } from "next/navigation";
import ItemEditor from "@/components/backlog/ItemEditor";
import StepsPanel from "@/components/backlog/StepsPanel";
import TestMissions from "@/components/backlog/TestMissions";
import ActivityPanel from "@/components/backlog/ActivityPanel";
import { getItem, listActivity, listEvents, listSteps, listTests } from "@/lib/backlog/data";
import { loadPanels } from "@/lib/backlog/panels";
import { getDict } from "@/lib/i18n";
import { getContext } from "@/lib/workspace";

export default async function BacklogItemPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) notFound();
  const [{ t, lang }, { supabase, canWrite, workspaceId }] = await Promise.all([getDict(), getContext()]);
  const item = await getItem(supabase, workspaceId, n);
  if (!item) notFound();

  const [p, projectsRes, events, activity, steps, tests] = await Promise.all([
    loadPanels(supabase, workspaceId),
    supabase.from("projects").select("id, name").eq("archived", false).order("name"),
    listEvents(supabase, workspaceId, item.id),
    listActivity(supabase, workspaceId, { limit: 20, itemId: item.id }),
    listSteps(supabase, workspaceId, { limit: 50 }),
    listTests(supabase, workspaceId, { limit: 100 }),
  ]);
  const projects = (projectsRes.data ?? []) as unknown as { id: string; name: string }[];
  const mySteps = steps.filter((s) => s.item?.number === n);
  const myTests = tests.filter((x) => x.item?.number === n);
  const fmt = new Intl.DateTimeFormat(lang === "es" ? "es" : "en", { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <p className="text-sm"><Link href="/backlog" className="underline">← {t.bl.back}</Link></p>
      <h1 className="text-2xl font-semibold tracking-tight">BL-{item.number} <span className="font-normal text-muted">{item.title}</span></h1>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <ItemEditor item={item} allItems={p.items} caps={p.caps} projects={projects} t={t} canWrite={canWrite} />
        <div className="space-y-3">
          <section className="card space-y-2 p-4">
            <h2 className="text-sm font-semibold">{t.bl.history}</h2>
            {events.length === 0 && <p className="text-sm text-muted">{t.bl.noHistory}</p>}
            <ul className="space-y-1 text-sm">
              {events.map((e) => (
                <li key={e.id}>
                  <span className="text-muted">{fmt.format(new Date(e.at))} · </span>
                  {e.from_status ? `${t.board[e.from_status as keyof typeof t.board] ?? e.from_status} → ` : ""}
                  {t.board[e.to_status as keyof typeof t.board] ?? e.to_status}
                  {e.by !== "user" && <span className="text-muted"> ({t.bl.by} {e.by})</span>}
                  {e.note && <span className="text-muted"> - {e.note}</span>}
                </li>
              ))}
            </ul>
          </section>
          {mySteps.length > 0 && (
            <StepsPanel pending={mySteps.filter((s) => s.status === "pending")} recent={mySteps.filter((s) => s.status !== "pending")} nowIso={p.nowIso} t={t} canWrite={canWrite} />
          )}
          {myTests.length > 0 && <TestMissions tests={myTests} t={t} canWrite={canWrite} full />}
          <ActivityPanel rows={activity.rows} working={activity.working} nowIso={p.nowIso} t={t} />
        </div>
      </div>
    </>
  );
}
