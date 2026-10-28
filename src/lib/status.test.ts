import { describe, expect, it } from "vitest";
import { nextStep } from "./status";

describe("order flow", () => {
  it("kitchen moves novo → aceito → em_preparo → pronto", () => {
    expect(nextStep("novo", "cozinha")).toBe("aceito");
    expect(nextStep("aceito", "cozinha")).toBe("em_preparo");
    expect(nextStep("em_preparo", "cozinha")).toBe("pronto");
  });
  it("only waiter/manager delivers a ready order", () => {
    expect(nextStep("pronto", "garcom")).toBe("entregue");
    expect(nextStep("pronto", "cozinha")).toBeNull();
  });
  it("waiter cannot accept orders in the kitchen", () => {
    expect(nextStep("novo", "garcom")).toBeNull();
  });
  it("delivered orders never go back", () => {
    expect(nextStep("entregue", "gerente")).toBeNull();
  });
});
