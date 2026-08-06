create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('bajar', 'subir')),
  target_value numeric not null,
  target_date date,
  start_value numeric not null,
  start_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table goals enable row level security;

create policy "Users manage their own goal"
  on goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
