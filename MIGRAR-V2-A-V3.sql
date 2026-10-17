-- MIGRACIÓN V2 -> V3: beneficios ampliados y datos de transferencia editables.
-- Ejecutar una sola vez en Supabase SQL Editor. Conserva productos, pedidos y administradores.

-- Permitir hasta 30 beneficios por producto en lugar de 6.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.shop_products'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%cardinality(features)%'
  loop
    execute format('alter table public.shop_products drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.shop_products
  add constraint shop_products_features_max check (cardinality(features) <= 30);

-- Tabla única de datos de pago. Los datos son públicos para que los compradores puedan transferir;
-- solo los usuarios autorizados en shop_admins pueden modificarlos.
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
values (1,'','dev.cristianm.mp','','','')
on conflict (id) do nothing;

alter table public.shop_payment_settings enable row level security;
revoke all on table public.shop_payment_settings from anon, authenticated;
grant select on public.shop_payment_settings to anon,authenticated;
grant update(account_holder,payment_alias,cbu_cvu,bank_name,wallet_name) on public.shop_payment_settings to authenticated;

drop policy if exists shop_payment_settings_public_read on public.shop_payment_settings;
create policy shop_payment_settings_public_read on public.shop_payment_settings
for select to anon,authenticated using (id = 1);
drop policy if exists shop_payment_settings_admin_update on public.shop_payment_settings;
create policy shop_payment_settings_admin_update on public.shop_payment_settings
for update to authenticated
using (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid())));

create or replace function public.shop_touch_payment_settings()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists shop_payment_settings_updated on public.shop_payment_settings;
create trigger shop_payment_settings_updated before update on public.shop_payment_settings
for each row execute function public.shop_touch_payment_settings();

-- La tabla se crea con el alias actual como valor inicial. Completá titular, CBU/CVU y banco/billetera
-- desde el panel admin.html > Pagos.
