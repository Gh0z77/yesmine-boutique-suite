import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Flower2, Scissors, Sparkles } from "lucide-react";

import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { contentQuery, type AboutContent } from "@/lib/store";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "Our story — Yesmine atelier" },
      {
        name: "description",
        content:
          "Yesmine is a women's clothing house built on hand-finished tailoring, natural fabrics and small-run collections designed to be worn for years.",
      },
      { property: "og:title", content: "Our story — Yesmine atelier" },
      {
        property: "og:description",
        content: "Hand-finished tailoring, natural fabrics and small-run womenswear collections.",
      },
    ],
  }),
  component: AboutPage,
});

const PILLARS = [
  { icon: Scissors, title: "Made in small runs", body: "Every style is cut in limited quantities so nothing is wasted and every seam is checked by hand." },
  { icon: Flower2, title: "Natural fabrics", body: "Silk, wool, linen and cotton sourced from mills we visit in person, chosen for how they age." },
  { icon: Sparkles, title: "Designed to last", body: "Timeless silhouettes in a soft rose palette — pieces you'll return to season after season." },
];

function AboutPage() {
  const { t } = useI18n();
  const { data: content } = useQuery(contentQuery);
  const about = (content?.["about"] ?? {}) as AboutContent;

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 -z-10 h-96 bg-soft-gradient" />
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <Reveal className="space-y-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Since 2019</p>
          <h1 className="font-display text-4xl leading-tight sm:text-6xl">
            {about.title_en ?? "The Yesmine atelier"}
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {about.body_en ??
              "Yesmine began with a single silk dress and a stubborn idea: that womenswear can be soft and structured at once. Today our atelier still works the same way — small runs, hand-finished hems, and fabrics chosen for how they move."}
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 90}>
              <div className="h-full rounded-3xl border bg-card p-7 shadow-soft transition-shadow hover:shadow-elegant">
                <p.icon className="h-7 w-7 text-primary" />
                <h2 className="mt-4 font-display text-xl">{p.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-16 overflow-hidden rounded-[2rem] shadow-elegant">
          <img
            src={
              about.image ??
              "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1600&q=80"
            }
            alt="Inside the Yesmine atelier"
            className="aspect-16/9 w-full object-cover"
            loading="lazy"
          />
        </Reveal>

        <Reveal className="mt-16 text-center">
          <h2 className="font-display text-3xl">Wear something made with care</h2>
          <Button variant="hero" size="xl" className="mt-6" asChild>
            <Link to="/shop">{t("nav.shop")}</Link>
          </Button>
        </Reveal>
      </div>
    </div>
  );
}
