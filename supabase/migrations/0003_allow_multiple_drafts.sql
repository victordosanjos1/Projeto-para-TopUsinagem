-- Drafts do not have a number, therefore more than one draft for the same
-- client/year must be allowed. Numbered documents stay unique per revision.
alter table public.quotes
  drop constraint if exists quotes_client_id_quote_year_quote_number_revision_key;

create unique index if not exists quotes_client_year_number_revision_unique
  on public.quotes (client_id, quote_year, quote_number, revision)
  where quote_number is not null;
