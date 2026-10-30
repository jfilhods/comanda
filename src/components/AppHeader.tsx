import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, X, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/session";

export function AppHeader({ children }: { children?: ReactNode }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const router = useRouterState();
  const pathname = router.location.pathname;

  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-30 bg-ink text-ink-foreground shadow-md">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        {/* Cabeçalho */}
        <div className="flex h-14 items-center justify-between sm:h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link
              to="/app"
              onClick={closeMenu}
              className="whitespace-nowrap font-display text-xl font-extrabold sm:text-2xl"
            >
              comanda<span className="text-accent">.</span>
            </Link>

            {/* Admin desktop */}
            {me?.isAdmin && (
              <Link
                to="/admin"
                className={`hidden sm:flex items-center gap-1 border-l border-sidebar-border pl-3 text-xs hover:text-accent ${
                  pathname.startsWith("/admin") ? "text-accent" : "text-sidebar-foreground/80"
                }`}
              >
                <ShieldCheck className="size-4" />
                Admin global
              </Link>
            )}
          </div>

          {/* Navegação desktop */}
          <nav className="hidden sm:flex items-center gap-1">{children}</nav>

          {/* Usuário desktop */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="max-w-40 truncate text-sm text-sidebar-foreground/70">{me?.name}</span>

            <Button
              size="icon"
              variant="ghost"
              onClick={signOut}
              aria-label="Sair"
              className="size-9 hover:bg-sidebar-accent hover:text-ink-foreground"
            >
              <LogOut className="size-5" />
            </Button>
          </div>

          {/* Botão hambúrguer mobile */}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            className="size-10 sm:hidden hover:bg-sidebar-accent hover:text-ink-foreground"
          >
            {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </Button>
        </div>

        {/* Menu mobile */}
        {menuOpen && (
          <div id="mobile-menu" className="border-t border-sidebar-border py-3 sm:hidden">
            {/* Usuário */}
            {me?.name && (
              <div className="mb-3 border-b border-sidebar-border px-3 pb-3">
                <p className="text-xs text-sidebar-foreground/60">Conectado como</p>
                <p className="truncate text-sm font-semibold">{me.name}</p>
              </div>
            )}

            {/* Admin */}
            {me?.isAdmin && (
              <Link
                to="/admin"
                onClick={closeMenu}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                  pathname.startsWith("/admin")
                    ? "bg-sidebar-accent text-accent"
                    : "hover:bg-sidebar-accent"
                }`}
              >
                <ShieldCheck className="size-5" />
                Admin global
              </Link>
            )}

            {/* Links de navegação */}
            <nav className="flex flex-col gap-1" onClickCapture={closeMenu}>
              {children}
            </nav>

            {/* Sair */}
            <div className="mt-3 border-t border-sidebar-border pt-3">
              <button
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-sidebar-accent"
              >
                <LogOut className="size-5" />
                Sair da conta
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
