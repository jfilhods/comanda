import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Comanda" },
      { name: "description", content: "Acesse o painel de pedidos do seu restaurante." },
      { property: "og:title", content: "Entrar — Comanda" },
      { property: "og:description", content: "Acesse o painel de pedidos do seu restaurante." },
    ],
  }),
  component: AuthPage,
});

type Mode = "select" | "admin" | "staff";

function AuthPage() {
  const nav = useNavigate();

  const [mode, setMode] = useState<Mode>("select");

  // ---- caixa admin: empresa/gerente/admin ----
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ---- caixa staff: operacional ----
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");

  const [busy, setBusy] = useState<"admin" | "staff" | null>(null);

  async function submitAdmin(e: React.FormEvent) {
    e.preventDefault();
    setBusy("admin");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      nav({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao entrar");
    } finally {
      setBusy(null);
    }
  }

  async function submitStaff(e: React.FormEvent) {
    e.preventDefault();
    setBusy("staff");
    try {
      const { data: resolved, error: rErr } = await (
        supabase.rpc as (
          fn: string,
          args: { _username: string },
        ) => PromiseLike<{ data: string | null; error: unknown }>
      )("resolve_staff_email", {
        _username: username.trim().toLowerCase(),
      });
      if (rErr) throw rErr;
      if (!resolved) throw new Error("Usuário não encontrado");

      const { error } = await supabase.auth.signInWithPassword({
        email: resolved as string,
        password: pin,
      });
      if (error) throw error;
      nav({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao entrar");
    } finally {
      setBusy(null);
    }
  }

  function goBack() {
    setMode("select");
    setBusy(null);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        {/* Logo sempre visível */}
        <div className="text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">
            comanda<span className="text-primary">.</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesse o painel de pedidos</p>
        </div>

        {/* ---------- SELEÇÃO ---------- */}
        {mode === "select" && (
          <div className="card-surface space-y-3 p-6">
            <p className="text-center text-sm font-medium text-muted-foreground">
              Quem está entrando?
            </p>

            <Button
              type="button"
              className="h-14 w-full text-base font-semibold"
              onClick={() => setMode("admin")}
            >
              Administradores
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-14 w-full text-base font-semibold"
              onClick={() => setMode("staff")}
            >
              Funcionários
            </Button>

            <p className="pt-2 text-center text-xs text-muted-foreground">
              Gerente, empresa e admin · Garçom, cozinha e entregador
            </p>
          </div>
        )}

        {/* ---------- LOGIN ADMIN ---------- */}
        {mode === "admin" && (
          <form onSubmit={submitAdmin} className="card-surface space-y-4 p-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">Administradores</h2>
                <p className="text-sm text-muted-foreground">Empresa / Gerente / Administrador</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground"
                onClick={goBack}
                disabled={busy !== null}
              >
                Voltar
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-email">E-mail</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-password">Senha</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={busy !== null}>
              {busy === "admin" ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        )}

        {/* ---------- LOGIN STAFF ---------- */}
        {mode === "staff" && (
          <form onSubmit={submitStaff} className="card-surface space-y-4 p-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">Funcionários</h2>
                <p className="text-sm text-muted-foreground">Garçom / Cozinha / Entregador</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground"
                onClick={goBack}
                disabled={busy !== null}
              >
                Voltar
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-user">Usuário</Label>
              <Input
                id="staff-user"
                autoCapitalize="none"
                autoCorrect="off"
                autoFocus
                placeholder="ex.: joao.silva"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-pin">Senha (8 dígitos)</Label>
              <Input
                id="staff-pin"
                type="password"
                inputMode="numeric"
                maxLength={8}
                pattern="\d{8}"
                placeholder="00000000"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={busy !== null}>
              {busy === "staff" ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        )}

        {/* Rodapé só na seleção */}
        {mode === "select" && (
          <p className="text-center text-xs text-muted-foreground">
            Primeiro acesso de empresa?{" "}
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => nav({ to: "/auth" })} // troque pela rota de cadastro se existir
            >
              Falar com o administrador
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
