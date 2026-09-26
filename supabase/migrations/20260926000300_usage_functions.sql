-- =============================================================================
-- 用量計算
--
-- 作法：掃過 public schema 底下所有「有 store_id 欄位」的實體表，逐表加總
-- pg_column_size(t.*)。用動態探索而不是寫死表名，之後新增資料表會自動被算
-- 進去，不用記得回來改這支函式。
--
-- pg_column_size 算的是資料列本身的大小，不含索引、TOAST 額外開銷與死 tuple。
-- 拿來當「這家店存了多少東西」的計費基準剛好：跨店之間公平、不會因為你重建
-- 索引或跑 VACUUM 就讓客人的用量跳動。
--
-- 第一版是每天全量掃。店數少的時候完全沒問題；之後量大了要改成「每日只累加
-- 新資料、每週全量對帳一次」（交易紀錄頁有刪除功能，純累加會漂移），
-- store_usage 的結構兩種算法都吃得下，換算法不用動前端。
-- =============================================================================

create or replace function public.calc_store_bytes(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r        record;
  v_bytes  bigint;
  v_result jsonb := '{}'::jsonb;
begin
  if p_store_id is null then
    return '{}'::jsonb;
  end if;

  for r in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname     = 'public'
      and c.relkind     = 'r'            -- 只算實體表，不含 view / 分割表父層
      and a.attname     = 'store_id'
      and a.attnum      > 0
      and not a.attisdropped
      and c.relname    <> 'store_usage'  -- 用量表自己不算，免得統計統計自己
    order by c.relname
  loop
    execute format(
      'select coalesce(sum(pg_column_size(t.*)), 0)::bigint from public.%I t where t.store_id = $1',
      r.table_name
    ) into v_bytes using p_store_id;

    if v_bytes > 0 then
      v_result := v_result || jsonb_build_object(r.table_name, v_bytes);
    end if;
  end loop;

  return v_result;
end;
$$;

comment on function public.calc_store_bytes(uuid)
  is '回傳 {表名: bytes} —— 動態掃過所有有 store_id 的表';


-- ── 寫入每日快照 ──────────────────────────────────────────────────────────────
-- 不帶參數 = 全部店（每日排程用）；帶 store_id = 只跑那一家（手動測試用）。
-- 同一天重複跑會覆蓋，不會長出兩列，所以排程失敗補跑是安全的。
create or replace function public.snapshot_store_usage(p_store_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r       record;
  v_by    jsonb;
  v_total bigint;
  v_count integer := 0;
  -- 用台灣日期當鍵，跟營業日的認知一致（伺服器是 UTC，直接用會差 8 小時）
  v_today date := (now() at time zone 'Asia/Taipei')::date;
begin
  for r in
    select id from public.stores
    where p_store_id is null or id = p_store_id
    order by id
  loop
    v_by := public.calc_store_bytes(r.id);

    select coalesce(sum(value::bigint), 0)
      into v_total
      from jsonb_each_text(v_by);

    insert into public.store_usage (store_id, measured_on, bytes_total, bytes_by_table, measured_at)
    values (r.id, v_today, v_total, v_by, now())
    on conflict (store_id, measured_on) do update
      set bytes_total    = excluded.bytes_total,
          bytes_by_table = excluded.bytes_by_table,
          measured_at    = excluded.measured_at;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.snapshot_store_usage(uuid)
  is '寫入當日用量快照，回傳處理的店家數。不帶參數=全部店。同日重複執行會覆蓋。';
