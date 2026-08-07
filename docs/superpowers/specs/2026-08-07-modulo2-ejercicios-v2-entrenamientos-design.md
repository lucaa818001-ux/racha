# Racha — Módulo Ejercicios v2: Entrenamientos — Design

## Contexto
Reemplaza el modelo de la primera versión del módulo (`2026-08-06-modulo2-ejercicios-design.md`), donde cada sesión se registraba de forma aislada por ejercicio. El usuario probó esa versión y la sintió pobre e incompleta comparada con apps de gimnasio populares (Strong, Hevy), que giran alrededor de un **entrenamiento** (workout) que agrupa varios ejercicios en una sola sesión, con cronómetro de descanso activo y un resumen al finalizar.

Los datos de ejercicios/carpetas/sesiones cargados hasta ahora son de prueba y se descartan como parte de esta migración.

## Alcance
1. Un **entrenamiento** (`workout`) agrupa una o más sesiones de ejercicio bajo una fecha de inicio/fin. Se puede empezar vacío o a partir de una rutina.
2. Las carpetas pasan a llamarse **rutinas** en la interfaz (misma tabla `exercise_folders` por dentro).
3. Pantalla principal (dashboard): botón "Empezar entrenamiento", rutinas con inicio rápido, feed de entrenamientos recientes, accesos a la biblioteca de ejercicios y a administrar rutinas.
4. Entrenamiento en curso: cronómetro de duración, lista de ejercicios agregados (de la rutina elegida o sueltos), carga de series sin salir de la pantalla, cronómetro de descanso activo entre series, "Finalizar" con resumen, "Cancelar".
5. Cronómetro de descanso: cuenta regresiva visible en pantalla + vibración al terminar + notificación local como respaldo si el teléfono está bloqueado/en segundo plano.
6. Historial y gráfica por ejercicio: siguen existiendo, ahora alimentados por todas las sesiones de todos los entrenamientos donde se hizo ese ejercicio.
7. Si la app se cierra con un entrenamiento sin finalizar, al volver a abrir la pestaña Ejercicios se retoma automáticamente.

## Fuera de alcance
- Detección automática de récord personal como notificación push separada (se muestra solo en el resumen del entrenamiento, no como alerta en tiempo real mientras cargás la serie).
- Editar un entrenamiento ya finalizado (agregar/sacar series después de cerrarlo).
- Compartir o exportar entrenamientos.
- Ajustar el tiempo de descanso "sobre la marcha" con botones +15s/-15s (se puede saltar el descanso entero, pero no ajustarlo).
- Minimizar el entrenamiento en curso para navegar a otras pestañas mientras sigue corriendo (queda anclado a la pestaña Ejercicios; las otras pestañas siguen usables, el cronómetro de duración total se recalcula por diferencia de tiempo así que no se pierde precisión si el usuario cambia de pestaña y vuelve).

## Datos

### Migración: limpiar datos de prueba y agregar `workouts`
```sql
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
```
- `truncate ... cascade` sobre `exercises` y `exercise_folders` limpia también `exercise_folder_items` y `exercise_logs` (que tienen foreign keys hacia esas tablas), dejando las 4 tablas en cero.
- `exercise_logs` sigue teniendo `date` (se completa con la fecha del entrenamiento al guardar) para no tocar `EjercicioChart.js`, que ya espera `{date, sets}` por fila.
- La restricción única `(workout_id, exercise_id)` habilita usar upsert: como máximo una fila de `exercise_logs` por ejercicio dentro de un mismo entrenamiento, y esa fila va acumulando series en su columna `sets` (jsonb) a medida que se cargan.
- `exercise_folders`/`exercise_folder_items` no cambian de estructura, solo de nombre visible ("Rutina" en vez de "Carpeta").

## Cálculos puros
Nuevo archivo `src/lib/workoutsCalculo.js`, funciones puras y testeables:
- `calcularDuracionMinutos(startedAt, endedAt) => number`: minutos redondeados entre `started_at` y `ended_at` (ambos `Date`).
- `calcularVolumenTotal(entradas) => number`: `entradas` es `{type, sets}[]` (una por ejercicio logueado en el entrenamiento). Para las de tipo `peso_reps`, suma `weight * reps` de cada set; las de tipo `tiempo` no aportan a este número (se reporta aparte).
- `calcularTiempoTotalSegundos(entradas) => number`: suma `duration_seg` de todos los sets de las entradas tipo `tiempo`.
- `esRecordPersonal(marcaNueva, mejorMarcaAnterior) => boolean`: `true` si `mejorMarcaAnterior` no es `null` y `marcaNueva > mejorMarcaAnterior`. Si no hay marca anterior (primera vez que se hace ese ejercicio), devuelve `false` (no cuenta como récord la primera vez).
- Reutiliza `mejorMarcaSesion` (ya existente en `src/lib/exerciciosCalculo.js`) para obtener la marca de cada ejercicio dentro del entrenamiento y compararla contra su historial previo.

## Cronómetro de descanso
- Componente `src/components/DescansoTimer.js`: recibe `segundos` (número) y `onFinalizar` (callback). Cuenta regresiva con `setInterval` mostrada como banner fijo abajo de la pantalla de entrenamiento en curso (no es un `<Modal>`, es contenido normal, así que no hay riesgo de anidamiento).
- Al llegar a 0: `Vibration.vibrate()` (API nativa de React Native, sin dependencia nueva) para aviso inmediato si la app está en primer plano, y además se programó al arrancar el cronómetro una notificación local (`expo-notifications`, ya es dependencia del proyecto y ya se usa en `src/lib/recordatorio.js`) con `trigger` a esa misma hora, como respaldo si el usuario bloqueó el teléfono o cambió de app. Se cancela esa notificación si el usuario toca "Saltar descanso" antes de que llegue la hora.
- Se dispara automáticamente después de guardar una serie nueva, usando el `rest_seconds` del ejercicio (si no tiene, no se muestra cronómetro para ese ejercicio).
- Botón "Saltar descanso" para cerrarlo antes de tiempo.

## Pantallas y componentes

### `src/lib/workouts.js` (nuevo, acceso a datos)
- `startWorkout(userId, folderId | null) => Promise<workout>`
- `finishWorkout(workoutId) => Promise<void>` (setea `ended_at`)
- `cancelWorkout(workoutId) => Promise<void>` (borra la fila, cascada borra sus `exercise_logs`)
- `getActiveWorkout(userId) => Promise<workout | null>` (el que tiene `ended_at` nulo, si existe)
- `getRecentWorkouts(userId, limite) => Promise<workout[]>` (finalizados, más recientes primero, con sus `exercise_logs` embebidos incluyendo `exercises(name, type)` para que el dashboard arme el resumen)
- `upsertWorkoutExerciseLog(workoutId, exerciseId, userId, {date, sets}) => Promise<log>` (usa `onConflict: 'workout_id,exercise_id'` para actualizar la fila si ya existe)
- `getWorkoutExerciseLogs(workoutId) => Promise<log[]>` (con `exercises(name, type, muscle_group, photo_path, rest_seconds)` embebido, para reconstruir la pantalla de entrenamiento en curso si se retoma)

### Modificar `src/lib/exercises.js`
- Se elimina `createExerciseLog` (la reemplaza `upsertWorkoutExerciseLog` de `workouts.js`). El resto de las funciones no cambia.

### Modificar `src/components/ListaEjerciciosModal.js` → renombrar a `src/components/BibliotecaEjerciciosModal.js`
- Se elimina la vista `registrarSesion` y todo su estado/handlers asociados (`cantidadSeries`, `sets`, `guardandoSesion`, `abrirRegistrarSesion`, `cambiarCantidadSeries`, `actualizarSet`, `repetirEnTodas`) — registrar series ahora solo pasa dentro de un entrenamiento activo.
- La vista `detalle` pierde el botón "Registrar sesión"; conserva imagen, descanso de referencia, gráfica e historial (borrado de ejercicio).
- El resto (`lista`, `crear`, `catalogo`, `editarObjetivo`) queda igual.
- Actualizar el import en `EjerciciosDashboard.js` (ver abajo) al nuevo nombre de archivo/componente.

### Crear `src/components/AgregarEjercicioModal.js`
- Modal propio (seguro: se abre desde `EntrenamientoActivo`, que no es un modal). Dos pestañas simples (chips arriba, no tabs de navegación): "Del catálogo" (lista `CATALOGO_EJERCICIOS` agrupada por músculo, igual que la vista `catalogo` de la biblioteca) y "Mis ejercicios" (lista los ya creados por el usuario vía `getExercises(userId, null)`).
- Tocar un ítem del catálogo pre-completa un mini formulario (nombre/músculo/tipo, editable) con botón "Crear y agregar" que llama `createExercise` y después agrega el ejercicio resultante a la lista local del entrenamiento en curso.
- Tocar un ítem de "Mis ejercicios" lo agrega directo a la lista local del entrenamiento (sin crear nada nuevo).

### Crear `src/components/EntrenamientoActivo.js`
- Recibe el `workout` activo y su lista inicial de ejercicios (si viene de una rutina, pre-poblada desde `getExercises(userId, folderId)`; si es vacío, arranca sin ejercicios).
- Encabezado: cronómetro de duración total (`Date.now() - workout.started_at`, actualizado cada segundo con `setInterval`), botón "Finalizar".
- Por cada ejercicio en la lista local: tarjeta con nombre, imagen/emoji (`DiagramaMusculo`), las series ya cargadas (peso×reps o duración), un formulario para cargar la próxima serie (mismos inputs que la vieja vista `registrarSesion`, pero una serie a la vez en vez de elegir cantidad de antemano) y botón "+ Agregar serie" que llama `upsertWorkoutExerciseLog` con el array de sets actualizado y dispara `DescansoTimer` si el ejercicio tiene `rest_seconds`.
- Botón "+ Agregar ejercicio" al final de la lista, abre `AgregarEjercicioModal`.
- "Finalizar" (confirmación): llama `finishWorkout`, calcula resumen con `workoutsCalculo.js` (duración, cantidad de ejercicios, series totales, volumen total, tiempo total tipo-tiempo, récords nuevos comparando cada `mejorMarcaSesion` de este entrenamiento contra el mejor histórico previo de ese ejercicio vía `getExerciseLogs`), lo muestra en un `Alert.alert` multi-línea (mismo patrón que el resumen de cierre de Objetivo), y vuelve al dashboard.
- "Cancelar entrenamiento" (confirmación destructiva): llama `cancelWorkout`, vuelve al dashboard sin guardar nada.

### Crear `src/components/EjerciciosDashboard.js`
- Botón grande "▶ Empezar entrenamiento" (vacío) arriba.
- Lista de rutinas (`getFolders`), cada fila con nombre + cantidad de ejercicios + botón "▶" que llama `startWorkout(userId, folder.id)`; tocar el resto de la fila abre `BibliotecaEjerciciosModal` con `folderId` de esa rutina (para editarla: agregar ejercicios, orden, objetivos).
- Botón "+ Nueva rutina" (reutiliza `CrearCarpetaModal`, ahora con el label "Nueva rutina").
- Botón "📋 Todos mis ejercicios" que abre `BibliotecaEjerciciosModal` con `folderId: null`.
- Sección "Entrenamientos recientes": `getRecentWorkouts(userId, 5)`, cada tarjeta con fecha, duración (`calcularDuracionMinutos`), cantidad de ejercicios distintos, volumen total (`calcularVolumenTotal`). Sin detalle expandible en esta primera vuelta — son solo tarjetas de resumen.

### Modificar `src/screens/EjerciciosScreen.js`
- Se reduce a orquestador: en el `useFocusEffect`, además de `userId`, busca `getActiveWorkout(userId)`.
- Si hay entrenamiento activo: renderiza `<EntrenamientoActivo workout={...} ... />`.
- Si no: renderiza `<EjerciciosDashboard userId={...} ... />`.
- `startWorkout`/`finishWorkout`/`cancelWorkout` actualizan el estado local para cambiar entre ambas vistas sin recargar toda la pantalla.

## Manejo de errores
- Igual que en la v1: alertas simples sin dejar estado a medias.
- Si falla `upsertWorkoutExerciseLog` al cargar una serie, se muestra alerta y la serie no se agrega a la lista local (para que lo que se ve en pantalla siempre refleje lo guardado).
- Si el usuario cierra la app en medio de un entrenamiento, al reabrir se reconstruye la pantalla de entrenamiento en curso desde `getActiveWorkout` + `getWorkoutExerciseLogs` (las series ya guardadas se recuperan; las que estaba por cargar en el formulario, no, ya que nunca llegaron a guardarse).

## Testing
- `workoutsCalculo.js` se testea con Jest: `calcularDuracionMinutos` (casos redondeo), `calcularVolumenTotal` (mezcla de tipos, entradas vacías), `esRecordPersonal` (supera la marca, no la supera, sin marca anterior).
- El resto (pantallas, cronómetro, flujo de entrenamiento) se verifica a mano en el iPhone, como en los módulos anteriores.
