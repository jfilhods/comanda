import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { useRestaurantRole } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/r/$rid")({
  component: RestaurantLayout,
});

const tabCls =
  "rounded-lg px-3 py-1.5 text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-ink-foreground";
const activeCls = { className: "bg-sidebar-accent text-accent" };

function RestaurantLayout() {
  const { rid } = Route.useParams();
  const role = useRestaurantRole(rid);
  const { data: r } = useQuery({
    queryKey: ["restaurant", rid],
    queryFn: async () => (await supabase.from("restaurants").select("id, name").eq("id", rid).maybeSingle()).data,
  });
  const mgr = role === "gerente" || role === "admin";
  return (
    <div className="min-h-screen">
      <AppHeader>
        <span className="mr-3 font-semibold text-accent">{r?.name}</span>
        {mgr && <Link to="/r/$rid/painel" params={{ rid }} className={tabCls} activeProps={activeCls}>Painel</Link>}
        {(mgr || role === "garcom") && <Link to="/r/$rid/mesas" params={{ rid }} className={tabCls} activeProps={activeCls}>Mesas</Link>}
        {(mgr || role === "cozinha") && <Link to="/r/$rid/cozinha" params={{ rid }} className={tabCls} activeProps={activeCls}>Cozinha</Link>}
        {mgr && <Link to="/r/$rid/cardapio" params={{ rid }} className={tabCls} activeProps={activeCls}>Cardápio</Link>}
        {mgr && <Link to="/r/$rid/equipe" params={{ rid }} className={tabCls} activeProps={activeCls}>Equipe</Link>}
      </AppHeader>
      {role === null ? (
        <p className="p-10 text-muted-foreground">Carregando…</p>
      ) : (
        <main className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </main>
      )}
    </div>
  );
}
