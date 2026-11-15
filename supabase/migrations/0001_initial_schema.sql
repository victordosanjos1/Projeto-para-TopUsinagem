create type public.quote_status as enum ('draft','sent','send_failed','cancelled','deleted');
create type public.freight_mode as enum ('cif','fob','customer_transport');
create type public.payment_term as enum ('cash','days_28','days_28_56','days_28_56_84','to_agree');

create table public.clients (
  id uuid primary key default gen_random_uuid(), company_name text not null, contact_name text not null,
  cnpj text not null unique check (cnpj ~ '^[0-9]{14}$'), city text not null, state text not null,
  country text not null default 'Brasil', is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.client_emails (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete restrict,
  email text not null, is_primary boolean not null default false, unique (client_id,email)
);
create table public.quotes (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete restrict,
  quote_year int not null check (quote_year between 2020 and 2100), quote_number int,
  revision int not null default 1 check (revision > 0), status public.quote_status not null default 'draft',
  customer_snapshot jsonb, valid_until date, validity_days int check (validity_days > 0),
  freight public.freight_mode not null, freight_amount numeric(14,2) not null default 0 check (freight_amount >= 0),
  delivery_days int check (delivery_days between 1 and 5), delivery_to_agree boolean not null default false,
  payment public.payment_term not null, discount_type text check (discount_type in ('money','percent')),
  discount_value numeric(14,2) not null default 0 check (discount_value >= 0), notes text,
  subtotal numeric(14,2) not null default 0, total numeric(14,2) not null default 0,
  finalized_at timestamptz, deleted_at timestamptz, created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique nulls not distinct (client_id, quote_year, quote_number, revision)
);
create unique index quotes_one_current_number on public.quotes(client_id,quote_year,quote_number) where quote_number is not null and revision = 1;
create table public.quote_items (
  id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.quotes(id) on delete cascade,
  position smallint not null check (position > 0), description text not null, quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0), subtotal numeric(14,2) not null check (subtotal >= 0), unique(quote_id,position)
);
create table public.quote_delivery_log (
  id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.quotes(id) on delete restrict,
  recipient text not null, provider_message_id text, status text not null check (status in ('accepted','failed','delivered')),
  error_message text, created_at timestamptz not null default now()
);
create table public.audit_log (id bigint generated always as identity primary key, actor_id uuid references auth.users(id), action text not null, entity_type text not null, entity_id uuid not null, metadata jsonb, created_at timestamptz not null default now());

alter table public.clients enable row level security; alter table public.client_emails enable row level security; alter table public.quotes enable row level security; alter table public.quote_items enable row level security; alter table public.quote_delivery_log enable row level security; alter table public.audit_log enable row level security;
create policy "staff can read clients" on public.clients for select to authenticated using (true);
create policy "staff can write clients" on public.clients for all to authenticated using (true) with check (true);
create policy "staff can read emails" on public.client_emails for select to authenticated using (true);
create policy "staff can write emails" on public.client_emails for all to authenticated using (true) with check (true);
create policy "staff can read quotes" on public.quotes for select to authenticated using (true);
create policy "staff can write quotes" on public.quotes for all to authenticated using (true) with check (true);
create policy "staff can read quote items" on public.quote_items for select to authenticated using (true);
create policy "staff can write quote items" on public.quote_items for all to authenticated using (true) with check (true);
create policy "staff can read delivery logs" on public.quote_delivery_log for select to authenticated using (true);
create policy "staff can insert delivery logs" on public.quote_delivery_log for insert to authenticated with check (true);
create policy "staff can read audit logs" on public.audit_log for select to authenticated using (true);
