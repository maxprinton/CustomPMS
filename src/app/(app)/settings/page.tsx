import LangSwitch from "@/components/LangSwitch";
import { renameWorkspace } from "@/app/actions";
import ApiSettings from "@/components/ApiSettings";
import BacklogSettingsForm from "@/components/backlog/BacklogSettingsForm";
import { loadSettings } from "@/lib/backlog/data";
import { getDict } from "@/lib/i18n";
import { getContext } from "@/lib/workspace";

type Member = { user_id: string; role: "owner" | "member" | "viewer" };

export default async function SettingsPage() {
  const [{ t, lang }, ctx] = await Promise.all([getDict(), getContext()]);
  const { data } = await ctx.supabase.from("workspace_members").select("user_id, role").eq("workspace_id", ctx.workspaceId).order("created_at");
  const members = (data ?? []) as unknown as Member[];
  const backlogSettings = await loadSettings(ctx.supabase, ctx.workspaceId);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t.settings.title}</h1>
      <section className="card space-y-2 p-4">
        <h2 className="font-medium">{t.settings.language}</h2>
        <LangSwitch lang={lang} label={t.settings.language} />
      </section>
      <section className="card space-y-2 p-4">
        <h2 className="font-medium">{t.settings.workspace}</h2>
        <form action={renameWorkspace} className="flex flex-wrap gap-2">
          <input name="name" required defaultValue={ctx.workspaceName} disabled={ctx.role !== "owner"} className="input max-w-sm flex-1" aria-label={t.common.name} />
          {ctx.role === "owner" && <button className="btn">{t.common.save}</button>}
        </form>
      </section>
      <section className="card space-y-2 p-4">
        <h2 className="font-medium">{t.backlog.title} - {t.bl.caps}</h2>
        <BacklogSettingsForm settings={backlogSettings} t={t} canWrite={ctx.canWrite} />
      </section>
      {ctx.role === "owner" ? <ApiSettings supabase={ctx.supabase} t={t} lang={lang} /> : <p className="text-sm text-muted">{t.api.ownersOnly}</p>}
      <section>
        <h2 className="mb-2 font-medium">{t.settings.members}</h2>
        <div className="card">
          {members.map((m) => (
            <div key={m.user_id} className="row">
              <span>{m.user_id === ctx.user.id ? `${ctx.user.email} (${t.settings.you})` : m.user_id}</span>
              <span className="badge">{t.roles[m.role]}</span>
            </div>
          ))}
        </div>
        <form action="/auth/signout" method="post" className="mt-4 md:hidden">
          <button className="chip">{t.nav.signOut}</button>
        </form>
      </section>
    </>
  );
}
