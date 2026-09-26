-- =============================================================================
-- 密碼雜湊改用內建的 sha256()，不再依賴 pgcrypto 的 digest()
--
-- 原因：Supabase 把 pgcrypto 裝在 extensions schema，不在 public。
-- approve_store_application() 宣告了 search_path = public, pg_catalog，
-- 裡面呼叫的 digest() 因此解析不到，執行時會噴
--   function digest(text, unknown) does not exist
-- 也就是後台按下「核准開通」一定失敗。
--
-- 改用 PostgreSQL 11 起就內建的 sha256(bytea)——不需要任何擴充套件，也不受
-- search_path 影響。實測產生的雜湊值與前端 Web Crypto 完全一致（含中文密碼），
-- 所以既有帳號的密碼不受影響，不用重設。
-- =============================================================================

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

  -- 只寫 password_hash（SHA-256 hex），跟前端 authStore.addStaff 同一套；
  -- verify-password 會在第一次登入成功時自動補上 bcrypt。
  insert into public.staff (store_id, username, password_hash, password_bcrypt,
                            name, role, is_active, is_superadmin, can_closeout)
  values (v_store_id, trim(p_username), encode(sha256(p_password::bytea), 'hex'), null,
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
