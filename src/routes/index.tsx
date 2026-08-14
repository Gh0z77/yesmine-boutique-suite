import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Quote, Sparkles, Truck, Scissors, Heart } from "lucide-react";
import { useState } from "react";

import { Logo, PetalFlower, YesmineEmblem } from "@/components/Logo";
import { ParallaxLayer, ParallaxScene } from "@/components/Parallax";
import { ProductCard } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { CARD_WIDTHS, HERO_WIDTHS, imageSrc, imageSrcSet } from "@/lib/images";
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
  // Prefetch on the server so the HTML ships with real products and copy,
  // instead of an empty shell that fills in after hydration.
  loader: async ({ context }) => {
    const [content, categories, products] = await Promise.all([
      context.queryClient.ensureQueryData(contentQuery),
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(productsQuery),
    ]);
    // Returned (not just cached) so the router ships it to the browser — the
    // client cache starts warm and hydration matches what the server rendered.
    return { content, categories, products };
  },
  // The picture messengers show when the link is shared. It used to be a
  // fixed stock photo no one could change; now it follows the hero image
  // the owner uploads, so sharing the site shows the real shop.
  head: ({ loaderData }) => {
    const hero = (loaderData?.content?.["hero"] ?? {}) as { image?: string };
    const share = hero.image?.trim() || SHARE_FALLBACK;
    return {
    meta: [
      { title: "Yesmine — ipak ko'ylaklar, jun paltolar va qo'lda pardozlangan aksessuarlar" },
      {
        name: "description",
        content:
          "Yesmine zamonaviy ayolni pushti ipak, jun va atlasga o'raydi. Kichik partiyalarda tikilgan, qo'lda pardozlangan ayollar kiyimi.",
      },
      { property: "og:title", content: "Yesmine — nazokat, kuch bilan kiyiladi" },
      {
        property: "og:description",
        content:
          "Kichik partiyalarda tikilgan ipak ko'ylaklar, jun paltolar va qo'lda pardozlangan aksessuarlar.",
      },
      { property: "og:image", content: share },
      { name: "twitter:image", content: share },
    ],
    };
  },
  component: Landing,
});

/** Stand-ins, used only until the owner uploads their own from the panel. */
const HERO_FALLBACK = "https://images.unsplash.com/photo-1552874869-5c39ec9288dc?w=1000&q=80";
const ABOUT_FALLBACK = "https://images.unsplash.com/photo-1613447895817-e617a4093f50?w=1200&q=80";
const SHARE_FALLBACK = HERO_FALLBACK;

function Landing() {
  const { t, lang } = useI18n();
  const seed = Route.useLoaderData();
  const { data: content } = useQuery({ ...contentQuery, initialData: seed.content });
  const { data: categories } = useQuery({ ...categoriesQuery, initialData: seed.categories });
  const { data: products } = useQuery({ ...productsQuery, initialData: seed.products });

  const hero = (content?.["hero"] ?? {}) as HeroContent;
  const about = (content?.["about"] ?? {}) as AboutContent;
  const testimonials = (content?.["testimonials"] ?? []) as Testimonial[];
  const gallery = (content?.["gallery"] ?? []) as string[];

  const heroImage = (hero["image"] as string)?.trim() || HERO_FALLBACK;

  const pick = (base: "headline" | "sub" | "cta") =>
    (hero[`${base}_${lang}` as keyof HeroContent] as string) ||
    (hero[`${base}_en` as keyof HeroContent] as string) ||
    "";

  /** Falls back to English whenever a block hasn't been translated yet. */
  const pickAbout = (base: "title" | "body") =>
    (about[`${base}_${lang}` as keyof AboutContent] as string) ||
    (about[`${base}_en` as keyof AboutContent] as string) ||
    "";

  // Brand words in the scrolling strip; "brand" stays the wordmark in every language.
  const marquee = ["silk", "handFinished", "smallRuns", "roseTones", "madeByWomen", "brand"];

  const featured = (products ?? []).filter((p) => p.featured).slice(0, 8);
  const bestSellers = [...(products ?? [])].sort((a, b) => b.sold_count - a.sold_count).slice(0, 4);

  return (
    <div className="overflow-x-hidden">
      {/* ---------- HERO ---------- */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-soft-gradient" />
        <div className="mesh-blob float-slow -left-24 top-0 h-[28rem] w-[28rem] text-pink-vivid" />
        <div className="mesh-blob float-slower right-0 top-24 h-[26rem] w-[26rem] text-magenta" />
        <div className="mesh-blob float-slow bottom-0 left-1/3 h-80 w-80 text-pink-blush" />

        {/* drifting petals */}
        {[12, 34, 58, 76, 90].map((left, i) => (
          <PetalFlower
            key={left}
            className="drift-petal absolute top-0 h-8 w-8 text-pink-vivid/45"
            {...{ style: { left: `${left}%`, animationDelay: `${i * 3}s` } }}
          />
        ))}

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-2 lg:pb-32 lg:pt-16">
          <div className="space-y-8">
            <Reveal className="flex items-center gap-3">
              <span className="flex items-center gap-2 rounded-full border border-primary/20 bg-card/70 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3.5 w-3.5" /> {t("home.badge")}
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
                <Scissors className="h-4 w-4 text-primary" /> {t("home.smallRuns")}
              </span>
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" /> {t("home.worldwide")}
              </span>
              <span className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-primary" /> {t("home.happy")}
              </span>
            </Reveal>
          </div>

          {/* Layered 3D scene — each layer sits at its own depth and leans
              toward the cursor, so the card genuinely reads as dimensional. */}
          <Reveal delay={120} className="relative">
            <ParallaxScene className="relative mx-auto aspect-4/5 w-full max-w-md" depth={900}>
              <ParallaxLayer z={-60} strength={8} className="absolute inset-0">
                <div className="absolute inset-0 rotate-3 rounded-[3rem] bg-brand-gradient shadow-elegant" />
              </ParallaxLayer>

              <ParallaxLayer z={20} strength={16} scrollFactor={0.03} className="absolute inset-0">
                <img
                  src={imageSrc(heroImage, 900)}
                  srcSet={imageSrcSet(heroImage, HERO_WIDTHS)}
                  sizes="(min-width: 1024px) 28rem, 92vw"
                  fetchPriority="high"
                  decoding="async"
                  alt="Yesmine model wearing a rose silk dress"
                  className="h-full w-full -rotate-2 rounded-[3rem] object-cover shadow-elegant transition-transform duration-700 ease-out hover:rotate-0"
                />
              </ParallaxLayer>

              <ParallaxLayer z={90} strength={30} className="absolute -bottom-8 -left-6">
                <div className="glass float-slow flex items-center gap-3 rounded-3xl p-4 shadow-soft">
                  <YesmineEmblem className="h-10 w-10 text-primary" />
                  <div>
                    <p className="font-script text-2xl leading-none text-primary">Yesmine</p>
                    <p className="text-xs text-muted-foreground">{t("home.atelierSince")}</p>
                  </div>
                </div>
              </ParallaxLayer>

              <ParallaxLayer z={120} strength={40} className="absolute -right-4 top-10">
                <div className="glass flex flex-col items-center rounded-2xl px-4 py-3 shadow-soft">
                  <PetalFlower className="spin-slow h-6 w-6 text-pink-vivid" />
                  <p className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                    {t("home.handFinished")}
                  </p>
                </div>
              </ParallaxLayer>
            </ParallaxScene>
          </Reveal>
        </div>
      </section>

      {/* ---------- MARQUEE ---------- */}
      <div className="overflow-hidden border-y bg-card py-4">
        <div className="marquee-track flex w-max gap-12 whitespace-nowrap px-6 text-sm uppercase tracking-[0.25em] text-muted-foreground">
          {Array.from({ length: 2 }).map((_, dup) => (
            <span key={dup} className="flex gap-12">
              {marquee.map((key) => (
                <span key={key} className="flex items-center gap-3">
                  <PetalFlower className="h-4 w-4 text-pink-vivid" />{" "}
                  {key === "brand" ? "Yesmine" : t(`marquee.${key}`)}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ---------- ABOUT ---------- */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
        <Reveal className="relative">
          <img
            src={imageSrc(about.image || ABOUT_FALLBACK, 900)}
            srcSet={imageSrcSet(about.image || ABOUT_FALLBACK, HERO_WIDTHS)}
            sizes="(min-width: 1024px) 45vw, 92vw"
            loading="lazy"
            decoding="async"
            alt="Inside the Yesmine atelier"
            className="aspect-4/3 w-full rounded-[2.5rem] object-cover shadow-elegant"
          />
          <div className="glass absolute -right-4 bottom-6 hidden rounded-2xl px-5 py-4 text-center sm:block">
            <p className="font-display text-3xl text-primary">{t("home.yearsValue")}</p>
            <p className="text-xs text-muted-foreground">{t("home.yearsLabel")}</p>
          </div>
        </Reveal>

        <Reveal delay={100} className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            {t("nav.about")}
          </p>
          <h2 className="font-display text-4xl leading-tight sm:text-5xl">
            {pickAbout("title") || "The Yesmine story"}
          </h2>
          <p className="text-lg leading-relaxed text-muted-foreground">{pickAbout("body")}</p>
          <Button variant="outline" size="lg" asChild>
            <Link to="/about">
              {t("home.readStory")} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </Reveal>
      </section>

      {/* ---------- COLLECTIONS ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <Reveal className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            {t("home.collections")}
          </p>
          <h2 className="mt-2 font-display text-4xl sm:text-5xl">{t("home.shopByCategory")}</h2>
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
                  src={imageSrc(c.image_url, 450)}
                  srcSet={imageSrcSet(c.image_url, CARD_WIDTHS)}
                  sizes="(min-width: 1024px) 24vw, 45vw"
                  alt={localized(c, "name", lang)}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-ink/70 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="font-display text-2xl text-on-brand">
                    {localized(c, "name", lang)}
                  </h3>
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
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              {t("home.newArrivals")}
            </p>
            <h2 className="mt-2 font-display text-4xl sm:text-5xl">{t("home.justLanded")}</h2>
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
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              {t("home.bestSellers")}
            </p>
            <h2 className="mt-2 font-display text-4xl sm:text-5xl">{t("home.lovedMost")}</h2>
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
      <TestimonialCarousel items={testimonials} lang={lang} />

      {/* ---------- LOOKBOOK ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Reveal className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            {t("home.lookbook")}
          </p>
          <h2 className="mt-2 font-display text-4xl sm:text-5xl">@yesmine</h2>
        </Reveal>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {gallery.map((src, i) => (
            <Reveal key={src} delay={i * 60}>
              <div className="group relative aspect-square overflow-hidden rounded-2xl">
                <img
                  src={imageSrc(src, 400)}
                  srcSet={imageSrcSet(src, CARD_WIDTHS)}
                  sizes="(min-width: 1024px) 16vw, 45vw"
                  alt={`Yesmine lookbook image ${i + 1}`}
                  loading="lazy"
                  decoding="async"
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
          <h2 className="font-display text-4xl text-on-brand sm:text-5xl">{t("home.ctaTitle")}</h2>
          <p className="text-on-brand/85">{t("home.ctaBody")}</p>
          <Button variant="glass" size="xl" asChild>
            <Link to="/shop">{t("nav.shop")}</Link>
          </Button>
        </Reveal>
      </section>
    </div>
  );
}

function TestimonialCarousel({ items, lang }: { items: Testimonial[]; lang: string }) {
  const [index, setIndex] = useState(0);
  if (items.length === 0) return null;
  const active = items[index % items.length]!;
  // A review written in English should not stay English once the reader
  // switches the site to Uzbek — fall back only when nothing was written.
  const quote =
    (active[`text_${lang}` as keyof Testimonial] as string | undefined)?.trim() || active.text;

  return (
    <section className="relative overflow-hidden py-24">
      <div className="mesh-blob float-slow left-10 top-10 h-72 w-72 text-pink-blush" />
      <div className="mesh-blob float-slower right-10 bottom-0 h-72 w-72 text-pink-vivid" />
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <Reveal className="glass rounded-[2rem] p-10 shadow-soft">
          <Quote className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-6 font-display text-2xl leading-relaxed text-foreground sm:text-3xl">
            “{quote}”
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
