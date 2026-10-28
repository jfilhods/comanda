import { useEffect } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StaffRole } from "./status";

export type Membership = {
  restaurant_id: string;
  role: StaffRole;
  restaurant: { id: string; name: string; company: { trade_name: string | null; legal_name: string } | null } | null;
};

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const [{ data: roles }, { data: members }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      supabase
        .from("restaurant_members")
        .select("restaurant_id, role, restaurant:restaurants(id, name, company:companies(trade_name, legal_name))")
        .eq("user_id", u.user.id)
        .eq("active", true),
      supabase.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle(),
    ]);
    return {
      id: u.user.id,
      email: u.user.email ?? "",
      name: profile?.full_name ?? u.user.email ?? "",
      isAdmin: !!roles?.some((r) => r.role === "global_admin"),
      memberships: (members ?? []) as unknown as Membership[],
    };
  },
});

export function useMe() {
  return useQuery(meQuery);
}

/** Role of the current user in a restaurant ("admin" for global admins). */
export function useRestaurantRole(rid: string): StaffRole | "admin" | null {
  const { data } = useMe();
  if (!data) return null;
  const m = data.memberships.find((m) => m.restaurant_id === rid);
  if (m) return m.role;
  return data.isAdmin ? "admin" : null;
}

/** Subscribe to realtime changes in a restaurant and invalidate given query keys. */
export function useRealtime(rid: string, tables: string[], keys: unknown[][]) {
  const qc = useQueryClient();
  useEffect(() => {
    let ch = supabase.channel(`rt-${rid}-${Math.random().toString(36).slice(2)}`);
    for (const t of tables) {
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: t, filter: `restaurant_id=eq.${rid}` },
        () => keys.forEach((k) => qc.invalidateQueries({ queryKey: k })),
      );
    }
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid]);
}
