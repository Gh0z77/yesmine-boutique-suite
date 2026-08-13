import { Link } from "@tanstack/react-router";
import { Instagram, Mail, MapPin, Phone, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo, PetalFlower } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");

  return (
    <footer className="relative mt-24 overflow-hidden bg-brand-gradient text-on-brand">
      <PetalFlower className="spin-slow absolute -right-10 -top-10 h-56 w-56 text-on-brand/15" />

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo tone="light" />
          <p className="max-w-xs text-sm text-on-brand/80">
            Yesmine is a small-run womenswear house: rose silk, soft wool and hand-finished satin, made by
            women for women.
          </p>
          <div className="flex gap-3">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Instagram"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-on-brand/30 transition-colors hover:bg-on-brand/15"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href="https://t.me"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Telegram"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-on-brand/30 transition-colors hover:bg-on-brand/15"
            >
              <Send className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <h3 className="font-display text-lg">Explore</h3>
          <ul className="space-y-2 text-on-brand/80">
            <li>
              <Link to="/" className="transition-opacity hover:opacity-100 hover:underline">
                {t("nav.home")}
              </Link>
            </li>
            <li>
              <Link to="/shop" className="transition-opacity hover:underline">
                {t("nav.shop")}
              </Link>
            </li>
            <li>
              <Link to="/about" className="transition-opacity hover:underline">
                {t("nav.about")}
              </Link>
            </li>
            <li>
              <Link to="/contact" className="transition-opacity hover:underline">
                {t("nav.contact")}
              </Link>
            </li>
            <li>
              <Link to="/cart" className="transition-opacity hover:underline">
                {t("cart.title")}
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-3 text-sm">
          <h3 className="font-display text-lg">Contact</h3>
          <ul className="space-y-2 text-on-brand/80">
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4" /> +998 71 200 40 40
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> hello@yesmine.store
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Tashkent, Amir Temur 12
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="font-display text-lg">{t("footer.newsletter")}</h3>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim())) {
                toast.error("Please enter a valid email address");
                return;
              }
              toast.success("You're on the list — welcome to Yesmine.");
              setEmail("");
            }}
          >
            <Input
              type="email"
              value={email}
              maxLength={255}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              aria-label="Email address"
              className="h-11 rounded-full border-on-brand/40 bg-on-brand/10 text-on-brand placeholder:text-on-brand/60"
            />
            <Button type="submit" variant="glass" size="icon" className="h-11 w-11" aria-label="Subscribe">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <LanguageSwitcher tone="light" className="w-fit" />
        </div>
      </div>

      <div className="border-t border-on-brand/20 px-4 py-5 text-center text-xs text-on-brand/70">
        © {new Date().getFullYear()} Yesmine. All rights reserved.
      </div>
    </footer>
  );
}
