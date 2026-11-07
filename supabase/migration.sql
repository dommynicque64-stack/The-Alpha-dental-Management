-- ═══════════════════════════════════════════════════════════════════
-- DentalCare · Supabase migration (run in the SQL editor, top to bottom)
-- Creates tables, indexes, RLS (deny-by-default), the appointment-overlap
-- guard trigger, and seed data (staff roles, settings, demo clinic data).
-- Idempotent: safe to re-run (uses IF NOT EXISTS / ON CONFLICT).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Tables ─────────────────────────────────────────────────────────

create table if not exists clinic_staff (
  id serial primary key,
  user_id text,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('admin','dentist','receptionist','accountant')),
  phone text,
  specialty text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now()
);

create table if not exists patients (
  id serial primary key,
  first_name text not null,
  last_name text not null,
  date_of_birth text,
  gender text,
  phone text not null,
  email text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  blood_type text,
  allergies text,
  medical_history text,
  insurance_provider text,
  insurance_number text,
  patient_type text not null default 'outpatient' check (patient_type in ('outpatient','inpatient')),
  status text not null default 'active' check (status in ('active','archived')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists appointments (
  id serial primary key,
  patient_id integer not null references patients(id) on delete cascade,
  dentist_id integer not null references clinic_staff(id) on delete restrict,
  appointment_date text not null,
  start_time text not null,
  end_time text not null,
  reason text,
  status text not null default 'scheduled'
    check (status in ('scheduled','confirmed','in_progress','completed','cancelled','no_show')),
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table if not exists dental_records (
  id serial primary key,
  patient_id integer not null references patients(id) on delete cascade,
  dentist_id integer references clinic_staff(id) on delete set null,
  record_date text not null,
  tooth_number text,
  diagnosis text not null,
  treatment_plan text,
  notes text,
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists treatments (
  id serial primary key,
  patient_id integer not null references patients(id) on delete cascade,
  dentist_id integer references clinic_staff(id) on delete set null,
  appointment_id integer references appointments(id) on delete set null,
  procedure_name text not null,
  tooth_number text,
  treatment_date text not null,
  cost numeric not null default 0,
  status text not null default 'planned'
    check (status in ('planned','in_progress','completed','cancelled')),
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists prescriptions (
  id serial primary key,
  patient_id integer not null references patients(id) on delete cascade,
  dentist_id integer references clinic_staff(id) on delete set null,
  medication text not null,
  dosage text,
  frequency text,
  duration text,
  instructions text,
  prescribed_date text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id serial primary key,
  invoice_number text not null unique,
  patient_id integer not null references patients(id) on delete cascade,
  treatment_id integer references treatments(id) on delete set null,
  original_amount numeric(12,2),
  discount_amount numeric(12,2) not null default 0,
  total_amount numeric not null default 0,
  amount_paid numeric not null default 0,
  balance numeric not null default 0,
  status text not null default 'unpaid'
    check (status in ('unpaid','partially_paid','paid','overdue')),
  issue_date text not null,
  due_date text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id serial primary key,
  invoice_id integer not null references invoices(id) on delete cascade,
  patient_id integer not null references patients(id) on delete cascade,
  amount numeric not null check (amount > 0),
  payment_method text not null default 'cash',
  payment_date text not null,
  reference_number text,
  notes text,
  received_by text,
  created_at timestamptz not null default now(),
  idempotency_key text
);

create unique index if not exists payments_idempotency_key_uidx
  on payments(idempotency_key) where idempotency_key is not null;

create table if not exists documents (
  id serial primary key,
  patient_id integer not null references patients(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  storage_path text,
  file_type text,
  file_size integer,
  document_type text not null default 'other',
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

create table if not exists notifications (
  id serial primary key,
  title text not null,
  message text not null,
  type text not null default 'general',
  related_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists clinic_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

-- ── 2. Indexes ────────────────────────────────────────────────────────

create index if not exists idx_staff_email on clinic_staff (email);
create index if not exists idx_staff_user on clinic_staff (user_id);
create index if not exists idx_patients_name on patients (last_name, first_name);
create index if not exists idx_patients_phone on patients (phone);
create index if not exists idx_appt_dentist_day on appointments (dentist_id, appointment_date);
create index if not exists idx_appt_patient on appointments (patient_id);
create index if not exists idx_records_patient on dental_records (patient_id);
create index if not exists idx_treatments_patient on treatments (patient_id);
create index if not exists idx_rx_patient on prescriptions (patient_id);
create index if not exists idx_invoices_patient on invoices (patient_id);
create index if not exists idx_payments_invoice on payments (invoice_id);
create index if not exists idx_docs_patient on documents (patient_id);

-- ── 3. Overlap guard (database level) ─────────────────────────────────
-- No two non-cancelled appointments for the same dentist on the same day
-- may overlap in [start_time, end_time). The API enforces this too and
-- returns HTTP 409; this trigger is the final guarantee.

create or replace function check_appointment_overlap()
returns trigger as $$
begin
  if NEW.status <> 'cancelled' then
    if exists (
      select 1 from appointments a
      where a.dentist_id = NEW.dentist_id
        and a.appointment_date = NEW.appointment_date
        and a.status <> 'cancelled'
        and (NEW.id is null or a.id <> NEW.id)
        and NEW.start_time < a.end_time
        and a.start_time < NEW.end_time
    ) then
      raise exception 'Overlapping appointment for dentist % on % (%–%)',
        NEW.dentist_id, NEW.appointment_date, NEW.start_time, NEW.end_time;
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists prevent_appointment_overlap on appointments;
create trigger prevent_appointment_overlap
  before insert or update on appointments
  for each row execute function check_appointment_overlap();

-- ── 4. Row-Level Security (deny anonymous; service role enforces RBAC) ─
-- The Vercel API uses the service-role key and enforces the role matrix in
-- code (api/auth-helper.js). These policies deny direct anon-key access so
-- the API layer is the only data path.

alter table clinic_staff    enable row level security;
alter table patients        enable row level security;
alter table appointments    enable row level security;
alter table dental_records  enable row level security;
alter table treatments      enable row level security;
alter table prescriptions   enable row level security;
alter table invoices        enable row level security;
alter table payments        enable row level security;
alter table documents       enable row level security;
alter table notifications   enable row level security;
alter table clinic_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'clinic_staff','patients','appointments','dental_records','treatments',
    'prescriptions','invoices','payments','documents','notifications','clinic_settings'
  ] loop
    execute format('drop policy if exists deny_anon_all on %I', t);
    execute format('create policy deny_anon_all on %I for all to anon using (false) with check (false)', t);
    execute format('drop policy if exists deny_authenticated_direct on %I', t);
    execute format(
      'create policy deny_authenticated_direct on %I for all to authenticated using (false) with check (false)', t
    );
  end loop;
end $$;

-- ── 5. Seed: staff roles ──────────────────────────────────────────────

insert into clinic_staff (full_name, email, role, phone, specialty, status) values
  ('Dr. Sarah Mitchell', 'admin@dentalcare.com',      'admin',        '+254712000001', 'Clinic Director', 'active'),
  ('Dr. James Mwangi',   'dentist@dentalcare.com',    'dentist',      '+254712000002', 'Orthodontics',    'active'),
  ('Dr. Amina Odhiambo', 'dentist2@dentalcare.com',   'dentist',      '+254712000003', 'Endodontics',     'active'),
  ('Grace Wanjiku',      'reception@dentalcare.com',  'receptionist', '+254712000004', null,              'active'),
  ('Peter Kamau',        'accounts@dentalcare.com',   'accountant',   '+254712000005', null,              'active')
on conflict (email) do update set
  full_name = excluded.full_name, role = excluded.role,
  phone = excluded.phone, specialty = excluded.specialty, status = excluded.status;

-- ── 6. Seed: clinic settings ──────────────────────────────────────────

insert into clinic_settings (key, value) values
  ('clinic_name', 'DentalCare Clinic'),
  ('software_name', 'Alpha Dental Management'),
  ('theme', 'original'),
  ('logo_url', ''),
  ('clinic_address', 'Kimathi Street, Nairobi, Kenya'),
  ('clinic_phone', '+254712000000'),
  ('clinic_email', 'info@dentalcare.com'),
  ('clinic_website', ''),
  ('working_hours', 'Mon–Sat 08:00–18:00'),
  ('currency', 'KES'),
  ('appointment_slot_minutes', '30'),
  ('mpesa_paybill', 'Coming soon — M-Pesa integration'),
  ('sms_reminders', 'Coming soon — SMS reminders')
on conflict (key) do nothing;

-- ── 7. Storage bucket ────────────────────────────────────────────────
-- Patient documents contain sensitive clinical information, so keep the
-- bucket private. The server uses the secret key to upload and issue
-- time-limited signed URLs after authorization.
insert into storage.buckets (id, name, public)
values ('patient-documents', 'patient-documents', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('clinic-assets', 'clinic-assets', true)
on conflict (id) do update set public = true;


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
