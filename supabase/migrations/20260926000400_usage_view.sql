-- =============================================================================
-- 店家端要讀的用量視圖
--
-- 店家只看得到一個整數百分比（不顯示 MB、不顯示剩餘時間），所以那個數字
-- 必須誠實代表「離要付錢還有多遠」，否則比不顯示更糟——一家店用了 11 個月
-- 但資料才 30MB，如果條上只算儲存量會顯示 60%，隔月時間到被通知付費，
-- 等於用一個數字騙他。
--
-- 三個進度取最終值：
--   storage_pct  資料量 / quota_bytes
--   time_pct     已過時間 / 12 個月上限
--   floor_pct    已過時間 / 2 個月保底
--
--   percent = least( greatest(storage_pct, time_pct), floor_pct )
--
-- greatest 讓「先到的那個時鐘」決定進度；floor_pct 當上蓋，保證未滿 2 個月
-- 時條不會跑到 100%（就算第 6 週就塞滿 50MB，也要到第 2 個月才算到量）。
-- =============================================================================

-- 已過時間佔某個區間的百分比。用 (起點+區間) 減起點取 epoch 當分母，
-- 而不是 extract(epoch from interval '12 months')——後者把一個月固定當 30 天，
-- 12 個月會變成 360 天，跟實際日曆對不起來。
create or replace function public.pct_elapsed(p_start timestamptz, p_span interval)
returns numeric
language sql
stable
as $$
  select case
    when p_start is null then 0::numeric
    else greatest(0::numeric, least(100::numeric,
      extract(epoch from (now() - p_start))::numeric * 100
      / nullif(extract(epoch from ((p_start + p_span) - p_start))::numeric, 0)
    ))
  end;
$$;

comment on function public.pct_elapsed(timestamptz, interval)
  is '已過時間佔指定區間的百分比，夾在 0~100';


create or replace view public.store_usage_current as
with latest as (
  select distinct on (store_id)
         store_id, measured_on, bytes_total, bytes_by_table, measured_at
  from public.store_usage
  order by store_id, measured_on desc
),
calc as (
  select
    s.id                       as store_id,
    s.plan,
    s.quota_bytes,
    s.trial_started_at,
    s.plan_expires_at,
    coalesce(l.bytes_total, 0) as bytes_total,
    coalesce(l.bytes_by_table, '{}'::jsonb) as bytes_by_table,
    l.measured_on,
    l.measured_at,
    least(100::numeric,
          coalesce(l.bytes_total, 0)::numeric * 100
          / nullif(s.quota_bytes, 0)::numeric)      as storage_pct,
    public.pct_elapsed(s.trial_started_at, interval '12 months') as time_pct,
    public.pct_elapsed(s.trial_started_at, interval '2 months')  as floor_pct
  from public.stores s
  left join latest l on l.store_id = s.id
)
select
  c.store_id,
  c.plan,
  c.quota_bytes,
  c.trial_started_at,
  c.plan_expires_at,
  c.bytes_total,
  c.bytes_by_table,
  c.measured_on,
  c.measured_at,
  round(c.storage_pct, 2) as storage_pct,
  round(c.time_pct,    2) as time_pct,
  round(c.floor_pct,   2) as floor_pct,
  -- 店家端唯一會讀的欄位。已付費的店不該看到倒數，只反映資料量。
  case
    when coalesce(c.plan, 'starter') = 'starter'
      then floor(least(greatest(c.storage_pct, c.time_pct), c.floor_pct))::int
    else floor(c.storage_pct)::int
  end as percent,
  -- 到量與否。保底期內一律 false，就算資料已經塞滿。
  case
    when coalesce(c.plan, 'starter') <> 'starter' then false
    else least(greatest(c.storage_pct, c.time_pct), c.floor_pct) >= 100
  end as needs_payment
from calc c;

comment on view public.store_usage_current
  is '店家端讀 percent 即可（整數、已夾 0~100）；MB 與各表明細只給後台看';
