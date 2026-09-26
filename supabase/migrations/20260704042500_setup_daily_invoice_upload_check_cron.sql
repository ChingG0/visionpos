-- 啟用排程 + 對外 HTTP 呼叫所需的 extension
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 把呼叫 edge function 需要的 anon key 存進 Vault，避免明文寫在 cron job SQL 裡
select vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4d3Nvb3RpemFuZWhvamFmd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NzA5MjUsImV4cCI6MjA5NzI0NjkyNX0.lcLdY7X55EP4fdPHq3B8Y-xFr7N-26u6Emykf_v6yi8',
  'ecpay_invoice_check_anon_key',
  '呼叫 ecpay-invoice edge function（check_uploads 漏傳檢核排程用）的 anon key'
) where not exists (
  select 1 from vault.decrypted_secrets where name = 'ecpay_invoice_check_anon_key'
);

-- 每天台灣時間早上 08:10（UTC 00:10）跑一次漏傳檢核 + 備份對照，涵蓋全部有啟用發票的店
select cron.schedule(
  'daily-ecpay-invoice-upload-check',
  '10 0 * * *',
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
