-- Applied after 0001_initial_schema.sql.
alter table public.quotes add column if not exists pdf_path text;
alter table public.quotes add column if not exists sent_at timestamptz;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists clients_updated_at on public.clients;
drop trigger if exists quotes_updated_at on public.quotes;
create trigger clients_updated_at before update on public.clients for each row execute procedure public.set_updated_at();
create trigger quotes_updated_at before update on public.quotes for each row execute procedure public.set_updated_at();

drop index if exists public.quotes_one_current_number;
create unique index if not exists quotes_one_current_number
  on public.quotes(quote_year, quote_number) where quote_number is not null and revision = 1;

insert into storage.buckets (id, name, public) values ('quote-pdfs', 'quote-pdfs', false)
on conflict (id) do nothing;
create policy "staff can read quote PDFs" on storage.objects for select to authenticated using (bucket_id = 'quote-pdfs');
create policy "staff can write quote PDFs" on storage.objects for insert to authenticated with check (bucket_id = 'quote-pdfs');
create policy "staff can update quote PDFs" on storage.objects for update to authenticated using (bucket_id = 'quote-pdfs');

create or replace function public.reserve_quote_number(p_quote_id uuid)
returns table (quote_number int, quote_year int)
language plpgsql security invoker set search_path = public as $$
declare v_year int; v_number int;
begin
  perform pg_advisory_xact_lock(hashtext('top-usinagem-quote-number'));
  select q.quote_year into v_year from quotes q where q.id = p_quote_id and q.created_by = auth.uid() and q.status = 'draft' for update;
  if v_year is null then raise exception 'Rascunho não encontrado'; end if;
  select coalesce(max(q.quote_number), 0) + 1 into v_number from quotes q where q.quote_year = v_year;
  update quotes set quote_number = v_number, finalized_at = now() where id = p_quote_id;
  return query select v_number, v_year;
end;
$$;
