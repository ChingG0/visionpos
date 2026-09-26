-- 重號檢核防護（財政部證明聯檢測項次「重號檢核」1/2/4）：
-- 1) 同一張訂單同時間只能有一張「issued」狀態的發票，避免連點/重試造成重複開票。
--    void 之後允許重開（註銷重開），所以用 partial unique index 只鎖 issued 狀態。
create unique index if not exists invoices_order_id_active_unique
  on public.invoices (order_id)
  where status = 'issued';

-- 2) 同一店同一發票號碼不可重複存在（正常情況下綠界字軌配號本身就唯一，
--    這裡是資料庫層級的最後一道防線，一旦重複會直接擋在 insert 階段）。
create unique index if not exists invoices_store_invoice_number_unique
  on public.invoices (store_id, invoice_number)
  where invoice_number is not null;
