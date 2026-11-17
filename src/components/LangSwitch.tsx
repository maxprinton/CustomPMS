import { setLang } from "@/app/actions";
import type { Lang } from "@/lib/i18n";

export default function LangSwitch({ lang, label }: { lang: Lang; label: string }) {
  return (
    <form action={setLang} className="flex gap-1" aria-label={label}>
      {(["en", "es"] as const).map((l) => (
        <button key={l} name="lang" value={l} className={`chip ${l === lang ? "chip-active" : ""}`} aria-pressed={l === lang}>
          {l === "en" ? "English" : "Español"}
        </button>
      ))}
    </form>
  );
}
