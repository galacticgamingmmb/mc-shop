-- SOLO PARA QUIEN YA INSTALÓ EL SQL ANTERIOR (v1).
-- Conserva pedidos y usuarios admin. Hacé un backup antes de ejecutarlo.

create table if not exists public.shop_products (
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
('fila_30d','Espacios Mochila Mensual','+9 espacios en la mochila','mochilas',1800,30,4,'',array['Una fila extra','Hasta 4 filas adicionales','Vigencia de 30 días'],true,60,'backpack',null)
on conflict (code) do nothing;

-- En la versión anterior total_ars era una columna GENERADA. Se conservan sus valores.
alter table public.shop_orders alter column total_ars drop expression;
alter table public.shop_orders drop constraint if exists shop_orders_product_code_check;
alter table public.shop_orders drop constraint if exists shop_orders_quantity_check;
alter table public.shop_orders drop constraint if exists rango_una_unidad;
alter table public.shop_orders drop constraint if exists shop_orders_order_code_check;
alter table public.shop_orders add constraint shop_orders_order_code_check check (order_code ~ '^SV-[A-F0-9]{10,12}$');
alter table public.shop_orders add constraint shop_orders_quantity_check check (quantity between 1 and 10);
alter table public.shop_orders add constraint shop_orders_product_code_fkey foreign key (product_code) references public.shop_products(code) on delete restrict;
alter table public.shop_orders add column product_name text not null default '';
alter table public.shop_orders add column duration_days integer;
alter table public.shop_orders add column delivery_type text not null default 'manual';
alter table public.shop_orders add column rank_group text;
alter table public.shop_orders add column unit_price_ars integer not null default 0;
-- Pedidos antiguos conservan importe histórico incluso si el precio del catálogo cambia.
update public.shop_orders o
set product_name = p.name,
    duration_days = p.duration_days,
    delivery_type = p.delivery_type,
    rank_group = p.rank_group,
    unit_price_ars = o.total_ars / o.quantity
from public.shop_products p where o.product_code = p.code;

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
revoke all on table public.shop_products from anon, authenticated;
grant select on public.shop_products to anon,authenticated;
grant insert,update on public.shop_products to authenticated;
create policy shop_products_visible_or_admin on public.shop_products for select to anon,authenticated
using (active or exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())));
create policy shop_products_admin_insert on public.shop_products for insert to authenticated
with check (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())));
create policy shop_products_admin_update on public.shop_products for update to authenticated
using (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())));
-- Las políticas ya existentes sobre shop_orders y shop_admins se conservan.
-- Sus permisos de INSERT/SELECT/UPDATE también se conservan; los visitantes solo insertan.


-- Funciones añadidas en la versión V3.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.shop_products'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%cardinality(features)%'
  loop execute format('alter table public.shop_products drop constraint %I', c.conname); end loop;
end $$;
alter table public.shop_products add constraint shop_products_features_max check (cardinality(features) <= 30);

create table if not exists public.shop_payment_settings (
  id smallint primary key default 1 check (id = 1),
  account_holder text not null default '' check (char_length(account_holder) <= 100),
  payment_alias text not null default 'dev.cristianm.mp' check (char_length(payment_alias) <= 100),
  cbu_cvu text not null default '' check (char_length(cbu_cvu) <= 30),
  bank_name text not null default '' check (char_length(bank_name) <= 80),
  wallet_name text not null default '' check (char_length(wallet_name) <= 80),
  updated_at timestamptz not null default now()
);
insert into public.shop_payment_settings (id,account_holder,payment_alias,cbu_cvu,bank_name,wallet_name)
values (1,'','dev.cristianm.mp','','','') on conflict (id) do nothing;
alter table public.shop_payment_settings enable row level security;
revoke all on table public.shop_payment_settings from anon, authenticated;
grant select on public.shop_payment_settings to anon,authenticated;
grant update(account_holder,payment_alias,cbu_cvu,bank_name,wallet_name) on public.shop_payment_settings to authenticated;
drop policy if exists shop_payment_settings_public_read on public.shop_payment_settings;
create policy shop_payment_settings_public_read on public.shop_payment_settings for select to anon,authenticated using (id = 1);
drop policy if exists shop_payment_settings_admin_update on public.shop_payment_settings;
create policy shop_payment_settings_admin_update on public.shop_payment_settings for update to authenticated
using (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())));
create or replace function public.shop_touch_payment_settings()
returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at := now(); return new; end; $$;
drop trigger if exists shop_payment_settings_updated on public.shop_payment_settings;
create trigger shop_payment_settings_updated before update on public.shop_payment_settings for each row execute function public.shop_touch_payment_settings();
