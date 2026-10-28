import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { useMe } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Seus restaurantes — Comanda" }] }),
  component: Picker,
});

function Picker() {
  const { data: me, isLoading } = useMe();
  const { data: all } = useQuery({
    queryKey: ["all-restaurants"],
    enabled: !!me?.isAdmin,
    queryFn: async () =>
      (
        await supabase
          .from("restaurants")
          .select("id, name, company:companies(trade_name, legal_name)")
          .order("name")
      ).data ?? [],
  });

  const items = me?.isAdmin
    ? (all ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        company: r.company?.trade_name || r.company?.legal_name,
        role: "Admin",
      }))
    : (me?.memberships ?? []).map((m) => ({
        id: m.restaurant_id,
        name: m.restaurant?.name ?? "",
        company: m.restaurant?.company?.trade_name || m.restaurant?.company?.legal_name,
        role: ROLE_LABEL[m.role],
      }));

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-extrabold">Escolha o restaurante</h1>
        {!isLoading && items.length === 0 && (
          <div className="card-surface mt-8 p-8 text-muted-foreground">
            {me?.isAdmin
              ? "Nenhum restaurante cadastrado ainda. Cadastre empresas e restaurantes no Admin global."
              : "Sua conta ainda não está vinculada a nenhum restaurante. Peça ao gerente para cadastrar você."}
          </div>
        )}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {items.map((r) => (
            <Link
              key={r.id}
              to="/r/$rid"
              params={{ rid: r.id }}
              className="card-surface flex items-center gap-4 p-5 transition hover:-translate-y-0.5"
            >
              <div className="grid size-12 place-items-center rounded-xl bg-secondary text-primary">
                <Store />
              </div>
              <div className="flex-1">
                <div className="font-display text-lg font-bold">{r.name}</div>
                <div className="text-sm text-muted-foreground">{r.company}</div>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{r.role}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
