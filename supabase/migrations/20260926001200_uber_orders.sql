-- =============================================================================
-- Uber Eats 訂單（由「付款詳細資訊（商品級別）」CSV 匯入）
--
-- 為什麼另開表而不塞進 delivery_orders：
--   delivery_orders 沒有平台服務費、實收金額這些欄位。硬塞的話「total」在同一張
--   表裡會有兩種意思（自家外送＝顧客付的＝實收；Uber＝顧客付的≠實收），報表算
--   出來的數字會是錯的，而且錯得很安靜。
--
-- CSV 的結構（實際驗證過 15 筆訂單、24 個品項全部對得起來）：
--   · 訂單列：「訂單 ID」有值（#7E765），帶所有金額欄位
--   · 品項列：「訂單 ID」是空的，靠「工作流程 ID」跟訂單列關聯
--   · 費用列：兩個 ID 都空，是廣告費用／點數，不是訂單——匯入時要排除
--
-- 去重用 order_uuid（完整 UUID）。CSV 上那個「訂單 ID」只有 5 碼（#7E765），
-- 不足以保證唯一，不能當主鍵。
-- =============================================================================

create table if not exists public.uber_orders (
  order_uuid      uuid        primary key,
  store_id        uuid        not null references public.stores(id) on delete cascade,
  workflow_id     uuid        not null,
  order_ref       text,                        -- CSV 的「訂單 ID」，如 #7E765，顯示用
  ordered_on      date        not null,        -- 訂單日期
  accepted_at     text,                        -- 接受訂單時間（CSV 只給 20:59 這種時分）
  completed_at    timestamptz,                 -- 訂單完成時間
  dining_mode     text,                        -- 用餐模式
  order_channel   text,                        -- iOS / Android / 網頁
  membership      text,                        -- 顧客 Uber 會員狀態
  currency        text        not null default 'TWD',

  -- 金額一律存「含加值型營業稅」的版本，跟 Uber 對帳單上顯示的一致
  gross_incl_tax  numeric(12,2) not null default 0,  -- 銷售額（顧客看到的商品金額）
  item_discount   numeric(12,2) not null default 0,  -- 商品優惠（負數，店家自己出的折扣）
  marketing_adj   numeric(12,2) not null default 0,  -- 行銷調整
  order_total     numeric(12,2) not null default 0,  -- 訂單總額
  platform_fee    numeric(12,2) not null default 0,  -- 平台服務費（負數）
  net_payout      numeric(12,2) not null default 0,  -- 總金額＝實際入袋

  payout_date     date,                        -- Uber 撥款日
  status          text,                        -- 訂單狀態（已完成／已取消／退款…）
  imported_at     timestamptz not null default now()
);

comment on table  public.uber_orders                is 'Uber Eats 訂單，由對帳 CSV 匯入。order_uuid 為主鍵，重複匯入同一檔案不會重算';
comment on column public.uber_orders.gross_incl_tax is '顧客付的商品金額（含稅）。營業額看這個';
comment on column public.uber_orders.net_payout     is 'Uber 實際撥給你的金額。現金流看這個——實測約為 gross 的 61%';
comment on column public.uber_orders.workflow_id    is '關聯 uber_order_items 用。CSV 的品項列只有這個欄位，沒有訂單 ID';

create index if not exists uber_orders_store_date_idx on public.uber_orders (store_id, ordered_on desc);
create index if not exists uber_orders_workflow_idx   on public.uber_orders (workflow_id);


-- ── 品項 ─────────────────────────────────────────────────────────────────────
create table if not exists public.uber_order_items (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores(id) on delete cascade,
  workflow_id    uuid not null,
  order_uuid     uuid references public.uber_orders(order_uuid) on delete cascade,
  ordered_on     date not null,
  item_name      text not null,
  qty            numeric(10,2) not null default 0,
  unit_price     numeric(12,2) not null default 0,
  gross_incl_tax numeric(12,2) not null default 0
);

-- 單價 × 數量 不等於銷售額：加料與選項的金額被折進銷售額，單價欄位不含。
-- 實測 24 個品項有 9 個對不起來（健人肉食黨 單價199×1 但銷售額 299）。
-- 商品分析一律用 gross_incl_tax，不要自己相乘——那會少算三成。
comment on column public.uber_order_items.gross_incl_tax
  is '這個品項的實際銷售額（含稅、含加料）。不要用 unit_price × qty 計算';
comment on column public.uber_order_items.unit_price
  is 'CSV 的單價，僅供參考。客製組合的品項這欄是 0';

create index if not exists uber_order_items_store_date_idx on public.uber_order_items (store_id, ordered_on desc);
create index if not exists uber_order_items_workflow_idx   on public.uber_order_items (workflow_id);
create index if not exists uber_order_items_name_idx       on public.uber_order_items (store_id, item_name);


-- ── RLS：跟其他資料表同一套 ────────────────────────────────────────────────────
alter table public.uber_orders      enable row level security;
alter table public.uber_order_items enable row level security;

drop policy if exists uber_orders_store_rls on public.uber_orders;
create policy uber_orders_store_rls on public.uber_orders
  for all using (store_id = requesting_store_id()) with check (store_id = requesting_store_id());

drop policy if exists uber_order_items_store_rls on public.uber_order_items;
create policy uber_order_items_store_rls on public.uber_order_items
  for all using (store_id = requesting_store_id()) with check (store_id = requesting_store_id());
