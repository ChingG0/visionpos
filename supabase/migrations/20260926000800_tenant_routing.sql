-- =============================================================================
-- 租戶路由
--
-- 每家店的資料落在哪個資料庫。目前全部同一個 Supabase，預留給「獨立雲端」方案：
-- 等第一個獨立雲端客人出現，改那一家的 api_url / database_shard 即可，後台依這
-- 張表決定連線目標，不用改架構。
--
-- ⚠ 這張表在正式站可能「早就存在」（先前手動建過，已有部分資料），所以：
--   · create table 用 if not exists，不會覆蓋既有資料
--   · 約束（unique / FK / check）與欄位一律獨立補，不放在 create table 裡面
--     ——放裡面的話，表已存在時會被整段跳過，後面依賴 unique 的 ON CONFLICT
--     就會炸掉（no unique or exclusion constraint matching）
-- =============================================================================

create table if not exists public.tenant_routing (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null,
  server_group   text not null default 'shared-group-01',
  database_shard text not null default 'supabase-main',
  api_url        text not null default 'https://axwsootizanehojafwnw.supabase.co',
  region         text not null default 'tw',
  status         text not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 既有的表可能少欄位（不同時期建的），一律補齊
alter table public.tenant_routing
  add column if not exists server_group   text        not null default 'shared-group-01',
  add column if not exists database_shard text        not null default 'supabase-main',
  add column if not exists api_url        text        not null default 'https://axwsootizanehojafwnw.supabase.co',
  add column if not exists region         text        not null default 'tw',
  add column if not exists status         text        not null default 'active',
  add column if not exists created_at     timestamptz not null default now(),
  add column if not exists updated_at     timestamptz not null default now();

-- 一店一筆。下面的回填與 trigger 都靠這個唯一索引做 ON CONFLICT。
-- 有重複就停下來讓人工判斷該留哪一筆，不自作主張刪資料。
do $$
begin
  if exists (
    select 1 from public.tenant_routing group by store_id having count(*) > 1
  ) then
    raise exception 'tenant_routing 有重複的 store_id，請先人工清理後再套用此 migration';
  end if;
end $$;

create unique index if not exists tenant_routing_store_id_key
  on public.tenant_routing (store_id);

create index if not exists tenant_routing_shard_idx
  on public.tenant_routing (database_shard, status);

-- 外鍵：指向已不存在的店的孤兒列會擋下建立，所以先清掉孤兒（那些列本來就沒意義）
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenant_routing_store_id_fkey') then
    delete from public.tenant_routing t
     where not exists (select 1 from public.stores s where s.id = t.store_id);

    alter table public.tenant_routing
      add constraint tenant_routing_store_id_fkey
      foreign key (store_id) references public.stores(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tenant_routing_status_check') then
    -- 既有資料若有白名單外的值，先擋下來而不是硬加約束造成 migration 失敗
    if not exists (
      select 1 from public.tenant_routing
      where status is not null and status not in ('active', 'migrating', 'suspended')
    ) then
      alter table public.tenant_routing
        add constraint tenant_routing_status_check
        check (status in ('active', 'migrating', 'suspended'));
    end if;
  end if;
end $$;

comment on table  public.tenant_routing          is '每家店的資料落在哪個資料庫。目前全部同一個，預留給獨立雲端方案';
comment on column public.tenant_routing.store_id is '一店一筆（unique），店刪掉時一併刪除';
comment on column public.tenant_routing.api_url  is '該店資料所在的 Supabase 位址，後台依此決定連線目標';


-- ── 新店自動補一筆路由 ────────────────────────────────────────────────────────
-- 建店有兩條路徑（後台手動建、approve_store_application 核准開通），寫成 trigger
-- 才不會其中一條漏掉、導致那家店在後台顯示「伺服器 —」。
create or replace function public.ensure_tenant_routing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenant_routing (store_id)
  values (new.id)
  on conflict (store_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_ensure_tenant_routing on public.stores;
create trigger trg_ensure_tenant_routing
  after insert on public.stores
  for each row execute function public.ensure_tenant_routing();


-- 既有店家補齊（截圖上 RINGO林果與長慶水果的「伺服器」顯示「—」就是缺這兩筆）
insert into public.tenant_routing (store_id)
select s.id from public.stores s
on conflict (store_id) do nothing;
