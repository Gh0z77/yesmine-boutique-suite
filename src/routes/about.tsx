import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Flower2, Scissors, Sparkles } from "lucide-react";

import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { HERO_WIDTHS, imageSrc, imageSrcSet } from "@/lib/images";
import { useI18n } from "@/lib/i18n";
import { contentQuery, type AboutContent } from "@/lib/store";

export const Route = createFileRoute("/about")({
  loader: async ({ context }) => ({
    content: await context.queryClient.ensureQueryData(contentQuery),
  }),
  head: () => ({
    meta: [
      { title: "Bizning hikoya — Yesmine atelyesi" },
      {
        name: "description",
        content:
          "Yesmine is a women's clothing house built on hand-finished tailoring, natural fabrics and small-run collections designed to be worn for years.",
      },
      { property: "og:title", content: "Bizning hikoya — Yesmine atelyesi" },
      {
        property: "og:description",
        content: "Qo'lda pardozlangan tikuv, tabiiy matolar va kichik partiyali ayollar kolleksiyalari.",
      },
    ],
  }),
  component: AboutPage,
});

/** Copy lives in the translations table so it can be edited and localized. */
const PILLARS = [
  { icon: Scissors, key: "pillar1" },
  { icon: Flower2, key: "pillar2" },
  { icon: Sparkles, key: "pillar3" },
] as const;

function AboutPage() {
  const { t, lang } = useI18n();
  const seed = Route.useLoaderData();
  const { data: content } = useQuery({ ...contentQuery, initialData: seed.content });
  const about = (content?.["about"] ?? {}) as AboutContent;

  /** Falls back to English while a language is still untranslated. */
  const pick = (base: "title" | "body") =>
    (about[`${base}_${lang}` as keyof AboutContent] as string) ||
    (about[`${base}_en` as keyof AboutContent] as string) ||
    "";

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 -z-10 h-96 bg-soft-gradient" />
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <Reveal className="space-y-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            {t("about.since", "Since 2019")}
          </p>
          <h1 className="font-display text-4xl leading-tight sm:text-6xl">
            {pick("title") || "The Yesmine atelier"}
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {pick("body") ||
              "Yesmine began with a single silk dress and a stubborn idea: that womenswear can be soft and structured at once."}
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.key} delay={i * 90}>
              <div className="h-full rounded-3xl border bg-card p-7 shadow-soft transition-shadow hover:shadow-elegant">
                <p.icon className="h-7 w-7 text-primary" />
                <h2 className="mt-4 font-display text-xl">{t(`about.${p.key}.title`)}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`about.${p.key}.body`)}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-16 overflow-hidden rounded-[2rem] shadow-elegant">
          <img
            src={
              about.image || "https://images.unsplash.com/photo-1613447895817-e617a4093f50?w=1600&q=80"
            }
            alt="Inside the Yesmine atelier"
            className="aspect-16/9 w-full object-cover"
            loading="lazy"
          />
        </Reveal>

        <Reveal className="mt-16 text-center">
          <h2 className="font-display text-3xl">
            {t("about.cta", "Wear something made with care")}
          </h2>
          <Button variant="hero" size="xl" className="mt-6" asChild>
            <Link to="/shop">{t("nav.shop")}</Link>
          </Button>
        </Reveal>
      </div>
    </div>
  );
}
