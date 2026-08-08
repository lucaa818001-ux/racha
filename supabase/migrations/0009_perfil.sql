create table unlocked_logros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logro_key text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, logro_key)
);

alter table unlocked_logros enable row level security;

create policy "Users manage their own unlocked logros"
  on unlocked_logros for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('profile_photos', 'profile_photos', false);

create policy "Users manage their own profile photo"
  on storage.objects for all
  using (bucket_id = 'profile_photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile_photos' and (storage.foldername(name))[1] = auth.uid()::text);
