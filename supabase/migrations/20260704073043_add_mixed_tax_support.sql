-- 混合稅率支援：商品分稅別 + 混合稅率開票資格閘門
alter table public.menu_items
  add column if not exists tax_type text not null default 'taxable'
    check (tax_type in ('taxable', 'exempt', 'zero'));
comment on column public.menu_items.tax_type is '商品課稅別：taxable=應稅(預設) / exempt=免稅 / zero=零稅率，用來決定電子發票 ItemTaxType 及是否需要混合稅率(TaxType=9)開票';

alter table public.invoice_settings
  add column if not exists mixed_tax_approved boolean not null default false;
comment on column public.invoice_settings.mixed_tax_approved is '是否已向財政部/綠界申請核可開立混合稅率(TaxType=9)發票；訂單同時含應稅+免稅(或零稅率)商品但此值為 false 時，開票會被擋下並回錯誤，避免違規開立未核准的混稅發票';
