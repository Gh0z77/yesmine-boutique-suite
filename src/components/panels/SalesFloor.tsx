import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Clock, LogIn, LogOut, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/cart";
import { can, type Profile } from "@/lib/profile";
import { cn } from "@/lib/utils";

/**
 * The shop floor: who is on shift and what is in the till.
 *
 * The close-out is deliberately blind — the cashier types what they counted
 * before the expected figure appears. Showing the target first turns a control
 * into a formality.
 */
export function SalesFloorPanel({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const employeeId = profile.employee_id;
  const [float, setFloat] = useState("");
  const [counted, setCounted] = useState("");
  const [movement, setMovement] = useState({ kind: "sale", amount: "", note: "" });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["panel", "shift"] });
    void queryClient.invalidateQueries({ queryKey: ["panel", "cash"] });
  };

  const { data: shift } = useQuery({
    queryKey: ["panel", "shift", employeeId],
    enabled: Boolean(employeeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .eq("employee_id", employeeId!)
        .is("ended_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: session } = useQuery({
    queryKey: ["panel", "cash", employeeId],
    enabled: Boolean(employeeId) && can(profile, "cash.register"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_sessions")
        .select("*")
        .eq("employee_id", employeeId!)
        .is("closed_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["panel", "cash", "movements", session?.id],
    enabled: Boolean(session?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_movements")
        .select("*")
        .eq("session_id", session!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: expected } = useQuery({
    queryKey: ["panel", "cash", "expected", session?.id, movements.length],
    enabled: Boolean(session?.id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cash_expected", { p_session: session!.id });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });

  // Supabase builders are thenables rather than real Promises, so this takes
  // PromiseLike and awaits it instead of trying to chain off a Promise.
  const run = async (
    query: PromiseLike<{ error: { message: string } | null }>,
    ok: string,
  ): Promise<boolean> => {
    const { error } = await query;
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success(ok);
    invalidate();
    return true;
  };

  const startShift = useMutation({
    mutationFn: () =>
      run(supabase.from("shifts").insert({ employee_id: employeeId! }), "Smena boshlandi"),
  });

  const endShift = useMutation({
    mutationFn: () =>
      run(
        supabase.from("shifts").update({ ended_at: new Date().toISOString() }).eq("id", shift!.id),
        "Smena yopildi",
      ),
  });

  const openTill = useMutation({
    mutationFn: () =>
      run(
        supabase
          .from("cash_sessions")
          .insert({ employee_id: employeeId!, opening_float: Number(float || 0) }),
        "Kassa ochildi",
      ).then((okay) => {
        if (okay) setFloat("");
      }),
  });

  const addMovement = useMutation({
    mutationFn: () =>
      run(
        supabase.from("cash_movements").insert({
          session_id: session!.id,
          kind: movement.kind,
          amount: Number(movement.amount || 0),
          note: movement.note.trim() || null,
        }),
        "Yozildi",
      ).then((okay) => {
        if (okay) setMovement({ kind: "sale", amount: "", note: "" });
      }),
  });

  const closeTill = useMutation({
    mutationFn: () =>
      run(
        supabase
          .from("cash_sessions")
          .update({ counted_cash: Number(counted || 0), closed_at: new Date().toISOString() })
          .eq("id", session!.id),
        "Kassa yopildi",
      ).then((okay) => {
        if (okay) setCounted("");
      }),
  });

  const difference =
    session?.counted_cash != null ? Number(session.counted_cash) - (expected ?? 0) : null;

  return (
    <div className="space-y-6">
      {/* ---------- SHIFT ---------- */}
      <section className="rounded-3xl border bg-card p-6 shadow-soft">
        <h2 className="flex items-center gap-2 font-display text-xl">
          <Clock className="h-5 w-5 text-primary" /> Smena
        </h2>
        {shift ? (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <p className="text-sm">
              Boshlandi:{" "}
              <span className="font-medium">{new Date(shift.started_at).toLocaleString()}</span>
            </p>
            <Button
              variant="soft"
              size="sm"
              className="ml-auto"
              disabled={endShift.isPending}
              onClick={() => endShift.mutate()}
            >
              <LogOut className="mr-1.5 h-4 w-4" /> Smenani yopish
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <p className="text-sm text-muted-foreground">Smena ochilmagan.</p>
            <Button
              variant="hero"
              size="sm"
              className="ml-auto"
              disabled={startShift.isPending}
              onClick={() => startShift.mutate()}
            >
              <LogIn className="mr-1.5 h-4 w-4" /> Smenani boshlash
            </Button>
          </div>
        )}
      </section>

      {/* ---------- CASH ---------- */}
      {can(profile, "cash.register") ? (
        <section className="space-y-5 rounded-3xl border bg-card p-6 shadow-soft">
          <h2 className="flex items-center gap-2 font-display text-xl">
            <Banknote className="h-5 w-5 text-primary" /> Kassa
          </h2>

          {!session ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label>Boshlang&apos;ich qoldiq</Label>
                <Input
                  inputMode="numeric"
                  value={float}
                  className="w-40"
                  onChange={(e) => setFloat(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <Button
                variant="hero"
                disabled={openTill.isPending}
                onClick={() => openTill.mutate()}
              >
                Kassani ochish
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat
                  label="Ochilish qoldig'i"
                  value={formatPrice(Number(session.opening_float))}
                />
                <Stat label="Harakatlar" value={String(movements.length)} />
                <Stat label="Kassada bo'lishi kerak" value={formatPrice(expected ?? 0)} accent />
              </div>

              {/* add movement */}
              <div className="grid gap-3 rounded-2xl border bg-background p-4 sm:grid-cols-[10rem_1fr_1fr_auto]">
                <select
                  value={movement.kind}
                  onChange={(e) => setMovement({ ...movement, kind: e.target.value })}
                  className="h-10 rounded-xl border bg-card px-3 text-sm"
                >
                  <option value="sale">Sotuv</option>
                  <option value="refund">Qaytarish</option>
                  <option value="expense">Xarajat</option>
                  <option value="deposit">Kassaga qo&apos;shish</option>
                  <option value="withdrawal">Kassadan olish</option>
                </select>
                <Input
                  inputMode="numeric"
                  placeholder="Summa"
                  value={movement.amount}
                  onChange={(e) =>
                    setMovement({ ...movement, amount: e.target.value.replace(/\D/g, "") })
                  }
                />
                <Input
                  placeholder="Izoh"
                  maxLength={200}
                  value={movement.note}
                  onChange={(e) => setMovement({ ...movement, note: e.target.value })}
                />
                <Button
                  variant="soft"
                  disabled={!movement.amount || addMovement.isPending}
                  onClick={() => addMovement.mutate()}
                >
                  <Plus className="mr-1 h-4 w-4" /> Qo&apos;shish
                </Button>
              </div>

              {movements.length > 0 ? (
                <ul className="divide-y rounded-2xl border text-sm">
                  {movements.slice(0, 10).map((m) => (
                    <li key={m.id} className="flex items-center gap-3 p-3">
                      <span className="capitalize">{LABEL[m.kind] ?? m.kind}</span>
                      {m.note ? <span className="text-muted-foreground">· {m.note}</span> : null}
                      <span
                        className={cn(
                          "ml-auto tabular-nums",
                          POSITIVE.includes(m.kind) ? "text-primary" : "text-destructive",
                        )}
                      >
                        {POSITIVE.includes(m.kind) ? "+" : "−"}
                        {formatPrice(Number(m.amount))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {/* blind close */}
              <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-dashed p-4">
                <div className="space-y-1.5">
                  <Label>Sanab chiqilgan naqd</Label>
                  <Input
                    inputMode="numeric"
                    value={counted}
                    className="w-44"
                    placeholder="Avval sanang"
                    onChange={(e) => setCounted(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                {counted ? (
                  <p className="text-sm">
                    Farq:{" "}
                    <span
                      className={cn(
                        "font-medium",
                        Number(counted) - (expected ?? 0) === 0
                          ? "text-primary"
                          : "text-destructive",
                      )}
                    >
                      {formatPrice(Number(counted) - (expected ?? 0))}
                    </span>
                  </p>
                ) : null}
                <Button
                  variant="soft"
                  className="ml-auto"
                  disabled={!counted || closeTill.isPending}
                  onClick={() => closeTill.mutate()}
                >
                  Kassani yopish
                </Button>
              </div>

              {difference !== null ? (
                <p className="text-sm text-muted-foreground">
                  Oxirgi farq: {formatPrice(difference)}
                </p>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

const POSITIVE = ["sale", "deposit"];
const LABEL: Record<string, string> = {
  sale: "Sotuv",
  refund: "Qaytarish",
  expense: "Xarajat",
  deposit: "Qo'shildi",
  withdrawal: "Olindi",
};

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-4", accent && "border-primary/40 bg-accent")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl">{value}</p>
    </div>
  );
}
