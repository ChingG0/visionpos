-- =============================================================================
-- 每日排程從台灣 08:10 改到 04:10
--
-- 原本是 UTC 00:10（台灣早上 08:10）——那個時段早餐店已經開了、早午餐在備料。
-- 這班排程現在多了資料用量快照，做的是 25 張表的全量掃描；等店數和資料長大，
-- 在尖峰時段掃全庫會跟 POS 的讀取搶 I/O。
--
-- 改成 UTC 20:10（台灣 04:10）：宵夜店收攤了、早餐店還沒開，全天最閒。
-- 發票漏傳檢核查的是「48 小時內未上傳成功」的發票，4 點跟 8 點對它沒有差別。
--
-- cron.schedule() 同名會直接覆蓋既有 job，不需要先 unschedule。
-- =============================================================================

select cron.schedule(
  'daily-ecpay-invoice-upload-check',
  '10 20 * * *',
  $$
  select net.http_post(
    url := 'https://axwsootizanehojafwnw.supabase.co/functions/v1/ecpay-invoice',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'ecpay_invoice_check_anon_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ecpay_invoice_check_anon_key')
    ),
    body := jsonb_build_object('action', 'check_uploads')
  );
  $$
);
