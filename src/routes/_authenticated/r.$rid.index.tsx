import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useRestaurantRole } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/r/$rid/")({
  component: RoleHome,
});

function RoleHome() {
  const { rid } = Route.useParams();
  const role = useRestaurantRole(rid);
  if (!role) return null;
  if (role === "cozinha") return <Navigate to="/r/$rid/cozinha" params={{ rid }} replace />;
  if (role === "garcom") return <Navigate to="/r/$rid/mesas" params={{ rid }} replace />;
  return <Navigate to="/r/$rid/painel" params={{ rid }} replace />;
}
