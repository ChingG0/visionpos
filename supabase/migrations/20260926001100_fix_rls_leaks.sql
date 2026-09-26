-- =============================================================================
-- 修正 RLS 外洩
--
-- 實測（只用 POS bundle 裡那把公開金鑰、不帶任何 header）：
--   takeout_orders   81 筆可讀
--   dine_in_orders  358 筆可讀
-- 內含 customer_name / customer_phone / card4 / carrier_num / buyer_tax_id /
-- items / 付款金額——是顧客個資，不是設定值。
--
-- 原因：這三張表各有一條 "allow all - xxx" policy（using/check 都是 true）
-- 且未限定角色。RLS 的 permissive policy 是 OR 關係，所以只要有這條，
-- 旁邊那條正規的 xxx_store_rls 就完全失效。
--
-- 看命名就知道是早期開發時為了方便加的（其他表用的是 xxx_service 命名，而且
-- 都有限定 service_role，實測讀不到）。這裡把三條全部移除——每張表都已經有
-- 對應的 xxx_store_rls，POS 走 x-store-id header 的正常存取不受影響。
--
-- delivery_orders 目前是空的所以掃不出外洩，但它有同樣的 policy，
-- 等 Uber 上線就會開始漏（外送單還多了顧客地址），一併處理。
-- =============================================================================

drop policy if exists "allow all - takeout_orders"  on public.takeout_orders;
drop policy if exists "allow all - dine_in_orders"  on public.dine_in_orders;
drop policy if exists "allow all - delivery_orders" on public.delivery_orders;

-- delivery_service 同樣是 using=true。它應該是給 uber-eats-webhook 用的，
-- 而那支 edge function 走 SUPABASE_SERVICE_ROLE_KEY，所以限定成 service_role
-- 不影響它，但可以確保匿名端拿不到。若原本就已限定，這句是無害的重複宣告。
do $$
begin
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'delivery_orders'
                and policyname = 'delivery_service') then
    alter policy delivery_service on public.delivery_orders to service_role;
  end if;
end $$;


-- =============================================================================
-- store_usage_current：SECURITY DEFINER view 造成的跨店外洩（這個是我加的）
--
-- PostgreSQL 的 view 預設以「建立者」的權限執行，會繞過底層表的 RLS。所以
-- 即使 store_usage 本身鎖得好好的（RLS 開啟、零 policy），透過這個 view 還是
-- 能讀到全部店家的用量、方案、bytes_total、trial_started_at。
-- Supabase 的 linter 也把它標為 CRITICAL（Security Definer View）。
--
-- 改成 security_invoker = on 之後會套用「呼叫者」的權限，因此底層兩張表都要
-- 補上店家自讀的 policy，否則 POS 的用量頁會讀不到自己的資料。
-- 後台用 service_role 繞過 RLS，仍然看得到全部，不受影響。
-- =============================================================================

-- 店家讀自己的用量
drop policy if exists store_usage_store_rls on public.store_usage;
create policy store_usage_store_rls on public.store_usage
  for all
  using      (store_id = requesting_store_id())
  with check (store_id = requesting_store_id());

-- view 要 join stores 取 quota_bytes / plan / trial_started_at，
-- 但 stores 目前只有 service 角色的 policy，匿名端一列都讀不到。
-- 這裡只開「讀自己那一列」，不含寫入。
drop policy if exists stores_self_select on public.stores;
create policy stores_self_select on public.stores
  for select
  using (id = requesting_store_id());

alter view public.store_usage_current set (security_invoker = on);
