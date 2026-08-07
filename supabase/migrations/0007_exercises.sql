create table exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text not null check (muscle_group in (
    'pecho', 'espalda', 'cuadriceps', 'isquios_gluteos', 'hombros',
    'biceps', 'triceps', 'core', 'cardio', 'otro'
  )),
  type text not null check (type in ('peso_reps', 'tiempo')),
  rest_seconds integer,
  photo_path text,
  created_at timestamptz not null default now()
);

alter table exercises enable row level security;

create policy "Users manage their own exercises"
  on exercises for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table exercise_logs (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  sets jsonb not null,
  created_at timestamptz not null default now()
);

alter table exercise_logs enable row level security;

create policy "Users manage their own exercise logs"
  on exercise_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table exercise_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table exercise_folders enable row level security;

create policy "Users manage their own folders"
  on exercise_folders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table exercise_folder_items (
  exercise_id uuid not null references exercises(id) on delete cascade,
  folder_id uuid not null references exercise_folders(id) on delete cascade,
  orden integer,
  target_sets integer,
  target_reps integer,
  target_duration_seg integer,
  primary key (exercise_id, folder_id)
);

alter table exercise_folder_items enable row level security;

create policy "Users manage their own folder items"
  on exercise_folder_items for all
  using (exists (
    select 1 from exercises e where e.id = exercise_id and e.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from exercises e where e.id = exercise_id and e.user_id = auth.uid()
  ));

insert into storage.buckets (id, name, public)
values ('exercise_photos', 'exercise_photos', false);

create policy "Users manage their own exercise photos"
  on storage.objects for all
  using (bucket_id = 'exercise_photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'exercise_photos' and (storage.foldername(name))[1] = auth.uid()::text);
