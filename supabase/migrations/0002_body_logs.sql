create table body_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight numeric not null,
  height numeric not null,
  photo_path text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table body_logs enable row level security;

create policy "Users manage their own body logs"
  on body_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('body_photos', 'body_photos', false);

create policy "Users manage their own body photos"
  on storage.objects for all
  using (bucket_id = 'body_photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'body_photos' and (storage.foldername(name))[1] = auth.uid()::text);
