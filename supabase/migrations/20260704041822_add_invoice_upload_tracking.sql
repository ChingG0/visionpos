-- 漏傳檢核 + 備份/稽核機制：
-- 1) 上傳狀態欄位註記（財政部檢測建議「發票上傳應有欄位註記」）
alter table public.invoices
  add column if not exists upload_status      text,        -- 'uploaded' | 'not_uploaded' | 'upload_failed' | null(尚未查過)
  add column if not exists turnkey_status      text,        -- 'C' 成功 | 'E' 失敗 | null
  add column if not exists upload_checked_at   timestamptz; -- 最近一次查核時間

comment on column public.invoices.upload_status    is '綠界 GetIssueList 回報的上傳狀態快照，每日排程更新';
comment on column public.invoices.turnkey_status    is '綠界 GetIssueList 回報的上傳後接收狀態（C成功/E失敗）';
comment on column public.invoices.upload_checked_at is '最近一次執行漏傳檢核的時間';

-- 2) 稽核異常紀錄表：漏傳超過48小時、或綠界端有但本地資料庫查無的紀錄（互為備份對照）
create table if not exists public.invoice_reconcile_alerts (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id),
  invoice_number text,
  kind         text not null check (kind in ('missing_upload', 'missing_in_local_db')),
  detail       jsonb,
  resolved     boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.invoice_reconcile_alerts enable row level security;
create policy "allow all (temp, matches existing invoices policy style)" on public.invoice_reconcile_alerts
  for all using (true) with check (true);

comment on table public.invoice_reconcile_alerts is '漏傳檢核 + 備份對照產生的異常紀錄：missing_upload=超過48小時仍未成功上傳財政部；missing_in_local_db=綠界端查得到但本地 invoices 表找不到對應紀錄（可能是先前寫入失敗留下的缺口）';
