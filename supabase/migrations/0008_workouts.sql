truncate table exercises, exercise_folders cascade;

create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references exercise_folders(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table workouts enable row level security;

create policy "Users manage their own workouts"
  on workouts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table exercise_logs
  add column workout_id uuid not null references workouts(id) on delete cascade;

alter table exercise_logs
  add constraint exercise_logs_workout_exercise_unique unique (workout_id, exercise_id);
