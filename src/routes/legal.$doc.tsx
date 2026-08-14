import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import { Reveal } from "@/components/Reveal";
import { useI18n } from "@/lib/i18n";
import { contentQuery } from "@/lib/store";
import { cn } from "@/lib/utils";

/** URL slug → the site_content key holding that document. */
const DOCS = {
  offer: "legal_offer",
  privacy: "legal_privacy",
  returns: "legal_returns",
} as const;

type DocSlug = keyof typeof DOCS;

export const Route = createFileRoute("/legal/$doc")({
  loader: async ({ context, params }) => {
    if (!(params.doc in DOCS)) throw notFound();
    return { content: await context.queryClient.ensureQueryData(contentQuery) };
  },
  head: ({ params }) => ({
    meta: [
      {
        title: `${params.doc === "offer" ? "Public offer" : params.doc === "privacy" ? "Privacy policy" : "Returns"} — Yesmine`,
      },
      { name: "description", content: "Yesmine legal information." },
    ],
  }),
  component: LegalPage,
});

type LegalDoc = Record<string, string | undefined>;

function LegalPage() {
  const { doc } = Route.useParams();
  const { t, lang } = useI18n();
  const seed = Route.useLoaderData();
  const { data: content } = useQuery({ ...contentQuery, initialData: seed.content });

  const key = DOCS[doc as DocSlug];
  const record = (content?.[key] ?? {}) as LegalDoc;

  /** Uzbek is the canonical text here; other languages fall back to it. */
  const pick = (base: "title" | "body") =>
    record[`${base}_${lang}`]?.trim() ||
    record[`${base}_uz`]?.trim() ||
    record[`${base}_en`]?.trim() ||
    "";

  const body = pick("body");

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 -z-10 h-56 bg-soft-gradient" />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Reveal className="space-y-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            <FileText className="h-3.5 w-3.5" /> {t("legal.heading")}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">{pick("title")}</h1>
          {record["updated"] ? (
            <p className="text-sm text-muted-foreground">
              {t("legal.updated")}: {record["updated"]}
            </p>
          ) : null}
        </Reveal>

        <nav className="mt-8 flex flex-wrap gap-2">
          {(Object.keys(DOCS) as DocSlug[]).map((slug) => (
            <Link
              key={slug}
              to="/legal/$doc"
              params={{ doc: slug }}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-all",
                slug === doc
                  ? "border-transparent bg-brand-gradient text-on-brand shadow-soft"
                  : "border-border bg-card text-foreground/80 hover:border-primary/40 hover:text-primary",
              )}
            >
              {t(`legal.${slug}`)}
            </Link>
          ))}
        </nav>

        <Reveal delay={80} className="mt-10 rounded-3xl border bg-card p-6 shadow-soft sm:p-9">
          {body ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
              {body}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This document hasn't been written yet. Add it from Admin → Content.
            </p>
          )}
        </Reveal>
      </div>
    </div>
  );
}
