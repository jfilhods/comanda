import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  restaurantId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  role: z.enum(["gerente", "garcom", "cozinha"]),
});

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("has_restaurant_role", {
      _uid: context.userId,
      _rid: data.restaurantId,
      _roles: ["gerente"],
    });
    if (!allowed) throw new Error("Sem permissão para cadastrar funcionários");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    // Reuse existing account if this email already exists
    let userId: string | null = null;
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (existing) {
      userId = existing.id;
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });
      if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");
      userId = created.user.id;
    }

    const { error: mErr } = await supabaseAdmin.from("restaurant_members").upsert(
      {
        restaurant_id: data.restaurantId,
        user_id: userId,
        role: data.role,
        active: true,
        created_by: context.userId,
      },
      { onConflict: "restaurant_id,user_id" },
    );
    if (mErr) throw new Error(mErr.message);
    return { ok: true, reused: !!existing };
  });
