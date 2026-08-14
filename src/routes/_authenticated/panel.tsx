import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Banknote,
  Boxes,
  Camera,
  LogOut,
  Megaphone,
  ShoppingBag,
  Store,
  Target,
} from "lucide-react";
import { useEffect } from "react";

import {
  DirectorPanel,
  FinancePanel,
  MarketingPanel,
  SupplyPanel,
} from "@/components/panels/Departments";
import { SalesFloorPanel } from "@/components/panels/SalesFloor";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/cart";
import { can, profileQuery } from "@/lib/profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/panel")({
  ssr: false,
  component: StaffPanel,
});

/** Each department opens on the numbers that department is judged by. */
const PANEL_META: Record<string, { icon: typeof Store; tone: string }> = {
  director: { icon: Target, tone: "text-primary" },
  marketing: { icon: Megaphone, tone: "text-primary" },
  sales: { icon: Store, tone: "text-primary" },
  finance: { icon: Banknote, tone: "text-primary" },
  supply: { icon: Boxes, tone: "text-primary" },
};

function StaffPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery(profileQuery);

  useEffect(() => {
    // An owner who lands here belongs in the full admin panel.
    if (profile?.is_admin) navigate({ to: "/admin", replace: true });
  }, [profile, navigate]);

  const { data: orders } = useQuery({
    queryKey: ["panel", "orders"],
    enabled: can(profile, "orders.read"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,order_number,customer_name,status,total,created_at")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: lowStock } = useQuery({
    queryKey: ["panel", "low-stock"],
    enabled: can(profile, "stock.read") || can(profile, "products.read"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,stock")
        .eq("active", true)
        .lte("stock", 3)
        .order("stock");
      if (error) throw error;
      return data ?? [];
    },
  });

  const signOut = async () => {
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  // Signed in, but nobody has attached this account to an employee record yet.
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-3xl border bg-card p-8 text-center shadow-elegant">
          <h1 className="font-display text-2xl">Hisobingiz hali biriktirilmagan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Rahbaringiz sizni xodimlar ro'yxatiga qo'shishi kerak. Qo'shilgach, shu sahifa
            o'zingizning bo'limingizni ochadi.
          </p>
          <Button variant="soft" className="mt-6" onClick={signOut}>
            Chiqish
          </Button>
        </div>
      </div>
    );
  }

  const meta = PANEL_META[profile.panel] ?? PANEL_META["sales"]!;
  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4 sm:px-6">
          <Link to="/">
            <Logo className="h-8" />
          </Link>
          <div className="ml-2">
            <p className="font-medium">{profile.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {profile.position_title} · {profile.department_name}
            </p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={signOut}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> Chiqish
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <Icon className={cn("h-7 w-7", meta.tone)} />
          <div>
            <h1 className="font-display text-3xl">{profile.department_name}</h1>
            <p className="text-sm text-muted-foreground">
              {profile.permissions.includes("*")
                ? "To'liq huquq"
                : `${profile.permissions.length} ta ruxsat`}
            </p>
          </div>
        </div>

        {/* Each department gets its own tools; the shared read-only blocks
            below stay visible for everyone who has the permission. */}
        {profile.panel === "sales" ? <SalesFloorPanel profile={profile} /> : null}
        {profile.panel === "finance" ? <FinancePanel profile={profile} /> : null}
        {profile.panel === "supply" ? <SupplyPanel profile={profile} /> : null}
        {profile.panel === "marketing" ? <MarketingPanel profile={profile} /> : null}
        {profile.panel === "director" ? (
          <>
            <DirectorPanel />
            <FinancePanel profile={profile} />
            <MarketingPanel profile={profile} />
          </>
        ) : null}

        {/* ---------- ORDERS ---------- */}
        {can(profile, "orders.read") ? (
          <section className="rounded-3xl border bg-card p-6 shadow-soft">
            <h2 className="flex items-center gap-2 font-display text-xl">
              <ShoppingBag className="h-5 w-5 text-primary" /> Oxirgi buyurtmalar
            </h2>
            {(orders ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Buyurtma yo'q.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="pb-3">Raqam</th>
                      <th className="pb-3">Mijoz</th>
                      <th className="pb-3">Holat</th>
                      <th className="pb-3 text-right">Summa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(orders ?? []).map((o) => (
                      <tr key={o.id} className="border-t">
                        <td className="py-3 font-medium">{o.order_number}</td>
                        <td className="py-3 text-muted-foreground">{o.customer_name}</td>
                        <td className="py-3 capitalize">{o.status}</td>
                        <td className="py-3 text-right">{formatPrice(Number(o.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {/* ---------- STOCK ---------- */}
        {can(profile, "stock.read") || can(profile, "products.read") ? (
          <section className="rounded-3xl border bg-card p-6 shadow-soft">
            <h2 className="flex items-center gap-2 font-display text-xl">
              <Boxes className="h-5 w-5 text-primary" /> Kam qolgan tovarlar
            </h2>
            {(lowStock ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Hamma tovar yetarli.</p>
            ) : (
              <ul className="mt-4 divide-y text-sm">
                {(lowStock ?? []).map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <span>{p.name}</span>
                    <span className={cn(p.stock === 0 ? "text-destructive" : "text-amber-600")}>
                      {p.stock} dona
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {/* ---------- CCTV ---------- */}
        {can(profile, "cctv.view") ? (
          <section className="rounded-3xl border bg-card p-6 shadow-soft">
            <h2 className="flex items-center gap-2 font-display text-xl">
              <Camera className="h-5 w-5 text-primary" /> Videokuzatuv
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Kameralar hali ulanmagan. Ulash uchun kamera tizimining oqim manzili kerak.
            </p>
          </section>
        ) : null}

        {profile.permissions.length === 0 ? (
          <p className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Sizning lavozimingizga hali hech qanday bo'lim biriktirilmagan.
          </p>
        ) : null}
      </main>
    </div>
  );
}
