-- SifaDent feature upgrade for an existing deployment
-- Run this once in Supabase SQL Editor after deploying the updated app.

alter table public.patients
  add column if not exists patient_type text;

update public.patients
set patient_type = 'outpatient'
where patient_type is null or patient_type = '';

alter table public.patients
  alter column patient_type set default 'outpatient';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'patients_patient_type_check'
      and conrelid = 'public.patients'::regclass
  ) then
    alter table public.patients
      add constraint patients_patient_type_check
      check (patient_type in ('outpatient','inpatient'));
  end if;
end $$;

alter table public.patients
  alter column patient_type set not null;

insert into public.clinic_settings (key, value)
values
  ('software_name', 'DentalCare'),
  ('theme', 'purple-pink'),
  ('logo_url', '')
on conflict (key) do nothing;

insert into storage.buckets (id, name, public)
values ('clinic-assets', 'clinic-assets', true)
on conflict (id) do update set public = true;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS original_amount numeric(12,2);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;
UPDATE public.invoices SET original_amount = COALESCE(original_amount, total_amount), discount_amount = COALESCE(discount_amount,0) WHERE original_amount IS NULL;


-- Payment idempotency prevents double-recording when the Record Payment button
-- is clicked more than once or a request is retried.
alter table public.payments
  add column if not exists idempotency_key text;

create unique index if not exists payments_idempotency_key_uidx
  on public.payments(idempotency_key)
  where idempotency_key is not null;

-- Store the emergency contact relationship selected on patient registration.
alter table public.patients
  add column if not exists emergency_contact_relationship text;

-- Atomic payment recording: locks the invoice row, prevents overpayment and
-- makes retries safe through the idempotency key.
create or replace function public.record_payment(
  p_invoice_id integer,
  p_patient_id integer,
  p_amount numeric,
  p_payment_method text,
  p_payment_date text,
  p_reference_number text default null,
  p_notes text default null,
  p_received_by text default null,
  p_idempotency_key text default null
)
returns setof public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_payment public.payments%rowtype;
  v_amount_paid numeric;
  v_balance numeric;
begin
  if p_idempotency_key is not null then
    select * into v_payment from public.payments where idempotency_key = p_idempotency_key limit 1;
    if found then return next v_payment; return; end if;
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.patient_id <> p_patient_id then raise exception 'Patient does not match invoice'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;

  v_balance := coalesce(v_invoice.balance, v_invoice.total_amount - coalesce(v_invoice.amount_paid,0));
  if p_amount > v_balance + 0.000001 then raise exception 'Payment amount exceeds the invoice amount due'; end if;

  v_amount_paid := coalesce(v_invoice.amount_paid,0) + p_amount;
  v_balance := v_invoice.total_amount - v_amount_paid;

  insert into public.payments(invoice_id, patient_id, amount, payment_method, payment_date, reference_number, notes, received_by, idempotency_key)
  values (p_invoice_id, p_patient_id, p_amount, coalesce(p_payment_method,'cash'), p_payment_date, p_reference_number, p_notes, p_received_by, p_idempotency_key)
  returning * into v_payment;

  update public.invoices set
    amount_paid = v_amount_paid,
    balance = v_balance,
    status = case when v_balance <= 0 then 'paid' else 'partially_paid' end,
    updated_at = now()
  where id = p_invoice_id;

  return next v_payment;
exception
  when unique_violation then
    if p_idempotency_key is not null then
      select * into v_payment from public.payments where idempotency_key = p_idempotency_key limit 1;
      if found then return next v_payment; return; end if;
    end if;
    raise;
end;
$$;

grant execute on function public.record_payment(integer, integer, numeric, text, text, text, text, text, text) to service_role;
