/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { OrderCard, ORDER_SELECT, type OrderRow } from "@/components/OrderCard";
import { useRealtime, useRestaurantRole } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/r/$rid/cozinha")({
  head: () => ({ meta: [{ title: "Cozinha — Comanda" }] }),
  component: Kitchen,
});

// -- LÓGICA DE ÁUDIO --

let audioCtx: AudioContext | null = null;
let isUnlocked = false;
let audioElement: HTMLAudioElement | null = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// Desbloqueia o áudio no navegador (precisa ser chamado num clique do usuário)
function unlockAudio() {
  if (isUnlocked) return;
  try {
    const ctx = getAudioCtx();
    // Toca um som mudo para "desbloquear" o contexto de áudio
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0; // Mudo
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);

    // Prepara o áudio MP3 em segundo plano
    if (!audioElement) {
      audioElement = new Audio("/audio/novo-pedido.mp3");
      audioElement.volume = 1.0;
      // Força o carregamento do arquivo
      audioElement.load();
    }

    isUnlocked = true;
    console.log("🔊 Áudio desbloqueado com sucesso!");
  } catch (err) {
    console.error("Erro ao desbloquear áudio:", err);
  }
}

// Campainha (Ding-Dong gerada por código)
function playDoorbell() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    const notes = [
      { freq: 659.25, start: now, duration: 0.6 },
      { freq: 523.25, start: now + 0.3, duration: 0.8 },
    ];

    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = note.freq;
      gain.gain.setValueAtTime(0, note.start);
      gain.gain.linearRampToValueAtTime(1.0, note.start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, note.start + note.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(note.start);
      osc.stop(note.start + note.duration);
    });
  } catch (err) {
    console.error("Erro na campainha:", err);
  }
}

// Toca o MP3
function playAudioFile(onEnd?: () => void) {
  if (!audioElement) {
    audioElement = new Audio("/audio/novo-pedido.mp3");
    audioElement.volume = 1.0;
  }

  // Reseta o áudio para o começo (caso já tenha tocado antes)
  audioElement.currentTime = 0;

  audioElement.onended = () => {
    if (onEnd) onEnd();
  };

  audioElement.play().catch((err) => {
    console.error(
      "🚨 BLOQUEIO DE ÁUDIO! O navegador bloqueou o MP3. Clique na tela primeiro.",
      err,
    );
  });
}

function triggerFullAlert() {
  unlockAudio(); // Garante que está desbloqueado
  playDoorbell();

  setTimeout(() => {
    playAudioFile(() => {
      setTimeout(() => {
        playAudioFile();
      }, 500);
    });
  }, 1200);
}

// -- COMPONENTE --

const COLS = [
  { key: "novo", title: "Novos", statuses: ["novo", "cancelamento_solicitado"] },
  { key: "prep", title: "Em preparo", statuses: ["aceito", "em_preparo"] },
  { key: "pronto", title: "Prontos", statuses: ["pronto"] },
] as const;

function isBebida(catName: string | undefined | null, productName: string) {
  const nomeBase = `${catName || ""} ${productName}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    nomeBase.includes("bebida") ||
    nomeBase.includes("suco") ||
    nomeBase.includes("cerveja") ||
    nomeBase.includes("drink") ||
    nomeBase.includes("dose") ||
    nomeBase.includes("long neck") ||
    nomeBase.includes("refrigerante") ||
    nomeBase.includes("agua") ||
    nomeBase.includes("nao alcoolic")
  );
}

function Kitchen() {
  const { rid } = Route.useParams();
  const role = useRestaurantRole(rid)!;
  const [sound, setSound] = useState(true);

  useRealtime(rid, ["orders"], [["orders", rid]]);

  // Desbloqueia o áudio no primeiro clique em qualquer lugar da tela da cozinha
  useEffect(() => {
    const handleGlobalClick = () => unlockAudio();
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  // Atalho de teclado para testar o som (tecla "T")
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (
          document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA"
        )
          return;
        triggerFullAlert();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { data: ordersRaw = [] } = useQuery({
    queryKey: ["orders", rid, "kitchen"],
    queryFn: async () =>
      ((
        await supabase
          .from("orders")
          .select(`*, items:order_items(*, product:products(description, categories(name)))`)
          .eq("restaurant_id", rid)
          .in("status", ["novo", "aceito", "em_preparo", "pronto", "cancelamento_solicitado"])
          .order("created_at")
      ).data ?? []) as any[],
  });

  const orders = ordersRaw
    .map((order) => {
      const itemsFiltrados = order.items.filter((item: any) => {
        const catName = item.product?.categories?.name;
        const prodName = item.product_name || item.product?.name || "";
        return !isBebida(catName, prodName);
      });
      return { ...order, items: itemsFiltrados };
    })
    .filter((order) => order.items.length > 0);

  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = new Set(orders.filter((o) => o.status === "novo").map((o) => o.id));
    if (seen.current) {
      const n = [...ids].filter((id) => !seen.current!.has(id));
      if (n.length) {
        if (sound) triggerFullAlert();
        setFresh(new Set(n));
      }
    }
    seen.current = new Set([...(seen.current ?? []), ...ids]);
  }, [orders, sound]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">Cozinha</h1>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => triggerFullAlert()}
            title="Testar som (Atalho: tecla T)"
          >
            <Volume2 className="mr-2 size-4" /> Testar Som
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              const next = !sound;
              setSound(next);
              if (next) triggerFullAlert();
            }}
          >
            {sound ? <Bell /> : <BellOff />} Som {sound ? "ligado" : "desligado"}
          </Button>
        </div>
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
