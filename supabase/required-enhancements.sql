-- Additive migration for outpatient numbers and dental-record integrity.
-- Safe to run after migration.sql / an existing production database.

alter table public.patients
  add column if not exists outpatient_number text;

create unique index if not exists patients_outpatient_number_uidx
  on public.patients (outpatient_number)
  where outpatient_number is not null;

create or replace function public.allocate_outpatient_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_year integer := extract(year from current_date)::integer;
  next_number integer;
begin
  perform pg_advisory_xact_lock(hashtext('outpatient-number-' || target_year::text));

  select coalesce(max(
    case
      when outpatient_number ~ '^OP-[0-9]{6}-[0-9]{4}$'
       and substring(outpatient_number from '[0-9]{4}$')::integer = target_year
      then substring(outpatient_number from '^OP-([0-9]{6})')::integer
      else 0
    end
  ), 0) + 1
  into next_number
  from public.patients;

  return 'OP-' || lpad(next_number::text, 6, '0') || '-' || target_year::text;
end;
$$;

create or replace function public.patients_assign_outpatient_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.outpatient_number is null or btrim(new.outpatient_number) = '' then
    new.outpatient_number := public.allocate_outpatient_number();
  else
    new.outpatient_number := upper(btrim(new.outpatient_number));
  end if;
  return new;
end;
$$;

drop trigger if exists patients_assign_outpatient_number on public.patients;
create trigger patients_assign_outpatient_number
before insert or update of outpatient_number on public.patients
for each row
execute function public.patients_assign_outpatient_number();

-- Backfill existing patients without changing any other patient fields or history.
do $$
declare
  patient_row record;
begin
  for patient_row in
    select id
    from public.patients
    where outpatient_number is null or btrim(outpatient_number) = ''
    order by id
    for update
  loop
    update public.patients
    set outpatient_number = public.allocate_outpatient_number()
    where id = patient_row.id
      and (outpatient_number is null or btrim(outpatient_number) = '');
  end loop;
end;
$$;

-- Ensure the dental-record columns used by the API exist in an older database.
-- These are additive only and preserve all existing dental records.
alter table public.dental_records
  add column if not exists record_date text;

alter table public.dental_records
  add column if not exists tooth_number text;

alter table public.dental_records
  add column if not exists diagnosis text;

alter table public.dental_records
  add column if not exists treatment_plan text;

alter table public.dental_records
  add column if not exists notes text;

alter table public.dental_records
  add column if not exists status text;

alter table public.dental_records
  add column if not exists created_by text;

alter table public.dental_records
  add column if not exists updated_at timestamptz default now();

update public.dental_records
set record_date = coalesce(record_date, created_at::date::text),
    status = coalesce(status, 'open')
where record_date is null or status is null;
WHE