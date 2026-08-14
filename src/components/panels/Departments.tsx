import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Boxes, PackageCheck, Plus, Target, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/cart";
import { can, type Profile } from "@/lib/profile";
import { cn } from "@/lib/utils";

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Banknote;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5 rounded-3xl border bg-card p-6 shadow-soft">
      <h2 className="flex items-center gap-2 font-display text-xl">
        <Icon className="h-5 w-5 text-primary" /> {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-xl",
          tone === "good" && "text-primary",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/* ==================================================================== */
/* MOLIYA                                                               */
/* ==================================================================== */

const CATEGORIES = ["Ijara", "Oylik", "Tovar sotib olish", "Reklama", "Kommunal", "Boshqa"];

/** The ledger every other department's money eventually lands in. */
export function FinancePanel({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({
    kind: "expense",
    category: CATEGORIES[0]!,
    amount: "",
    note: "",
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["panel", "finance"],
    enabled: can(profile, "finance.read"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_entries")
        .select("*")
        .gte("happened_on", monthStart())
        .order("happened_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("finance_entries").insert({
        kind: draft.kind,
        category: draft.category,
        amount: Number(draft.amount || 0),
        note: draft.note.trim() || null,
        created_by: profile.employee_id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setDraft({ ...draft, amount: "", note: "" });
      toast.success("Yozildi");
      void queryClient.invalidateQueries({ queryKey: ["panel", "finance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const income = entries
    .filter((e) => e.kind === "income")
    .reduce((n, e) => n + Number(e.amount), 0);
  const expense = entries
    .filter((e) => e.kind === "expense")
    .reduce((n, e) => n + Number(e.amount), 0);

  return (
    <Section icon={Banknote} title="Moliya — shu oy">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Kirim" value={formatPrice(income)} tone="good" />
        <Stat label="Chiqim" value={formatPrice(expense)} tone="bad" />
        <Stat
          label="Sof"
          value={formatPrice(income - expense)}
          tone={income - expense >= 0 ? "good" : "bad"}
        />
      </div>

      {can(profile, "finance.write") ? (
        <div className="grid gap-3 rounded-2xl border bg-background p-4 sm:grid-cols-[9rem_11rem_1fr_1fr_auto]">
          <select
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
            className="h-10 rounded-xl border bg-card px-3 text-sm"
          >
            <option value="expense">Chiqim</option>
            <option value="income">Kirim</option>
          </select>
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            className="h-10 rounded-xl border bg-card px-3 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Input
            inputMode="numeric"
            placeholder="Summa"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value.replace(/\D/g, "") })}
          />
          <Input
            placeholder="Izoh"
            maxLength={200}
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
          <Button
            variant="soft"
            disabled={!draft.amount || add.isPending}
            onClick={() => add.mutate()}
          >
            <Plus className="mr-1 h-4 w-4" /> Yozish
          </Button>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Bu oyda yozuv yo&apos;q.</p>
      ) : (
        <ul className="divide-y rounded-2xl border text-sm">
          {entries.slice(0, 15).map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="font-medium">{e.category}</span>
              {e.note ? <span className="text-muted-foreground">· {e.note}</span> : null}
              <span className="text-xs text-muted-foreground">{e.happened_on}</span>
              <span
                className={cn(
                  "ml-auto tabular-nums",
                  e.kind === "income" ? "text-primary" : "text-destructive",
                )}
              >
                {e.kind === "income" ? "+" : "−"}
                {formatPrice(Number(e.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ==================================================================== */
/* TA'MINOT                                                             */
/* ==================================================================== */

/** Purchase orders. Receiving one moves stock and books the cost in one go. */
export function SupplyPanel({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const [supplier, setSupplier] = useState("");
  const [expected, setExpected] = useState("");

  const { data: orders = [] } = useQuery({
    queryKey: ["panel", "supply"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supply_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["panel", "supply"] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("supply_orders").insert({
        supplier: supplier.trim(),
        expected_on: expected || null,
        created_by: profile.employee_id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setSupplier("");
      setExpected("");
      toast.success("Buyurtma yaratildi");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const receive = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("receive_supply_order", { p_id: id });
      if (error) throw new Error(error.message);
      return data as unknown as { lines: number; total: number };
    },
    onSuccess: (r) => {
      toast.success(`Qabul qilindi — ${r.lines} satr, ${formatPrice(Number(r.total))}`);
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("ALREADY_RECEIVED")
          ? "Bu buyurtma allaqachon qabul qilingan."
          : e.message.includes("NOT_ALLOWED")
            ? "Sizda bunga ruxsat yo'q."
            : e.message,
      ),
  });

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("supply_orders").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
  };

  return (
    <Section icon={Boxes} title="Ta'minot">
      {can(profile, "supply.manage") ? (
        <div className="grid gap-3 rounded-2xl border bg-background p-4 sm:grid-cols-[1fr_12rem_auto]">
          <Input
            placeholder="Yetkazib beruvchi"
            maxLength={120}
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />
          <div className="space-y-1">
            <Label className="text-xs">Kutilayotgan sana</Label>
            <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
          </div>
          <Button
            variant="soft"
            className="self-end"
            disabled={supplier.trim().length < 2 || create.isPending}
            onClick={() => create.mutate()}
          >
            <Plus className="mr-1 h-4 w-4" /> Buyurtma
          </Button>
        </div>
      ) : null}

      {orders.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Buyurtma yo&apos;q.</p>
      ) : (
        <ul className="divide-y rounded-2xl border text-sm">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="font-medium">{o.supplier}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  o.status === "received"
                    ? "bg-accent text-accent-foreground"
                    : o.status === "cancelled"
                      ? "bg-muted text-muted-foreground"
                      : "bg-amber-100 text-amber-800",
                )}
              >
                {STATUS[o.status] ?? o.status}
              </span>
              {o.expected_on ? (
                <span className="text-xs text-muted-foreground">kutilmoqda: {o.expected_on}</span>
              ) : null}
              {Number(o.total) > 0 ? (
                <span className="text-muted-foreground">{formatPrice(Number(o.total))}</span>
              ) : null}

              {can(profile, "supply.manage") && o.status !== "received" ? (
                <div className="ml-auto flex gap-1">
                  {o.status === "draft" ? (
                    <Button variant="ghost" size="sm" onClick={() => setStatus(o.id, "ordered")}>
                      Buyurtma berildi
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={receive.isPending}
                    onClick={() => receive.mutate(o.id)}
                  >
                    <PackageCheck className="mr-1 h-4 w-4" /> Qabul qilish
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Qabul qilinganda tovar omborga qo&apos;shiladi va xarajat moliya daftariga yoziladi.
      </p>
    </Section>
  );
}

const STATUS: Record<string, string> = {
  draft: "Qoralama",
  ordered: "Buyurtma berildi",
  received: "Qabul qilindi",
  cancelled: "Bekor qilindi",
};

/* ==================================================================== */
/* MARKETING                                                            */
/* ==================================================================== */

const LEAD_LABEL: Record<string, string> = {
  new: "Yangi",
  in_work: "Ishlanmoqda",
  callback: "Qayta aloqa",
  won: "Sotildi",
  lost: "Yo'qotildi",
};

export function MarketingPanel({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();

  const { data: leads = [] } = useQuery({
    queryKey: ["panel", "leads"],
    enabled: can(profile, "leads.read"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const move = async (id: string, status: string) => {
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["panel", "leads"] });
  };

  const closed = leads.filter((l) => l.status === "won" || l.status === "lost");
  const won = leads.filter((l) => l.status === "won");

  return (
    <Section icon={Target} title="Marketing — lidlar">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Jami lid" value={String(leads.length)} />
        <Stat
          label="Konversiya"
          value={closed.length ? `${Math.round((won.length / closed.length) * 100)}%` : "—"}
          tone="good"
        />
        <Stat
          label="Sotilgan summa"
          value={formatPrice(won.reduce((n, l) => n + Number(l.amount), 0))}
          tone="good"
        />
      </div>

      {leads.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Lid yo&apos;q. Sotuv panelidan qo&apos;shiladi.
        </p>
      ) : (
        <ul className="divide-y rounded-2xl border text-sm">
          {leads.slice(0, 15).map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="font-medium">{l.name}</span>
              <span className="text-muted-foreground">{l.phone}</span>
              {Number(l.amount) > 0 ? (
                <span className="text-primary">{formatPrice(Number(l.amount))}</span>
              ) : null}
              {can(profile, "leads.write") ? (
                <select
                  value={l.status}
                  onChange={(e) => move(l.id, e.target.value)}
                  className="ml-auto h-8 rounded-lg border bg-background px-2 text-xs"
                >
                  {Object.entries(LEAD_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="ml-auto text-xs text-muted-foreground">
                  {LEAD_LABEL[l.status] ?? l.status}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ==================================================================== */
/* DIREKTOR                                                             */
/* ==================================================================== */

/** Every department on one screen, read-only. */
export function DirectorPanel() {
  const { data } = useQuery({
    queryKey: ["panel", "director"],
    queryFn: async () => {
      const from = monthStart();
      const [orders, finance, shifts, leads, low] = await Promise.all([
        supabase.from("orders").select("total,status,created_at").gte("created_at", from),
        supabase.from("finance_entries").select("kind,amount").gte("happened_on", from),
        supabase.from("shifts").select("id").is("ended_at", null),
        supabase.from("leads").select("status,amount"),
        supabase.from("products").select("id").eq("active", true).lte("stock", 3),
      ]);

      const live = (orders.data ?? []).filter((o) => o.status !== "cancelled");
      const entries = finance.data ?? [];
      return {
        revenue: live.reduce((n, o) => n + Number(o.total), 0),
        orderCount: live.length,
        income: entries
          .filter((e) => e.kind === "income")
          .reduce((n, e) => n + Number(e.amount), 0),
        expense: entries
          .filter((e) => e.kind === "expense")
          .reduce((n, e) => n + Number(e.amount), 0),
        openShifts: (shifts.data ?? []).length,
        leads: (leads.data ?? []).length,
        wonLeads: (leads.data ?? []).filter((l) => l.status === "won").length,
        lowStock: (low.data ?? []).length,
      };
    },
  });

  if (!data) return null;
  const net = data.income - data.expense;

  return (
    <Section icon={TrendingUp} title="Direktor — shu oy">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Do'kon tushumi" value={formatPrice(data.revenue)} tone="good" />
        <Stat label="Buyurtmalar" value={String(data.orderCount)} />
        <Stat label="Moliya: sof" value={formatPrice(net)} tone={net >= 0 ? "good" : "bad"} />
        <Stat label="Ochiq smenalar" value={String(data.openShifts)} />
        <Stat label="Lidlar" value={String(data.leads)} />
        <Stat label="Sotilgan lidlar" value={String(data.wonLeads)} tone="good" />
        <Stat
          label="Kam qolgan tovar"
          value={String(data.lowStock)}
          tone={data.lowStock > 0 ? "bad" : "good"}
        />
        <Stat label="Chiqim" value={formatPrice(data.expense)} tone="bad" />
      </div>
      <p className="text-xs text-muted-foreground">
        Bekor qilingan buyurtmalar tushumga kirmaydi. Moliya raqamlari faqat qo&apos;lda kiritilgan
        yozuvlardan.
      </p>
    </Section>
  );
}
