export type OrderStatus =
  | "novo"
  | "aceito"
  | "em_preparo"
  | "pronto"
  | "entregue"
  | "cancelamento_solicitado"
  | "cancelado";

export type StaffRole = "gerente" | "garcom" | "cozinha" | "entregador";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  novo: "Novo",
  aceito: "Aceito",
  em_preparo: "Em preparo",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelamento_solicitado: "Cancelamento solicitado",
  cancelado: "Cancelado",
};

export const STATUS_CLASS: Record<OrderStatus, string> = {
  novo: "bg-st-novo text-primary-foreground",
  aceito: "bg-st-aceito text-primary-foreground",
  em_preparo: "bg-st-preparo text-accent-foreground",
  pronto: "bg-st-pronto text-primary-foreground",
  entregue: "bg-st-entregue text-primary-foreground",
  cancelamento_solicitado: "bg-st-cancel/15 text-st-cancel",
  cancelado: "bg-st-cancel text-primary-foreground",
};

export const ROLE_LABEL: Record<StaffRole, string> = {
  gerente: "Gerente",
  garcom: "Garçom",
  cozinha: "Cozinha",
  entregador: "Entregador",
};

export const TABLE_STATUS_LABEL: Record<string, string> = {
  livre: "Livre",
  ocupada: "Ocupada",
  aguardando_pagamento: "Aguardando pagamento",
  em_encerramento: "Em encerramento",
};

export function nextStep(status: OrderStatus, role: StaffRole | "admin"): OrderStatus | null {
  const isMgr = role === "gerente" || role === "admin";

  switch (status) {
    case "novo":
      // cozinha/gerente aceitam
      return role === "cozinha" || isMgr ? "aceito" : null;

    case "aceito":
      // cozinha/gerente iniciam preparo
      return role === "cozinha" || isMgr ? "em_preparo" : null;

    case "em_preparo":
      // *** AQUI ESTAVA O BUG ***: cozinha precisa poder marcar como pronto
      return role === "cozinha" || isMgr ? "pronto" : null;

    case "pronto":
      // garçom/gerente entregam
      return role === "garcom" || isMgr ? "entregue" : null;

    default:
      return null;
  }
}

/**
 * Rótulos do botão que chama `nextStep`.
 * A chave é o STATUS DE DESTINO.
 */
export const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  aceito: "Aceitar",
  em_preparo: "Iniciar preparo",
  pronto: "Pronto",
  entregue: "Entregar",
};

export const brl = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
