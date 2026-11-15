-- Aplicar depois de 0003_allow_multiple_drafts.sql.
-- 1. Numeração própria por cliente e por ano (01/2026, 02/2026... para cada cliente).
-- 2. Dados do cliente congelados (customer_snapshot) no momento da finalização.
-- 3. Revisões: mesmo número-base, revisão 2, 3...
-- 4. Exclusão reversível e histórico (audit_log) gravando de verdade.

-- 1. Numeração por cliente --------------------------------------------------
drop index if exists public.quotes_one_current_number;
create unique index if not exists quotes_one_current_number
  on public.quotes (client_id, quote_year, quote_number)
  where quote_number is not null and revision = 1;

-- Revisões apontam para a revisão anterior; exclusão lembra o estado anterior.
alter table public.quotes add column if not exists revision_of uuid references public.quotes(id) on delete restrict;
alter table public.quotes add column if not exists status_before_delete public.quote_status;

create or replace function public.client_snapshot(p_client_id uuid)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'company_name', c.company_name, 'contact_name', c.contact_name, 'cnpj', c.cnpj,
    'city', c.city, 'state', c.state, 'country', c.country,
    'emails', coalesce((select jsonb_agg(e.email order by e.is_primary desc, e.email)
                        from client_emails e where e.client_id = c.id), '[]'::jsonb))
  from clients c where c.id = p_client_id;
$$;

-- Reserva o número (rascunho novo) ou mantém o número-base (revisão), congela o
-- cliente e marca a finalização. A trava é por cliente: dois usuários finalizando
-- ao mesmo tempo para o mesmo cliente nunca recebem o mesmo número.
create or replace function public.reserve_quote_number(p_quote_id uuid)
returns table (quote_number int, quote_year int)
language plpgsql security invoker set search_path = public as $$
declare v_client uuid; v_number int; v_year int; v_status quote_status;
begin
  select q.client_id, q.quote_number, q.quote_year, q.status
    into v_client, v_number, v_year, v_status
    from quotes q where q.id = p_quote_id for update;
  if v_client is null or v_status <> 'draft' then raise exception 'Rascunho não encontrado'; end if;

  if v_number is null then
    v_year := extract(year from now() at time zone 'America/Sao_Paulo')::int;
    perform pg_advisory_xact_lock(hashtext('top-quote-number:' || v_client::text || ':' || v_year));
    select coalesce(max(q.quote_number), 0) + 1 into v_number
      from quotes q where q.client_id = v_client and q.quote_year = v_year;
  end if;

  update quotes set quote_number = v_number, quote_year = v_year, finalized_at = now(),
                    customer_snapshot = client_snapshot(v_client)
   where id = p_quote_id;
  return query select v_number, v_year;
end;
$$;

-- Cria uma revisão em rascunho a partir de um orçamento finalizado.
create or replace function public.create_quote_revision(p_quote_id uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_src quotes%rowtype; v_new uuid; v_rev int;
begin
  select * into v_src from quotes where id = p_quote_id for update;
  if v_src.id is null or v_src.quote_number is null or v_src.status not in ('sent', 'send_failed') then
    raise exception 'Somente orçamentos finalizados podem receber revisão';
  end if;
  perform pg_advisory_xact_lock(hashtext('top-quote-revision:' || v_src.client_id::text || ':' || v_src.quote_year || ':' || v_src.quote_number));
  if exists (select 1 from quotes where client_id = v_src.client_id and quote_year = v_src.quote_year
               and quote_number = v_src.quote_number and status = 'draft') then
    raise exception 'Já existe uma revisão em rascunho para este orçamento';
  end if;
  select max(revision) + 1 into v_rev from quotes
   where client_id = v_src.client_id and quote_year = v_src.quote_year and quote_number = v_src.quote_number;

  insert into quotes (client_id, quote_year, quote_number, revision, status, revision_of, valid_until, validity_days,
                      freight, freight_amount, delivery_days, delivery_to_agree, payment, discount_type, discount_value,
                      notes, subtotal, total, created_by)
  values (v_src.client_id, v_src.quote_year, v_src.quote_number, v_rev, 'draft', v_src.id, v_src.valid_until, v_src.validity_days,
          v_src.freight, v_src.freight_amount, v_src.delivery_days, v_src.delivery_to_agree, v_src.payment, v_src.discount_type,
          v_src.discount_value, v_src.notes, v_src.subtotal, v_src.total, auth.uid())
  returning id into v_new;

  insert into quote_items (quote_id, position, description, quantity, unit_price, subtotal)
  select v_new, position, description, quantity, unit_price, subtotal from quote_items where quote_id = p_quote_id;

  insert into audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'revision_created', 'quote', v_new, jsonb_build_object('source_quote_id', p_quote_id, 'revision', v_rev));
  return v_new;
end;
$$;

-- 4. Histórico ------------------------------------------------------------------
-- Antes não havia política de inserção, então todo registro de histórico falhava em silêncio.
drop policy if exists "staff can insert audit logs" on public.audit_log;
create policy "staff can insert audit logs" on public.audit_log
  for insert to authenticated with check (actor_id = auth.uid());
