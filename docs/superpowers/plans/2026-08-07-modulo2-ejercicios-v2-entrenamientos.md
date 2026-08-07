# Módulo Ejercicios v2 (Entrenamientos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-exercise-session model with a workout-centric model (inspired by Strong/Hevy): a workout groups multiple exercises logged in one sitting, with an active rest timer, a finish-workout summary, and a dashboard with quick-start routines and a recent-workouts feed.

**Architecture:** `workoutsCalculo.js` holds pure, unit-tested aggregation functions (duration, volume, PR detection) with no Supabase dependency. `workouts.js` mirrors the existing `exercises.js`/`bodyLogs.js` data-access pattern. `EjerciciosScreen.js` becomes a thin orchestrator that renders either `EjerciciosDashboard` (no active workout) or `EntrenamientoActivo` (active workout) — both plain screen content, not modals, so the "add exercise mid-workout" flow can safely use its own `<Modal>` without the nested-modal risk that shaped `ListaEjerciciosModal.js`'s single-modal design in v1. The old `ListaEjerciciosModal.js` is renamed to `BibliotecaEjerciciosModal.js` and loses its `registrarSesion` view, since logging now only happens inside an active workout.

**Tech Stack:** Supabase (Postgres + Storage, additive-then-destructive migration wiping test data), `expo-notifications` (already a dependency, already used in `src/lib/recordatorio.js`), React Native `Vibration` (core API, no new dependency).

## Global Constraints

- Todos los datos actuales de `exercises`, `exercise_folders`, `exercise_folder_items`, `exercise_logs` son de prueba y se borran como parte de la migración — from design doc.
- Cada fila de `exercise_logs` pertenece siempre a un `workout_id` (no nulo); como máximo una fila por `(workout_id, exercise_id)` — from design doc.
- Las carpetas (`exercise_folders`) se llaman "Rutinas" en toda la interfaz nueva — from design doc.
- El cronómetro de descanso vibra y programa una notificación local de respaldo; se puede saltar antes de tiempo — from design doc.
- No hay modo para minimizar el entrenamiento en curso y navegar a otra pestaña — queda anclado a la pestaña Ejercicios hasta finalizar o cancelar — from design doc.
- Ningún componente que se abra desde dentro de otro modal puede ser su propio `<Modal>` — from design doc (lección del bug de Físico). `EntrenamientoActivo` y `EjerciciosDashboard` son screen content (no modales), así que `AgregarEjercicioModal` (abierto desde `EntrenamientoActivo`) y `BibliotecaEjerciciosModal`/`CrearCarpetaModal` (abiertos desde `EjerciciosDashboard`) son todos seguros como `<Modal>` propios — nunca hay dos abiertos a la vez.

---

## File Structure

- Create: `supabase/migrations/0008_workouts.sql` — wipe test data + `workouts` table + `exercise_logs.workout_id`.
- Create: `src/lib/workoutsCalculo.js` — pure aggregation functions.
- Create: `src/lib/workouts.js` — Supabase data access for workouts.
- Modify: `src/lib/exercises.js` — remove `createExerciseLog`.
- Create: `src/components/DescansoTimer.js` — rest countdown + vibration + local notification.
- Delete: `src/components/ListaEjerciciosModal.js` / Create: `src/components/BibliotecaEjerciciosModal.js` — exercise/routine management, minus session logging.
- Create: `src/components/AgregarEjercicioModal.js` — mid-workout exercise picker.
- Create: `src/components/EntrenamientoActivo.js` — live workout screen content.
- Create: `src/components/EjerciciosDashboard.js` — home dashboard screen content.
- Modify: `src/screens/EjerciciosScreen.js` — thin orchestrator switching between the two.

---

## Task 1: Wipe test data and add `workouts`

**Files:**
- Create: `supabase/migrations/0008_workouts.sql`

**Interfaces:**
- Produces: table `workouts(id, user_id, folder_id, started_at, ended_at, created_at)` with RLS; `exercise_logs.workout_id` (not null, FK to `workouts`, cascade delete) plus a unique constraint on `(workout_id, exercise_id)`. Task 3 (`workouts.js`) depends on this.

- [ ] **Step 1: Write and apply the migration**

Create `supabase/migrations/0008_workouts.sql`:
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

Use the Supabase MCP tool `apply_migration` with `project_id: "holaqwecblmdgefeulrr"`, `name: "workouts"`, and that SQL.

- [ ] **Step 2: Verify**

Use `list_tables` with `project_id: "holaqwecblmdgefeulrr"`. Expected: `workouts` appears with RLS enabled; `exercise_logs` has a new `workout_id` column. Use `execute_sql` to confirm `exercises`, `exercise_folders`, `exercise_folder_items`, `exercise_logs` all have 0 rows after the truncate.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_workouts.sql
git commit -m "feat: add workouts table, wipe test data"
```

---

## Task 2: Workout aggregation calculations (TDD)

**Files:**
- Create: `src/lib/workoutsCalculo.js`
- Create: `src/lib/workoutsCalculo.test.js`

**Interfaces:**
- Produces:
  - `calcularDuracionMinutos(startedAt: Date, endedAt: Date) => number`
  - `calcularVolumenTotal(entradas: {type, sets}[]) => number`
  - `calcularTiempoTotalSegundos(entradas: {type, sets}[]) => number`
  - `esRecordPersonal(marcaNueva: number, mejorMarcaAnterior: number|null) => boolean`
  Task 8 (`EntrenamientoActivo`) and Task 9 (`EjerciciosDashboard`) depend on these.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/workoutsCalculo.test.js`:
```javascript
import {
  calcularDuracionMinutos,
  calcularVolumenTotal,
  calcularTiempoTotalSegundos,
  esRecordPersonal,
} from './workoutsCalculo';

test('calcularDuracionMinutos redondea los minutos transcurridos', () => {
  const inicio = new Date('2026-08-07T10:00:00');
  const fin = new Date('2026-08-07T10:45:30');
  expect(calcularDuracionMinutos(inicio, fin)).toBe(46);
});

test('calcularDuracionMinutos con menos de un minuto redondea a 0', () => {
  const inicio = new Date('2026-08-07T10:00:00');
  const fin = new Date('2026-08-07T10:00:20');
  expect(calcularDuracionMinutos(inicio, fin)).toBe(0);
});

test('calcularVolumenTotal suma peso x reps solo de las entradas peso_reps', () => {
  const entradas = [
    { type: 'peso_reps', sets: [{ weight: 40, reps: 10 }, { weight: 40, reps: 8 }] },
    { type: 'tiempo', sets: [{ duration_seg: 60 }] },
  ];
  expect(calcularVolumenTotal(entradas)).toBe(720);
});

test('calcularVolumenTotal con entradas vacias devuelve 0', () => {
  expect(calcularVolumenTotal([])).toBe(0);
});

test('calcularTiempoTotalSegundos suma la duracion solo de las entradas tiempo', () => {
  const entradas = [
    { type: 'tiempo', sets: [{ duration_seg: 60 }, { duration_seg: 30 }] },
    { type: 'peso_reps', sets: [{ weight: 40, reps: 10 }] },
  ];
  expect(calcularTiempoTotalSegundos(entradas)).toBe(90);
});

test('esRecordPersonal es true cuando supera la marca anterior', () => {
  expect(esRecordPersonal(55, 50)).toBe(true);
});

test('esRecordPersonal es false cuando no supera la marca anterior', () => {
  expect(esRecordPersonal(45, 50)).toBe(false);
});

test('esRecordPersonal es false cuando no hay marca anterior', () => {
  expect(esRecordPersonal(45, null)).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- workoutsCalculo`
Expected: FAIL with "Cannot find module './workoutsCalculo'"

- [ ] **Step 3: Write the implementation**

Create `src/lib/workoutsCalculo.js`:
```javascript
export function calcularDuracionMinutos(startedAt, endedAt) {
  const ms = endedAt.getTime() - startedAt.getTime();
  return Math.round(ms / (1000 * 60));
}

export function calcularVolumenTotal(entradas) {
  return entradas
    .filter((e) => e.type === 'peso_reps')
    .reduce((total, e) => total + e.sets.reduce((sub, s) => sub + s.weight * s.reps, 0), 0);
}

export function calcularTiempoTotalSegundos(entradas) {
  return entradas
    .filter((e) => e.type === 'tiempo')
    .reduce((total, e) => total + e.sets.reduce((sub, s) => sub + s.duration_seg, 0), 0);
}

export function esRecordPersonal(marcaNueva, mejorMarcaAnterior) {
  if (mejorMarcaAnterior === null || mejorMarcaAnterior === undefined) return false;
  return marcaNueva > mejorMarcaAnterior;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- workoutsCalculo`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workoutsCalculo.js src/lib/workoutsCalculo.test.js
git commit -m "feat: add workout aggregation calculations"
```

---

## Task 3: Data access — `src/lib/workouts.js`

**Files:**
- Create: `src/lib/workouts.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (talks directly to Supabase, same pattern as `exercises.js`). Depends on the `workouts` table and `exercise_logs.workout_id` from Task 1.
- Produces:
  - `startWorkout(userId, folderId: string|null) => Promise<{id, folder_id, started_at, ended_at}>`
  - `finishWorkout(workoutId) => Promise<void>`
  - `cancelWorkout(workoutId) => Promise<void>`
  - `getActiveWorkout(userId) => Promise<{id, folder_id, started_at, ended_at} | null>`
  - `getRecentWorkouts(userId, limite) => Promise<{id, started_at, ended_at, exercise_logs: {sets, exercises: {type}}[]}[]>`
  - `upsertWorkoutExerciseLog(workoutId, exerciseId, userId, {date: Date, sets}) => Promise<{id, sets, ...}>`
  - `getWorkoutExerciseLogs(workoutId) => Promise<{id, sets, exercises: {id, name, muscle_group, type, rest_seconds, photo_path}}[]>`
  Task 8 (`EntrenamientoActivo`), Task 9 (`EjerciciosDashboard`), and Task 10 (`EjerciciosScreen`) use these.

- [ ] **Step 1: Implement**

Create `src/lib/workouts.js`:
```javascript
import { supabase } from './supabase';

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function startWorkout(userId, folderId) {
  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: userId, folder_id: folderId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function finishWorkout(workoutId) {
  const { error } = await supabase
    .from('workouts')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', workoutId);
  if (error) throw error;
}

export async function cancelWorkout(workoutId) {
  const { error } = await supabase.from('workouts').delete().eq('id', workoutId);
  if (error) throw error;
}

export async function getActiveWorkout(userId) {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, folder_id, started_at, ended_at')
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRecentWorkouts(userId, limite) {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, started_at, ended_at, exercise_logs(sets, exercises(type))')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data;
}

export async function upsertWorkoutExerciseLog(workoutId, exerciseId, userId, { date, sets }) {
  const { data, error } = await supabase
    .from('exercise_logs')
    .upsert(
      { workout_id: workoutId, exercise_id: exerciseId, user_id: userId, date: formatDate(date), sets },
      { onConflict: 'workout_id,exercise_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getWorkoutExerciseLogs(workoutId) {
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('id, sets, exercises(id, name, muscle_group, type, rest_seconds, photo_path)')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/workouts.js
git commit -m "feat: add workouts data access module"
```

---

## Task 4: Retire `createExerciseLog` from `exercises.js`

**Files:**
- Modify: `src/lib/exercises.js:149-157` (remove `createExerciseLog`)

**Interfaces:**
- Produces: `exercises.js` no longer exports `createExerciseLog` (replaced by `workouts.js`'s `upsertWorkoutExerciseLog`). All other exports (`getFolders, createFolder, deleteFolder, getExercises, createExercise, deleteExercise, updateFolderItem, getExerciseLogs, getSignedExercisePhotoUrl`) are unchanged.

- [ ] **Step 1: Remove the function and its now-unused helper**

In `src/lib/exercises.js`, delete this block (currently lines 149-157):
```javascript
export async function createExerciseLog(exerciseId, userId, { date, sets }) {
  const { data, error } = await supabase
    .from('exercise_logs')
    .insert({ exercise_id: exerciseId, user_id: userId, date: formatDate(date), sets })
    .select()
    .single();
  if (error) throw error;
  return data;
}

```
Also delete the `formatDate` helper near the top of the file (currently lines 7-12):
```javascript
function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

```
`createExerciseLog` was its only caller in this file — grep the file for `formatDate` after deleting to confirm no other reference remains before removing it.

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: PASS, all existing suites unaffected (this file has no tests of its own, this is a sanity check for syntax errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/exercises.js
git commit -m "refactor: remove createExerciseLog, replaced by workouts.js"
```

---

## Task 5: `src/components/DescansoTimer.js`

**Files:**
- Create: `src/components/DescansoTimer.js`

**Interfaces:**
- Produces: `<DescansoTimer segundos={number} onFinalizar={() => void} />`. Task 8 (`EntrenamientoActivo`) uses this.

- [ ] **Step 1: Implement**

Create `src/components/DescansoTimer.js`:
```javascript
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { colors } from '../theme/colors';

export default function DescansoTimer({ segundos, onFinalizar }) {
  const [restante, setRestante] = useState(segundos);
  const notificationIdRef = useRef(null);

  useEffect(() => {
    setRestante(segundos);
    const finEn = Date.now() + segundos * 1000;

    async function programarAviso() {
      let permiso = await Notifications.getPermissionsAsync();
      if (permiso.status !== 'granted') {
        permiso = await Notifications.requestPermissionsAsync();
        if (permiso.status !== 'granted') return;
      }
      const disparo = new Date(finEn);
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: 'Descanso terminado', body: 'Volvé a la próxima serie 💪', sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: disparo },
      });
      notificationIdRef.current = id;
    }
    programarAviso();

    const intervalo = setInterval(() => {
      const quedan = Math.max(0, Math.round((finEn - Date.now()) / 1000));
      setRestante(quedan);
      if (quedan <= 0) {
        clearInterval(intervalo);
        Vibration.vibrate();
        onFinalizar();
      }
    }, 1000);

    return () => {
      clearInterval(intervalo);
      if (notificationIdRef.current) {
        Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
        notificationIdRef.current = null;
      }
    };
  }, [segundos]);

  function saltar() {
    if (notificationIdRef.current) {
      Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
      notificationIdRef.current = null;
    }
    onFinalizar();
  }

  const minutos = Math.floor(restante / 60);
  const segs = restante % 60;
  const texto = `${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;

  return (
    <View style={styles.contenedor}>
      <Text style={styles.texto}>⏱ Descanso: {texto}</Text>
      <Pressable onPress={saltar}>
        <Text style={styles.saltar}>Saltar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cobalto,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  texto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 15 },
  saltar: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 14, textDecorationLine: 'underline' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DescansoTimer.js
git commit -m "feat: add rest timer with vibration and local notification"
```

---

## Task 6: `src/components/BibliotecaEjerciciosModal.js` (rename from `ListaEjerciciosModal.js`, drop session logging)

**Files:**
- Delete: `src/components/ListaEjerciciosModal.js`
- Create: `src/components/BibliotecaEjerciciosModal.js`

**Interfaces:**
- Consumes: `getExercises, createExercise, deleteExercise, updateFolderItem, getExerciseLogs` from `exercises.js`; `DiagramaMusculo`, `EjercicioChart`, `CATALOGO_EJERCICIOS` (all unchanged from v1).
- Produces: `<BibliotecaEjerciciosModal visible userId folderId folderName folders ancho onClose onCambio />` — same props as the old `ListaEjerciciosModal`, minus any session-logging concern. Task 9 (`EjerciciosDashboard`) uses this.

- [ ] **Step 1: Delete the old file**

```bash
git rm src/components/ListaEjerciciosModal.js
```

- [ ] **Step 2: Create the new file**

Create `src/components/BibliotecaEjerciciosModal.js`:
```javascript
import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getExercises, createExercise, deleteExercise, updateFolderItem, getExerciseLogs } from '../lib/exercises';
import DiagramaMusculo from './DiagramaMusculo';
import EjercicioChart from './EjercicioChart';
import { CATALOGO_EJERCICIOS } from '../lib/catalogoEjercicios';
import { colors } from '../theme/colors';

const GRUPOS_MUSCULARES = [
  { key: 'pecho', label: 'Pecho' },
  { key: 'espalda', label: 'Espalda' },
  { key: 'cuadriceps', label: 'Cuádriceps' },
  { key: 'isquios_gluteos', label: 'Isquios/Glúteos' },
  { key: 'hombros', label: 'Hombros' },
  { key: 'biceps', label: 'Bíceps' },
  { key: 'triceps', label: 'Tríceps' },
  { key: 'core', label: 'Core' },
  { key: 'cardio', label: 'Cardio' },
  { key: 'otro', label: 'Otro' },
];

export default function BibliotecaEjerciciosModal({ visible, userId, folderId, folderName, folders, ancho, onClose, onCambio }) {
  const [vista, setVista] = useState('lista');
  const [cargando, setCargando] = useState(true);
  const [ejercicios, setEjercicios] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [logs, setLogs] = useState([]);

  const [nombre, setNombre] = useState('');
  const [muscleGroup, setMuscleGroup] = useState(null);
  const [tipo, setTipo] = useState('peso_reps');
  const [restSeconds, setRestSeconds] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [folderIdsSeleccionadas, setFolderIdsSeleccionadas] = useState([]);
  const [guardandoCrear, setGuardandoCrear] = useState(false);

  const [orden, setOrden] = useState('');
  const [targetSets, setTargetSets] = useState('');
  const [targetReps, setTargetReps] = useState('');
  const [targetDurationSeg, setTargetDurationSeg] = useState('');
  const [guardandoObjetivo, setGuardandoObjetivo] = useState(false);

  const cargarEjercicios = useCallback(async () => {
    setCargando(true);
    const data = await getExercises(userId, folderId);
    setEjercicios(data);
    setCargando(false);
  }, [userId, folderId]);

  useEffect(() => {
    if (!visible) return;
    setVista('lista');
    setSeleccionado(null);
    cargarEjercicios();
  }, [visible, cargarEjercicios]);

  async function abrirDetalle(ejercicio) {
    setSeleccionado(ejercicio);
    setVista('detalle');
    const data = await getExerciseLogs(ejercicio.id);
    setLogs(data);
  }

  function abrirEditarObjetivo(ejercicio) {
    setSeleccionado(ejercicio);
    setOrden(ejercicio.orden !== null && ejercicio.orden !== undefined ? String(ejercicio.orden) : '');
    setTargetSets(
      ejercicio.target_sets !== null && ejercicio.target_sets !== undefined ? String(ejercicio.target_sets) : ''
    );
    setTargetReps(
      ejercicio.target_reps !== null && ejercicio.target_reps !== undefined ? String(ejercicio.target_reps) : ''
    );
    setTargetDurationSeg(
      ejercicio.target_duration_seg !== null && ejercicio.target_duration_seg !== undefined
        ? String(ejercicio.target_duration_seg)
        : ''
    );
    setVista('editarObjetivo');
  }

  function abrirCrear() {
    setNombre('');
    setMuscleGroup(null);
    setTipo('peso_reps');
    setRestSeconds('');
    setPhotoUri(null);
    setFolderIdsSeleccionadas(folderId !== null ? [folderId] : []);
    setVista('crear');
  }

  function abrirCatalogo() {
    setVista('catalogo');
  }

  function elegirDeCatalogo(item) {
    setNombre(item.name);
    setMuscleGroup(item.muscleGroup);
    setTipo(item.type);
    setVista('crear');
  }

  function volver() {
    if (vista === 'catalogo') setVista('crear');
    else setVista('lista');
  }

  function toggleFolderSeleccionada(id) {
    setFolderIdsSeleccionadas((actual) => (actual.includes(id) ? actual.filter((f) => f !== id) : [...actual, id]));
  }

  async function elegirFoto(origen) {
    const permiso =
      origen === 'camara'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Activá el permiso correspondiente en Ajustes.');
      return;
    }
    const resultado =
      origen === 'camara'
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!resultado.canceled) setPhotoUri(resultado.assets[0].uri);
  }

  function elegirOrigenFoto() {
    Alert.alert('Agregar foto', '¿Cómo querés agregarla?', [
      { text: 'Tomar foto', onPress: () => elegirFoto('camara') },
      { text: 'Elegir de galería', onPress: () => elegirFoto('galeria') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function handleGuardarEjercicio() {
    setGuardandoCrear(true);
    try {
      await createExercise(userId, {
        name: nombre.trim(),
        muscleGroup,
        type: tipo,
        restSeconds: restSeconds.trim() !== '' ? Number(restSeconds) : null,
        photoUri,
        folderIds: folderIdsSeleccionadas,
      });
      await cargarEjercicios();
      onCambio?.();
      setVista('lista');
    } catch (e) {
      console.error('Error al crear ejercicio:', e.message, e);
      Alert.alert('Error', 'No se pudo crear el ejercicio, intentá de nuevo.');
    } finally {
      setGuardandoCrear(false);
    }
  }

  async function handleGuardarObjetivo() {
    setGuardandoObjetivo(true);
    try {
      await updateFolderItem(seleccionado.id, folderId, {
        orden: orden.trim() !== '' ? Number(orden) : null,
        targetSets: targetSets.trim() !== '' ? Number(targetSets) : null,
        targetReps: targetReps.trim() !== '' ? Number(targetReps) : null,
        targetDurationSeg: targetDurationSeg.trim() !== '' ? Number(targetDurationSeg) : null,
      });
      await cargarEjercicios();
      setVista('lista');
    } catch (e) {
      console.error('Error al guardar objetivo:', e.message, e);
      Alert.alert('Error', 'No se pudo guardar, intentá de nuevo.');
    } finally {
      setGuardandoObjetivo(false);
    }
  }

  function handleBorrarEjercicio() {
    const mensaje =
      logs.length > 0
        ? `"${seleccionado.name}" tiene ${logs.length} sesión(es) registradas que se van a perder. ¿Borrar de todas formas?`
        : `¿Borrar "${seleccionado.name}"?`;
    Alert.alert('Borrar ejercicio', mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteExercise(seleccionado.id, seleccionado.photo_path);
          await cargarEjercicios();
          onCambio?.();
          setVista('lista');
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.contenedor}>
        <View style={styles.encabezado}>
          {vista === 'lista' ? (
            <Text style={styles.titulo}>{folderName}</Text>
          ) : (
            <Pressable onPress={volver} hitSlop={12}>
              <Text style={styles.volver}>‹ {vista === 'catalogo' ? 'Crear ejercicio' : folderName}</Text>
            </Pressable>
          )}
          <View style={styles.encabezadoBotones}>
            {vista === 'lista' && (
              <Pressable onPress={abrirCrear} hitSlop={12}>
                <Text style={styles.masBoton}>➕</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.cerrar}>✕</Text>
            </Pressable>
          </View>
        </View>

        {vista === 'lista' &&
          (cargando ? (
            <ActivityIndicator size="large" color={colors.cobalto} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 22 }}>
              {ejercicios.length === 0 && (
                <View style={styles.vacioContenedor}>
                  <Text style={styles.vacioEmoji}>🏋️‍♂️</Text>
                  <Text style={styles.vacioTitulo}>Todavía no hay ejercicios acá</Text>
                  <Text style={styles.vacioSubtitulo}>Creá el primero o elegí uno de la lista</Text>
                </View>
              )}
              {ejercicios.map((ejercicio) => (
                <View key={ejercicio.id} style={styles.fila}>
                  <Pressable style={styles.filaContenido} onPress={() => abrirDetalle(ejercicio)}>
                    <DiagramaMusculo photoPath={ejercicio.photo_path} muscleGroup={ejercicio.muscle_group} tamano={44} />
                    <View style={styles.filaTextos}>
                      <Text style={styles.filaTitulo}>{ejercicio.name}</Text>
                      <Text style={styles.filaSubtitulo}>
                        {ejercicio.type === 'tiempo' ? 'Tiempo' : 'Peso/reps'}
                        {ejercicio.target_sets
                          ? ` · objetivo ${ejercicio.target_sets}x${
                              ejercicio.type === 'tiempo' ? `${ejercicio.target_duration_seg}s` : ejercicio.target_reps
                            }`
                          : ''}
                      </Text>
                    </View>
                  </Pressable>
                  {folderId !== null && (
                    <Pressable onPress={() => abrirEditarObjetivo(ejercicio)} hitSlop={8}>
                      <Text style={styles.editarTexto}>Editar</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </ScrollView>
          ))}

        {vista === 'detalle' && seleccionado && (
          <ScrollView contentContainerStyle={{ padding: 22 }}>
            <Text style={styles.tituloDetalle}>{seleccionado.name}</Text>
            <View style={styles.detalleCentro}>
              <DiagramaMusculo photoPath={seleccionado.photo_path} muscleGroup={seleccionado.muscle_group} tamano={120} />
            </View>
            {seleccionado.rest_seconds ? (
              <Text style={styles.descansoTexto}>⏱ Descanso de referencia: {seleccionado.rest_seconds}s</Text>
            ) : null}
            <EjercicioChart logs={logs} type={seleccionado.type} ancho={ancho} />
            <Text style={styles.subtitulo}>Historial</Text>
            {logs.length === 0 && <Text style={styles.sinEjercicios}>Todavía no registraste ninguna sesión.</Text>}
            {[...logs].reverse().map((log) => (
              <View key={log.id} style={styles.filaHistorial}>
                <Text style={styles.filaFecha}>{log.date}</Text>
                <Text style={styles.filaDetalle}>
                  {log.sets
                    .map((s) => (seleccionado.type === 'tiempo' ? `${s.duration_seg}s` : `${s.weight}kg×${s.reps}`))
                    .join(', ')}
                </Text>
              </View>
            ))}
            <Pressable style={styles.botonBorrar} onPress={handleBorrarEjercicio}>
              <Text style={styles.botonBorrarTexto}>Borrar ejercicio</Text>
            </Pressable>
          </ScrollView>
        )}

        {vista === 'crear' && (
          <ScrollView contentContainerStyle={{ padding: 22 }}>
            <Text style={styles.tituloDetalle}>Crear ejercicio</Text>
            <Pressable style={styles.fotoButton} onPress={abrirCatalogo}>
              <Text style={styles.fotoButtonTexto}>📋 Elegir de la lista</Text>
            </Pressable>
            <TextInput
              style={styles.input}
              placeholder="Nombre del ejercicio"
              placeholderTextColor={colors.textTertiary}
              value={nombre}
              onChangeText={setNombre}
            />
            <Text style={styles.etiqueta}>Grupo muscular</Text>
            <View style={styles.gridChips}>
              {GRUPOS_MUSCULARES.map((grupo) => (
                <Pressable
                  key={grupo.key}
                  style={[styles.chip, muscleGroup === grupo.key && styles.chipActivo]}
                  onPress={() => setMuscleGroup(grupo.key)}
                >
                  <Text style={styles.chipTexto}>{grupo.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.etiqueta}>Tipo</Text>
            <View style={styles.tipoFila}>
              <Pressable
                style={[styles.tipoBoton, tipo === 'peso_reps' && styles.tipoBotonActivo]}
                onPress={() => setTipo('peso_reps')}
              >
                <Text style={styles.tipoBotonTexto}>Peso/reps</Text>
              </Pressable>
              <Pressable
                style={[styles.tipoBoton, tipo === 'tiempo' && styles.tipoBotonActivo]}
                onPress={() => setTipo('tiempo')}
              >
                <Text style={styles.tipoBotonTexto}>Tiempo</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Descanso en segundos (opcional)"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              value={restSeconds}
              onChangeText={setRestSeconds}
            />
            <Pressable style={styles.fotoButton} onPress={elegirOrigenFoto}>
              <Text style={styles.fotoButtonTexto}>{photoUri ? 'Foto lista ✓' : 'Agregar foto (opcional)'}</Text>
            </Pressable>
            {folders.length > 0 && (
              <>
                <Text style={styles.etiqueta}>Rutinas</Text>
                <View style={styles.gridChips}>
                  {folders.map((folder) => (
                    <Pressable
                      key={folder.id}
                      style={[styles.chip, folderIdsSeleccionadas.includes(folder.id) && styles.chipActivo]}
                      onPress={() => toggleFolderSeleccionada(folder.id)}
                    >
                      <Text style={styles.chipTexto}>{folder.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            <Pressable
              style={[
                styles.guardarButton,
                (!nombre.trim() || !muscleGroup || guardandoCrear) && styles.guardarButtonDeshabilitado,
              ]}
              disabled={!nombre.trim() || !muscleGroup || guardandoCrear}
              onPress={handleGuardarEjercicio}
            >
              <Text style={styles.guardarButtonTexto}>{guardandoCrear ? 'Guardando...' : 'Guardar'}</Text>
            </Pressable>
          </ScrollView>
        )}

        {vista === 'catalogo' && (
          <ScrollView contentContainerStyle={{ padding: 22 }}>
            <Text style={styles.tituloDetalle}>Elegir de la lista</Text>
            {GRUPOS_MUSCULARES.map((grupo) => {
              const items = CATALOGO_EJERCICIOS.filter((item) => item.muscleGroup === grupo.key);
              if (items.length === 0) return null;
              return (
                <View key={grupo.key} style={{ marginBottom: 16 }}>
                  <Text style={styles.subtituloCatalogo}>{grupo.label}</Text>
                  {items.map((item) => (
                    <Pressable key={item.name} style={styles.filaCatalogo} onPress={() => elegirDeCatalogo(item)}>
                      <Text style={styles.filaCatalogoTexto}>{item.name}</Text>
                      <Text style={styles.flecha}>›</Text>
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        )}

        {vista === 'editarObjetivo' && seleccionado && (
          <ScrollView contentContainerStyle={{ padding: 22 }}>
            <Text style={styles.tituloDetalle}>Editar en esta rutina</Text>
            <TextInput
              style={styles.input}
              placeholder="Orden (ej: 1)"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              value={orden}
              onChangeText={setOrden}
            />
            <TextInput
              style={styles.input}
              placeholder="Series objetivo (ej: 4)"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              value={targetSets}
              onChangeText={setTargetSets}
            />
            {seleccionado.type === 'tiempo' ? (
              <TextInput
                style={styles.input}
                placeholder="Duración objetivo en segundos (ej: 60)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={targetDurationSeg}
                onChangeText={setTargetDurationSeg}
              />
            ) : (
              <TextInput
                style={styles.input}
                placeholder="Reps objetivo (ej: 8)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                value={targetReps}
                onChangeText={setTargetReps}
              />
            )}
            <Pressable
              style={[styles.guardarButton, guardandoObjetivo && styles.guardarButtonDeshabilitado]}
              disabled={guardandoObjetivo}
              onPress={handleGuardarObjetivo}
            >
              <Text style={styles.guardarButtonTexto}>{guardandoObjetivo ? 'Guardando...' : 'Guardar'}</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.background },
  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 22,
    paddingBottom: 16,
  },
  encabezadoBotones: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  titulo: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: colors.textPrimary },
  tituloDetalle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  volver: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.cobalto },
  masBoton: { fontSize: 20 },
  cerrar: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: colors.textPrimary },
  sinEjercicios: { fontFamily: 'Inter_400Regular', color: colors.textTertiary },
  vacioContenedor: { alignItems: 'center', paddingVertical: 40 },
  vacioEmoji: { fontSize: 48, marginBottom: 12 },
  vacioTitulo: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.textPrimary, marginBottom: 4 },
  vacioSubtitulo: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textTertiary },
  subtituloCatalogo: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 15,
    color: colors.cobalto,
    marginBottom: 8,
  },
  filaCatalogo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  filaCatalogoTexto: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textPrimary },
  flecha: { fontSize: 20, color: colors.textTertiary },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  filaContenido: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  filaTextos: { marginLeft: 12, flex: 1 },
  filaTitulo: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.textPrimary },
  filaSubtitulo: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  editarTexto: { fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.cobalto },
  detalleCentro: { alignItems: 'center', marginBottom: 16 },
  descansoTexto: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitulo: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: 24,
    marginBottom: 12,
  },
  filaHistorial: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 8 },
  filaFecha: { fontFamily: 'Inter_600SemiBold', color: colors.textPrimary, fontSize: 14 },
  filaDetalle: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  botonBorrar: {
    marginTop: 16,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  botonBorrarTexto: { fontFamily: 'Inter_500Medium', color: colors.racha.rojo, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  etiqueta: { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  gridChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActivo: { backgroundColor: colors.cobalto, borderColor: colors.cobalto },
  chipTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 13 },
  tipoFila: { flexDirection: 'row', marginBottom: 16, backgroundColor: colors.surface, borderRadius: 12, padding: 4 },
  tipoBoton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tipoBotonActivo: { backgroundColor: colors.cobalto },
  tipoBotonTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 13 },
  fotoButton: { borderRadius: 14, padding: 14, marginBottom: 16, backgroundColor: colors.surface, alignItems: 'center' },
  fotoButtonTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary },
  guardarButton: { borderRadius: 20, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.cobalto },
  guardarButtonDeshabilitado: { opacity: 0.5 },
  guardarButtonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: PASS, all existing suites unaffected.

- [ ] **Step 4: Commit**

```bash
git add -A src/components/ListaEjerciciosModal.js src/components/BibliotecaEjerciciosModal.js
git commit -m "refactor: rename ListaEjerciciosModal to BibliotecaEjerciciosModal, drop session logging"
```

---

## Task 7: `src/components/AgregarEjercicioModal.js`

**Files:**
- Create: `src/components/AgregarEjercicioModal.js`

**Interfaces:**
- Consumes: `getExercises, createExercise` from `exercises.js`; `CATALOGO_EJERCICIOS` from `catalogoEjercicios.js`.
- Produces: `<AgregarEjercicioModal visible userId onAgregar={(exercise) => void} onClose />`. Task 8 (`EntrenamientoActivo`) uses this. Safe as its own `<Modal>` — always opened from `EntrenamientoActivo`, which is plain screen content, never from within another modal.

- [ ] **Step 1: Implement**

Create `src/components/AgregarEjercicioModal.js`:
```javascript
import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { getExercises, createExercise } from '../lib/exercises';
import { CATALOGO_EJERCICIOS } from '../lib/catalogoEjercicios';
import { colors } from '../theme/colors';

const GRUPOS_MUSCULARES = [
  { key: 'pecho', label: 'Pecho' },
  { key: 'espalda', label: 'Espalda' },
  { key: 'cuadriceps', label: 'Cuádriceps' },
  { key: 'isquios_gluteos', label: 'Isquios/Glúteos' },
  { key: 'hombros', label: 'Hombros' },
  { key: 'biceps', label: 'Bíceps' },
  { key: 'triceps', label: 'Tríceps' },
  { key: 'core', label: 'Core' },
  { key: 'cardio', label: 'Cardio' },
  { key: 'otro', label: 'Otro' },
];

export default function AgregarEjercicioModal({ visible, userId, onAgregar, onClose }) {
  const [fuente, setFuente] = useState('mios');
  const [misEjercicios, setMisEjercicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [itemCatalogo, setItemCatalogo] = useState(null);
  const [nombre, setNombre] = useState('');
  const [muscleGroup, setMuscleGroup] = useState(null);
  const [tipo, setTipo] = useState('peso_reps');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setFuente('mios');
    setItemCatalogo(null);
    setCargando(true);
    getExercises(userId, null).then((data) => {
      setMisEjercicios(data);
      setCargando(false);
    });
  }, [visible, userId]);

  function elegirDeCatalogo(item) {
    setItemCatalogo(item);
    setNombre(item.name);
    setMuscleGroup(item.muscleGroup);
    setTipo(item.type);
  }

  function agregarYCerrar(ejercicio) {
    onAgregar(ejercicio);
    onClose();
  }

  async function handleCrearYAgregar() {
    setGuardando(true);
    try {
      const nuevo = await createExercise(userId, {
        name: nombre.trim(),
        muscleGroup,
        type: tipo,
        restSeconds: null,
        photoUri: null,
        folderIds: [],
      });
      agregarYCerrar(nuevo);
    } catch (e) {
      console.error('Error al crear ejercicio:', e.message, e);
      Alert.alert('Error', 'No se pudo crear el ejercicio, intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.contenedor}>
        <View style={styles.encabezado}>
          {itemCatalogo ? (
            <Pressable onPress={() => setItemCatalogo(null)} hitSlop={12}>
              <Text style={styles.volver}>‹ Catálogo</Text>
            </Pressable>
          ) : (
            <Text style={styles.titulo}>Agregar ejercicio</Text>
          )}
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.cerrar}>✕</Text>
          </Pressable>
        </View>

        {itemCatalogo ? (
          <ScrollView contentContainerStyle={{ padding: 22 }}>
            <TextInput
              style={styles.input}
              placeholder="Nombre del ejercicio"
              placeholderTextColor={colors.textTertiary}
              value={nombre}
              onChangeText={setNombre}
            />
            <Text style={styles.etiqueta}>Grupo muscular</Text>
            <View style={styles.gridChips}>
              {GRUPOS_MUSCULARES.map((grupo) => (
                <Pressable
                  key={grupo.key}
                  style={[styles.chip, muscleGroup === grupo.key && styles.chipActivo]}
                  onPress={() => setMuscleGroup(grupo.key)}
                >
                  <Text style={styles.chipTexto}>{grupo.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.etiqueta}>Tipo</Text>
            <View style={styles.tipoFila}>
              <Pressable
                style={[styles.tipoBoton, tipo === 'peso_reps' && styles.tipoBotonActivo]}
                onPress={() => setTipo('peso_reps')}
              >
                <Text style={styles.tipoBotonTexto}>Peso/reps</Text>
              </Pressable>
              <Pressable
                style={[styles.tipoBoton, tipo === 'tiempo' && styles.tipoBotonActivo]}
                onPress={() => setTipo('tiempo')}
              >
                <Text style={styles.tipoBotonTexto}>Tiempo</Text>
              </Pressable>
            </View>
            <Pressable
              style={[
                styles.guardarButton,
                (!nombre.trim() || !muscleGroup || guardando) && styles.guardarButtonDeshabilitado,
              ]}
              disabled={!nombre.trim() || !muscleGroup || guardando}
              onPress={handleCrearYAgregar}
            >
              <Text style={styles.guardarButtonTexto}>{guardando ? 'Agregando...' : 'Crear y agregar'}</Text>
            </Pressable>
          </ScrollView>
        ) : (
          <>
            <View style={styles.fuenteFila}>
              <Pressable
                style={[styles.fuenteBoton, fuente === 'mios' && styles.fuenteBotonActivo]}
                onPress={() => setFuente('mios')}
              >
                <Text style={styles.fuenteBotonTexto}>Mis ejercicios</Text>
              </Pressable>
              <Pressable
                style={[styles.fuenteBoton, fuente === 'catalogo' && styles.fuenteBotonActivo]}
                onPress={() => setFuente('catalogo')}
              >
                <Text style={styles.fuenteBotonTexto}>Catálogo</Text>
              </Pressable>
            </View>
            {fuente === 'mios' ? (
              cargando ? (
                <ActivityIndicator size="large" color={colors.cobalto} style={{ marginTop: 40 }} />
              ) : (
                <ScrollView contentContainerStyle={{ padding: 22 }}>
                  {misEjercicios.length === 0 && (
                    <Text style={styles.sinEjercicios}>Todavía no creaste ningún ejercicio propio.</Text>
                  )}
                  {misEjercicios.map((ejercicio) => (
                    <Pressable key={ejercicio.id} style={styles.filaCatalogo} onPress={() => agregarYCerrar(ejercicio)}>
                      <Text style={styles.filaCatalogoTexto}>{ejercicio.name}</Text>
                      <Text style={styles.flecha}>›</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )
            ) : (
              <ScrollView contentContainerStyle={{ padding: 22 }}>
                {GRUPOS_MUSCULARES.map((grupo) => {
                  const items = CATALOGO_EJERCICIOS.filter((item) => item.muscleGroup === grupo.key);
                  if (items.length === 0) return null;
                  return (
                    <View key={grupo.key} style={{ marginBottom: 16 }}>
                      <Text style={styles.subtituloCatalogo}>{grupo.label}</Text>
                      {items.map((item) => (
                        <Pressable key={item.name} style={styles.filaCatalogo} onPress={() => elegirDeCatalogo(item)}>
                          <Text style={styles.filaCatalogoTexto}>{item.name}</Text>
                          <Text style={styles.flecha}>›</Text>
                        </Pressable>
                      ))}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.background },
  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 22,
    paddingBottom: 16,
  },
  titulo: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: colors.textPrimary },
  volver: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.cobalto },
  cerrar: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: colors.textPrimary },
  fuenteFila: {
    flexDirection: 'row',
    marginHorizontal: 22,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  fuenteBoton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  fuenteBotonActivo: { backgroundColor: colors.cobalto },
  fuenteBotonTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 13 },
  sinEjercicios: { fontFamily: 'Inter_400Regular', color: colors.textTertiary },
  subtituloCatalogo: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: colors.cobalto, marginBottom: 8 },
  filaCatalogo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  filaCatalogoTexto: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textPrimary },
  flecha: { fontSize: 20, color: colors.textTertiary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  etiqueta: { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  gridChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActivo: { backgroundColor: colors.cobalto, borderColor: colors.cobalto },
  chipTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 13 },
  tipoFila: { flexDirection: 'row', marginBottom: 16, backgroundColor: colors.surface, borderRadius: 12, padding: 4 },
  tipoBoton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tipoBotonActivo: { backgroundColor: colors.cobalto },
  tipoBotonTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 13 },
  guardarButton: { borderRadius: 20, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.cobalto },
  guardarButtonDeshabilitado: { opacity: 0.5 },
  guardarButtonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AgregarEjercicioModal.js
git commit -m "feat: add mid-workout exercise picker modal"
```

---

## Task 8: `src/components/EntrenamientoActivo.js`

**Files:**
- Create: `src/components/EntrenamientoActivo.js`

**Interfaces:**
- Consumes: `upsertWorkoutExerciseLog, finishWorkout, cancelWorkout` from `workouts.js`; `getExerciseLogs` from `exercises.js`; `mejorMarcaSesion` from `exerciciosCalculo.js`; `calcularDuracionMinutos, calcularVolumenTotal, calcularTiempoTotalSegundos, esRecordPersonal` from `workoutsCalculo.js`; `DiagramaMusculo`; `DescansoTimer` (Task 5); `AgregarEjercicioModal` (Task 7).
- Produces: `<EntrenamientoActivo userId workout={{id, started_at, ...}} entradasIniciales={{exercise, sets, logId}[]} onFinalizado={() => void} onCancelado={() => void} />`. Task 10 (`EjerciciosScreen`) uses this. Not a `<Modal>` — plain screen content.

- [ ] **Step 1: Implement**

Create `src/components/EntrenamientoActivo.js`:
```javascript
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { upsertWorkoutExerciseLog, finishWorkout, cancelWorkout } from '../lib/workouts';
import { getExerciseLogs } from '../lib/exercises';
import { mejorMarcaSesion } from '../lib/exerciciosCalculo';
import {
  calcularDuracionMinutos,
  calcularVolumenTotal,
  calcularTiempoTotalSegundos,
  esRecordPersonal,
} from '../lib/workoutsCalculo';
import DiagramaMusculo from './DiagramaMusculo';
import DescansoTimer from './DescansoTimer';
import AgregarEjercicioModal from './AgregarEjercicioModal';
import { colors } from '../theme/colors';

export default function EntrenamientoActivo({ userId, workout, entradasIniciales, onFinalizado, onCancelado }) {
  const [entradas, setEntradas] = useState(entradasIniciales);
  const [inputsPendientes, setInputsPendientes] = useState({});
  const [descansoSegundos, setDescansoSegundos] = useState(null);
  const [agregarVisible, setAgregarVisible] = useState(false);
  const [ahora, setAhora] = useState(new Date());

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(intervalo);
  }, []);

  const segundosTranscurridos = Math.max(0, Math.floor((ahora - new Date(workout.started_at)) / 1000));
  const minutosTexto = String(Math.floor(segundosTranscurridos / 60)).padStart(2, '0');
  const segsTexto = String(segundosTranscurridos % 60).padStart(2, '0');

  function actualizarInputPendiente(exerciseId, cambios) {
    setInputsPendientes((actual) => ({ ...actual, [exerciseId]: { ...actual[exerciseId], ...cambios } }));
  }

  function agregarEjercicioAlWorkout(ejercicio) {
    setEntradas((actual) => [...actual, { exercise: ejercicio, sets: [], logId: null }]);
  }

  async function agregarSerie(entrada) {
    const pendiente = inputsPendientes[entrada.exercise.id] || {};
    const nuevoSet =
      entrada.exercise.type === 'tiempo'
        ? { duration_seg: Number(pendiente.duration_seg) || 0 }
        : { weight: Number(pendiente.weight) || 0, reps: Number(pendiente.reps) || 0 };
    const nuevosSets = [...entrada.sets, nuevoSet];
    try {
      const guardado = await upsertWorkoutExerciseLog(workout.id, entrada.exercise.id, userId, {
        date: new Date(),
        sets: nuevosSets,
      });
      setEntradas((actual) =>
        actual.map((e) => (e.exercise.id === entrada.exercise.id ? { ...e, sets: nuevosSets, logId: guardado.id } : e))
      );
      setInputsPendientes((actual) => ({ ...actual, [entrada.exercise.id]: {} }));
      if (entrada.exercise.rest_seconds) {
        setDescansoSegundos(entrada.exercise.rest_seconds);
      }
    } catch (e) {
      console.error('Error al guardar serie:', e.message, e);
      Alert.alert('Error', 'No se pudo guardar la serie, intentá de nuevo.');
    }
  }

  function handleFinalizar() {
    Alert.alert('Finalizar entrenamiento', '¿Terminaste tu entrenamiento?', [
      { text: 'Todavía no', style: 'cancel' },
      {
        text: 'Finalizar',
        onPress: async () => {
          try {
            await finishWorkout(workout.id);
            const finAhora = new Date();
            const duracion = calcularDuracionMinutos(new Date(workout.started_at), finAhora);
            const entradasConSets = entradas.filter((e) => e.sets.length > 0);
            const entradasConTipo = entradasConSets.map((e) => ({ type: e.exercise.type, sets: e.sets }));
            const volumen = calcularVolumenTotal(entradasConTipo);
            const tiempoTotal = calcularTiempoTotalSegundos(entradasConTipo);
            const totalSeries = entradasConSets.reduce((total, e) => total + e.sets.length, 0);

            const records = [];
            for (const entrada of entradasConSets) {
              const marcaNueva = mejorMarcaSesion(entrada.sets, entrada.exercise.type);
              const historial = await getExerciseLogs(entrada.exercise.id);
              const historialPrevio = historial.filter((log) => log.id !== entrada.logId);
              const marcasPrevias = historialPrevio.map((log) => mejorMarcaSesion(log.sets, entrada.exercise.type));
              const mejorPrevia = marcasPrevias.length > 0 ? Math.max(...marcasPrevias) : null;
              if (esRecordPersonal(marcaNueva, mejorPrevia)) records.push(entrada.exercise.name);
            }

            const resumen =
              `Duración: ${duracion} min\n` +
              `Ejercicios: ${entradasConSets.length}\n` +
              `Series totales: ${totalSeries}\n` +
              (volumen > 0 ? `Volumen total: ${volumen}kg\n` : '') +
              (tiempoTotal > 0 ? `Tiempo total: ${tiempoTotal}s\n` : '') +
              (records.length > 0 ? `🏆 Récord nuevo en: ${records.join(', ')}` : '');

            Alert.alert('¡Entrenamiento completado! 💪', resumen, [{ text: 'Listo', onPress: onFinalizado }]);
          } catch (e) {
            console.error('Error al finalizar entrenamiento:', e.message, e);
            Alert.alert('Error', 'No se pudo finalizar el entrenamiento, intentá de nuevo.');
          }
        },
      },
    ]);
  }

  function handleCancelar() {
    Alert.alert(
      'Cancelar entrenamiento',
      '¿Seguro que querés cancelar? Se pierde todo lo registrado en este entrenamiento.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelWorkout(workout.id);
              onCancelado();
            } catch (e) {
              console.error('Error al cancelar entrenamiento:', e.message, e);
              Alert.alert('Error', 'No se pudo cancelar, intentá de nuevo.');
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.contenedor}>
      <View style={styles.encabezado}>
        <Text style={styles.cronometro}>
          ⏱ {minutosTexto}:{segsTexto}
        </Text>
        <Pressable onPress={handleFinalizar}>
          <Text style={styles.finalizarTexto}>Finalizar</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 22 }}>
        {descansoSegundos !== null && (
          <DescansoTimer segundos={descansoSegundos} onFinalizar={() => setDescansoSegundos(null)} />
        )}
        {entradas.length === 0 && <Text style={styles.sinEjercicios}>Agregá tu primer ejercicio para arrancar.</Text>}
        {entradas.map((entrada) => {
          const pendiente = inputsPendientes[entrada.exercise.id] || {};
          return (
            <View key={entrada.exercise.id} style={styles.tarjeta}>
              <View style={styles.tarjetaEncabezado}>
                <DiagramaMusculo
                  photoPath={entrada.exercise.photo_path}
                  muscleGroup={entrada.exercise.muscle_group}
                  tamano={40}
                />
                <Text style={styles.tarjetaTitulo}>{entrada.exercise.name}</Text>
              </View>
              {entrada.sets.map((set, i) => (
                <Text key={i} style={styles.serieHecha}>
                  Serie {i + 1}: {entrada.exercise.type === 'tiempo' ? `${set.duration_seg}s` : `${set.weight}kg × ${set.reps}`}
                </Text>
              ))}
              <View style={styles.serieFila}>
                {entrada.exercise.type === 'tiempo' ? (
                  <TextInput
                    style={styles.serieInput}
                    placeholder="Segundos"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    value={pendiente.duration_seg || ''}
                    onChangeText={(valor) => actualizarInputPendiente(entrada.exercise.id, { duration_seg: valor })}
                  />
                ) : (
                  <>
                    <TextInput
                      style={styles.serieInput}
                      placeholder="Kg"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                      value={pendiente.weight || ''}
                      onChangeText={(valor) => actualizarInputPendiente(entrada.exercise.id, { weight: valor })}
                    />
                    <TextInput
                      style={styles.serieInput}
                      placeholder="Reps"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                      value={pendiente.reps || ''}
                      onChangeText={(valor) => actualizarInputPendiente(entrada.exercise.id, { reps: valor })}
                    />
                  </>
                )}
                <Pressable style={styles.agregarSerieBoton} onPress={() => agregarSerie(entrada)}>
                  <Text style={styles.agregarSerieTexto}>+ Serie</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        <Pressable style={styles.agregarEjercicioBoton} onPress={() => setAgregarVisible(true)}>
          <Text style={styles.agregarEjercicioTexto}>+ Agregar ejercicio</Text>
        </Pressable>
        <Pressable style={styles.cancelarBoton} onPress={handleCancelar}>
          <Text style={styles.cancelarTexto}>Cancelar entrenamiento</Text>
        </Pressable>
      </ScrollView>
      <AgregarEjercicioModal
        visible={agregarVisible}
        userId={userId}
        onAgregar={agregarEjercicioAlWorkout}
        onClose={() => setAgregarVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.background },
  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 22,
    paddingBottom: 16,
    backgroundColor: colors.surface,
  },
  cronometro: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: colors.textPrimary },
  finalizarTexto: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.cobalto },
  sinEjercicios: { fontFamily: 'Inter_400Regular', color: colors.textTertiary, marginBottom: 16 },
  tarjeta: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 12 },
  tarjetaEncabezado: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tarjetaTitulo: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.textPrimary, marginLeft: 10 },
  serieHecha: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  serieFila: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  serieInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  agregarSerieBoton: { backgroundColor: colors.cobalto, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  agregarSerieTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 13 },
  agregarEjercicioBoton: {
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginBottom: 12,
  },
  agregarEjercicioTexto: { fontFamily: 'Inter_600SemiBold', color: colors.cobalto, fontSize: 15 },
  cancelarBoton: { borderRadius: 20, paddingVertical: 14, alignItems: 'center' },
  cancelarTexto: { fontFamily: 'Inter_500Medium', color: colors.racha.rojo, fontSize: 14 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EntrenamientoActivo.js
git commit -m "feat: add live workout screen with set logging and rest timer"
```

---

## Task 9: `src/components/EjerciciosDashboard.js`

**Files:**
- Create: `src/components/EjerciciosDashboard.js`

**Interfaces:**
- Consumes: `createFolder, deleteFolder` from `exercises.js`; `getRecentWorkouts` from `workouts.js`; `calcularDuracionMinutos, calcularVolumenTotal` from `workoutsCalculo.js`; `CrearCarpetaModal`; `BibliotecaEjerciciosModal` (Task 6).
- Produces: `<EjerciciosDashboard userId folders ancho onEmpezar={(folderId: string|null) => void} onRecargarFolders={() => Promise<void>} />`. Task 10 (`EjerciciosScreen`) uses this.

- [ ] **Step 1: Implement**

Create `src/components/EjerciciosDashboard.js`:
```javascript
import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { createFolder, deleteFolder } from '../lib/exercises';
import { getRecentWorkouts } from '../lib/workouts';
import { calcularDuracionMinutos, calcularVolumenTotal } from '../lib/workoutsCalculo';
import CrearCarpetaModal from './CrearCarpetaModal';
import BibliotecaEjerciciosModal from './BibliotecaEjerciciosModal';
import { colors } from '../theme/colors';

function formatFecha(fechaStr) {
  const d = new Date(fechaStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function EjerciciosDashboard({ userId, folders, ancho, onEmpezar, onRecargarFolders }) {
  const [crearCarpetaVisible, setCrearCarpetaVisible] = useState(false);
  const [bibliotecaVisible, setBibliotecaVisible] = useState(false);
  const [carpetaAbierta, setCarpetaAbierta] = useState(null);
  const [recientes, setRecientes] = useState([]);

  useEffect(() => {
    getRecentWorkouts(userId, 5).then(setRecientes);
  }, [userId]);

  async function handleCrearCarpeta(nombre) {
    try {
      await createFolder(userId, nombre);
      await onRecargarFolders();
      setCrearCarpetaVisible(false);
    } catch (e) {
      console.error('Error al crear rutina:', e.message, e);
      Alert.alert('Error', 'No se pudo crear la rutina, intentá de nuevo.');
    }
  }

  function handleBorrarCarpeta(folder) {
    Alert.alert('Borrar rutina', `¿Borrar la rutina "${folder.name}"? Los ejercicios no se borran.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFolder(folder.id);
            await onRecargarFolders();
          } catch (e) {
            console.error('Error al borrar rutina:', e.message, e);
            Alert.alert('Error', 'No se pudo borrar la rutina, intentá de nuevo.');
          }
        },
      },
    ]);
  }

  function abrirTodos() {
    setCarpetaAbierta({ id: null, name: 'Todos mis ejercicios' });
    setBibliotecaVisible(true);
  }

  function abrirCarpeta(folder) {
    setCarpetaAbierta(folder);
    setBibliotecaVisible(true);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 22 }}>
      <Text style={styles.titulo}>Ejercicios</Text>
      <Pressable style={styles.empezarBoton} onPress={() => onEmpezar(null)}>
        <Text style={styles.empezarTexto}>▶ Empezar entrenamiento</Text>
      </Pressable>

      <View style={styles.seccionFila}>
        <Text style={styles.subtitulo}>Rutinas</Text>
        <Pressable onPress={() => setCrearCarpetaVisible(true)} hitSlop={12}>
          <Text style={styles.nuevaTexto}>+ Nueva</Text>
        </Pressable>
      </View>
      {folders.length === 0 && <Text style={styles.sinDatos}>Todavía no armaste ninguna rutina.</Text>}
      {folders.map((folder) => (
        <View key={folder.id} style={styles.fila}>
          <Pressable style={styles.filaContenido} onPress={() => abrirCarpeta(folder)}>
            <Text style={styles.filaTitulo}>📁 {folder.name}</Text>
            <Text style={styles.filaSubtitulo}>
              {folder.cantidadEjercicios} ejercicio{folder.cantidadEjercicios === 1 ? '' : 's'}
            </Text>
          </Pressable>
          <View style={styles.filaBotones}>
            <Pressable style={styles.empezarChico} onPress={() => onEmpezar(folder.id)}>
              <Text style={styles.empezarChicoTexto}>▶</Text>
            </Pressable>
            <Pressable onPress={() => handleBorrarCarpeta(folder)} hitSlop={8}>
              <Text style={styles.borrarTexto}>Borrar</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable style={styles.biblioteca} onPress={abrirTodos}>
        <Text style={styles.bibliotecaTexto}>📋 Todos mis ejercicios</Text>
        <Text style={styles.flecha}>›</Text>
      </Pressable>

      <Text style={styles.subtitulo}>Entrenamientos recientes</Text>
      {recientes.length === 0 && <Text style={styles.sinDatos}>Todavía no completaste ningún entrenamiento.</Text>}
      {recientes.map((workout) => {
        const duracion = calcularDuracionMinutos(new Date(workout.started_at), new Date(workout.ended_at));
        const entradasConTipo = workout.exercise_logs.map((log) => ({ type: log.exercises.type, sets: log.sets }));
        const volumen = calcularVolumenTotal(entradasConTipo);
        return (
          <View key={workout.id} style={styles.tarjetaReciente}>
            <Text style={styles.recienteFecha}>{formatFecha(workout.started_at)}</Text>
            <Text style={styles.recienteDetalle}>
              {duracion} min · {workout.exercise_logs.length} ejercicio{workout.exercise_logs.length === 1 ? '' : 's'}
              {volumen > 0 ? ` · ${volumen}kg` : ''}
            </Text>
          </View>
        );
      })}

      <CrearCarpetaModal
        visible={crearCarpetaVisible}
        onGuardar={handleCrearCarpeta}
        onClose={() => setCrearCarpetaVisible(false)}
      />
      <BibliotecaEjerciciosModal
        visible={bibliotecaVisible}
        userId={userId}
        folderId={carpetaAbierta?.id ?? null}
        folderName={carpetaAbierta?.name ?? ''}
        folders={folders}
        ancho={ancho}
        onClose={() => setBibliotecaVisible(false)}
        onCambio={onRecargarFolders}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  titulo: { fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginBottom: 16 },
  empezarBoton: {
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: colors.cobalto,
    marginBottom: 24,
  },
  empezarTexto: { fontFamily: 'Inter_700Bold', color: '#fff', fontSize: 17 },
  seccionFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subtitulo: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 18, color: colors.textPrimary, marginTop: 20, marginBottom: 8 },
  nuevaTexto: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.cobalto },
  sinDatos: { fontFamily: 'Inter_400Regular', color: colors.textTertiary, marginBottom: 8 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  filaContenido: { flex: 1 },
  filaTitulo: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.textPrimary },
  filaSubtitulo: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  filaBotones: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  empezarChico: { backgroundColor: colors.cobalto, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  empezarChicoTexto: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  borrarTexto: { fontFamily: 'Inter_500Medium', color: colors.racha.rojo, fontSize: 13 },
  biblioteca: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
  },
  bibliotecaTexto: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.textPrimary },
  flecha: { fontSize: 22, color: colors.textTertiary },
  tarjetaReciente: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 8 },
  recienteFecha: { fontFamily: 'Inter_600SemiBold', color: colors.textPrimary, fontSize: 14 },
  recienteDetalle: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 13, marginTop: 2 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EjerciciosDashboard.js
git commit -m "feat: add exercises dashboard with routines and recent workouts"
```

---

## Task 10: `src/screens/EjerciciosScreen.js` (final wiring)

**Files:**
- Modify: `src/screens/EjerciciosScreen.js` (full content replaced)

**Interfaces:**
- Consumes: `getFolders, getExercises` from `exercises.js`; `getActiveWorkout, getWorkoutExerciseLogs, startWorkout` from `workouts.js`; `EjerciciosDashboard` (Task 9); `EntrenamientoActivo` (Task 8).
- Produces: the screen registered in `src/navigation/TabNavigator.js` (already wired, no navigation changes needed).

- [ ] **Step 1: Implement**

Replace the full contents of `src/screens/EjerciciosScreen.js`:
```javascript
import { useCallback, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getFolders, getExercises } from '../lib/exercises';
import { getActiveWorkout, getWorkoutExerciseLogs, startWorkout } from '../lib/workouts';
import EjerciciosDashboard from '../components/EjerciciosDashboard';
import EntrenamientoActivo from '../components/EntrenamientoActivo';
import { colors } from '../theme/colors';

const ANCHO_GRAFICO = Dimensions.get('window').width - 44 - 32;

export default function EjerciciosScreen() {
  const [userId, setUserId] = useState(null);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workoutActivo, setWorkoutActivo] = useState(null);
  const [entradasWorkout, setEntradasWorkout] = useState([]);

  const cargarFolders = useCallback(async (uid) => {
    const data = await getFolders(uid);
    setFolders(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (cancelado) return;
        setUserId(user.id);
        await cargarFolders(user.id);
        const activo = await getActiveWorkout(user.id);
        if (cancelado) return;
        if (activo) {
          const logs = await getWorkoutExerciseLogs(activo.id);
          if (cancelado) return;
          setWorkoutActivo(activo);
          setEntradasWorkout(logs.map((log) => ({ exercise: log.exercises, sets: log.sets, logId: log.id })));
        }
        if (!cancelado) setLoading(false);
      });
      return () => {
        cancelado = true;
      };
    }, [cargarFolders])
  );

  async function empezarEntrenamiento(folderId) {
    const workout = await startWorkout(userId, folderId);
    let entradas = [];
    if (folderId !== null) {
      const ejerciciosRutina = await getExercises(userId, folderId);
      entradas = ejerciciosRutina.map((ejercicio) => ({ exercise: ejercicio, sets: [], logId: null }));
    }
    setWorkoutActivo(workout);
    setEntradasWorkout(entradas);
  }

  function volverAlDashboard() {
    setWorkoutActivo(null);
    setEntradasWorkout([]);
    cargarFolders(userId);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.cobalto} />
      </View>
    );
  }

  if (workoutActivo) {
    return (
      <EntrenamientoActivo
        userId={userId}
        workout={workoutActivo}
        entradasIniciales={entradasWorkout}
        onFinalizado={volverAlDashboard}
        onCancelado={volverAlDashboard}
      />
    );
  }

  return (
    <EjerciciosDashboard
      userId={userId}
      folders={folders}
      ancho={ANCHO_GRAFICO}
      onEmpezar={empezarEntrenamiento}
      onRecargarFolders={() => cargarFolders(userId)}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: PASS, all suites (existing + `workoutsCalculo.test.js`).

- [ ] **Step 3: Verify no bundler errors**

Read the Metro bundler background task output and confirm no new `ERROR` lines after this change.

- [ ] **Step 4: Commit**

```bash
git add src/screens/EjerciciosScreen.js
git commit -m "feat: wire EjerciciosScreen to dashboard/active-workout views"
```

- [ ] **Step 5: Manual verification on the phone**

Open the Ejercicios tab and check:
- Dashboard shows "Empezar entrenamiento", an empty "Rutinas" state, "Todos mis ejercicios", and an empty "Entrenamientos recientes" state (since all data was wiped).
- "+ Nueva" creates a rutina; "📋 Todos mis ejercicios" and a rutina both open the biblioteca modal, where you can still create exercises (with the catalog picker), edit a rutina's orden/objetivo, view an exercise's chart/historial, and delete it — but there's no "Registrar sesión" button there anymore.
- "▶ Empezar entrenamiento" (empty) switches to the live workout screen with a running duration timer; "+ Agregar ejercicio" opens the picker (catálogo/mis ejercicios), adding one shows it as a card.
- Logging a set (+ Serie) saves it, shows it in the card's history, and — if that exercise has a `rest_seconds` set — pops the rest timer banner with a working countdown, vibration at zero, and a "Saltar" button.
- "▶" next to a rutina starts a workout pre-populated with that rutina's exercises.
- "Finalizar" shows a summary alert (duration, exercises, sets, volume, any PR) and returns to the dashboard, where the workout now appears in "Entrenamientos recientes".
- "Cancelar entrenamiento" discards everything and returns to the dashboard with no trace of that workout.
- Force-closing the app mid-workout and reopening the Ejercicios tab resumes the same in-progress workout with its already-logged sets intact.

---
