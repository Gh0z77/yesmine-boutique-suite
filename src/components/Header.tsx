import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Header() {
  const { t } = useI18n();
  const { count, setDrawerOpen } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [term, setTerm] = useState("");
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onShop = pathname.startsWith("/shop");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  const links = [
    { to: "/", label: t("nav.home") },
    { to: "/shop", label: t("nav.shop") },
    { to: "/about", label: t("nav.about") },
    { to: "/contact", label: t("nav.contact") },
  ] as const;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-500",
        scrolled ? "glass shadow-soft" : "bg-transparent",
      )}
    >
      {/* Equal 1fr side columns, so the middle one lands on the header's true
          centre no matter how wide the logo or the action cluster get. */}
      <div className="mx-auto grid h-20 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden items-center justify-center gap-9 text-base font-medium tracking-wide lg:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="relative text-foreground/85 transition-colors hover:text-primary"
              activeProps={{ className: "text-primary" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2 sm:gap-3">
          {onShop ? (
            <form
              className="hidden items-center md:flex"
              onSubmit={(e) => {
                e.preventDefault();
                const q = term.trim();
                void navigate({ to: "/shop", search: (prev) => ({ ...prev, q: q || undefined }) });
              }}
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder={t("common.search")}
                  aria-label={t("common.search")}
                  className="h-10 w-52 rounded-full pl-9"
                />
              </div>
            </form>
          ) : null}

          <LanguageSwitcher />

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t("cart.title")}
            className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-accent"
          >
            <ShoppingBag className="h-5 w-5 text-foreground" />
            {count > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gradient px-1 text-[11px] font-semibold text-on-brand">
                {count}
              </span>
            ) : null}
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {menuOpen ? (
        <div className="glass border-t lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-3">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="py-3 text-base font-medium text-foreground/85"
                activeProps={{ className: "text-primary" }}
                activeOptions={{ exact: l.to === "/" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
