-- 存放綠界 GetIssue 回傳的官方一維/二維條碼內容（已用店家 AES 金鑰正確加密），
-- 補印時直接重用，不必每次重打 GetIssue。
alter table public.invoices
  add column if not exists pos_bar_code  text,
  add column if not exists qr_code_left  text,
  add column if not exists qr_code_right text,
  add column if not exists qr_code_ready boolean not null default false;

comment on column public.invoices.pos_bar_code  is '綠界 GetIssue 回傳的一維條碼內容（Code39，年期別5+字軌號碼10+隨機碼4）';
comment on column public.invoices.qr_code_left  is '綠界 GetIssue 回傳的左方二維條碼內容（含正確 AES 加密驗證資訊）';
comment on column public.invoices.qr_code_right is '綠界 GetIssue 回傳的右方二維條碼內容';
comment on column public.invoices.qr_code_ready is '是否成功取得官方條碼；false 代表綠界尚未設定密碼種子或未核准 POS 自訂版型權限，此時不應列印條碼區塊';
