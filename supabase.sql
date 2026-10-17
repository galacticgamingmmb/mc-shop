-- INSTALACIÓN NUEVA: ejecutá este archivo entero en SQL Editor de Supabase.
-- Si ya tenés una tienda V2, usá MIGRAR-V2-A-V3.sql. No ejecutes este archivo sobre una base existente.

create table public.shop_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.shop_products (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{2,31}$'),
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 140),
  category text not null check (category in ('rangos','mochilas','otros')),
  price_ars integer not null check (price_ars between 1 and 10000000),
  duration_days integer check (duration_days between 1 and 3650),
  max_quantity smallint not null default 1 check (max_quantity between 1 and 10),
  badge text not null default '' check (char_length(badge) <= 24),
  features text[] not null default '{}'::text[] check (cardinality(features) <= 30),
  active boolean not null default true,
  display_order integer not null default 100 check (display_order between 0 and 100000),
  delivery_type text not null default 'manual' check (delivery_type in ('manual','rank','backpack')),
  rank_group text check (rank_group is null or rank_group ~ '^[a-z][a-z0-9_-]{0,31}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint require_rank_group check (delivery_type <> 'rank' or rank_group is not null),
  constraint timed_product_has_days check (delivery_type = 'manual' or duration_days is not null)
);

insert into public.shop_products
(code,name,description,category,price_ars,duration_days,max_quantity,badge,features,active,display_order,delivery_type,rank_group)
values
('vip','VIP Mensual','Rango de 30 días','rangos',3900,30,1,'',array['Prefijo VIP y color de chat','3 homes','/craft y /hat','Kit semanal equilibrado'],true,10,'rank','vip'),
('vipplus','VIP+ Mensual','Rango de 30 días','rangos',6000,30,1,'Destacado',array['Todo lo de VIP','5 homes','Ender Chest y yunque portátil','Kit semanal mejorado','Cosméticos exclusivos','Vuelo en zonas habilitadas, fuera de combate'],true,20,'rank','vipplus'),
('vip_semanal','VIP Semanal','Rango de 7 días','rangos',1200,7,1,'',array['Prefijo VIP y color de chat','3 homes','/craft y /hat','Kit semanal equilibrado'],true,30,'rank','vip'),
('vipplus_semanal','VIP+ Semanal','Rango de 7 días','rangos',1800,7,1,'',array['Todo lo de VIP','5 homes','Ender Chest y yunque portátil','Kit semanal mejorado','Cosméticos exclusivos','Vuelo en zonas habilitadas, fuera de combate'],true,40,'rank','vipplus'),
('fila_7d','Espacios Mochila Semanal','+9 espacios en la mochila','mochilas',500,7,4,'',array['Una fila extra','Hasta 4 filas adicionales','Vigencia de 7 días'],true,50,'backpack',null),
('fila_30d','Espacios Mochila Mensual','+9 espacios en la mochila','mochilas',1800,30,4,'',array['Una fila extra','Hasta 4 filas adicionales','Vigencia de 30 días'],true,60,'backpack',null);


-- Datos públicos para transferencias. Se pueden editar desde admin.html > Pagos.
create table public.shop_payment_settings (
  id smallint primary key default 1 check (id = 1),
  account_holder text not null default '' check (char_length(account_holder) <= 100),
  payment_alias text not null default 'dev.cristianm.mp' check (char_length(payment_alias) <= 100),
  cbu_cvu text not null default '' check (char_length(cbu_cvu) <= 30),
  bank_name text not null default '' check (char_length(bank_name) <= 80),
  wallet_name text not null default '' check (char_length(wallet_name) <= 80),
  updated_at timestamptz not null default now()
);
insert into public.shop_payment_settings (id,account_holder,payment_alias,cbu_cvu,bank_name,wallet_name)
values (1,'','dev.cristianm.mp','','','')
on conflict (id) do nothing;

create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique check (order_code ~ '^SV-[A-F0-9]{10,12}$'),
  nickname text not null check (nickname ~ '^[A-Za-z0-9_]{3,16}$'),
  discord text check (char_length(discord) <= 80),
  transfer_reference text check (char_length(transfer_reference) <= 100),
  product_code text not null references public.shop_products(code) on delete restrict,
  quantity smallint not null check (quantity between 1 and 10),
  product_name text not null default '',
  duration_days integer,
  delivery_type text not null default 'manual',
  rank_group text,
  unit_price_ars integer not null default 0,
  total_ars integer not null default 0,
  status text not null default 'pendiente' check (status in ('pendiente','verificado','entregado','rechazado')),
  admin_note text not null default '' check (char_length(admin_note) <= 500),
  created_at timestamptz not null default now()
);
create index shop_orders_created_at_idx on public.shop_orders(created_at desc);
create index shop_orders_status_idx on public.shop_orders(status);

-- El navegador solo envía producto y cantidad. La BD fija los valores reales al crear el pedido.
create or replace function public.shop_snapshot_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.shop_products%rowtype;
begin
  select * into p from public.shop_products where code = new.product_code and active = true;
  if not found then raise exception 'Producto no disponible'; end if;
  if new.quantity < 1 or new.quantity > p.max_quantity then raise exception 'Cantidad no permitida'; end if;
  new.product_name := p.name;
  new.duration_days := p.duration_days;
  new.delivery_type := p.delivery_type;
  new.rank_group := p.rank_group;
  new.unit_price_ars := p.price_ars;
  new.total_ars := p.price_ars * new.quantity;
  new.status := 'pendiente';
  new.admin_note := '';
  return new;
end;
$$;
create trigger shop_order_snapshot_before_insert before insert on public.shop_orders
for each row execute function public.shop_snapshot_order();

create or replace function public.shop_touch_product()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger shop_products_updated before update on public.shop_products
for each row execute function public.shop_touch_product();

alter table public.shop_products enable row level security;
alter table public.shop_admins enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_payment_settings enable row level security;
revoke all on table public.shop_admins from anon, authenticated;
revoke all on table public.shop_products from anon, authenticated;
revoke all on table public.shop_orders from anon, authenticated;
revoke all on table public.shop_payment_settings from anon, authenticated;

grant select(user_id) on public.shop_admins to authenticated;
grant select on public.shop_products to anon,authenticated;
grant insert,update on public.shop_products to authenticated;
grant insert(order_code,nickname,discord,transfer_reference,product_code,quantity) on public.shop_orders to anon,authenticated;
grant select on public.shop_orders to authenticated;
grant update(status,admin_note) on public.shop_orders to authenticated;
grant select on public.shop_payment_settings to anon,authenticated;
grant update(account_holder,payment_alias,cbu_cvu,bank_name,wallet_name) on public.shop_payment_settings to authenticated;

create policy shop_admins_self_read on public.shop_admins for select to authenticated
using (user_id = (select auth.uid()));
create policy shop_products_visible_or_admin on public.shop_products for select to anon,authenticated
using (active or exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())));
create policy shop_products_admin_insert on public.shop_products for insert to authenticated
with check (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())));
create policy shop_products_admin_update on public.shop_products for update to authenticated
using (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())));
create policy shop_orders_public_insert on public.shop_orders for insert to anon,authenticated
with check (true);
create policy shop_orders_admin_read on public.shop_orders for select to authenticated
using (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())));
create policy shop_orders_admin_update on public.shop_orders for update to authenticated
using (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())));

-- Después: creá el usuario admin desde Supabase > Authentication > Users.
-- Copiá su UID y ejecutá por separado:
-- insert into public.shop_admins (user_id) values ('UUID_REAL_DEL_ADMIN');

create policy shop_payment_settings_public_read on public.shop_payment_settings
for select to anon,authenticated using (id = 1);
create policy shop_payment_settings_admin_update on public.shop_payment_settings
for update to authenticated
using (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())));
create or replace function public.shop_touch_payment_settings()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger shop_payment_settings_updated before update on public.shop_payment_settings
for each row execute function public.shop_touch_payment_settings();
