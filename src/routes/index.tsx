import { createFileRoute, Link } from "@tanstack/react-router";
import { ChefHat, ClipboardList, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Comanda — Pedidos do salão à cozinha em tempo real" },
      {
        name: "description",
        content:
          "Sistema multiempresa para garçons, cozinha e gerência: mesas, cardápio, pedidos e fechamento de contas.",
      },
      { property: "og:title", content: "Comanda — Pedidos do salão à cozinha" },
      {
        property: "og:description",
        content: "Garçom lança, a cozinha vê na hora, o gerente fecha a conta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-ink text-ink-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-2xl font-extrabold tracking-tight">
          comanda<span className="text-accent">.</span>
        </span>
        <Button asChild variant="secondary">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16">
        <p className="mb-6 inline-block rounded-full border border-sidebar-border px-3 py-1 text-sm text-sidebar-foreground/80">
          Garçom · Cozinha · Gerência
        </p>
        <h1 className="max-w-4xl font-display text-5xl font-extrabold leading-[1.02] md:text-7xl">
          O pedido sai da mesa e <span className="text-accent">chega na cozinha</span> no mesmo
          segundo.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-sidebar-foreground/75">
          Cada empresa com seus restaurantes, equipe, cardápio e mesas — tudo separado e seguro.
        </p>
        <Button asChild size="lg" className="mt-10">
          <Link to="/auth">
            Acessar o sistema <ArrowRight />
          </Link>
        </Button>
        <div className="mt-24 grid gap-4 md:grid-cols-3">
          {[
            {
              i: ClipboardList,
              t: "Garçom",
              d: "Abre a conta da mesa, lança itens com observações e acompanha o status.",
            },
            {
              i: ChefHat,
              t: "Cozinha",
              d: "Fila ao vivo com aviso sonoro: aceitar, preparar, marcar pronto.",
            },
            {
              i: Building2,
              t: "Gerência",
              d: "Indicadores do dia, cardápio, mesas, equipe e fechamento de contas.",
            },
          ].map(({ i: Icon, t, d }) => (
            <div
              key={t}
              className="rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-6"
            >
              <Icon className="mb-4 size-7 text-accent" />
              <h3 className="text-xl font-bold">{t}</h3>
              <p className="mt-2 text-sidebar-foreground/70">{d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
