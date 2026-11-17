import Link from "next/link";
import { createClientRecord } from "@/app/actions";
import { getDict } from "@/lib/i18n";
import { getContext } from "@/lib/workspace";

type Client = { id: string; name: string; kind: "external" | "internal" };

export default async function ClientsPage() {
  const [{ t }, { supabase, canWrite }] = await Promise.all([getDict(), getContext()]);
  const { data } = await supabase.from("clients").select("id, name, kind").eq("archived", false).order("name");
  const clients = (data ?? []) as unknown as Client[];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t.clients.title}</h1>
      {canWrite && (
        <form action={createClientRecord} className="card flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-48 flex-1">
            <label className="label" htmlFor="client-name">{t.clients.new}</label>
            <input id="client-name" name="name" required className="input" placeholder={t.common.name} />
          </div>
          <div>
            <label className="label" htmlFor="client-kind">{t.clients.kind}</label>
            <select id="client-kind" name="kind" className="input">
              <option value="external">{t.clients.external}</option>
              <option value="internal">{t.clients.internal}</option>
            </select>
          </div>
          <button className="btn">{t.common.add}</button>
        </form>
      )}
      <div className="card">
        {clients.length === 0 && <p className="p-4 text-sm text-muted">{t.common.none}</p>}
        {clients.map((c) => (
          <Link key={c.id} href={`/clients/${c.id}`} className="row">
            <span>{c.name}</span>
            <span className="badge">{t.clients[c.kind]}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
