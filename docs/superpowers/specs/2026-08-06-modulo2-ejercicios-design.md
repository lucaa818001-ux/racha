# Racha — Módulo 2: Ejercicios — Design

## Contexto
Módulo pendiente del README (Módulo 2), construido después de Racha, Físico y Objetivos. Permite crear ejercicios propios, organizarlos en carpetas libres, registrar sesiones (series) y ver la evolución en el tiempo. Rutinas/plantillas formales y récord personal automático quedan fuera de esta primera vuelta (la idea de "carpetas" cubre parte de esa necesidad de organización sin la complejidad de plantillas estructuradas).

## Alcance
1. Crear ejercicios propios: nombre, grupo muscular, tipo (peso/reps o tiempo), descanso de referencia (opcional), foto propia (opcional).
2. Carpetas libres (nombre a elección, ej: "Pecho", "Lunes"): un ejercicio puede pertenecer a varias carpetas a la vez.
3. Registrar sesión: elegir cantidad de series, cargar peso×reps (o duración si es tipo tiempo) por serie, fecha automática (hoy).
4. Ver historial de sesiones de un ejercicio + gráfica de evolución.
5. Imagen del ejercicio: la foto propia si se subió, si no, una ilustración genérica según el grupo muscular.

## Fuera de alcance
- Rutinas/plantillas estructuradas (secuencia de ejercicios con series/reps predefinidas).
- Detección automática de récord personal.
- Cronómetro de descanso activo (el descanso es solo un dato de referencia, no una cuenta regresiva).
- Generación de imagen por IA específica para cada ejercicio individual (se usa una ilustración genérica por grupo muscular, ver sección "Imagen del ejercicio").

## Datos

### Tabla `exercises`
```sql
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
```

### Tabla `exercise_logs`
```sql
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
```
- Si `exercises.type = 'peso_reps'`: `sets = [{weight, reps}, ...]`.
- Si `exercises.type = 'tiempo'`: `sets = [{duration_seg}, ...]`.

### Tabla `exercise_folders`
```sql
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
```

### Tabla puente `exercise_folder_items`
```sql
create table exercise_folder_items (
  exercise_id uuid not null references exercises(id) on delete cascade,
  folder_id uuid not null references exercise_folders(id) on delete cascade,
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
```

### Storage
- Bucket nuevo `exercise_photos` (mismo patrón que `body_photos`): fotos propias subidas al crear un ejercicio, acceso vía URL firmada.

## Imagen del ejercicio
- Se generan 10 ilustraciones (una por `muscle_group`) con un modelo de generación de imágenes, mostrando una persona genérica haciendo un ejercicio representativo de esa zona con el músculo resaltado en color cobalto (`#4C6EF5`) sobre fondo oscuro (`#0D0D12`), estilo flat/vectorial consistente. Se generan una sola vez durante la implementación y quedan como assets bundleados en la app (sin costo ni dependencia externa en tiempo de uso).
- Al crear un ejercicio, el usuario puede opcionalmente subir su propia foto (cámara o galería) — reemplaza la ilustración genérica para ese ejercicio puntual. Es responsabilidad del usuario elegir una imagen para su propio uso personal.
- Prioridad de visualización: `exercise.photo_path` si existe, si no, la ilustración de `exercise.muscle_group`.
- Referencia para ampliar el catálogo más adelante (fuera de esta implementación): un prompt de texto para generar ilustraciones adicionales por ejercicio específico vía Claude Design, ya compartido con el usuario en la conversación de diseño.

## Cálculo de "mejor marca" por sesión
Nuevo archivo `src/lib/exerciciosCalculo.js`, funciones puras y testeables:
- `mejorMarcaSesion(sets, type) => number`:
  - Tipo `peso_reps`: devuelve el `weight` máximo entre los sets de esa sesión (para graficar evolución de fuerza).
  - Tipo `tiempo`: devuelve la suma de `duration_seg` de todos los sets de esa sesión (tiempo total trabajado ese día).
- Usada para armar los puntos de la gráfica de evolución (un punto por sesión, usando `date` + `mejorMarcaSesion`).

## Pantallas y archivos
- Reemplazar `src/screens/EjerciciosScreen.js`: fila fija "Todos los ejercicios" + lista de carpetas (nombre + cantidad de ejercicios), botón "+ Nueva carpeta" (mismo estilo de icono-botón que Objetivo/Físico).
- Crear `src/lib/exercises.js`: `getFolders(userId)`, `createFolder(userId, name)`, `deleteFolder(folderId)`, `getExercises(userId, folderId | null)` (null = todos), `createExercise(userId, {name, muscleGroup, type, restSeconds, photoUri, folderIds})`, `deleteExercise(exerciseId)`, `getExerciseLogs(exerciseId)`, `createExerciseLog(exerciseId, userId, {date, sets})`.
- Crear `src/components/ListaEjerciciosModal.js`: modal lista→detalle. Lista muestra ejercicios de la carpeta (o todos), cada fila con mini-imagen + nombre + tipo. Botón "+ Crear ejercicio" abre `CrearEjercicioModal`. Tocar un ejercicio pasa a la vista de detalle dentro del mismo modal (imagen grande, descanso de referencia, gráfica, historial de sesiones, botón "Registrar sesión").
- Crear `src/components/CrearEjercicioModal.js`: nombre, dropdown de grupo muscular, toggle tipo (peso/reps o tiempo), input de descanso en segundos (opcional), selector de foto (opcional, mismo patrón que `RegistrarFisicoModal`), checkboxes de carpetas (multi-selección, incluye la carpeta actual preseleccionada si se abrió desde una carpeta).
- Crear `src/components/RegistrarSesionModal.js`: selector de cantidad de series (1-8), filas de peso+reps (o duración), fecha automática, guarda vía `createExerciseLog`.
- Crear `src/components/EjercicioChart.js`: gráfica hand-rolled SVG (mismo patrón que `WeightChart`/`ObjetivoChart`) con un punto por sesión usando `mejorMarcaSesion`.
- Crear `src/components/DiagramaMusculo.js`: muestra la foto propia si existe, si no, la ilustración bundleada según `muscle_group`.
- Assets nuevos: `assets/musculos/{pecho,espalda,cuadriceps,isquios_gluteos,hombros,biceps,triceps,core,cardio,otro}.png` (las 10 ilustraciones generadas).

## Manejo de errores
- Si falla crear/guardar/borrar cualquier entidad: alerta simple, sin dejar estado a medias (mismo patrón que Objetivo/Físico).
- Borrar una carpeta borra solo las filas de `exercise_folder_items` correspondientes (por `on delete cascade`), nunca los ejercicios.
- Borrar un ejercicio con sesiones registradas pide confirmación extra (se pierde el historial); sin sesiones, borra directo.

## Testing
- `mejorMarcaSesion` se testea con Jest: casos tipo `peso_reps` (varios sets, encuentra el máximo) y tipo `tiempo` (suma de duraciones), casos con un solo set, caso con sets vacíos.
- El resto (formularios, carpetas, navegación, imágenes) se verifica a mano en el iPhone, como en los módulos anteriores.
