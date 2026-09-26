-- =============================================================================
-- 用量計費所需的欄位
--
-- stores 本來就有 plan（預設 'starter'）、deployment_type、store_status，
-- 這支只補目前沒有的三個，並把 plan 的合法值定下來。
--
-- 命名上沿用既有的 'starter' 當免費版，不另外發明 'trial'——同一個概念兩個
-- 名字，遲早會有人判斷錯。
--
-- 停用狀態也不塞進 plan，那是 store_status 的職責（它已經有 'active' 預設值）。
--
-- 免費版的到期由三個時鐘決定，先到者為準：
--   quota_bytes                    資料量上限，預設 50MB
--   trial_started_at + 12 months   最長免費期
--   trial_started_at + 2 months    最短保障期（在這之前一律不催繳）
-- =============================================================================

alter table public.stores
  add column if not exists trial_started_at timestamptz,
  add column if not exists plan_expires_at  timestamptz,
  add column if not exists quota_bytes      bigint not null default 52428800;  -- 50 MB

comment on column public.stores.trial_started_at is '三個時鐘的共同起點，開通當下寫入；既有店家以 created_at 回填';
comment on column public.stores.plan_expires_at  is '付費方案到期日，starter 不使用';
comment on column public.stores.quota_bytes      is '免費額度上限，預設 50MB（52428800）。放在店上是為了個別調整不用改程式';

-- plan 白名單。add constraint 沒有 if not exists，用 DO 包起來才能重複執行。
-- 允許 null 是因為不確定這個欄位有沒有 not null，寧可寬鬆也不要讓 migration 掛掉。
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stores_plan_check') then
    alter table public.stores
      add constraint stores_plan_check
      check (plan is null or plan in ('starter', 'monthly', 'halfyear', 'yearly'));
  end if;
end $$;

comment on column public.stores.plan is 'starter=免費版（受三個時鐘限制）/ monthly / halfyear / yearly。停用請用 store_status，不要用這欄';

-- 既有店家補上起點。stores 確認有 created_at，直接用它比用 now() 貼近真實開通日。
update public.stores
   set trial_started_at = coalesce(created_at, now())
 where trial_started_at is null;
