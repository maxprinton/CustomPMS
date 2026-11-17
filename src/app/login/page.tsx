import LoginForm from "@/components/LoginForm";
import LangSwitch from "@/components/LangSwitch";
import { getDict } from "@/lib/i18n";

export default async function LoginPage() {
  const { lang, t } = await getDict();
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-6 p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <span className="font-semibold tracking-tight">{t.appName}</span>
          <LangSwitch lang={lang} label={t.settings.language} />
        </div>
        <LoginForm t={t.login} />
      </div>
    </main>
  );
}
