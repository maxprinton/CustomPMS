import Link from "next/link";
import Nav from "@/components/Nav";
import { getDict } from "@/lib/i18n";
import { getContext } from "@/lib/workspace";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ t }, ctx] = await Promise.all([getDict(), getContext()]);
  const items = [
    { href: "/", label: t.nav.dashboard },
    { href: "/clients", label: t.nav.clients },
    { href: "/projects", label: t.nav.projects },
    { href: "/notes", label: t.nav.notes },
    { href: "/backlog", label: t.nav.backlog },
    { href: "/templates", label: t.nav.templates },
    { href: "/settings", label: t.nav.settings },
  ];
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col md:flex-row">
      <aside className="flex flex-col gap-3 border-line p-3 md:w-56 md:shrink-0 md:border-r md:p-4">
        <div className="flex items-center justify-between md:block">
          <Link href="/" className="font-semibold tracking-tight">
            {t.appName}
          </Link>
          <p className="text-xs text-muted md:mt-0.5">{ctx.workspaceName}</p>
        </div>
        <Nav items={items} />
        <form action="/auth/signout" method="post" className="hidden md:mt-auto md:block">
          <button className="nav-link w-full text-left">{t.nav.signOut}</button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 space-y-6 p-4 md:p-8">
        {!ctx.canWrite && <p className="badge">{t.common.readOnly}</p>}
        {children}
      </main>
    </div>
  );
}
