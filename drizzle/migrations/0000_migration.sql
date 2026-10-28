
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('global_admin');
CREATE TYPE public.staff_role AS ENUM ('gerente','garcom','cozinha');
CREATE TYPE public.order_status AS ENUM ('novo','aceito','em_preparo','pronto','entregue','cancelamento_solicitado','cancelado');
CREATE TYPE public.table_status AS ENUM ('livre','ocupada','aguardando_pagamento','em_encerramento');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- TENANTS
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  trade_name text,
  cnpj text,
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','suspensa')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE,
  description text,
  phone text,
  address text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.restaurant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.staff_role NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_members TO authenticated;
GRANT ALL ON public.restaurant_members TO service_role;
ALTER TABLE public.restaurant_members ENABLE ROW LEVEL SECURITY;

-- HELPERS
CREATE OR REPLACE FUNCTION public.is_global_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'global_admin')
$$;

CREATE OR REPLACE FUNCTION public.has_restaurant_role(_uid uuid, _rid uuid, _roles public.staff_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_global_admin(_uid) OR EXISTS (
    SELECT 1 FROM public.restaurant_members
    WHERE user_id = _uid AND restaurant_id = _rid AND active AND role = ANY(_roles))
$$;

CREATE OR REPLACE FUNCTION public.is_restaurant_member(_uid uuid, _rid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_restaurant_role(_uid, _rid, ARRAY['gerente','garcom','cozinha']::public.staff_role[])
$$;

-- POLICIES (tenants)
CREATE POLICY "own profile or admin or coworker" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_global_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.restaurant_members m WHERE m.user_id = profiles.id AND public.is_restaurant_member(auth.uid(), m.restaurant_id)));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "admin all companies" ON public.companies FOR ALL TO authenticated
  USING (public.is_global_admin(auth.uid())) WITH CHECK (public.is_global_admin(auth.uid()));
CREATE POLICY "members read company" ON public.companies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.company_id = companies.id AND public.is_restaurant_member(auth.uid(), r.id)));

CREATE POLICY "admin all restaurants" ON public.restaurants FOR ALL TO authenticated
  USING (public.is_global_admin(auth.uid())) WITH CHECK (public.is_global_admin(auth.uid()));
CREATE POLICY "members read restaurant" ON public.restaurants FOR SELECT TO authenticated
  USING (public.is_restaurant_member(auth.uid(), id));

CREATE POLICY "read members" ON public.restaurant_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_restaurant_member(auth.uid(), restaurant_id));
CREATE POLICY "manager manages members" ON public.restaurant_members FOR ALL TO authenticated
  USING (public.has_restaurant_role(auth.uid(), restaurant_id, ARRAY['gerente']::public.staff_role[]))
  WITH CHECK (public.has_restaurant_role(auth.uid(), restaurant_id, ARRAY['gerente']::public.staff_role[]));

-- MENU
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  available boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  prep_minutes int,
  code text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dining_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  label text NOT NULL,
  capacity int,
  status public.table_status NOT NULL DEFAULT 'livre',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories, public.products, public.dining_tables TO authenticated;
GRANT ALL ON public.categories, public.products, public.dining_tables TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dining_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read" ON public.categories FOR SELECT TO authenticated USING (public.is_restaurant_member(auth.uid(), restaurant_id));
CREATE POLICY "manager writes" ON public.categories FOR ALL TO authenticated
  USING (public.has_restaurant_role(auth.uid(), restaurant_id, ARRAY['gerente']::public.staff_role[]))
  WITH CHECK (public.has_restaurant_role(auth.uid(), restaurant_id, ARRAY['gerente']::public.staff_role[]));
CREATE POLICY "members read" ON public.products FOR SELECT TO authenticated USING (public.is_restaurant_member(auth.uid(), restaurant_id));
CREATE POLICY "manager writes" ON public.products FOR ALL TO authenticated
  USING (public.has_restaurant_role(auth.uid(), restaurant_id, ARRAY['gerente']::public.staff_role[]))
  WITH CHECK (public.has_restaurant_role(auth.uid(), restaurant_id, ARRAY['gerente']::public.staff_role[]));
CREATE POLICY "members read" ON public.dining_tables FOR SELECT TO authenticated USING (public.is_restaurant_member(auth.uid(), restaurant_id));
CREATE POLICY "manager writes" ON public.dining_tables FOR ALL TO authenticated
  USING (public.has_restaurant_role(auth.uid(), restaurant_id, ARRAY['gerente']::public.staff_role[]))
  WITH CHECK (public.has_restaurant_role(auth.uid(), restaurant_id, ARRAY['gerente']::public.staff_role[]));

-- SESSIONS & ORDERS (writes only via RPC)
CREATE TABLE public.table_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.dining_tables(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','fechada')),
  opened_by uuid,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid,
  closed_at timestamptz,
  payment_method text,
  amount_paid numeric(10,2)
);
CREATE UNIQUE INDEX one_open_session_per_table ON public.table_sessions(table_id) WHERE status = 'aberta';

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigint GENERATED ALWAYS AS IDENTITY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.table_sessions(id),
  table_id uuid NOT NULL REFERENCES public.dining_tables(id),
  waiter_id uuid NOT NULL,
  status public.order_status NOT NULL DEFAULT 'novo',
  previous_status public.order_status,
  notes text,
  total numeric(10,2) NOT NULL DEFAULT 0,
  cancel_reason text,
  cancelled_by uuid,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  subtotal numeric(10,2) NOT NULL,
  notes text,
  status public.order_status NOT NULL DEFAULT 'novo'
);
CREATE TABLE public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL,
  from_status public.order_status,
  to_status public.order_status NOT NULL,
  actor_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.table_sessions, public.orders, public.order_items, public.order_events TO authenticated;
GRANT ALL ON public.table_sessions, public.orders, public.order_items, public.order_events TO service_role;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read" ON public.table_sessions FOR SELECT TO authenticated USING (public.is_restaurant_member(auth.uid(), restaurant_id));
CREATE POLICY "members read" ON public.orders FOR SELECT TO authenticated USING (public.is_restaurant_member(auth.uid(), restaurant_id));
CREATE POLICY "members read" ON public.order_items FOR SELECT TO authenticated USING (public.is_restaurant_member(auth.uid(), restaurant_id));
CREATE POLICY "members read" ON public.order_events FOR SELECT TO authenticated USING (public.is_restaurant_member(auth.uid(), restaurant_id));

-- SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  IF lower(NEW.email) = 'jorgejuniords@gmail.com' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'global_admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC: create order
CREATE OR REPLACE FUNCTION public.create_order(_table_id uuid, _items jsonb, _notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _rid uuid; _sid uuid; _oid uuid; _total numeric := 0;
  _it jsonb; _p record; _qty int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT restaurant_id INTO _rid FROM dining_tables WHERE id = _table_id;
  IF _rid IS NULL THEN RAISE EXCEPTION 'Mesa não encontrada'; END IF;
  IF NOT has_restaurant_role(_uid, _rid, ARRAY['garcom','gerente']::staff_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF EXISTS (SELECT 1 FROM restaurants r JOIN companies c ON c.id = r.company_id
             WHERE r.id = _rid AND (c.status <> 'ativa' OR r.status <> 'ativo')) THEN
    RAISE EXCEPTION 'Empresa ou restaurante suspenso'; END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Pedido vazio'; END IF;

  SELECT id INTO _sid FROM table_sessions WHERE table_id = _table_id AND status = 'aberta' FOR UPDATE;
  IF _sid IS NULL THEN
    INSERT INTO table_sessions(restaurant_id, table_id, opened_by) VALUES (_rid, _table_id, _uid) RETURNING id INTO _sid;
  END IF;
  UPDATE dining_tables SET status = 'ocupada' WHERE id = _table_id AND status = 'livre';

  INSERT INTO orders(restaurant_id, session_id, table_id, waiter_id, notes) VALUES (_rid, _sid, _table_id, _uid, NULLIF(_notes,''))
  RETURNING id INTO _oid;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_it->>'quantity')::int;
    IF _qty IS NULL OR _qty < 1 OR _qty > 99 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    SELECT * INTO _p FROM products WHERE id = (_it->>'product_id')::uuid AND restaurant_id = _rid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não pertence ao restaurante'; END IF;
    IF NOT (_p.available AND _p.active) THEN RAISE EXCEPTION 'Produto indisponível: %', _p.name; END IF;
    INSERT INTO order_items(order_id, restaurant_id, product_id, product_name, unit_price, quantity, subtotal, notes)
    VALUES (_oid, _rid, _p.id, _p.name, _p.price, _qty, _p.price * _qty, NULLIF(_it->>'notes',''));
    _total := _total + _p.price * _qty;
  END LOOP;
  UPDATE orders SET total = _total WHERE id = _oid;
  INSERT INTO order_events(order_id, restaurant_id, to_status, actor_id) VALUES (_oid, _rid, 'novo', _uid);
  RETURN _oid;
END $$;

-- RPC: status transitions
CREATE OR REPLACE FUNCTION public.set_order_status(_order_id uuid, _to public.order_status, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid(); _o record; _ok boolean := false;
  _mgr boolean; _kit boolean; _wai boolean;
BEGIN
  SELECT * INTO _o FROM orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  _mgr := has_restaurant_role(_uid, _o.restaurant_id, ARRAY['gerente']::staff_role[]);
  _kit := has_restaurant_role(_uid, _o.restaurant_id, ARRAY['cozinha']::staff_role[]);
  _wai := has_restaurant_role(_uid, _o.restaurant_id, ARRAY['garcom']::staff_role[]);

  _ok := CASE
    WHEN _o.status = 'novo' AND _to = 'aceito' THEN _kit OR _mgr
    WHEN _o.status = 'aceito' AND _to = 'em_preparo' THEN _kit OR _mgr
    WHEN _o.status = 'em_preparo' AND _to = 'pronto' THEN _kit OR _mgr
    WHEN _o.status = 'pronto' AND _to = 'entregue' THEN _wai OR _mgr
    WHEN _o.status = 'novo' AND _to = 'cancelado' THEN _mgr OR (_wai AND _o.waiter_id = _uid)
    WHEN _o.status IN ('aceito','em_preparo','pronto') AND _to = 'cancelamento_solicitado' THEN _wai OR _mgr OR _kit
    WHEN _o.status = 'cancelamento_solicitado' AND _to = 'cancelado' THEN _mgr
    WHEN _o.status = 'cancelamento_solicitado' AND _to = _o.previous_status THEN _mgr
    ELSE false END;
  IF NOT _ok THEN RAISE EXCEPTION 'Transição não permitida: % → %', _o.status, _to; END IF;
  IF _to IN ('cancelado','cancelamento_solicitado') AND COALESCE(trim(_reason),'') = '' THEN
    RAISE EXCEPTION 'Informe o motivo'; END IF;

  UPDATE orders SET
    previous_status = CASE WHEN _to = 'cancelamento_solicitado' THEN _o.status ELSE previous_status END,
    status = _to, updated_at = now(),
    cancel_reason = CASE WHEN _to IN ('cancelado','cancelamento_solicitado') THEN _reason ELSE cancel_reason END,
    cancelled_by = CASE WHEN _to = 'cancelado' THEN _uid ELSE cancelled_by END,
    cancelled_at = CASE WHEN _to = 'cancelado' THEN now() ELSE cancelled_at END
  WHERE id = _order_id;
  UPDATE order_items SET status = _to WHERE order_id = _order_id;
  INSERT INTO order_events(order_id, restaurant_id, from_status, to_status, actor_id, reason)
  VALUES (_order_id, _o.restaurant_id, _o.status, _to, _uid, _reason);
END $$;

-- RPC: request bill
CREATE OR REPLACE FUNCTION public.request_bill(_table_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rid uuid;
BEGIN
  SELECT restaurant_id INTO _rid FROM dining_tables WHERE id = _table_id;
  IF NOT has_restaurant_role(auth.uid(), _rid, ARRAY['garcom','gerente']::staff_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF NOT EXISTS (SELECT 1 FROM table_sessions WHERE table_id = _table_id AND status = 'aberta') THEN RAISE EXCEPTION 'Mesa sem conta aberta'; END IF;
  UPDATE dining_tables SET status = 'aguardando_pagamento' WHERE id = _table_id;
END $$;

-- RPC: close session
CREATE OR REPLACE FUNCTION public.close_session(_session_id uuid, _payment_method text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s record; _total numeric;
BEGIN
  SELECT * INTO _s FROM table_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND OR _s.status <> 'aberta' THEN RAISE EXCEPTION 'Conta não está aberta'; END IF;
  IF NOT has_restaurant_role(auth.uid(), _s.restaurant_id, ARRAY['gerente']::staff_role[]) THEN RAISE EXCEPTION 'Somente o gerente encerra contas'; END IF;
  IF EXISTS (SELECT 1 FROM orders WHERE session_id = _session_id AND status NOT IN ('entregue','cancelado')) THEN
    RAISE EXCEPTION 'Há pedidos em andamento nesta mesa'; END IF;
  SELECT COALESCE(sum(total),0) INTO _total FROM orders WHERE session_id = _session_id AND status = 'entregue';
  UPDATE table_sessions SET status = 'fechada', closed_by = auth.uid(), closed_at = now(),
    payment_method = _payment_method, amount_paid = _total WHERE id = _session_id;
  UPDATE dining_tables SET status = 'livre' WHERE id = _s.table_id;
  RETURN _total;
END $$;

REVOKE EXECUTE ON FUNCTION public.create_order, public.set_order_status, public.request_bill, public.close_session FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_order, public.set_order_status, public.request_bill, public.close_session TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders, public.order_items, public.dining_tables, public.table_sessions;
