import { Check, Globe } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGS, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * One compact button showing the active language; the other two live in a
 * small menu. Three side-by-side pills ate more header width than a shop
 * with four nav links can spare.
 */
export function LanguageSwitcher({
  className,
  tone = "brand",
}: {
  className?: string;
  tone?: "brand" | "light";
}) {
  const { lang, setLang } = useI18n();
  const active = LANGS.find((l) => l.code === lang) ?? LANGS[0]!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Language: ${active.label}`}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
          tone === "light"
            ? "border-on-brand/30 text-on-brand hover:bg-on-brand/15"
            : "border-border text-foreground/80 hover:border-primary/40 hover:text-primary",
          className,
        )}
      >
        <Globe className="h-3.5 w-3.5" />
        {active.label}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-32">
        {LANGS.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onSelect={() => setLang(l.code)}
            className="flex items-center justify-between gap-3"
          >
            {l.label}
            {l.code === lang ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
