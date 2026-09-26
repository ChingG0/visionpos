-- =============================================================================
-- 每日用量快照
--
-- bytes_by_table 一定要存：之後要回答「是哪張表長最快」「發票表那份重複的
-- items 到底佔多少」這類問題時，不用重跑一次全量掃描就有答案。
-- =============================================================================

create table if not exists public.store_usage (
  store_id       uuid        not null references public.stores(id) on delete cascade,
  measured_on    date        not null,
  bytes_total    bigint      not null default 0,
  bytes_by_table jsonb       not null default '{}'::jsonb,
  measured_at    timestamptz not null default now(),
  primary key (store_id, measured_on)
);

comment on table  public.store_usage                is '每店每日一列的資料量快照，由 snapshot_store_usage() 寫入';
comment on column public.store_usage.bytes_by_table is '{"takeout_orders": 123456, ...} 用來追哪張表長最快';

-- 後台要看「最近有哪些店量測過」「成長曲線」，都是依日期掃
create index if not exists store_usage_measured_on_idx
  on public.store_usage (measured_on desc);
