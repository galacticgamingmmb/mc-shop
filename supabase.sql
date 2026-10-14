-- SURVIVAL STORE / ejecutar en Supabase > SQL Editor
-- No incluye claves ni contraseñas. Los valores del catálogo están protegidos por la BD.
-- IMPORTANTE: ejecutar una sola vez al crear la tienda.

create table if not exists public.shop_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique check (order_code ~ '^SV-[A-F0-9]{10}$'),
  nickname text not null check (nickname ~ '^[A-Za-z0-9_]{3,16}$'),
  discord text check (char_length(discord) <= 80),
  transfer_reference text check (char_length(transfer_reference) <= 100),
  product_code text not null check (product_code in ('fila_7d','fila_30d','vip','vipplus')),
  quantity smallint not null check (quantity between 1 and 4),
  total_ars integer generated always as (
    (case product_code
      when 'fila_7d' then 500
      when 'fila_30d' then 1800
      when 'vip' then 2200
      when 'vipplus' then 3900
      else 0 end) * quantity
  ) stored,
  status text not null default 'pendiente' check (status in ('pendiente','verificado','entregado','rechazado')),
  admin_note text not null default '' check (char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  constraint rango_una_unidad check (product_code in ('fila_7d','fila_30d') or quantity = 1)
);

create index if not exists shop_orders_created_at_idx on public.shop_orders (created_at desc);
create index if not exists shop_orders_status_idx on public.shop_orders (status);

alter table public.shop_admins enable row level security;
alter table public.shop_orders enable row level security;

-- Privilegios mínimos. La clave PUBLICABLE no obtiene lectura de pedidos.
revoke all on table public.shop_orders from anon, authenticated;
revoke all on table public.shop_admins from anon, authenticated;
grant insert (order_code,nickname,discord,transfer_reference,product_code,quantity)
  on public.shop_orders to anon, authenticated;
grant select on public.shop_orders to authenticated;
grant update (status,admin_note) on public.shop_orders to authenticated;
grant select (user_id) on public.shop_admins to authenticated;

-- Administración: un usuario solo puede averiguar si SU cuenta es administradora.
create policy "shop_admins_self_select" on public.shop_admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Cualquier visitante puede ENVIAR un pedido, pero no leerlo, editarlo o borrarlo.
create policy "shop_orders_public_insert" on public.shop_orders
  for insert to anon, authenticated
  with check (true);

-- Para leer/actualizar pedidos se requiere usuario autenticado explícitamente autorizado.
create policy "shop_orders_admin_select" on public.shop_orders
  for select to authenticated
  using (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())));

create policy "shop_orders_admin_update" on public.shop_orders
  for update to authenticated
  using (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())));

-- DESPUÉS de crear un usuario en Supabase > Authentication > Users:
-- Copiá su UUID y ejecutá esta instrucción por separado, reemplazando el ejemplo.
-- insert into public.shop_admins (user_id) values ('00000000-0000-0000-0000-000000000000');
-- IMPORTANTE: no pegues el UUID del ejemplo. Tenés que sustituirlo por el real.
