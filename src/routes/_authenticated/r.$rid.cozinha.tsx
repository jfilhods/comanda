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

let audioCtx: AudioContext | null = null;

function getCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

const COLS = [
  { key: "novo", title: "Novos", statuses: ["novo", "cancelamento_solicitado"] },
  { key: "prep", title: "Em preparo", statuses: ["aceito", "em_preparo"] },
  { key: "pronto", title: "Prontos", statuses: ["pronto"] },
] as const;

function beep() {
  try {
    const ctx = getCtx();
    [0, 0.18].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.16);
    });
  } catch {
    /* ignore */
  }
}

function Kitchen() {
  const { rid } = Route.useParams();
  const role = useRestaurantRole(rid)!;
  const [sound, setSound] = useState(true);
  useRealtime(rid, ["orders"], [["orders", rid]]);
  const { data: orders = [] } = useQuery({
    queryKey: ["orders", rid, "kitchen"],
    queryFn: async () =>
      ((
        await supabase
          .from("orders")
          .select(ORDER_SELECT)
          .eq("restaurant_id", rid)
          .in("status", ["novo", "aceito", "em_preparo", "pronto", "cancelamento_solicitado"])
          .order("created_at")
      ).data ?? []) as unknown as OrderRow[],
  });

  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    const ids = new Set(orders.filter((o) => o.status === "novo").map((o) => o.id));
    if (seen.current) {
      const n = [...ids].filter((id) => !seen.current!.has(id));
      if (n.length) {
        if (sound) beep();
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
            if (next) beep(); // clique = desbloqueio + feedback sonoro
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
