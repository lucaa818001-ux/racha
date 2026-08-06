alter table goals add column status text not null default 'activo' check (status in ('activo', 'completado', 'cancelado'));
alter table goals add column ended_at date;

alter table goals drop constraint goals_user_id_key;

create unique index goals_un_activo_por_usuario
  on goals (user_id)
  where status = 'activo';
