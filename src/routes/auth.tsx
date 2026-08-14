import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Kirish — Yesmine" },
      { name: "description", content: "Yesmine ishchi paneli." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

/**
 * One form, no choices.
 *
 * Nobody picks a role at the door — the account already knows which job it
 * belongs to, so the only thing asked for is who you are. Where you land is
 * decided after sign-in from the employee record, which the person signing in
 * cannot influence.
 */
function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void routeByRole(navigate);
    });
  }, [navigate]);

  const submit = async () => {
    const address = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(address)) {
      toast.error("Emailni to'g'ri kiriting.");
      return;
    }
    if (password.length < 6) {
      toast.error("Parolni kiriting.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: address, password });

    if (error) {
      setLoading(false);
      // Deliberately identical for a wrong password and an unknown address:
      // the form must not reveal which accounts exist.
      toast.error("Email yoki parol noto'g'ri.");
      return;
    }

    await routeByRole(navigate);
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      <div className="absolute inset-0 -z-10 bg-soft-gradient" />
      <div className="mesh-blob absolute -left-24 top-10 -z-10 h-72 w-72 text-pink-blush" />

      <div className="w-full max-w-sm rounded-[2rem] border bg-card p-8 shadow-elegant">
        <Link to="/" className="flex justify-center">
          <Logo className="h-9" />
        </Link>

        <h1 className="mt-8 flex items-center justify-center gap-2 text-center font-display text-3xl">
          <Lock className="h-5 w-5 text-primary" /> Kirish
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Rahbaringiz bergan login va parol bilan kiring.
        </p>

        <div className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label>Login (email)</Label>
            <Input
              type="email"
              value={email}
              maxLength={255}
              autoFocus
              autoComplete="username"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Parol</Label>
            <Input
              type="password"
              value={password}
              maxLength={72}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
            />
          </div>

          <Button variant="hero" size="lg" className="w-full" disabled={loading} onClick={submit}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Kirish
          </Button>

          <Link
            to="/"
            className="block text-center text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            Bosh sahifa
          </Link>
        </div>
      </div>
    </div>
  );
}

/** The database decides the destination, not the browser. */
async function routeByRole(navigate: ReturnType<typeof useNavigate>) {
  const { data } = await supabase.rpc("my_profile");
  const profile = data as unknown as { is_admin?: boolean } | null;
  navigate({ to: profile?.is_admin ? "/admin" : "/panel", replace: true });
}
