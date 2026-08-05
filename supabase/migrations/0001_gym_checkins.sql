create table gym_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  photo_path text not null,
  racha_dia integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table gym_checkins enable row level security;

create policy "Users manage their own checkins"
  on gym_checkins for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('checkins', 'checkins', false);

create policy "Users manage their own checkin photos"
  on storage.objects for all
  using (bucket_id = 'checkins' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'checkins' and (storage.foldername(name))[1] = auth.uid()::text);
