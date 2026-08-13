import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DollarSign, Package, ShoppingBag, TrendingUp } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/cart";
import type { Order } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const [orders, products] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("id,stock,active"),
      ]);
      if (orders.error) throw orders.error;
      if (products.error) throw products.error;
      const list = (orders.data ?? []) as Order[];
      return {
        orders: list,
        revenue: list
          .filter((o) => o.status !== "cancelled")
          .reduce((sum, o) => sum + Number(o.total), 0),
        pending: list.filter((o) => o.status === "pending").length,
        products: products.data?.length ?? 0,
        lowStock: (products.data ?? []).filter((p) => p.stock <= 3).length,
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live snapshot of the Yesmine store. {stats?.lowStock ?? 0} products low on stock.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-3xl border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-3 font-display text-3xl">{c.value}</p>
          </div>
        ))}
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
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
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
      </div>
    </div>
  );
}
