import Link from "next/link";
import { notFound } from "next/navigation";
import { createContact } from "@/app/actions";
import { getDict } from "@/lib/i18n";
import { getContext } from "@/lib/workspace";

type Client = { id: string; name: string; kind: "external" | "internal"; notes: string | null };
type Contact = { id: string; name: string; email: string | null; phone: string | null; role_title: string | null };
type Project = { id: string; name: string; status: "active" | "on_hold" | "done" | "cancelled" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ t }, { supabase, canWrite }] = await Promise.all([getDict(), getContext()]);
  const [c, ct, pr] = await Promise.all([
    supabase.from("clients").select("id, name, kind, notes").eq("id", id).maybeSingle(),
    supabase.from("contacts").select("id, name, email, phone, role_title").eq("client_id", id).order("name"),
    supabase.from("projects").select("id, name, status").eq("client_id", id).order("name"),
  ]);
  const client = c.data as unknown as Client | null;
  if (!client) notFound();
  const contacts = (ct.data ?? []) as unknown as Contact[];
  const projects = (pr.data ?? []) as unknown as Project[];

  return (
    <>
      <div>
        <Link href="/clients" className="text-sm text-muted hover:underline">{t.clients.title}</Link>
        <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
        <span className="badge">{t.clients[client.kind]}</span>
      </div>

      <section>
        <h2 className="mb-2 font-medium">{t.clients.projects}</h2>
        <div className="card">
          {projects.length === 0 && <p className="p-4 text-sm text-muted">{t.common.none}</p>}
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="row">
              <span>{p.name}</span>
              <span className="badge">{t.status[p.status]}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium">{t.clients.contacts}</h2>
        <div className="card">
          {contacts.length === 0 && <p className="p-4 text-sm text-muted">{t.common.none}</p>}
          {contacts.map((k) => (
            <div key={k.id} className="row">
              <div>
                <p>{k.name}</p>
                <p className="text-sm text-muted">{[k.role_title, k.email, k.phone].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
          ))}
        </div>
        {canWrite && (
          <form action={createContact} className="card mt-3 grid gap-3 p-4 sm:grid-cols-2">
            <input type="hidden" name="client_id" value={client.id} />
            <input name="name" required className="input" placeholder={t.common.name} aria-label={t.common.name} />
            <input name="role_title" className="input" placeholder={t.clients.role} aria-label={t.clients.role} />
            <input name="email" type="email" className="input" placeholder={t.clients.email} aria-label={t.clients.email} />
            <input name="phone" className="input" placeholder={t.clients.phone} aria-label={t.clients.phone} />
            <button className="btn sm:col-span-2 sm:justify-self-start">{t.clients.newContact}</button>
          </form>
        )}
      </section>
    </>
  );
}
