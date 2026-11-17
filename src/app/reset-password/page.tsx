import ResetForm from "@/components/ResetForm";
import { getDict } from "@/lib/i18n";

export default async function ResetPasswordPage() {
  const { t } = await getDict();
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6 sm:p-8">
        <ResetForm t={t.login} />
      </div>
    </main>
  );
}
