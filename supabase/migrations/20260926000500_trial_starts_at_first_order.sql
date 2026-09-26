-- =============================================================================
-- 免費期的時鐘從「第一筆訂單」開始，不是從建立店家開始
--
-- 原本用 created_at 當起點會有兩個問題：
--   1) 建好卻從沒用過的店（例如只有 322 bytes 的空店）照樣會在 12 個月後
--      被要求付費——向一個從未使用的人收錢，對方只會直接消失。
--   2) 開通到真正營業中間通常隔幾週在建菜單、訓練員工，那段不該算進免費期。
--
-- 改用 trigger 而不是在前端結帳流程寫，是因為進單的路徑有四條（新單結帳、
-- 內用座位、外帶取餐、Uber webhook），寫在資料庫這層才不會漏掉任何一條，
-- 也不會有人之後新增第五條時忘記處理。
--
-- trial_started_at 為 null = 時鐘還沒開始，pct_elapsed() 會回 0，
-- 用量條顯示 0%、needs_payment 為 false。
-- =============================================================================

create or replace function public.touch_trial_start()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 只有第一筆會真的更新到列；之後每次都是走主鍵索引、match 0 rows，
  -- 成本是微秒等級，不會拖慢結帳。
  update public.stores
     set trial_started_at = now()
   where id = new.store_id
     and trial_started_at is null;
  return new;
end;
$$;

comment on function public.touch_trial_start()
  is '第一筆訂單寫入時，把該店的免費期時鐘啟動';

-- 三張訂單表各掛一個。用 DO 迴圈是因為表可能不存在（例如還沒接外送的環境）。
do $$
declare
  t text;
begin
  foreach t in array array['takeout_orders', 'dine_in_orders', 'delivery_orders']
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('drop trigger if exists trg_trial_start on public.%I', t);
      execute format(
        'create trigger trg_trial_start after insert on public.%I
           for each row execute function public.touch_trial_start()', t);
    end if;
  end loop;
end $$;


-- ── 回填：把既有店家的起點改成它們真正的第一筆訂單 ────────────────────────────
-- 沒有任何訂單的店會被設回 null（時鐘尚未啟動），這正是我們要的。
do $$
declare
  t         text;
  v_tscol   text;
  v_union   text := '';
begin
  foreach t in array array['takeout_orders', 'dine_in_orders', 'delivery_orders']
  loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      continue;
    end if;

    -- created_at 才是「下單當下」；沒有這欄的表退而求其次用 completed_at
    select case
             when exists (select 1 from information_schema.columns
                          where table_schema='public' and table_name=t and column_name='created_at')
               then 'coalesce(created_at, completed_at)'
             else 'completed_at'
           end
      into v_tscol;

    v_union := v_union
      || case when v_union = '' then '' else ' union all ' end
      || format('select store_id, %s as ts from public.%I', v_tscol, t);
  end loop;

  if v_union = '' then
    return;
  end if;

  execute format($f$
    update public.stores s
       set trial_started_at = f.first_ts
      from (select store_id, min(ts) as first_ts
              from (%s) x
             where store_id is not null and ts is not null
             group by store_id) f
     where s.id = f.store_id
  $f$, v_union);

  -- 完全沒有訂單的店：時鐘歸零，等它真的開始做生意再啟動
  execute format($f$
    update public.stores s
       set trial_started_at = null
     where s.trial_started_at is not null
       and not exists (select 1 from (%s) y where y.store_id = s.id and y.ts is not null)
  $f$, v_union);
end $$;
