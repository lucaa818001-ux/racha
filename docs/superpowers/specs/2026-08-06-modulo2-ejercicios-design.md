# Racha — Módulo 2: Ejercicios — Design

## Contexto
Módulo pendiente del README (Módulo 2), construido después de Racha, Físico y Objetivos. Permite crear ejercicios propios, organizarlos en carpetas libres, registrar sesiones (series) y ver la evolución en el tiempo. Las carpetas duplican como "rutinas": opcionalmente pueden llevar orden y objetivo de series/reps por ejercicio, sin ser una entidad separada. Detección automática de récord personal queda fuera de esta primera vuelta.

## Alcance
1. Crear ejercicios propios: nombre, grupo muscular, tipo (peso/reps o tiempo), descanso de referencia (opcional), foto propia (opcional).
2. Carpetas libres (nombre a elección, ej: "Pecho", "Lunes"): un ejercicio puede pertenecer a varias carpetas a la vez.
3. Rutinas (extensión de carpetas): dentro de una carpeta, cada ejercicio puede tener opcionalmente un número de orden y un objetivo (series objetivo + reps objetivo, o series objetivo + duración objetivo si es tipo tiempo). Si no se completan, la carpeta funciona sin orden ni objetivo, como una carpeta simple.
4. Registrar sesión: elegir cantidad de series, cargar peso×reps (o duración si es tipo tiempo) por serie, fecha automática (hoy). Si el ejercicio tiene objetivo definido en la carpeta desde la que se abrió, la cantidad de series y los valores de reps/duración vienen pre-completados (editables).
5. Ver historial de sesiones de un ejercicio + gráfica de evolución.
6. Imagen del ejercicio: la foto propia si se subió (opcional, la elige el usuario); si no subió nada, un emoji de referencia según el grupo muscular (sin fotos ni ilustraciones provistas por la app).

## Fuera de alcance
- Detección automática de récord personal.
- Cronómetro de descanso activo (el descanso es solo un dato de referencia, no una cuenta regresiva).
- Ilustraciones o fotos generadas/provistas por nosotros para los ejercicios (ni por IA ni bajadas de internet). Si el usuario no sube su propia foto, no se muestra ninguna imagen — solo un emoji de referencia según el grupo muscular (ver "Imagen del ejercicio").
- Modo "entrenar ahora" (asistente que recorre los ejercicios de una rutina en secuencia dentro de una sola pantalla).

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
```
- `orden`, `target_sets`, `target_reps`, `target_duration_seg` son todos opcionales (nullable). Se completan desde la vista de una carpeta (ver "Pantallas y archivos"), no al crear el ejercicio.
- `target_reps` se usa si el ejercicio es tipo `peso_reps`; `target_duration_seg` si es tipo `tiempo`. Nunca se completan los dos para el mismo ejercicio.
- Dentro de una carpeta, los ejercicios se ordenan por `orden` ascendente (los que no tienen `orden` van al final, en el orden en que se agregaron).

### Storage
- Bucket nuevo `exercise_photos` (mismo patrón que `body_photos`): fotos propias subidas al crear un ejercicio, acceso vía URL firmada.

## Imagen del ejercicio
- No generamos ni proveemos ninguna foto o ilustración de los ejercicios. Al crear un ejercicio, el usuario puede opcionalmente subir su propia foto (cámara o galería) — es responsabilidad suya elegir una imagen para su propio uso personal.
- Si no subió foto, se muestra un emoji de referencia según `exercise.muscle_group` (mapeo fijo en código, sin assets nuevos): `pecho: 🎽`, `espalda: 🧍`, `cuadriceps: 🦵`, `isquios_gluteos: 🍑`, `hombros: 🤷`, `biceps: 💪`, `triceps: 🦾`, `core: 🔥`, `cardio: ❤️`, `otro: 🏋️`.
- Prioridad de visualización: `exercise.photo_path` si existe, si no, el emoji de `exercise.muscle_group`.

## Cálculo de "mejor marca" por sesión
Nuevo archivo `src/lib/exerciciosCalculo.js`, funciones puras y testeables:
- `mejorMarcaSesion(sets, type) => number`:
  - Tipo `peso_reps`: devuelve el `weight` máximo entre los sets de esa sesión (para graficar evolución de fuerza).
  - Tipo `tiempo`: devuelve la suma de `duration_seg` de todos los sets de esa sesión (tiempo total trabajado ese día).
- Usada para armar los puntos de la gráfica de evolución (un punto por sesión, usando `date` + `mejorMarcaSesion`).

## Pantallas y archivos
- Reemplazar `src/screens/EjerciciosScreen.js`: fila fija "Todos los ejercicios" + lista de carpetas (nombre + cantidad de ejercicios), botón "+ Nueva carpeta" (mismo estilo de icono-botón que Objetivo/Físico).
- Crear `src/lib/exercises.js`: `getFolders(userId)`, `createFolder(userId, name)`, `deleteFolder(folderId)`, `getExercises(userId, folderId | null)` (null = todos; si `folderId` no es null, cada ejercicio devuelto incluye `orden`, `target_sets`, `target_reps`, `target_duration_seg` de esa carpeta, ordenados por `orden` ascendente con los `null` al final), `createExercise(userId, {name, muscleGroup, type, restSeconds, photoUri, folderIds})`, `deleteExercise(exerciseId)`, `updateFolderItem(exerciseId, folderId, {orden, targetSets, targetReps, targetDurationSeg})`, `getExerciseLogs(exerciseId)`, `createExerciseLog(exerciseId, userId, {date, sets})`.
- Crear `src/components/ListaEjerciciosModal.js`: modal lista→detalle. Lista muestra ejercicios de la carpeta (o todos), cada fila con mini-imagen + nombre + tipo. Si se abrió desde una carpeta (no "Todos"), cada fila tiene un botón chico "Editar en esta carpeta" que abre `EditarObjetivoCarpetaModal`. Botón "+ Crear ejercicio" abre `CrearEjercicioModal`. Tocar un ejercicio (fuera del botón de editar) pasa a la vista de detalle dentro del mismo modal (imagen grande, descanso de referencia, gráfica, historial de sesiones, botón "Registrar sesión"); si se llegó desde una carpeta, la vista de detalle recuerda esa carpeta para pasarle el objetivo a `RegistrarSesionModal`.
- Crear `src/components/CrearEjercicioModal.js`: nombre, dropdown de grupo muscular, toggle tipo (peso/reps o tiempo), input de descanso en segundos (opcional), selector de foto (opcional, mismo patrón que `RegistrarFisicoModal`), checkboxes de carpetas (multi-selección, incluye la carpeta actual preseleccionada si se abrió desde una carpeta). No incluye orden ni objetivo — eso se completa después, desde la carpeta.
- Crear `src/components/EditarObjetivoCarpetaModal.js`: input numérico de orden, input de series objetivo, e input de reps objetivo o duración objetivo según `exercise.type`. Guarda vía `updateFolderItem`.
- Crear `src/components/RegistrarSesionModal.js`: recibe `objetivo` opcional (`{sets, reps, durationSeg}`). Si viene, pre-completa el selector de cantidad de series con `objetivo.sets` y cada fila con `objetivo.reps` o `objetivo.durationSeg` (editable). Si no viene, arranca vacío como hoy. Selector de cantidad de series (1-8), filas de peso+reps (o duración), fecha automática, guarda vía `createExerciseLog`.
- Crear `src/components/EjercicioChart.js`: gráfica hand-rolled SVG (mismo patrón que `WeightChart`/`ObjetivoChart`) con un punto por sesión usando `mejorMarcaSesion`.
- Crear `src/components/DiagramaMusculo.js`: muestra la foto propia si existe (con `getSignedUrl`), si no, el emoji de `muscle_group` (mapeo fijo, sin assets nuevos).

## Manejo de errores
- Si falla crear/guardar/borrar cualquier entidad: alerta simple, sin dejar estado a medias (mismo patrón que Objetivo/Físico).
- Borrar una carpeta borra solo las filas de `exercise_folder_items` correspondientes (por `on delete cascade`), nunca los ejercicios.
- Borrar un ejercicio con sesiones registradas pide confirmación extra (se pierde el historial); sin sesiones, borra directo.

## Testing
- `mejorMarcaSesion` se testea con Jest: casos tipo `peso_reps` (varios sets, encuentra el máximo) y tipo `tiempo` (suma de duraciones), casos con un solo set, caso con sets vacíos.
- El resto (formularios, carpetas, navegación, imágenes) se verifica a mano en el iPhone, como en los módulos anteriores.
