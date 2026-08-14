import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, DollarSign, Package, ShoppingBag, TrendingUp } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/cart";
import { ORDER_STATUSES, type Order, type OrderItem } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

const STATUS_TONE: Record<string, string> = {
  pending: "bg-chart-4",
  processing: "bg-chart-2",
  shipped: "bg-chart-3",
  delivered: "bg-primary",
  cancelled: "bg-muted-foreground",
};

function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const [orders, items, products, leads] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("order_items").select("*"),
        supabase.from("products").select("id,name,stock,active,price,sold_count"),
        // The sales desk works in its own panel; without this the owner had no
        // way to see any of it from here.
        supabase.from("leads").select("status,amount"),
      ]);
      if (orders.error) throw orders.error;
      if (items.error) throw items.error;
      if (products.error) throw products.error;

      const list = (orders.data ?? []) as Order[];
      const lines = (items.data ?? []) as OrderItem[];
      const live = list.filter((o) => o.status !== "cancelled");
      const liveIds = new Set(live.map((o) => o.id));

      // Revenue and units come from the order lines of orders that weren't cancelled.
      const perProduct = new Map<string, { name: string; units: number; revenue: number }>();
      for (const line of lines) {
        if (!liveIds.has(line.order_id)) continue;
        const id = line.product_id ?? line.product_name;
        const entry = perProduct.get(id) ?? { name: line.product_name, units: 0, revenue: 0 };
        entry.units += line.quantity;
        entry.revenue += Number(line.price) * line.quantity;
        perProduct.set(id, entry);
      }

      const byStatus = ORDER_STATUSES.map((status) => ({
        status,
        count: list.filter((o) => o.status === status).length,
      }));

      const leadRows = leads.data ?? [];
      const closedLeads = leadRows.filter((l) => l.status === "won" || l.status === "lost");
      const wonLeads = leadRows.filter((l) => l.status === "won");

      return {
        leads: {
          total: leadRows.length,
          open: leadRows.length - closedLeads.length,
          won: wonLeads.length,
          rate: closedLeads.length ? wonLeads.length / closedLeads.length : 0,
          wonAmount: wonLeads.reduce((n, l) => n + Number(l.amount), 0),
        },
        orders: list,
        revenue: live.reduce((sum, o) => sum + Number(o.total), 0),
        pending: list.filter((o) => o.status === "pending").length,
        products: products.data?.length ?? 0,
        lowStock: (products.data ?? []).filter((p) => p.active && p.stock <= 3),
        byStatus,
        topSellers: [...perProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      };
    },
  });

  const cards = [
    { label: "Revenue", value: formatPrice(stats?.revenue ?? 0), icon: DollarSign },
    { label: "Orders", value: String(stats?.orders.length ?? 0), icon: ShoppingBag },
    { label: "Pending", value: String(stats?.pending ?? 0), icon: TrendingUp },
    { label: "Products", value: String(stats?.products ?? 0), icon: Package },
  ];

  const recent = (stats?.orders ?? []).slice(0, 8);
  const totalOrders = stats?.orders.length ?? 0;
  const lowStock = stats?.lowStock ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live snapshot of the Yesmine store. Cancelled orders are excluded from revenue.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-3xl border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-3 font-display text-3xl">
              {isLoading ? (
                <span className="inline-block h-8 w-20 animate-pulse rounded bg-muted" />
              ) : (
                c.value
              )}
            </p>
          </div>
        ))}
      </div>

      {stats?.leads && stats.leads.total > 0 ? (
        <div className="rounded-3xl border bg-card p-6 shadow-soft">
          <h2 className="font-display text-xl">Sotuv bo'limi</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Jami lid</p>
              <p className="mt-1 font-display text-2xl">{stats.leads.total}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ochiq</p>
              <p className="mt-1 font-display text-2xl">{stats.leads.open}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Konversiya</p>
              <p className="mt-1 font-display text-2xl">{Math.round(stats.leads.rate * 100)}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sotilgan summa</p>
              <p className="mt-1 font-display text-2xl">{formatPrice(stats.leads.wonAmount)}</p>
            </div>
          </div>
        </div>
      ) : null}

      {lowStock.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-3xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="font-medium text-destructive">
            {lowStock.length} product{lowStock.length === 1 ? "" : "s"} low on stock:
          </span>
          <span className="text-muted-foreground">
            {lowStock.map((p) => `${p.name} (${p.stock})`).join(", ")}
          </span>
          <Link to="/admin/products" className="text-primary hover:underline">
            Restock
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------- STATUS BREAKDOWN ---------- */}
        <div className="rounded-3xl border bg-card p-6 shadow-soft">
          <h2 className="font-display text-xl">Orders by status</h2>
          {totalOrders === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                {(stats?.byStatus ?? [])
                  .filter((s) => s.count > 0)
                  .map((s) => (
                    <span
                      key={s.status}
                      className={cn("h-full", STATUS_TONE[s.status] ?? "bg-muted")}
                      style={{ width: `${(s.count / totalOrders) * 100}%` }}
                    />
                  ))}
              </div>
              <ul className="space-y-2 text-sm">
                {(stats?.byStatus ?? []).map((s) => (
                  <li key={s.status} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        STATUS_TONE[s.status] ?? "bg-muted",
                      )}
                    />
                    <span className="capitalize">{s.status}</span>
                    <span className="ml-auto tabular-nums text-muted-foreground">
                      {s.count} · {Math.round((s.count / totalOrders) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ---------- TOP SELLERS ---------- */}
        <div className="rounded-3xl border bg-card p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl">Top sellers</h2>
            <Link to="/admin/products" className="text-sm text-primary hover:underline">
              All products
            </Link>
          </div>
          {(stats?.topSellers ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nothing sold yet.</p>
          ) : (
            <ol className="space-y-3 text-sm">
              {(stats?.topSellers ?? []).map((p, i) => (
                <li key={p.name} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                    {i + 1}
                  </span>
                  <span className="line-clamp-1 flex-1">{p.name}</span>
                  <span className="text-muted-foreground">{p.units} sold</span>
                  <span className="w-20 text-right font-medium">{formatPrice(p.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="rounded-3xl border bg-card p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl">Recent orders</h2>
          <Link to="/admin/orders" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="pb-3">Order</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="py-3 font-medium">{o.order_number}</td>
                    <td className="py-3 text-muted-foreground">{o.customer_name}</td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 capitalize">{o.status}</td>
                    <td className="py-3 text-right">{formatPrice(Number(o.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
