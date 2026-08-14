import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  LogOut,
  Package,
  ScrollText,
  Settings,
  ShoppingBag,
  Sparkles,
  Contact,
  Inbox,
  Tags,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/products", label: "Products", icon: Package, exact: false },
  { to: "/admin/categories", label: "Categories", icon: Tags, exact: false },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag, exact: false },
  { to: "/admin/content", label: "Content", icon: ScrollText, exact: false },
  { to: "/admin/inbox", label: "Inbox", icon: Inbox, exact: false },
  { to: "/admin/payments", label: "Sozlamalar", icon: Settings, exact: false },
  { to: "/admin/staff", label: "Xodimlar", icon: Contact, exact: false },
  { to: "/admin/team", label: "Team", icon: Users, exact: false },
] as const;

function AdminLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [claiming, setClaiming] = useState(false);

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const {
    data: isAdmin,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["is-admin", session?.id],
    enabled: Boolean(session?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
  });

  // A signed-in employee who isn't the owner belongs in their own cabinet, not
  // on a "claim admin" screen they can never satisfy.
  const { data: profile } = useQuery({ ...profileQuery, enabled: isAdmin === false });

  useEffect(() => {
    if (isAdmin === false && profile?.employee_id) navigate({ to: "/panel", replace: true });
  }, [isAdmin, profile, navigate]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/auth", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const claim = async () => {
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_admin");
    setClaiming(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      toast.success("You are now the store admin.");
      void refetch();
    } else {
      toast.error("This email isn't on the studio allow list.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-3xl border bg-card p-8 text-center shadow-elegant">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-4 font-display text-2xl">Studio access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {session?.email} hisobida studio huquqi yo'q. Agar siz do'kon egasi bo'lsangiz, admin
            o'rnini egallang. Xodim bo'lsangiz — rahbaringiz sizni Xodimlar bo'limiga qo'shishi
            kerak, shundan keyin bu sahifa avtomatik o'z kabinetingizga o'tadi.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="hero" disabled={claiming} onClick={claim}>
              Claim admin access
            </Button>
            <Button variant="soft" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card p-6 lg:flex">
        <Link to="/">
          <Logo className="h-8" />
        </Link>
        <nav className="mt-10 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              activeProps={{ className: "bg-brand-gradient text-on-brand shadow-soft" }}
              inactiveProps={{
                className: "text-muted-foreground hover:bg-accent hover:text-primary",
              }}
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all"
            >
              <item.icon className="h-4 w-4" /> {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3 pt-8">
          <p className="truncate text-xs text-muted-foreground">{session?.email}</p>
          <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center gap-3 overflow-x-auto border-b bg-card px-4 py-3 lg:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              activeProps={{ className: "bg-brand-gradient text-on-brand" }}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-muted-foreground"
            >
              {item.label}
            </Link>
          ))}
          <button type="button" onClick={signOut} className="ml-auto text-sm text-muted-foreground">
            <LogOut className="h-4 w-4" />
          </button>
        </header>
        <main className="p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
