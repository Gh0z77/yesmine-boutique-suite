import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Quote, Sparkles, Truck, Scissors, Heart } from "lucide-react";
import { useState } from "react";

import { Logo, PetalFlower, YesmineEmblem } from "@/components/Logo";
import { ProductCard } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { useI18n, localized } from "@/lib/i18n";
import {
  categoriesQuery,
  contentQuery,
  productsQuery,
  type AboutContent,
  type HeroContent,
  type Testimonial,
} from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Yesmine — Rose silk dresses, wool coats & hand-finished accessories" },
      {
        name: "description",
        content:
          "Yesmine dresses the modern woman in rose-toned silk, wool and satin. Small-run womenswear, finished by hand and shipped worldwide.",
      },
      { property: "og:title", content: "Yesmine — Softness, worn with power" },
      {
        property: "og:description",
        content: "Small-run rose silk dresses, wool coats and hand-finished accessories.",
      },
      {
        property: "og:image",
        content: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&q=80",
      },
      {
        name: "twitter:image",
        content: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&q=80",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t, lang } = useI18n();
  const { data: content } = useQuery(contentQuery);
  const { data: categories } = useQuery(categoriesQuery);
  const { data: products } = useQuery(productsQuery);

  const hero = (content?.["hero"] ?? {}) as HeroContent;
  const about = (content?.["about"] ?? {}) as AboutContent;
  const testimonials = (content?.["testimonials"] ?? []) as Testimonial[];
  const gallery = (content?.["gallery"] ?? []) as string[];

  const pick = (base: "headline" | "sub" | "cta") =>
    (hero[`${base}_${lang}` as keyof HeroContent] as string) ||
    (hero[`${base}_en` as keyof HeroContent] as string) ||
    "";

  const featured = (products ?? []).filter((p) => p.featured).slice(0, 8);
  const bestSellers = [...(products ?? [])].sort((a, b) => b.sold_count - a.sold_count).slice(0, 4);

  return (
    <div className="overflow-x-hidden">
      {/* ---------- HERO ---------- */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-soft-gradient" />
        <div className="mesh-blob float-slow -left-24 top-0 h-[28rem] w-[28rem] bg-pink-vivid" />
        <div className="mesh-blob float-slower right-0 top-24 h-[26rem] w-[26rem] bg-magenta" />
        <div className="mesh-blob float-slow bottom-0 left-1/3 h-80 w-80 bg-pink-blush" />

        {/* drifting petals */}
        {[12, 34, 58, 76, 90].map((left, i) => (
          <PetalFlower
            key={left}
            className="drift-petal absolute top-0 h-8 w-8 text-pink-vivid/45"
            // eslint-disable-next-line react/forbid-dom-props
            {...{ style: { left: `${left}%`, animationDelay: `${i * 3}s` } }}
          />
        ))}

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-2 lg:pb-32 lg:pt-16">
          <div className="space-y-8">
            <Reveal className="flex items-center gap-3">
              <span className="flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Autumn Atelier 2026
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="font-display text-5xl leading-[1.05] text-foreground sm:text-6xl lg:text-7xl">
                {pick("headline") || "Softness, worn with power"}
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
                {pick("sub")}
              </p>
            </Reveal>

            <Reveal delay={240} className="flex flex-wrap items-center gap-3">
              <Button variant="hero" size="xl" asChild>
                <Link to="/shop">
                  {pick("cta") || t("nav.shop")} <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="glass" size="xl" asChild>
                <Link to="/about">{t("nav.about")}</Link>
              </Button>
            </Reveal>

            <Reveal delay={320} className="flex flex-wrap gap-6 pt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Scissors className="h-4 w-4 text-primary" /> Made in small runs
              </span>
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" /> Worldwide delivery
              </span>
              <span className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-primary" /> 12k happy women
              </span>
            </Reveal>
          </div>

          {/* 3D-ish rotating emblem + hero imagery */}
          <Reveal delay={120} className="relative">
            <div className="relative mx-auto aspect-4/5 w-full max-w-md">
              <div className="absolute inset-0 rotate-3 rounded-[3rem] bg-brand-gradient shadow-elegant" />
              <img
                src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1000&q=80"
                alt="Yesmine model wearing a rose silk dress"
                className="absolute inset-0 h-full w-full -rotate-2 rounded-[3rem] object-cover shadow-elegant transition-transform duration-700 ease-out hover:rotate-0"
              />
              <div className="glass absolute -bottom-8 -left-6 flex items-center gap-3 rounded-3xl p-4 shadow-soft float-slow">
                <YesmineEmblem className="h-10 w-10 text-primary" />
                <div>
                  <p className="font-script text-2xl leading-none text-primary">Yesmine</p>
                  <p className="text-xs text-muted-foreground">Atelier since 2019</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- MARQUEE ---------- */}
      <div className="overflow-hidden border-y bg-card py-4">
        <div className="marquee-track flex w-max gap-12 whitespace-nowrap px-6 text-sm uppercase tracking-[0.25em] text-muted-foreground">
          {Array.from({ length: 2 }).map((_, dup) => (
            <span key={dup} className="flex gap-12">
              {["Silk", "Hand-finished", "Small runs", "Rose tones", "Made by women", "Yesmine"].map(
                (word) => (
                  <span key={word} className="flex items-center gap-3">
                    <PetalFlower className="h-4 w-4 text-pink-vivid" /> {word}
                  </span>
                ),
              )}
            </span>
          ))}
        </div>
      </div>

      {/* ---------- ABOUT ---------- */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
        <Reveal className="relative">
          <img
            src={about.image ?? "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=1200&q=80"}
            alt="Inside the Yesmine atelier"
            className="aspect-4/3 w-full rounded-[2.5rem] object-cover shadow-elegant"
          />
          <div className="glass absolute -right-4 bottom-6 hidden rounded-2xl px-5 py-4 text-center sm:block">
            <p className="font-display text-3xl text-primary">7 yrs</p>
            <p className="text-xs text-muted-foreground">of atelier craft</p>
          </div>
        </Reveal>

        <Reveal delay={100} className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            {t("nav.about")}
          </p>
          <h2 className="font-display text-4xl leading-tight sm:text-5xl">
            {about.title_en ?? "The Yesmine story"}
          </h2>
          <p className="text-lg leading-relaxed text-muted-foreground">{about.body_en}</p>
          <Button variant="outline" size="lg" asChild>
            <Link to="/about">
              Read our story <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </Reveal>
      </section>

      {/* ---------- COLLECTIONS ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <Reveal className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Collections</p>
          <h2 className="mt-2 font-display text-4xl sm:text-5xl">Shop by category</h2>
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(categories ?? []).map((c, i) => (
            <Reveal key={c.id} delay={i * 90}>
              <Link
                to="/shop"
                search={{ category: c.slug }}
                className="tilt-card group relative block aspect-3/4 overflow-hidden rounded-3xl shadow-soft"
              >
                <img
                  src={c.image_url ?? ""}
                  alt={localized(c, "name", lang)}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-ink/70 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="font-display text-2xl text-on-brand">{localized(c, "name", lang)}</h3>
                  <span className="mt-1 inline-flex items-center gap-1 text-sm text-on-brand/80">
                    {t("common.viewAll")} <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- FEATURED ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">New arrivals</p>
            <h2 className="mt-2 font-display text-4xl sm:text-5xl">Just landed</h2>
          </div>
          <Button variant="soft" asChild>
            <Link to="/shop">{t("common.viewAll")}</Link>
          </Button>
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p, i) => (
            <Reveal key={p.id} delay={i * 70}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- BEST SELLERS ---------- */}
      <section className="bg-card py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Best sellers</p>
            <h2 className="mt-2 font-display text-4xl sm:text-5xl">Loved most this season</h2>
          </Reveal>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {bestSellers.map((p, i) => (
              <Reveal key={p.id} delay={i * 70}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- TESTIMONIALS ---------- */}
      <TestimonialCarousel items={testimonials} />

      {/* ---------- LOOKBOOK ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Reveal className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Lookbook</p>
          <h2 className="mt-2 font-display text-4xl sm:text-5xl">@yesmine</h2>
        </Reveal>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {gallery.map((src, i) => (
            <Reveal key={src} delay={i * 60}>
              <div className="group relative aspect-square overflow-hidden rounded-2xl">
                <img
                  src={src}
                  alt={`Yesmine lookbook image ${i + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="relative mx-4 mb-4 overflow-hidden rounded-[2.5rem] bg-brand-gradient px-6 py-20 text-center sm:mx-6">
        <PetalFlower className="spin-slow absolute -left-12 -top-12 h-64 w-64 text-on-brand/15" />
        <Reveal className="relative mx-auto max-w-2xl space-y-6">
          <Logo tone="light" className="justify-center" />
          <h2 className="font-display text-4xl text-on-brand sm:text-5xl">Dress the way you feel</h2>
          <p className="text-on-brand/85">
            Explore the full atelier — new pieces are released in limited runs every month.
          </p>
          <Button variant="glass" size="xl" asChild>
            <Link to="/shop">{t("nav.shop")}</Link>
          </Button>
        </Reveal>
      </section>
    </div>
  );
}

function TestimonialCarousel({ items }: { items: Testimonial[] }) {
  const [index, setIndex] = useState(0);
  if (items.length === 0) return null;
  const active = items[index % items.length]!;

  return (
    <section className="relative overflow-hidden py-24">
      <div className="mesh-blob float-slow left-10 top-10 h-72 w-72 bg-pink-blush" />
      <div className="mesh-blob float-slower right-10 bottom-0 h-72 w-72 bg-pink-vivid" />
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <Reveal className="glass rounded-[2rem] p-10 shadow-soft">
          <Quote className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-6 font-display text-2xl leading-relaxed text-foreground sm:text-3xl">
            “{active.text}”
          </p>
          <p className="mt-6 text-sm font-medium text-primary">
            {active.name}
            {active.city ? ` · ${active.city}` : ""}
          </p>
          <div className="mt-8 flex justify-center gap-2">
            {items.map((item, i) => (
              <button
                key={item.name}
                type="button"
                aria-label={`Testimonial ${i + 1}`}
                onClick={() => setIndex(i)}
                className={
                  i === index % items.length
                    ? "h-2 w-8 rounded-full bg-primary transition-all"
                    : "h-2 w-2 rounded-full bg-primary/30 transition-all hover:bg-primary/60"
                }
              />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
