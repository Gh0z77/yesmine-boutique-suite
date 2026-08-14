import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MapPicker } from "@/components/MapPicker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/cart";
import { ORDER_STATUSES, type Order, type OrderItem } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: AdminOrders,
});

function AdminOrders() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: async () => {
      const [orders, items] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("order_items").select("*"),
      ]);
      if (orders.error) throw orders.error;
      if (items.error) throw items.error;
      return {
        orders: (orders.data ?? []) as Order[],
        items: (items.data ?? []) as OrderItem[],
      };
    },
  });

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Order marked ${status}`);
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
  };

  const orders = (data?.orders ?? []).filter((o) => filter === "all" || o.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">{orders.length} orders</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-muted" />
      ) : orders.length === 0 ? (
        <div className="rounded-3xl border bg-card p-12 text-center text-muted-foreground">
          No orders here yet.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const items = (data?.items ?? []).filter((i) => i.order_id === o.id);
            const expanded = open === o.id;
            return (
              <div key={o.id} className="rounded-3xl border bg-card p-5 shadow-soft">
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => setOpen(expanded ? null : o.id)}
                  >
                    <p className="font-medium">{o.order_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {o.customer_name} · {o.phone} · {new Date(o.created_at).toLocaleDateString()}
                    </p>
                  </button>
                  <span className="ml-auto font-display text-xl text-primary">
                    {formatPrice(Number(o.total))}
                  </span>
                  <Select value={o.status} onValueChange={(v) => void updateStatus(o.id, v)}>
                    <SelectTrigger className="w-40 capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {expanded ? (
                  <div className="mt-5 grid gap-5 border-t pt-5 sm:grid-cols-2">
                    <div className="space-y-3 text-sm">
                      <p className="font-medium">Delivery</p>
                      <p className="text-muted-foreground">{o.address}</p>
                      {o.email ? <p className="text-muted-foreground">{o.email}</p> : null}
                      {o.note ? <p className="text-muted-foreground">Note: {o.note}</p> : null}
                      <p className="text-muted-foreground">
                        Payment: {o.payment_status} {o.payment_ref ? `(${o.payment_ref})` : ""}
                      </p>
                      <p className="text-muted-foreground">
                        Placed {new Date(o.created_at).toLocaleString()}
                      </p>

                      {o.lat !== null && o.lng !== null ? (
                        <div className="space-y-2">
                          <p className="font-medium">Pinned delivery point</p>
                          <MapPicker
                            lat={o.lat}
                            lng={o.lng}
                            onChange={() => {}}
                            readOnly
                            initialZoom={15}
                          />
                          <a
                            className="inline-flex items-center gap-1.5 text-primary hover:underline"
                            href={`https://www.openstreetmap.org/?mlat=${o.lat}&mlon=${o.lng}#map=17/${o.lat}/${o.lng}`}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            <MapPin className="h-3.5 w-3.5" /> Open in maps ({o.lat.toFixed(5)},{" "}
                            {o.lng.toFixed(5)})
                          </a>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No map location was recorded.</p>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="font-medium">Items</p>
                      {items.map((i) => (
                        <div key={i.id} className="flex justify-between text-muted-foreground">
                          <span>
                            {i.product_name} ×{i.quantity}{" "}
                            {[i.size, i.color].filter(Boolean).join(" · ")}
                          </span>
                          <span>{formatPrice(Number(i.price) * i.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
