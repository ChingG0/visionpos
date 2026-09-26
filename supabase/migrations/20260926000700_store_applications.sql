-- =============================================================================
-- 店家申請
--
-- 為什麼不直接寫進 stores（它其實已經有 owner_name/email/tax_id/phone/address）：
--   申請不等於店家。被拒絕的、重複送的、機器人灌的，都不該留在那張所有東西都
--   外鍵指過去的核心表裡。分開一張，要清空隨時可以清，也不會佔用 stores.code
--   的唯一鍵、不會被 snapshot_store_usage 掃到。
--
-- 欄位名刻意跟 stores 對齊，核准時複製過去就好。
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists public.store_applications (
  id            uuid primary key default gen_random_uuid(),
  store_name    text not null,
  owner_name    text not null,
  phone         text not null,
  email         text,
  tax_id        text,
  address       text,
  business_type text default 'restaurant',
  note          text,                                   -- 申請人想補充的話

  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  reviewed_at      timestamptz,
  review_note      text,                                -- 你的審核備註（不給申請人看）
  created_store_id uuid references public.stores(id),   -- 核准後指向建立的店

  source_ip     text,                                   -- 防濫用用，不對外顯示
  created_at    timestamptz not null default now()
);

comment on table public.store_applications is '公開申請表單的收件匣，由 store-application edge function 寫入，人工審核後用 approve_store_application() 開通';

create index if not exists store_applications_status_idx  on public.store_applications (status, created_at desc);
create index if not exists store_applications_phone_idx   on public.store_applications (phone, created_at desc);

-- 這張表只有 edge function（service_role）碰得到。
-- 啟用 RLS 但不建任何 policy = anon / authenticated 一律讀寫不到，
-- service_role 本來就繞過 RLS。申請人的聯絡資料不該能被匿名撈走。
alter table public.store_applications enable row level security;


-- ── 核准開通 ─────────────────────────────────────────────────────────────────
-- 一個交易內做完：建店、建老闆帳號、灌初始分類、回寫申請狀態。
-- 中途任何一步失敗就整個回滾，不會留下半套的店。
--
-- 密碼只寫 password_hash（SHA-256 hex），跟前端 authStore.addStaff 同一套；
-- verify-password 在第一次登入成功時會自動補上 bcrypt，不需要在這裡處理。
--
-- trial_started_at 刻意不設——免費期的時鐘由第一筆訂單的 trigger 啟動。
create or replace function public.approve_store_application(
  p_application_id uuid,
  p_store_code     text,
  p_username       text,
  p_password       text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  a          public.store_applications%rowtype;
  v_code     text := lower(trim(p_store_code));
  v_store_id uuid;
  v_labels   text[] := array['主餐', '飲料', '加點'];
  i          integer;
begin
  select * into a from public.store_applications where id = p_application_id;
  if not found then
    raise exception '找不到這筆申請：%', p_application_id;
  end if;
  if a.status <> 'pending' then
    raise exception '這筆申請已經處理過了（目前狀態：%）', a.status;
  end if;
  if v_code is null or v_code = '' then
    raise exception '必須指定店家代碼';
  end if;
  if exists (select 1 from public.stores where lower(code) = v_code) then
    raise exception '店家代碼 % 已經有人用了', v_code;
  end if;
  if coalesce(trim(p_username), '') = '' or coalesce(p_password, '') = '' then
    raise exception '必須指定老闆帳號與密碼';
  end if;

  -- verify-password 查店家時是 code 比小寫、store_code 比大寫，兩邊都要填
  insert into public.stores (code, store_code, name, owner_name, email, tax_id, phone, address,
                             business_type, plan, store_status, deployment_type)
  values (v_code, upper(v_code), a.store_name, a.owner_name, a.email, a.tax_id, a.phone, a.address,
          coalesce(a.business_type, 'restaurant'), 'starter', 'active', 'shared')
  returning id into v_store_id;

  insert into public.staff (store_id, username, password_hash, name, role,
                            is_active, is_superadmin, can_closeout)
  values (v_store_id, trim(p_username), encode(digest(p_password, 'sha256'), 'hex'),
          a.owner_name, 'owner', true, false, true);

  -- 給一組最起碼的分類。全空白的菜單會讓新店家第一天就卡住不知道從哪開始。
  for i in 1 .. array_length(v_labels, 1) loop
    insert into public.categories (id, store_id, label, sort_order)
    values ('cat' || replace(v_store_id::text, '-', '') || '-seed' || i,
            v_store_id, v_labels[i], i - 1);
  end loop;

  update public.store_applications
     set status = 'approved', reviewed_at = now(), created_store_id = v_store_id
   where id = p_application_id;

  return v_store_id;
end;
$$;

comment on function public.approve_store_application(uuid, text, text, text)
  is '核准申請並開通：建店 + 老闆帳號 + 初始分類，回傳新的 store_id。整段在一個交易內，失敗全回滾。';
