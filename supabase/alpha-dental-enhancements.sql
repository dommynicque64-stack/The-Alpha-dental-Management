-- Alpha Dental Management enhancements (safe additive migration)
alter table public.patients add column if not exists consent_acknowledged boolean not null default false;
alter table public.patients add column if not exists consent_text text;
alter table public.patients add column if not exists consent_signature text;
alter table public.patients add column if not exists consent_signed_at timestamptz;

-- The existing address column and values are preserved; only the UI label changes.
\ninsert into public.clinic_settings (key, value) values ('software_name','Alpha Dental Management') on conflict (key) do nothing;\n