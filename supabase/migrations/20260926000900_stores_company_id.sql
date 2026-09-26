-- =============================================================================
-- stores 加 company_id：連鎖總部的預留欄位
--
-- 只加欄位、可空、先不建 companies 表也不做管理介面——目前沒有實際的連鎖客人。
-- 但「一家公司多家分店」的查詢需要這個外鍵才做得出來，先放著，之後補上 companies
-- 表時不用再動 stores（那時候只要加一條 FK）。
-- =============================================================================

alter table public.stores
  add column if not exists company_id uuid;

comment on column public.stores.company_id
  is '所屬公司／連鎖總部。目前無 companies 表，先當純標記欄位；有連鎖客人時再補 FK';

create index if not exists stores_company_id_idx on public.stores (company_id)
  where company_id is not null;
