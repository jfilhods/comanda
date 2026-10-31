/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { OrderCard, ORDER_SELECT, type OrderRow } from "@/components/OrderCard";
import { useRealtime, useRestaurantRole } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/r/$rid/cozinha")({
  head: () => ({ meta: [{ title: "Cozinha — Comanda" }] }),
  component: Kitchen,
});

// Nomes das categorias que a cozinha NÃO deve ver (bebidas e drinques)
const DRINK_CATEGORIES = [
  "Cervejas",
  "Cerveja 600ml",
  "Bebidas",
  "Não Alcoólicos",
  "Long Neck",
  "Doses",
  "Sucos",
  "Sucos Naturais",
  "Drinks",
];

// Função que usa a API de síntese de voz do navegador
function speak() {
  try {
    if (!("speechSynthesis" in window)) {
      console.warn("Este navegador não suporta síntese de voz.");
      return;
    }

    // Cancela qualquer fala anterior que ainda esteja tocando
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance("Atenção, um novo pedido!");
    utterance.lang = "pt-BR";
    utterance.volume = 1; // Volume máximo (0 a 1)
    utterance.rate = 1.1; // Velocidade um pouco mais rápida para chamar atenção
    utterance.pitch = 0.9; // Tom um pouco mais grave

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error("Erro ao tentar falar:", err);
  }
}

const COLS = [
  { key: "novo", title: "Novos", statuses: ["novo", "cancelamento_solicitado"] },
  { key: "prep", title: "Em preparo", statuses: ["aceito", "em_preparo"] },
  { key: "pronto", title: "Prontos", statuses: ["pronto"] },
] as const;

function Kitchen() {
  const { rid } = Route.useParams();
  const role = useRestaurantRole(rid)!;
  const [sound, setSound] = useState(true);
  useRealtime(rid, ["orders"], [["orders", rid]]);

  const { data: ordersRaw = [] } = useQuery({
    queryKey: ["orders", rid, "kitchen"],
    queryFn: async () =>
      ((
        await supabase
          .from("orders")
          .select(
            `
            *,
            items:order_items(
              *,
              product:products(
                description,
                categories(name)
            )
          `,
          ) // Incluímos a categoria do produto
          .eq("restaurant_id", rid)
          .in("status", ["novo", "aceito", "em_preparo", "pronto", "cancelamento_solicitado"])
          .order("created_at")
      ).data ?? []) as any[],
  });

  // Filtra os itens de cada pedido, removendo as bebidas
  const orders = ordersRaw
    .map((order) => {
      const itemsFiltrados = order.items.filter((item: any) => {
        const catName = item.product?.categories?.name;
        // Se a categoria estiver na lista de exclusão, não mostra
        if (catName && DRINK_CATEGORIES.includes(catName)) return false;
        return true;
      });

      return { ...order, items: itemsFiltrados };
    })
    // Remove pedidos que ficaram sem itens (ex: pedido só de bebida)
    .filter((order) => order.items.length > 0);

  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = new Set(orders.filter((o) => o.status === "novo").map((o) => o.id));
    if (seen.current) {
      const n = [...ids].filter((id) => !seen.current!.has(id));
      if (n.length) {
        // Se o som estiver ativado, dispara a voz
        if (sound) speak();
        setFresh(new Set(n));
      }
    }
    seen.current = new Set([...(seen.current ?? []), ...ids]);
  }, [orders, sound]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">Cozinha</h1>
        <Button
          variant="outline"
          onClick={() => {
            const next = !sound;
            setSound(next);
            // Feedback sonoro (opcional) ao ligar o som
            if (next) speak();
          }}
        >
          {sound ? <Bell /> : <BellOff />} Som {sound ? "ligado" : "desligado"}
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {COLS.map((c) => {
          const list = orders.filter((o) => (c.statuses as readonly string[]).includes(o.status));
          return (
            <section key={c.key} className="rounded-2xl bg-muted/60 p-3">
              <h2 className="mb-3 flex items-center justify-between px-1 text-lg font-bold">
                {c.title} <span className="rounded-full bg-card px-2.5 text-sm">{list.length}</span>
              </h2>
              <div className="space-y-3">
                {list.map((o) => (
                  <OrderCard key={o.id} o={o} role={role} big highlight={fresh.has(o.id)} />
                ))}
                {!list.length && (
                  <p className="px-1 py-6 text-center text-sm text-muted-foreground">Vazio</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
