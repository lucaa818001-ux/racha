# Módulo Perfil Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the placeholder Perfil screen into a personal dashboard: editable name and profile photo, streak/weight/goal stats, persisted achievement badges with real unlock dates, a recent check-in photo gallery, a weight-trend sparkline, and lifetime workout totals — on top of the existing reminder-time and sign-out controls.

**Architecture:** One new Postgres table (`unlocked_logros`) and one new Storage bucket (`profile_photos`); a pure, Jest-tested achievement-eligibility function (`logros.js`) kept separate from its Supabase-touching persistence layer (`logrosDb.js`), matching this codebase's established split between `*Calculo.js`/pure files and `*.js` data-access files. `PerfilScreen.js` is the only screen touched — it is not a modal and does not open any modal that itself opens another modal.

**Tech Stack:** Supabase (Postgres + Storage, additive migration), `expo-image-picker` (already a dependency, already used the same way in `RegistrarFisicoModal.js`), `react-native-svg` (already used in `WeightChart.js`/`ObjetivoChart.js`).

## Global Constraints
- No se agregan funciones sociales (amigos, ranking) — from design doc.
- La foto de perfil es independiente de las fotos de check-in de Racha, guardada en su propio bucket `profile_photos` en la ruta determinística `${userId}/foto.jpg` — from design doc.
- Los logros se persisten en `unlocked_logros` con `unlocked_at` real (no se recalculan de cero en cada carga) — from design doc.
- `logros.js` es puro (sin Supabase); toda la parte con Supabase vive en `logrosDb.js` — from design doc.

---

## File Structure
- Create: `supabase/migrations/0009_perfil.sql` — `unlocked_logros` table + `profile_photos` bucket.
- Create: `src/lib/logros.js` — pure achievement definitions + eligibility check.
- Create: `src/lib/logrosDb.js` — Supabase access for achievements + profile photo.
- Modify: `src/lib/workouts.js` — add `getAllFinishedWorkouts`.
- Create: `src/components/MiniSparkline.js` — tiny SVG line chart, no axes/labels.
- Create: `src/components/EditarNombreModal.js` — name-edit modal.
- Modify: `src/screens/PerfilScreen.js` — full rewrite.

---

## Task 1: Migration — `unlocked_logros` table and `profile_photos` bucket

**Files:**
- Create: `supabase/migrations/0009_perfil.sql`

**Interfaces:**
- Produces: table `unlocked_logros(id, user_id, logro_key, unlocked_at)` with RLS and a `unique(user_id, logro_key)` constraint; storage bucket `profile_photos` (non-public) with a per-user-folder RLS policy. Task 3 (`logrosDb.js`) depends on both.

- [ ] **Step 1: Write and apply the migration**

Create `supabase/migrations/0009_perfil.sql`:
```sql
create table unlocked_logros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logro_key text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, logro_key)
);

alter table unlocked_logros enable row level security;

create policy "Users manage their own unlocked logros"
  on unlocked_logros for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('profile_photos', 'profile_photos', false);

create policy "Users manage their own profile photo"
  on storage.objects for all
  using (bucket_id = 'profile_photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile_photos' and (storage.foldername(name))[1] = auth.uid()::text);
```

Use the Supabase MCP tool `apply_migration` with `project_id: "holaqwecblmdgefeulrr"`, `name: "perfil"`, and that SQL.

- [ ] **Step 2: Verify**

Use `list_tables` with `project_id: "holaqwecblmdgefeulrr"`. Expected: `unlocked_logros` appears with RLS enabled. Use `execute_sql` to confirm the `profile_photos` bucket exists in `storage.buckets` and `public = false`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0009_perfil.sql
git commit -m "feat: add unlocked_logros table and profile_photos bucket"
```

---

## Task 2: Pure achievement eligibility (TDD) — `src/lib/logros.js`

**Files:**
- Create: `src/lib/logros.js`
- Create: `src/lib/logros.test.js`

**Interfaces:**
- Produces:
  - `LOGROS`: array of `{ key: string, emoji: string, label: string, check: (stats) => boolean }`.
  - `calcularLogrosDesbloqueados(stats: { rachaMaxima, objetivosCompletados, totalEntrenamientos }) => LOGROS[]` (subset that pass `check`).
  Task 3 (`logrosDb.js`) depends on both exports.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/logros.test.js`:
```javascript
import { calcularLogrosDesbloqueados } from './logros';

test('sin ningun logro cuando las stats estan en cero', () => {
  const resultado = calcularLogrosDesbloqueados({ rachaMaxima: 0, objetivosCompletados: 0, totalEntrenamientos: 0 });
  expect(resultado).toEqual([]);
});

test('desbloquea racha_7 justo al llegar a 7 dias', () => {
  const resultado = calcularLogrosDesbloqueados({ rachaMaxima: 7, objetivosCompletados: 0, totalEntrenamientos: 0 });
  expect(resultado.map((l) => l.key)).toEqual(['racha_7']);
});

test('no desbloquea racha_7 con 6 dias', () => {
  const resultado = calcularLogrosDesbloqueados({ rachaMaxima: 6, objetivosCompletados: 0, totalEntrenamientos: 0 });
  expect(resultado.map((l) => l.key)).toEqual([]);
});

test('desbloquea varios logros de racha a la vez con 30 dias', () => {
  const resultado = calcularLogrosDesbloqueados({ rachaMaxima: 30, objetivosCompletados: 0, totalEntrenamientos: 0 });
  expect(resultado.map((l) => l.key)).toEqual(['racha_7', 'racha_14', 'racha_30']);
});

test('desbloquea logros de objetivos y entrenamientos independientemente de la racha', () => {
  const resultado = calcularLogrosDesbloqueados({ rachaMaxima: 0, objetivosCompletados: 3, totalEntrenamientos: 50 });
  expect(resultado.map((l) => l.key)).toEqual(['objetivo_1', 'objetivo_3', 'entrenos_10', 'entrenos_50']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- logros`
Expected: FAIL with "Cannot find module './logros'"

- [ ] **Step 3: Write the implementation**

Create `src/lib/logros.js`:
```javascript
export const LOGROS = [
  { key: 'racha_7', emoji: '🔥', label: '7 días seguidos', check: (s) => s.rachaMaxima >= 7 },
  { key: 'racha_14', emoji: '🔥', label: '14 días seguidos', check: (s) => s.rachaMaxima >= 14 },
  { key: 'racha_30', emoji: '🔥', label: '30 días seguidos', check: (s) => s.rachaMaxima >= 30 },
  { key: 'objetivo_1', emoji: '🎯', label: 'Primer objetivo cumplido', check: (s) => s.objetivosCompletados >= 1 },
  { key: 'objetivo_3', emoji: '🎯', label: '3 objetivos cumplidos', check: (s) => s.objetivosCompletados >= 3 },
  { key: 'entrenos_10', emoji: '💪', label: '10 entrenamientos', check: (s) => s.totalEntrenamientos >= 10 },
  { key: 'entrenos_50', emoji: '💪', label: '50 entrenamientos', check: (s) => s.totalEntrenamientos >= 50 },
];

export function calcularLogrosDesbloqueados(stats) {
  return LOGROS.filter((logro) => logro.check(stats));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- logros`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/logros.js src/lib/logros.test.js
git commit -m "feat: add pure achievement-eligibility calculation"
```

---

## Task 3: Achievement + profile-photo data access — `src/lib/logrosDb.js`

**Files:**
- Create: `src/lib/logrosDb.js`

**Interfaces:**
- Consumes: `LOGROS`, `calcularLogrosDesbloqueados` from `./logros` (Task 2). Depends on `unlocked_logros` table and `profile_photos` bucket from Task 1.
- Produces:
  - `getLogrosGuardados(userId) => Promise<{logro_key, unlocked_at}[]>`
  - `guardarLogroNuevo(userId, logroKey) => Promise<void>`
  - `sincronizarLogros(userId, stats) => Promise<Array<{key, emoji, label, check, unlockedAt}>>` (sorted by `unlockedAt` ascending)
  - `getProfilePhotoPath(userId) => string` (pure, no network call: `` `${userId}/foto.jpg` ``)
  - `uploadProfilePhoto(userId, photoUri) => Promise<void>`
  - `getSignedProfilePhotoUrl(userId) => Promise<string>` (throws if no photo exists yet — callers catch this to show a fallback)
  Task 7 (`PerfilScreen.js`) uses all of these.

- [ ] **Step 1: Implement**

Create `src/lib/logrosDb.js`:
```javascript
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { calcularLogrosDesbloqueados, LOGROS } from './logros';

const BUCKET = 'profile_photos';

export async function getLogrosGuardados(userId) {
  const { data, error } = await supabase
    .from('unlocked_logros')
    .select('logro_key, unlocked_at')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function guardarLogroNuevo(userId, logroKey) {
  const { error } = await supabase.from('unlocked_logros').insert({ user_id: userId, logro_key: logroKey });
  if (error) throw error;
}

export async function sincronizarLogros(userId, stats) {
  const elegibles = calcularLogrosDesbloqueados(stats);
  const guardados = await getLogrosGuardados(userId);
  const filas = [...guardados];

  for (const logro of elegibles) {
    if (!filas.some((f) => f.logro_key === logro.key)) {
      await guardarLogroNuevo(userId, logro.key);
      filas.push({ logro_key: logro.key, unlocked_at: new Date().toISOString() });
    }
  }

  return filas
    .map((fila) => {
      const logro = LOGROS.find((l) => l.key === fila.logro_key);
      return logro ? { ...logro, unlockedAt: fila.unlocked_at } : null;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.unlockedAt) - new Date(b.unlockedAt));
}

export function getProfilePhotoPath(userId) {
  return `${userId}/foto.jpg`;
}

export async function uploadProfilePhoto(userId, photoUri) {
  const photoPath = getProfilePhotoPath(userId);
  const base64 = await FileSystem.readAsStringAsync(photoUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(photoPath, decode(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
}

export async function getSignedProfilePhotoUrl(userId) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(getProfilePhotoPath(userId), 60);
  if (error) throw error;
  return data.signedUrl;
}
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: PASS, all suites unaffected (this file has no tests of its own, matching the convention for data-access files like `exercises.js`/`bodyLogs.js`/`workouts.js`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/logrosDb.js
git commit -m "feat: add achievement persistence and profile photo data access"
```

---

## Task 4: `getAllFinishedWorkouts` — modify `src/lib/workouts.js`

**Files:**
- Modify: `src/lib/workouts.js` (add one function; do not change any existing export)

**Interfaces:**
- Produces: `getAllFinishedWorkouts(userId) => Promise<{id, started_at, ended_at, exercise_logs: {sets, exercises: {name, type}}[]}[]>` — same embedded shape as the existing `getRecentWorkouts`, but with no `.limit()`. Task 7 (`PerfilScreen.js`) uses this.

- [ ] **Step 1: Add the function**

In `src/lib/workouts.js`, add this new exported function (place it near `getRecentWorkouts` for readability):
```javascript
export async function getAllFinishedWorkouts(userId) {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, started_at, ended_at, exercise_logs(sets, exercises(name, type))')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: PASS, all existing suites unaffected.

- [ ] **Step 3: Commit**

```bash
git add src/lib/workouts.js
git commit -m "feat: add getAllFinishedWorkouts for lifetime stats"
```

---

## Task 5: `src/components/MiniSparkline.js`

**Files:**
- Create: `src/components/MiniSparkline.js`

**Interfaces:**
- Produces: `<MiniSparkline valores={number[]} ancho={number} alto={number} />`. Renders `null` if `valores.length < 2`. Task 7 (`PerfilScreen.js`) uses this.

- [ ] **Step 1: Implement**

Create `src/components/MiniSparkline.js`:
```javascript
import { View, StyleSheet } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { colors } from '../theme/colors';

export default function MiniSparkline({ valores, ancho, alto }) {
  if (valores.length < 2) return null;

  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;

  const puntos = valores.map((valor, i) => {
    const x = (i / (valores.length - 1)) * ancho;
    const y = alto - ((valor - min) / rango) * alto;
    return `${x},${y}`;
  });

  return (
    <View style={styles.contenedor}>
      <Svg width={ancho} height={alto}>
        <Polyline points={puntos.join(' ')} fill="none" stroke={colors.cobalto} strokeWidth={2} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { alignItems: 'center' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MiniSparkline.js
git commit -m "feat: add MiniSparkline component"
```

---

## Task 6: `src/components/EditarNombreModal.js`

**Files:**
- Create: `src/components/EditarNombreModal.js`

**Interfaces:**
- Produces: `<EditarNombreModal visible nombreActual onGuardar={(nombre: string) => Promise<void>} onClose />`. Safe as its own `<Modal>` — always opened from `PerfilScreen`, which is not a modal. Task 7 uses this.

- [ ] **Step 1: Implement**

Create `src/components/EditarNombreModal.js`:
```javascript
import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { colors } from '../theme/colors';

export default function EditarNombreModal({ visible, nombreActual, onGuardar, onClose }) {
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (visible) setNombre(nombreActual || '');
  }, [visible, nombreActual]);

  const nombreValido = nombre.trim() !== '';

  async function handleGuardar() {
    setGuardando(true);
    try {
      await onGuardar(nombre.trim());
    } catch (e) {
      console.error('Error al guardar nombre:', e.message, e);
      Alert.alert('Error', 'No se pudo guardar, intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.titulo}>Tu nombre</Text>
          <TextInput
            style={styles.input}
            placeholder="¿Cómo te llamás?"
            placeholderTextColor={colors.textTertiary}
            value={nombre}
            onChangeText={setNombre}
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
git add src/components/EditarNombreModal.js
git commit -m "feat: add name-edit modal"
```

---

## Task 7: `src/screens/PerfilScreen.js` (final wiring)

**Files:**
- Modify: `src/screens/PerfilScreen.js` (full content replaced)

**Interfaces:**
- Consumes: `getCheckinsForRange, getRachaMaxima, getSignedPhotoUrl` from `checkins.js`; `calcularRachaActual` from `rachaCalculo.js`; `getHoraRecordatorio, setHoraRecordatorio, sincronizarRecordatorios` from `recordatorio.js` (all pre-existing, unchanged); `getBodyLogsForRange` from `bodyLogs.js`; `getActiveGoal, getGoalHistory` from `goals.js`; `calcularProgreso` from `objetivoCalculo.js`; `getAllFinishedWorkouts` from `workouts.js` (Task 4); `calcularVolumenTotal` from `workoutsCalculo.js`; `sincronizarLogros, uploadProfilePhoto, getSignedProfilePhotoUrl` from `logrosDb.js` (Task 3); `MiniSparkline` (Task 5); `EditarNombreModal` (Task 6); `PhotoViewerModal` (pre-existing, generic via `getSignedUrl` prop); `colors, getRachaColor` from `theme/colors.js`.
- Produces: the screen registered in `src/navigation/TabNavigator.js` (already wired, no navigation changes needed).

- [ ] **Step 1: Implement**

Replace the full contents of `src/screens/PerfilScreen.js`:
```javascript
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ScrollView, Image, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { getCheckinsForRange, getRachaMaxima, getSignedPhotoUrl } from '../lib/checkins';
import { calcularRachaActual } from '../lib/rachaCalculo';
import { getHoraRecordatorio, setHoraRecordatorio, sincronizarRecordatorios } from '../lib/recordatorio';
import { getBodyLogsForRange } from '../lib/bodyLogs';
import { getActiveGoal, getGoalHistory } from '../lib/goals';
import { calcularProgreso } from '../lib/objetivoCalculo';
import { getAllFinishedWorkouts } from '../lib/workouts';
import { calcularVolumenTotal } from '../lib/workoutsCalculo';
import { sincronizarLogros, uploadProfilePhoto, getSignedProfilePhotoUrl } from '../lib/logrosDb';
import EditarNombreModal from '../components/EditarNombreModal';
import MiniSparkline from '../components/MiniSparkline';
import PhotoViewerModal from '../components/PhotoViewerModal';
import { colors, getRachaColor } from '../theme/colors';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatFechaLarga(fechaStr) {
  const d = new Date(fechaStr);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

const ANCHO_SPARKLINE = 260;

function FotoCheckin({ checkin, onSeleccionar }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    getSignedPhotoUrl(checkin.photo_path)
      .then(setUrl)
      .catch(() => {});
  }, [checkin.photo_path]);

  return (
    <Pressable style={styles.miniatura} onPress={() => onSeleccionar(checkin.photo_path)}>
      {url ? (
        <Image source={{ uri: url }} style={styles.miniaturaImagen} resizeMode="cover" />
      ) : (
        <View style={styles.miniaturaImagen} />
      )}
    </Pressable>
  );
}

export default function PerfilScreen() {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState('');
  const [miembroDesde, setMiembroDesde] = useState(null);
  const [fotoPerfilUrl, setFotoPerfilUrl] = useState(null);
  const [rachaActual, setRachaActual] = useState(0);
  const [rachaMaxima, setRachaMaxima] = useState(0);
  const [pesoActual, setPesoActual] = useState(null);
  const [sparklineValores, setSparklineValores] = useState([]);
  const [objetivoActivo, setObjetivoActivo] = useState(null);
  const [progresoObjetivo, setProgresoObjetivo] = useState(0);
  const [totalEntrenamientos, setTotalEntrenamientos] = useState(0);
  const [volumenTotal, setVolumenTotal] = useState(0);
  const [logros, setLogros] = useState([]);
  const [fotosRecientes, setFotosRecientes] = useState([]);
  const [fotoSeleccionada, setFotoSeleccionada] = useState(null);
  const [editarNombreVisible, setEditarNombreVisible] = useState(false);
  const [hora, setHora] = useState('20:00');

  const cargarDatos = useCallback(async (user) => {
    setNombre(user.user_metadata?.nombre || '');
    setMiembroDesde(user.created_at);

    try {
      const url = await getSignedProfilePhotoUrl(user.id);
      setFotoPerfilUrl(url);
    } catch {
      setFotoPerfilUrl(null);
    }

    const hoy = new Date();
    const desde60 = new Date();
    desde60.setDate(desde60.getDate() - 60);
    const checkinsRecientes = await getCheckinsForRange(user.id, desde60, hoy);
    const actual = calcularRachaActual(checkinsRecientes.map((c) => c.date));
    const maxima = await getRachaMaxima(user.id);
    setRachaActual(actual);
    setRachaMaxima(maxima);
    setFotosRecientes(checkinsRecientes.filter((c) => c.photo_path).reverse().slice(0, 8));

    const desdeInicio = new Date(2000, 0, 1);
    const logsPeso = await getBodyLogsForRange(user.id, desdeInicio, hoy);
    const ultimoPeso = logsPeso.length > 0 ? logsPeso[logsPeso.length - 1].weight : null;
    setPesoActual(ultimoPeso);
    setSparklineValores(logsPeso.slice(-10).map((l) => l.weight));

    const goal = await getActiveGoal(user.id);
    setObjetivoActivo(goal);
    if (goal) {
      const pesoParaProgreso = ultimoPeso !== null ? ultimoPeso : goal.start_value;
      setProgresoObjetivo(calcularProgreso(goal, pesoParaProgreso));
    }

    const historial = await getGoalHistory(user.id);
    const objetivosCompletados = historial.filter((g) => g.status === 'completado').length;

    const workouts = await getAllFinishedWorkouts(user.id);
    setTotalEntrenamientos(workouts.length);
    const volumen = workouts.reduce((total, w) => {
      const entradas = (w.exercise_logs ?? []).map((log) => ({ type: log.exercises.type, sets: log.sets }));
      return total + calcularVolumenTotal(entradas);
    }, 0);
    setVolumenTotal(volumen);

    const logrosDesbloqueados = await sincronizarLogros(user.id, {
      rachaMaxima: maxima,
      objetivosCompletados,
      totalEntrenamientos: workouts.length,
    });
    setLogros(logrosDesbloqueados);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelado = false;
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (cancelado) return;
        try {
          setUserId(user.id);
          const h = await getHoraRecordatorio();
          if (!cancelado) setHora(h);
          await cargarDatos(user);
        } catch (e) {
          console.error('Error al cargar Perfil:', e.message, e);
          if (!cancelado) Alert.alert('Error', 'No se pudo cargar, intentá de nuevo.');
        } finally {
          if (!cancelado) setLoading(false);
        }
      });
      return () => {
        cancelado = true;
      };
    }, [cargarDatos])
  );

  async function alCambiarHora(event, fecha) {
    if (!fecha) return;
    const horaStr = `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
    setHora(horaStr);
    await setHoraRecordatorio(horaStr);

    const hoy = new Date();
    const checkins = await getCheckinsForRange(
      userId,
      new Date(hoy.getFullYear(), 0, 1),
      new Date(hoy.getFullYear(), 11, 31)
    );
    await sincronizarRecordatorios(checkins);
  }

  async function handleGuardarNombre(nuevoNombre) {
    const { error } = await supabase.auth.updateUser({ data: { nombre: nuevoNombre } });
    if (error) throw error;
    setNombre(nuevoNombre);
    setEditarNombreVisible(false);
  }

  function elegirOrigenFotoPerfil() {
    Alert.alert('Foto de perfil', '¿Cómo querés agregarla?', [
      { text: 'Tomar foto', onPress: () => elegirFotoPerfil('camara') },
      { text: 'Elegir de galería', onPress: () => elegirFotoPerfil('galeria') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function elegirFotoPerfil(origen) {
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
    if (resultado.canceled) return;
    try {
      await uploadProfilePhoto(userId, resultado.assets[0].uri);
      const url = await getSignedProfilePhotoUrl(userId);
      setFotoPerfilUrl(url);
    } catch (e) {
      console.error('Error al subir foto de perfil:', e.message, e);
      Alert.alert('Error', 'No se pudo subir la foto, intentá de nuevo.');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.cargando}>Cargando...</Text>
      </View>
    );
  }

  const [horas, minutos] = hora.split(':').map(Number);
  const valorPicker = new Date();
  valorPicker.setHours(horas, minutos, 0, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 22 }}>
      <View style={styles.encabezado}>
        <Pressable onPress={elegirOrigenFotoPerfil}>
          {fotoPerfilUrl ? (
            <Image source={{ uri: fotoPerfilUrl }} style={styles.fotoPerfil} />
          ) : (
            <View style={[styles.fotoPerfil, styles.fotoPerfilPlaceholder]}>
              <Text style={styles.fotoPerfilInicial}>{(nombre || '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </Pressable>
        <Pressable onPress={() => setEditarNombreVisible(true)}>
          <Text style={styles.nombre}>{nombre || 'Poné tu nombre'} ✏️</Text>
        </Pressable>
        {miembroDesde && <Text style={styles.miembroDesde}>Miembro desde {formatFechaLarga(miembroDesde)}</Text>}
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCaja}>
          <Text style={[styles.statNumero, { color: getRachaColor(rachaActual) }]}>🔥 {rachaActual}</Text>
          <Text style={styles.statLabel}>Racha actual</Text>
        </View>
        <View style={styles.statCaja}>
          <Text style={styles.statNumero}>🏆 {rachaMaxima}</Text>
          <Text style={styles.statLabel}>Racha máxima</Text>
        </View>
        <View style={styles.statCaja}>
          <Text style={styles.statNumero}>⚖️ {pesoActual ?? '--'}</Text>
          <Text style={styles.statLabel}>Peso actual</Text>
        </View>
        {objetivoActivo && (
          <View style={styles.statCaja}>
            <Text style={styles.statNumero}>🎯 {progresoObjetivo}%</Text>
            <Text style={styles.statLabel}>Objetivo</Text>
          </View>
        )}
      </View>

      {sparklineValores.length >= 2 && (
        <View style={styles.sparklineCaja}>
          <Text style={styles.sparklineTitulo}>Tendencia de peso</Text>
          <MiniSparkline valores={sparklineValores} ancho={ANCHO_SPARKLINE} alto={40} />
        </View>
      )}

      <Text style={styles.subtitulo}>Logros</Text>
      {logros.length === 0 && <Text style={styles.sinDatos}>Todavía no desbloqueaste ningún logro.</Text>}
      <View style={styles.logrosGrid}>
        {logros.map((logro) => (
          <View key={logro.key} style={styles.logroChip}>
            <Text style={styles.logroEmoji}>{logro.emoji}</Text>
            <Text style={styles.logroLabel}>{logro.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.subtitulo}>Totales</Text>
      <View style={styles.totalesFila}>
        <View style={styles.totalCaja}>
          <Text style={styles.totalNumero}>{totalEntrenamientos}</Text>
          <Text style={styles.totalLabel}>Entrenamientos</Text>
        </View>
        <View style={styles.totalCaja}>
          <Text style={styles.totalNumero}>{volumenTotal}kg</Text>
          <Text style={styles.totalLabel}>Volumen total</Text>
        </View>
      </View>

      <Text style={styles.subtitulo}>Fotos recientes</Text>
      {fotosRecientes.length === 0 ? (
        <Text style={styles.sinDatos}>Todavía no subiste ninguna foto de check-in.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galeriaFila}>
          {fotosRecientes.map((checkin) => (
            <FotoCheckin key={checkin.id} checkin={checkin} onSeleccionar={setFotoSeleccionada} />
          ))}
        </ScrollView>
      )}

      <View style={styles.nubeFila}>
        <Text style={styles.nubeTexto}>☁️ Todo respaldado en la nube</Text>
      </View>

      <Text style={styles.subtitulo}>Configuración</Text>
      <View style={styles.fila}>
        <Text style={styles.filaTexto}>Recordatorio</Text>
        <DateTimePicker
          value={valorPicker}
          mode="time"
          display={Platform.OS === 'ios' ? 'compact' : 'default'}
          themeVariant="dark"
          onChange={alCambiarHora}
        />
      </View>
      <Pressable style={styles.signOutButton} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </Pressable>

      <EditarNombreModal
        visible={editarNombreVisible}
        nombreActual={nombre}
        onGuardar={handleGuardarNombre}
        onClose={() => setEditarNombreVisible(false)}
      />
      <PhotoViewerModal
        visible={!!fotoSeleccionada}
        photoPath={fotoSeleccionada}
        getSignedUrl={getSignedPhotoUrl}
        onClose={() => setFotoSeleccionada(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  cargando: { fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  encabezado: { alignItems: 'center', marginBottom: 24 },
  fotoPerfil: { width: 96, height: 96, borderRadius: 48, marginBottom: 12, backgroundColor: colors.surface },
  fotoPerfilPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  fotoPerfilInicial: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 36, color: colors.textPrimary },
  nombre: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: colors.textPrimary, marginBottom: 4 },
  miembroDesde: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textTertiary },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCaja: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  statNumero: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: colors.textPrimary },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textTertiary, marginTop: 4 },
  sparklineCaja: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    alignItems: 'center',
  },
  sparklineTitulo: { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  subtitulo: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 10,
    marginTop: 4,
  },
  sinDatos: { fontFamily: 'Inter_400Regular', color: colors.textTertiary, marginBottom: 16 },
  logrosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  logroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  logroEmoji: { fontSize: 16, marginRight: 6 },
  logroLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.textPrimary },
  totalesFila: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  totalCaja: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 14, alignItems: 'center' },
  totalNumero: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: colors.textPrimary },
  totalLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textTertiary, marginTop: 4 },
  galeriaFila: { marginBottom: 20 },
  miniatura: { marginRight: 10 },
  miniaturaImagen: { width: 72, height: 96, borderRadius: 14, backgroundColor: colors.surface },
  nubeFila: { alignItems: 'center', marginBottom: 24 },
  nubeTexto: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textTertiary },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  filaTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 15 },
  signOutButton: { paddingVertical: 12, alignItems: 'center', borderRadius: 20, backgroundColor: colors.racha.rojo },
  signOutText: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 15 },
});
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: PASS, all suites (existing + `logros.test.js`).

- [ ] **Step 3: Verify no bundler errors**

Read the Metro bundler background task output and confirm no new `ERROR` lines after this change.

- [ ] **Step 4: Commit**

```bash
git add src/screens/PerfilScreen.js
git commit -m "feat: build out Perfil dashboard with stats, achievements, and photo gallery"
```

- [ ] **Step 5: Manual verification on the phone**

Open the Perfil tab and check:
- Tapping the circular photo (or the "?" placeholder if no profile photo yet) opens the camera/gallery picker; picking one uploads it and it appears immediately.
- Tapping the name opens the edit modal; saving updates the header immediately.
- "Miembro desde" shows a real date.
- The stats grid shows racha actual (colored per the racha scale), racha máxima, peso actual, and — only if there's an active goal — its progress %.
- If there are at least 2 weight logs, the sparkline renders; otherwise it's absent, no crash.
- The Logros section shows any already-earned badges; if you cross a threshold (e.g., complete a 7-day streak), the new badge appears next time you open Perfil.
- Totales shows the right count of finished workouts and a plausible total volume.
- Fotos recientes shows check-in photos; tapping one opens it large via the existing photo viewer.
- The cloud-backup line, reminder time picker, and sign-out button still work exactly as before.

---
