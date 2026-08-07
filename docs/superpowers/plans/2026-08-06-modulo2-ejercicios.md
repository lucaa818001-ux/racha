# Módulo Ejercicios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user create custom exercises, organize them in free-form folders (which double as simple routines), log sessions with sets, and see their evolution over time.

**Architecture:** `exerciciosCalculo.js` holds one pure, unit-tested function (`mejorMarcaSesion`) with no Supabase dependency. `exercises.js` mirrors the existing `bodyLogs.js`/`goals.js` data-access pattern, including the same photo-upload-to-storage approach as `bodyLogs.js`. Everything that would normally be a separate popup (create exercise, edit a folder's target, log a session) is instead an internal view of one single `<Modal>` (`ListaEjerciciosModal.js`), because two simultaneously-visible `<Modal>` components already caused a real bug in this app (the photo viewer opening "behind" the Físico history modal). `EjercicioChart.js` reuses the SVG approach from `WeightChart.js`.

**Tech Stack:** Supabase (Postgres + Storage), existing SVG-chart, `expo-image-picker`, and chip/toggle UI patterns already used elsewhere in the app.

## Global Constraints

- Un ejercicio puede pertenecer a varias carpetas a la vez (relación muchos-a-muchos) — from design doc.
- Las rutinas no son una entidad separada: son carpetas con `orden` y objetivo (series + reps o series + duración) opcionales por ejercicio — from design doc.
- El descanso (`rest_seconds`) es solo un dato de referencia, no un cronómetro activo — from design doc.
- No hay detección automática de récord personal — from design doc.
- No proveemos ninguna foto/ilustración de ejercicios: solo la foto propia opcional del usuario, o un emoji fijo de respaldo por grupo muscular — from design doc.
- Nada que se abra desde dentro de `ListaEjerciciosModal` puede ser un `<Modal>` separado — todo es una vista interna del mismo modal — from design doc.
- Selector de cantidad de series: rango 1 a 8 — from design doc.
- Grupos musculares válidos: `pecho, espalda, cuadriceps, isquios_gluteos, hombros, biceps, triceps, core, cardio, otro` — from design doc.

---

## File Structure

- Create: `supabase/migrations/0007_exercises.sql` — 4 tablas + bucket de fotos + RLS.
- Create: `src/lib/exerciciosCalculo.js` — cálculo puro de "mejor marca" por sesión.
- Create: `src/lib/exercises.js` — acceso a datos (carpetas, ejercicios, sesiones).
- Create: `src/components/DiagramaMusculo.js` — foto propia o emoji de respaldo.
- Create: `src/components/EjercicioChart.js` — gráfica de evolución.
- Create: `src/components/CrearCarpetaModal.js` — modal simple para nombrar una carpeta.
- Create: `src/components/ListaEjerciciosModal.js` — modal único con 5 vistas internas (lista, detalle, crear, editar objetivo, registrar sesión).
- Modify: `src/screens/EjerciciosScreen.js` — reemplaza el stub actual, orquesta todo lo anterior.

---

## Task 1: Supabase schema and RLS

**Files:**
- Create: `supabase/migrations/0007_exercises.sql`

**Interfaces:**
- Produces: tablas `exercises(id, user_id, name, muscle_group, type, rest_seconds, photo_path, created_at)`, `exercise_logs(id, exercise_id, user_id, date, sets, created_at)`, `exercise_folders(id, user_id, name, created_at)`, `exercise_folder_items(exercise_id, folder_id, orden, target_sets, target_reps, target_duration_seg)`, y el bucket de Storage `exercise_photos`. Task 3 (`exercises.js`) depende de esto.

- [ ] **Step 1: Write and apply the migration**

Create `supabase/migrations/0007_exercises.sql`:
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
```

Use the Supabase MCP tool `apply_migration` with `project_id: "holaqwecblmdgefeulrr"`, `name: "exercises"`, and that SQL.

- [ ] **Step 2: Verify**

Use `list_tables` with `project_id: "holaqwecblmdgefeulrr"`.
Expected: `exercises`, `exercise_logs`, `exercise_folders`, `exercise_folder_items` all appear with RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_exercises.sql
git commit -m "feat: add exercises, folders, and logs tables"
```

---

## Task 2: "Best mark per session" calculation (TDD)

**Files:**
- Create: `src/lib/exerciciosCalculo.js`
- Create: `src/lib/exerciciosCalculo.test.js`

**Interfaces:**
- Produces: `mejorMarcaSesion(sets: {weight,reps}[] | {duration_seg}[], type: 'peso_reps'|'tiempo') => number | null`. Task 4 (`EjercicioChart`) depends on this.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/exerciciosCalculo.test.js`:
```javascript
import { mejorMarcaSesion } from './exerciciosCalculo';

test('peso_reps: devuelve el peso maximo entre los sets', () => {
  const sets = [{ weight: 40, reps: 10 }, { weight: 50, reps: 8 }, { weight: 45, reps: 8 }];
  expect(mejorMarcaSesion(sets, 'peso_reps')).toBe(50);
});

test('peso_reps: un solo set devuelve su peso', () => {
  const sets = [{ weight: 60, reps: 5 }];
  expect(mejorMarcaSesion(sets, 'peso_reps')).toBe(60);
});

test('tiempo: suma la duracion de todos los sets', () => {
  const sets = [{ duration_seg: 30 }, { duration_seg: 45 }, { duration_seg: 60 }];
  expect(mejorMarcaSesion(sets, 'tiempo')).toBe(135);
});

test('sets vacios devuelve null', () => {
  expect(mejorMarcaSesion([], 'peso_reps')).toBeNull();
  expect(mejorMarcaSesion([], 'tiempo')).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- exerciciosCalculo`
Expected: FAIL with "Cannot find module './exerciciosCalculo'"

- [ ] **Step 3: Write the implementation**

Create `src/lib/exerciciosCalculo.js`:
```javascript
export function mejorMarcaSesion(sets, type) {
  if (!sets || sets.length === 0) return null;
  if (type === 'tiempo') {
    return sets.reduce((total, s) => total + s.duration_seg, 0);
  }
  return Math.max(...sets.map((s) => s.weight));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- exerciciosCalculo`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/exerciciosCalculo.js src/lib/exerciciosCalculo.test.js
git commit -m "feat: add mejorMarcaSesion calculation"
```

---

## Task 3: Data access — `src/lib/exercises.js`

**Files:**
- Create: `src/lib/exercises.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (talks directly to Supabase, same pattern as `bodyLogs.js`).
- Produces:
  - `getFolders(userId) => Promise<{id, name, cantidadEjercicios}[]>`
  - `createFolder(userId, name) => Promise<folder>`
  - `deleteFolder(folderId) => Promise<void>`
  - `getExercises(userId, folderId: string|null) => Promise<exercise[]>` (si `folderId` no es null, cada ejercicio trae además `orden`, `target_sets`, `target_reps`, `target_duration_seg`, ya ordenados)
  - `createExercise(userId, {name, muscleGroup, type, restSeconds, photoUri, folderIds}) => Promise<exercise>`
  - `deleteExercise(exerciseId, photoPath) => Promise<void>`
  - `updateFolderItem(exerciseId, folderId, {orden, targetSets, targetReps, targetDurationSeg}) => Promise<void>`
  - `getExerciseLogs(exerciseId) => Promise<{id, date, sets}[]>`
  - `createExerciseLog(exerciseId, userId, {date, sets}) => Promise<log>`
  - `getSignedExercisePhotoUrl(photoPath) => Promise<string>`
  Task 6 (`DiagramaMusculo`) usa `getSignedExercisePhotoUrl`. Task 7 (`ListaEjerciciosModal`) usa el resto.

- [ ] **Step 1: Implement**

Create `src/lib/exercises.js`:
```javascript
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

const BUCKET = 'exercise_photos';

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getFolders(userId) {
  const { data: folders, error } = await supabase
    .from('exercise_folders')
    .select('id, name')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const { data: items, error: itemsError } = await supabase
    .from('exercise_folder_items')
    .select('folder_id, exercises!inner(user_id)')
    .eq('exercises.user_id', userId);
  if (itemsError) throw itemsError;

  const conteo = {};
  items.forEach((item) => {
    conteo[item.folder_id] = (conteo[item.folder_id] || 0) + 1;
  });

  return folders.map((f) => ({ ...f, cantidadEjercicios: conteo[f.id] || 0 }));
}

export async function createFolder(userId, name) {
  const { data, error } = await supabase
    .from('exercise_folders')
    .insert({ user_id: userId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFolder(folderId) {
  const { error } = await supabase.from('exercise_folders').delete().eq('id', folderId);
  if (error) throw error;
}

export async function getExercises(userId, folderId) {
  if (folderId === null) {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, type, rest_seconds, photo_path')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('exercise_folder_items')
    .select(
      'orden, target_sets, target_reps, target_duration_seg, exercises!inner(id, name, muscle_group, type, rest_seconds, photo_path, user_id)'
    )
    .eq('folder_id', folderId)
    .eq('exercises.user_id', userId)
    .order('orden', { ascending: true, nullsFirst: false });
  if (error) throw error;

  return data.map((item) => ({
    ...item.exercises,
    orden: item.orden,
    target_sets: item.target_sets,
    target_reps: item.target_reps,
    target_duration_seg: item.target_duration_seg,
  }));
}

export async function createExercise(userId, { name, muscleGroup, type, restSeconds, photoUri, folderIds }) {
  let photoPath = null;
  if (photoUri) {
    photoPath = `${userId}/${Date.now()}.jpg`;
    const base64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(photoPath, decode(base64), { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;
  }

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      user_id: userId,
      name,
      muscle_group: muscleGroup,
      type,
      rest_seconds: restSeconds || null,
      photo_path: photoPath,
    })
    .select()
    .single();
  if (error) throw error;

  if (folderIds && folderIds.length > 0) {
    const filas = folderIds.map((folderId) => ({ exercise_id: data.id, folder_id: folderId }));
    const { error: folderError } = await supabase.from('exercise_folder_items').insert(filas);
    if (folderError) throw folderError;
  }

  return data;
}

export async function deleteExercise(exerciseId, photoPath) {
  if (photoPath) {
    await supabase.storage.from(BUCKET).remove([photoPath]);
  }
  const { error } = await supabase.from('exercises').delete().eq('id', exerciseId);
  if (error) throw error;
}

export async function updateFolderItem(exerciseId, folderId, { orden, targetSets, targetReps, targetDurationSeg }) {
  const { error } = await supabase
    .from('exercise_folder_items')
    .update({
      orden: orden ?? null,
      target_sets: targetSets ?? null,
      target_reps: targetReps ?? null,
      target_duration_seg: targetDurationSeg ?? null,
    })
    .eq('exercise_id', exerciseId)
    .eq('folder_id', folderId);
  if (error) throw error;
}

export async function getExerciseLogs(exerciseId) {
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('id, date, sets')
    .eq('exercise_id', exerciseId)
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createExerciseLog(exerciseId, userId, { date, sets }) {
  const { data, error } = await supabase
    .from('exercise_logs')
    .insert({ exercise_id: exerciseId, user_id: userId, date: formatDate(date), sets })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSignedExercisePhotoUrl(photoPath) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(photoPath, 60);
  if (error) throw error;
  return data.signedUrl;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/exercises.js
git commit -m "feat: add exercises data access module"
```

---

## Task 4: `src/components/DiagramaMusculo.js`

**Files:**
- Create: `src/components/DiagramaMusculo.js`

**Interfaces:**
- Consumes: `getSignedExercisePhotoUrl` from Task 3.
- Produces: `<DiagramaMusculo photoPath={string|null} muscleGroup={string} tamano={number} />`. Task 7 (`ListaEjerciciosModal`) usa esto.

- [ ] **Step 1: Implement**

Create `src/components/DiagramaMusculo.js`:
```javascript
import { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { getSignedExercisePhotoUrl } from '../lib/exercises';
import { colors } from '../theme/colors';

const EMOJI_POR_GRUPO = {
  pecho: '🎽',
  espalda: '🧍',
  cuadriceps: '🦵',
  isquios_gluteos: '🍑',
  hombros: '🤷',
  biceps: '💪',
  triceps: '🦾',
  core: '🔥',
  cardio: '❤️',
  otro: '🏋️',
};

export default function DiagramaMusculo({ photoPath, muscleGroup, tamano = 64 }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!photoPath) {
      setUrl(null);
      return;
    }
    getSignedExercisePhotoUrl(photoPath).then(setUrl).catch(() => setUrl(null));
  }, [photoPath]);

  if (photoPath && url) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.imagen, { width: tamano, height: tamano }]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[styles.emojiContenedor, { width: tamano, height: tamano }]}>
      <Text style={{ fontSize: tamano * 0.5 }}>{EMOJI_POR_GRUPO[muscleGroup] || '🏋️'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  imagen: { borderRadius: 12 },
  emojiContenedor: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DiagramaMusculo.js
git commit -m "feat: add exercise muscle group image/emoji component"
```

---

## Task 5: `src/components/EjercicioChart.js`

**Files:**
- Create: `src/components/EjercicioChart.js`

**Interfaces:**
- Consumes: `mejorMarcaSesion` from Task 2.
- Produces: `<EjercicioChart logs={{id,date,sets}[]} type={'peso_reps'|'tiempo'} ancho={number} />`. Task 7 (`ListaEjerciciosModal`) usa esto.

- [ ] **Step 1: Implement**

Create `src/components/EjercicioChart.js`:
```javascript
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { mejorMarcaSesion } from '../lib/exerciciosCalculo';
import { colors } from '../theme/colors';

const ALTO_GRAFICO = 160;
const MARGEN_ETIQUETA = 24;
const MARGEN_LATERAL = 18;
const ALTO_TOTAL = ALTO_GRAFICO + MARGEN_ETIQUETA * 2;

export default function EjercicioChart({ logs, type, ancho }) {
  if (logs.length < 2) {
    return (
      <View style={[styles.tarjeta, styles.centrado]}>
        <Text style={styles.mensaje}>Registrá más sesiones para ver tu evolución</Text>
      </View>
    );
  }

  const unidad = type === 'tiempo' ? 'seg' : 'kg';
  const marcas = logs.map((log) => mejorMarcaSesion(log.sets, type));
  const min = Math.min(...marcas);
  const max = Math.max(...marcas);
  const margen = (max - min) * 0.1 || 1;
  const marcaMin = min - margen;
  const marcaMax = max + margen;

  const anchoUtil = ancho - MARGEN_LATERAL * 2;
  const puntos = logs.map((log, i) => {
    const marca = marcas[i];
    const x = MARGEN_LATERAL + (i / (logs.length - 1)) * anchoUtil;
    const y = MARGEN_ETIQUETA + ALTO_GRAFICO - ((marca - marcaMin) / (marcaMax - marcaMin)) * ALTO_GRAFICO;
    return { x, y, marca, date: log.date };
  });

  const puntosStr = puntos.map((p) => `${p.x},${p.y}`).join(' ');
  const mostrarEtiquetas = logs.length <= 10;

  return (
    <View style={styles.tarjeta}>
      <Svg width={ancho} height={ALTO_TOTAL}>
        <Polyline points={puntosStr} fill="none" stroke={colors.cobalto} strokeWidth={2} />
        {puntos.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill={colors.cobalto} />
        ))}
        {mostrarEtiquetas &&
          puntos.map((p, i) => (
            <SvgText
              key={`marca-${i}`}
              x={p.x}
              y={p.y - 10}
              fontSize="11"
              fill={colors.textSecondary}
              textAnchor="middle"
            >
              {`${p.marca}${unidad}`}
            </SvgText>
          ))}
        <SvgText x={MARGEN_LATERAL} y={ALTO_TOTAL - 6} fontSize="11" fill={colors.textTertiary} textAnchor="start">
          {puntos[0].date}
        </SvgText>
        <SvgText
          x={ancho - MARGEN_LATERAL}
          y={ALTO_TOTAL - 6}
          fontSize="11"
          fill={colors.textTertiary}
          textAnchor="end"
        >
          {puntos[puntos.length - 1].date}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, marginVertical: 16 },
  centrado: { height: ALTO_TOTAL, alignItems: 'center', justifyContent: 'center' },
  mensaje: { fontFamily: 'Inter_400Regular', color: colors.textTertiary, textAlign: 'center' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EjercicioChart.js
git commit -m "feat: add exercise evolution chart"
```

---

## Task 6: `src/components/CrearCarpetaModal.js`

**Files:**
- Create: `src/components/CrearCarpetaModal.js`

**Interfaces:**
- Produces: `<CrearCarpetaModal visible={bool} onGuardar={(nombre: string) => Promise<void>} onClose={() => void} />`. Task 8 (`EjerciciosScreen`) usa esto. Este es el único modal de este módulo que se abre directo desde una pantalla (no desde dentro de otro modal), por eso puede ser un `<Modal>` propio sin riesgo de anidarse.

- [ ] **Step 1: Implement**

Create `src/components/CrearCarpetaModal.js`:
```javascript
import { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { colors } from '../theme/colors';

export default function CrearCarpetaModal({ visible, onGuardar, onClose }) {
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);

  const nombreValido = nombre.trim() !== '';

  async function handleGuardar() {
    setGuardando(true);
    try {
      await onGuardar(nombre.trim());
      setNombre('');
    } catch (e) {
      console.error('Error al crear carpeta:', e.message, e);
      Alert.alert('Error', 'No se pudo crear la carpeta, intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.titulo}>Nueva carpeta</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre (ej: Pecho, Lunes)"
            placeholderTextColor={colors.textTertiary}
            value={nombre}
            onChangeText={setNombre}
            autoFocus
          />
          <Pressable
            style={[styles.guardarButton, (!nombreValido || guardando) && styles.guardarButtonDeshabilitado]}
            disabled={!nombreValido || guardando}
            onPress={handleGuardar}
          >
            <Text style={styles.guardarButtonTexto}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text style={styles.cancelar}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 22 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 22 },
  titulo: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  guardarButton: { borderRadius: 20, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.cobalto },
  guardarButtonDeshabilitado: { opacity: 0.5 },
  guardarButtonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
  cancelar: { textAlign: 'center', marginTop: 16, fontFamily: 'Inter_500Medium', color: colors.textSecondary },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CrearCarpetaModal.js
git commit -m "feat: add folder creation modal"
```

---

## Task 7: `src/components/ListaEjerciciosModal.js`

**Files:**
- Create: `src/components/ListaEjerciciosModal.js`

**Interfaces:**
- Consumes: `getExercises, createExercise, deleteExercise, updateFolderItem, getExerciseLogs, createExerciseLog` from Task 3; `DiagramaMusculo` from Task 4; `EjercicioChart` from Task 5.
- Produces: `<ListaEjerciciosModal visible={bool} userId={string} folderId={string|null} folderName={string} folders={{id,name}[]} ancho={number} onClose={() => void} onCambio={() => void} />`. Task 8 (`EjerciciosScreen`) usa esto. `onCambio` se llama después de crear/borrar un ejercicio, para que la pantalla principal actualice el conteo de ejercicios por carpeta.

Este componente tiene 5 vistas internas (`'lista' | 'detalle' | 'crear' | 'editarObjetivo' | 'registrarSesion'`) controladas por un solo `useState`, todas dentro de un único `<Modal>` — ver la nota sobre modales anidados en el documento de diseño.

- [ ] **Step 1: Implement**

Create `src/components/ListaEjerciciosModal.js`:
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
import {
  getExercises,
  createExercise,
  deleteExercise,
  updateFolderItem,
  getExerciseLogs,
  createExerciseLog,
} from '../lib/exercises';
import DiagramaMusculo from './DiagramaMusculo';
import EjercicioChart from './EjercicioChart';
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

function filasVacias(cantidad, tipo) {
  return Array.from({ length: cantidad }, () =>
    tipo === 'tiempo' ? { duration_seg: '' } : { weight: '', reps: '' }
  );
}

export default function ListaEjerciciosModal({ visible, userId, folderId, folderName, folders, ancho, onClose, onCambio }) {
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

  const [cantidadSeries, setCantidadSeries] = useState(1);
  const [sets, setSets] = useState(filasVacias(1, 'peso_reps'));
  const [guardandoSesion, setGuardandoSesion] = useState(false);

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

  function abrirRegistrarSesion() {
    const cantidad = seleccionado.target_sets || 1;
    setCantidadSeries(cantidad);
    const filas = filasVacias(cantidad, seleccionado.type);
    if (seleccionado.type === 'tiempo' && seleccionado.target_duration_seg) {
      filas.forEach((f) => (f.duration_seg = String(seleccionado.target_duration_seg)));
    } else if (seleccionado.type === 'peso_reps' && seleccionado.target_reps) {
      filas.forEach((f) => (f.reps = String(seleccionado.target_reps)));
    }
    setSets(filas);
    setVista('registrarSesion');
  }

  function volver() {
    setVista(vista === 'registrarSesion' ? 'detalle' : 'lista');
  }

  function toggleFolderSeleccionada(id) {
    setFolderIdsSeleccionadas((actual) => (actual.includes(id) ? actual.filter((f) => f !== id) : [...actual, id]));
  }

  function cambiarCantidadSeries(n) {
    setCantidadSeries(n);
    setSets((actual) => {
      const nuevas = filasVacias(n, seleccionado.type);
      for (let i = 0; i < Math.min(n, actual.length); i++) nuevas[i] = actual[i];
      return nuevas;
    });
  }

  function actualizarSet(indice, cambios) {
    setSets((actual) => actual.map((s, i) => (i === indice ? { ...s, ...cambios } : s)));
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

  async function handleGuardarSesion() {
    setGuardandoSesion(true);
    try {
      const setsFormateados =
        seleccionado.type === 'tiempo'
          ? sets.map((s) => ({ duration_seg: Number(s.duration_seg) || 0 }))
          : sets.map((s) => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 }));
      await createExerciseLog(seleccionado.id, userId, { date: new Date(), sets: setsFormateados });
      const data = await getExerciseLogs(seleccionado.id);
      setLogs(data);
      setVista('detalle');
    } catch (e) {
      console.error('Error al registrar sesión:', e.message, e);
      Alert.alert('Error', 'No se pudo guardar la sesión, intentá de nuevo.');
    } finally {
      setGuardandoSesion(false);
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
              <Text style={styles.volver}>‹ {vista === 'registrarSesion' ? seleccionado.name : folderName}</Text>
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
              {ejercicios.length === 0 && <Text style={styles.sinEjercicios}>Todavía no hay ejercicios acá.</Text>}
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
            <Pressable style={styles.boton} onPress={abrirRegistrarSesion}>
              <Text style={styles.botonTexto}>Registrar sesión</Text>
            </Pressable>
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
                <Text style={styles.etiqueta}>Carpetas</Text>
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

        {vista === 'editarObjetivo' && seleccionado && (
          <ScrollView contentContainerStyle={{ padding: 22 }}>
            <Text style={styles.tituloDetalle}>Editar en esta carpeta</Text>
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

        {vista === 'registrarSesion' && seleccionado && (
          <ScrollView contentContainerStyle={{ padding: 22 }}>
            <Text style={styles.tituloDetalle}>Registrar sesión</Text>
            <Text style={styles.etiqueta}>Cantidad de series</Text>
            <View style={styles.gridChips}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <Pressable
                  key={n}
                  style={[styles.chip, cantidadSeries === n && styles.chipActivo]}
                  onPress={() => cambiarCantidadSeries(n)}
                >
                  <Text style={styles.chipTexto}>{n}</Text>
                </Pressable>
              ))}
            </View>
            {sets.map((set, i) =>
              seleccionado.type === 'tiempo' ? (
                <View key={i} style={styles.serieFila}>
                  <Text style={styles.serieNumero}>Serie {i + 1}</Text>
                  <TextInput
                    style={styles.serieInput}
                    placeholder="Segundos"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    value={set.duration_seg}
                    onChangeText={(valor) => actualizarSet(i, { duration_seg: valor })}
                  />
                </View>
              ) : (
                <View key={i} style={styles.serieFila}>
                  <Text style={styles.serieNumero}>Serie {i + 1}</Text>
                  <TextInput
                    style={styles.serieInput}
                    placeholder="Kg"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    value={set.weight}
                    onChangeText={(valor) => actualizarSet(i, { weight: valor })}
                  />
                  <TextInput
                    style={styles.serieInput}
                    placeholder="Reps"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    value={set.reps}
                    onChangeText={(valor) => actualizarSet(i, { reps: valor })}
                  />
                </View>
              )
            )}
            <Pressable
              style={[styles.guardarButton, guardandoSesion && styles.guardarButtonDeshabilitado]}
              disabled={guardandoSesion}
              onPress={handleGuardarSesion}
            >
              <Text style={styles.guardarButtonTexto}>{guardandoSesion ? 'Guardando...' : 'Guardar sesión'}</Text>
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
  boton: { borderRadius: 20, paddingVertical: 16, alignItems: 'center', backgroundColor: colors.cobalto },
  botonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
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
  serieFila: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  serieNumero: { fontFamily: 'Inter_500Medium', color: colors.textSecondary, fontSize: 13, width: 64 },
  serieInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ListaEjerciciosModal.js
git commit -m "feat: add exercise list/detail/create/log modal"
```

---

## Task 8: `src/screens/EjerciciosScreen.js`

**Files:**
- Modify: `src/screens/EjerciciosScreen.js` (currently a placeholder stub, full content replaced)

**Interfaces:**
- Consumes: `getFolders, createFolder, deleteFolder` from Task 3; `CrearCarpetaModal` from Task 6; `ListaEjerciciosModal` from Task 7.
- Produces: the screen registered in `src/navigation/TabNavigator.js` (already wired, no navigation changes needed).

- [ ] **Step 1: Implement**

Replace the full contents of `src/screens/EjerciciosScreen.js`:
```javascript
import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, RefreshControl, StyleSheet, Alert, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getFolders, createFolder, deleteFolder } from '../lib/exercises';
import CrearCarpetaModal from '../components/CrearCarpetaModal';
import ListaEjerciciosModal from '../components/ListaEjerciciosModal';
import { colors } from '../theme/colors';

const ANCHO_GRAFICO = Dimensions.get('window').width - 44 - 32;

export default function EjerciciosScreen() {
  const [userId, setUserId] = useState(null);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [crearCarpetaVisible, setCrearCarpetaVisible] = useState(false);
  const [listaVisible, setListaVisible] = useState(false);
  const [carpetaAbierta, setCarpetaAbierta] = useState(null);

  const cargarDatos = useCallback(async (uid) => {
    const data = await getFolders(uid);
    setFolders(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (cancelado) return;
        setUserId(user.id);
        await cargarDatos(user.id);
        if (!cancelado) setLoading(false);
      });
      return () => {
        cancelado = true;
      };
    }, [cargarDatos])
  );

  async function handleRefrescar() {
    setRefrescando(true);
    try {
      await cargarDatos(userId);
    } finally {
      setRefrescando(false);
    }
  }

  async function handleCrearCarpeta(nombre) {
    await createFolder(userId, nombre);
    await cargarDatos(userId);
    setCrearCarpetaVisible(false);
  }

  function handleBorrarCarpeta(folder) {
    Alert.alert('Borrar carpeta', `¿Borrar la carpeta "${folder.name}"? Los ejercicios no se borran.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteFolder(folder.id);
          await cargarDatos(userId);
        },
      },
    ]);
  }

  function abrirTodos() {
    setCarpetaAbierta({ id: null, name: 'Todos los ejercicios' });
    setListaVisible(true);
  }

  function abrirCarpeta(folder) {
    setCarpetaAbierta(folder);
    setListaVisible(true);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.cobalto} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 22 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={handleRefrescar} tintColor={colors.cobalto} />}
    >
      <View style={styles.encabezadoFila}>
        <Text style={styles.titulo}>Ejercicios</Text>
        <Pressable style={styles.nuevaCarpetaBoton} onPress={() => setCrearCarpetaVisible(true)}>
          <Text style={styles.nuevaCarpetaIcono}>➕</Text>
        </Pressable>
      </View>
      <Pressable style={styles.fila} onPress={abrirTodos}>
        <Text style={styles.filaTitulo}>📋 Todos los ejercicios</Text>
        <Text style={styles.flecha}>›</Text>
      </Pressable>
      {folders.map((folder) => (
        <Pressable key={folder.id} style={styles.fila} onPress={() => abrirCarpeta(folder)}>
          <View>
            <Text style={styles.filaTitulo}>📁 {folder.name}</Text>
            <Text style={styles.filaSubtitulo}>
              {folder.cantidadEjercicios} ejercicio{folder.cantidadEjercicios === 1 ? '' : 's'}
            </Text>
          </View>
          <Pressable onPress={() => handleBorrarCarpeta(folder)} hitSlop={12}>
            <Text style={styles.borrarTexto}>Borrar</Text>
          </Pressable>
        </Pressable>
      ))}
      <CrearCarpetaModal
        visible={crearCarpetaVisible}
        onGuardar={handleCrearCarpeta}
        onClose={() => setCrearCarpetaVisible(false)}
      />
      <ListaEjerciciosModal
        visible={listaVisible}
        userId={userId}
        folderId={carpetaAbierta?.id ?? null}
        folderName={carpetaAbierta?.name ?? ''}
        folders={folders}
        ancho={ANCHO_GRAFICO}
        onClose={() => setListaVisible(false)}
        onCambio={() => cargarDatos(userId)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary },
  encabezadoFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  nuevaCarpetaBoton: { backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 },
  nuevaCarpetaIcono: { fontSize: 22 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  filaTitulo: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.textPrimary },
  filaSubtitulo: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  borrarTexto: { fontFamily: 'Inter_500Medium', color: colors.racha.rojo, fontSize: 14 },
  flecha: { fontSize: 22, color: colors.textTertiary },
});
```

- [ ] **Step 2: Verify no bundler errors**

Read the Metro bundler background task output (or start it with `npx expo start --tunnel --clear` if not running) and confirm no new `ERROR` lines after this change.

- [ ] **Step 3: Commit**

```bash
git add src/screens/EjerciciosScreen.js
git commit -m "feat: build out Ejercicios screen with folders and exercise list"
```

- [ ] **Step 4: Manual verification on the phone**

Open the Ejercicios tab and check:
- "+ Nueva carpeta" creates a folder that appears in the list.
- "Todos los ejercicios" and a folder both open the list modal.
- "+" inside the list modal creates an exercise (with muscle group, type, optional rest/photo/folders).
- Tapping an exercise opens its detail (image/emoji, chart placeholder message with <2 sessions, empty historial message).
- "Registrar sesión" logs a session and it shows up in historial and the chart once there are 2+.
- From within a folder, "Editar" on a row lets you set orden/objetivo, and reopening "Registrar sesión" for that exercise pre-fills sets/reps.
- Borrar ejercicio and borrar carpeta both work with confirmation.

---
