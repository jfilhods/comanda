import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  restaurantId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(["gerente", "garcom", "cozinha", "entregador"]),
  password: z.string().regex(/^\d{8}$/, "A senha deve ter exatamente 8 dígitos numéricos"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  username: z
    .string()
    .regex(/^[a-z0-9._-]{3,20}$/, "Usuário deve ter de 3 a 20 caracteres.")
    .optional()
    .or(z.literal("")),
});

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => {
    // Log para vermos exatamente o que chega
    console.log(">>> DADOS RECEBIDOS NO SERVIDOR:", d);

    const parsed = schema.parse(d);

    if (parsed.role === "gerente" && !parsed.email) {
      throw new Error("Gerentes precisam de e-mail.");
    }
    // CORREÇÃO: usa trim para não considerar "   " como username válido
    if (parsed.role !== "gerente" && !parsed.username?.trim()) {
      throw new Error("Outros cargos precisam de username.");
    }
    return parsed;
  })
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("has_restaurant_role", {
      _uid: context.userId,
      _rid: data.restaurantId,
      _roles: ["gerente"],
    });
    if (!allowed) throw new Error("Sem permissão para cadastrar funcionários");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const emailToUse = (data.email ?? "").trim().toLowerCase();

    // CORREÇÃO: calcula o username uma única vez, com trim, e só para não-gerente
    const isManager = data.role === "gerente";
    const usernameToSave = isManager ? null : (data.username ?? "").trim().toLowerCase();

    if (isManager && !emailToUse) {
      throw new Error("Gerentes precisam de e-mail.");
    }
    if (!isManager && !usernameToSave) {
      throw new Error("Outros cargos precisam de username.");
    }
    if (!emailToUse) {
      throw new Error("E-mail é obrigatório para cadastrar um funcionário.");
    }

    // CORREÇÃO: verifica se o username já está em uso por OUTRO usuário
    // (antes, ao recadastrar o mesmo funcionário, ele mesmo era encontrado e
    // disparava "Este nome de usuário já está em uso.")
    if (usernameToSave) {
      const { data: existingUser, error } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .ilike("staff_username", usernameToSave)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (existingUser && existingUser.email?.toLowerCase() !== emailToUse) {
        throw new Error("Este nome de usuário já está em uso.");
      }
    }

    let userId: string | null = null;
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", emailToUse!)
      .maybeSingle();

    if (existing) {
      userId = existing.id;

      // CORREÇÃO: quando o usuário já existe, atualiza a senha para o PIN
      // informado pelo gerente. Antes, o PIN novo era ignorado e o funcionário
      // ficava preso à senha antiga.
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
      });
      if (updErr) throw new Error(`Erro ao atualizar senha: ${updErr.message}`);
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: emailToUse!,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });
      if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");
      userId = created.user.id;
    }

    // CORREÇÃO: só inclui staff_username no payload quando houver valor.
    // Antes, o upsert gravava `staff_username: null` e apagava o username
    // de funcionários já existentes, quebrando o login por usuário.
    const profilePayload: Record<string, unknown> = {
      id: userId,
      full_name: data.fullName,
      email: emailToUse!,
    };
    if (usernameToSave) {
      profilePayload.staff_username = usernameToSave;
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(profilePayload as any, { onConflict: "id" });

    if (profileError) {
      throw new Error(`Erro ao salvar perfil: ${profileError.message}`);
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

const deleteSchema = z.object({
  userId: z.string().uuid(),
  restaurantId: z.string().uuid(),
});

export const deleteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    // 1. Verifica se quem está pedindo é gerente do restaurante
    const { data: allowed } = await context.supabase.rpc("has_restaurant_role", {
      _uid: context.userId,
      _rid: data.restaurantId,
      _roles: ["gerente"],
    });
    if (!allowed) throw new Error("Sem permissão para excluir funcionários.");

    // 2. Impede que o gerente se exclua por acidente
    if (data.userId === context.userId) {
      throw new Error("Você não pode excluir a sua própria conta.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 3. Remove o usuário do Auth (o cascade vai deletar o profile e os members automaticamente)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);

    if (error) {
      throw new Error(`Erro ao excluir usuário: ${error.message}`);
    }

    return { ok: true };
  });
