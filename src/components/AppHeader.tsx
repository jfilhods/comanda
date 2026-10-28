import { Link, useNavigate } from "@tanstack/react-router";
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
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }
  return (
    <header className="sticky top-0 z-30 bg-ink text-ink-foreground">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
        <Link to="/app" className="font-display text-xl font-extrabold">
          comanda<span className="text-accent">.</span>
        </Link>
        <div className="flex flex-1 flex-wrap items-center gap-1">{children}</div>
        {me?.isAdmin && (
          <Link to="/admin" className="text-sm text-sidebar-foreground/80 hover:text-accent">
            Admin global
          </Link>
        )}
        <span className="hidden text-sm text-sidebar-foreground/70 sm:inline">{me?.name}</span>
        <Button size="icon" variant="ghost" onClick={signOut} aria-label="Sair" className="hover:bg-sidebar-accent hover:text-ink-foreground">
          <LogOut />
        </Button>
      </div>
    </header>
  );
}
