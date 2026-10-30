import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/session";

export function AppHeader({ children }: { children?: ReactNode }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const router = useRouterState();
  const pathname = router.location.pathname;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 bg-ink text-ink-foreground shadow-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
        {/* ESQUERDA: Logo */}
        <div className="flex items-center gap-3">
          <Link
            to="/app"
            className="font-display text-lg sm:text-xl font-extrabold whitespace-nowrap"
          >
            comanda<span className="text-accent">.</span>
          </Link>
          {me?.isAdmin && (
            <Link
              to="/admin"
              className="hidden sm:inline text-xs text-sidebar-foreground/80 hover:text-accent border-l border-sidebar-border pl-3"
            >
              Admin global
            </Link>
          )}
        </div>

        {/* CENTRO: Abas (Navegação principal) */}
        <div className="order-3 w-full sm:order-2 sm:w-auto flex overflow-x-auto gap-1 pb-1 sm:pb-0 scrollbar-hide">
          {children}
        </div>

        {/* DIREITA: Usuário e Sair */}
        <div className="order-2 sm:order-3 flex items-center gap-1 sm:gap-2">
          <span className="hidden text-sm text-sidebar-foreground/70 sm:inline">{me?.name}</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={signOut}
            aria-label="Sair"
            className="hover:bg-sidebar-accent hover:text-ink-foreground size-9"
          >
            <LogOut className="size-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
