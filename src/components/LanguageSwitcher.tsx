import { LANGS, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className, tone = "brand" }: { className?: string; tone?: "brand" | "light" }) {
  const { lang, setLang } = useI18n();

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-full border p-0.5 text-xs font-medium",
        tone === "light" ? "border-on-brand/30 text-on-brand" : "border-border text-muted-foreground",
        className,
      )}
    >
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors",
            lang === l.code
              ? "bg-primary text-primary-foreground"
              : tone === "light"
                ? "hover:bg-on-brand/15"
                : "hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
