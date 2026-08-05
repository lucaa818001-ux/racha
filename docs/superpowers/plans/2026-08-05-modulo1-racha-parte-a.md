# Módulo 1 (Parte A): Check-in diario + calendario — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is executed **inline, conversationally**, since Task 6 needs the user to grant camera/photo permissions and test on their physical iPhone — per the project README's requirement to explain and confirm each step with a first-time programmer.

**Goal:** Users can tap "Registrar hoy", take or pick a photo, and see it reflected as a colored day in a monthly calendar, with a running current-streak counter at the top.

**Architecture:** A pure function computes the streak from a list of dates (no dependencies, fully unit-tested). A small data-access module (`src/lib/checkins.js`) wraps Supabase table + Storage calls. Two presentational components (`CalendarGrid`, `PhotoViewerModal`) render UI from props only. `RachaScreen.js` orchestrates: fetch → compute → render → handle the check-in action.

**Tech Stack:** Supabase (Postgres table + private Storage bucket), `expo-image-picker`, Jest (`jest-expo` preset) for the first unit tests in this project.

## Global Constraints

- Explain steps in plain language, one at a time, wait for confirmation before manual/physical actions (camera permission, testing on phone) — from README.
- Color of a check-in day is frozen at creation time (`racha_dia` column) — never recalculated retroactively — from design doc.
- Photos are private: stored under `<user_id>/<date>.jpg` in a non-public bucket, served via short-lived signed URLs — from design doc.
- One check-in per user per day, enforced by a DB unique constraint — from README.
- Dates are computed in the device's **local** timezone, not UTC — from design doc.

---

## File Structure

- Create: `supabase/migrations/0001_gym_checkins.sql` — schema + RLS + storage bucket/policies (applied via Supabase MCP, kept in repo for history).
- Create: `src/lib/rachaCalculo.js` — pure streak-calculation function.
- Create: `src/lib/rachaCalculo.test.js` — Jest tests for the above.
- Create: `src/lib/checkins.js` — Supabase data access (table + storage).
- Create: `src/components/CalendarGrid.js` — presentational monthly grid.
- Create: `src/components/PhotoViewerModal.js` — presentational photo modal.
- Modify: `src/screens/RachaScreen.js` — orchestrates the above.
- Modify: `package.json` — add `jest`, `jest-expo`, `test` script, `jest` config block.

---

## Task 1: Supabase schema, RLS, and Storage bucket

**Files:**
- Create: `supabase/migrations/0001_gym_checkins.sql`

**Interfaces:**
- Produces: table `gym_checkins(id, user_id, date, photo_path, racha_dia, created_at)` with RLS restricting rows to `auth.uid() = user_id`; Storage bucket `checkins` (private) with RLS restricting objects to their owner's folder. Task 3 (`checkins.js`) depends on both existing.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0001_gym_checkins.sql`:
```sql
create table gym_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  photo_path text not null,
  racha_dia integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table gym_checkins enable row level security;

create policy "Users manage their own checkins"
  on gym_checkins for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('checkins', 'checkins', false);

create policy "Users manage their own checkin photos"
  on storage.objects for all
  using (bucket_id = 'checkins' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'checkins' and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 2: Apply the migration to the Supabase project**

Use the Supabase MCP tool `apply_migration` with `project_id: "holaqwecblmdgefeulrr"`, `name: "gym_checkins"`, and the SQL content above.

- [ ] **Step 3: Verify the table and policies exist**

Use the Supabase MCP tool `list_tables` with `project_id: "holaqwecblmdgefeulrr"`.
Expected: `gym_checkins` appears with RLS enabled.

Use `execute_sql` with:
```sql
select bucket_id, name from storage.objects limit 1;
select id, public from storage.buckets where id = 'checkins';
```
Expected: the `checkins` bucket exists with `public = false`.

- [ ] **Step 4: Commit the migration file**

```bash
git add supabase/migrations/0001_gym_checkins.sql
git commit -m "feat: add gym_checkins table and private photo storage bucket"
```

---

## Task 2: Streak calculation (TDD)

**Files:**
- Create: `src/lib/rachaCalculo.js`
- Create: `src/lib/rachaCalculo.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `calcularRachaActual(fechasCheckin: string[], hoy?: Date) => number`. `fechasCheckin` are `"YYYY-MM-DD"` strings in any order. Task 3 and Task 6 both call this function.

- [ ] **Step 1: Install Jest**

```bash
npx expo install jest-expo jest --dev
```

- [ ] **Step 2: Add the test script and config to package.json**

Add to `package.json` (top level, alongside `"scripts"`):
```json
"scripts": {
  "start": "expo start",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "web": "expo start --web",
  "test": "jest"
},
"jest": {
  "preset": "jest-expo"
}
```

- [ ] **Step 3: Write the failing tests**

Create `src/lib/rachaCalculo.test.js`:
```javascript
import { calcularRachaActual } from './rachaCalculo';

const hoy = new Date('2026-08-05T12:00:00');

test('sin check-ins, la racha es 0', () => {
  expect(calcularRachaActual([], hoy)).toBe(0);
});

test('con check-in de hoy y ayer, la racha es 2', () => {
  expect(calcularRachaActual(['2026-08-05', '2026-08-04'], hoy)).toBe(2);
});

test('sin check-in de hoy pero si de ayer, cuenta desde ayer', () => {
  expect(calcularRachaActual(['2026-08-04', '2026-08-03'], hoy)).toBe(2);
});

test('un hueco corta la racha antes de ese hueco', () => {
  expect(calcularRachaActual(['2026-08-05', '2026-08-03'], hoy)).toBe(1);
});

test('sin check-in de hoy ni ayer, la racha es 0', () => {
  expect(calcularRachaActual(['2026-08-01'], hoy)).toBe(0);
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with "Cannot find module './rachaCalculo'".

- [ ] **Step 5: Implement the minimal function**

Create `src/lib/rachaCalculo.js`:
```javascript
function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calcularRachaActual(fechasCheckin, hoy = new Date()) {
  const fechasSet = new Set(fechasCheckin);
  const cursor = new Date(hoy);
  if (!fechasSet.has(formatDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let racha = 0;
  while (fechasSet.has(formatDate(cursor))) {
    racha++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return racha;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/rachaCalculo.js src/lib/rachaCalculo.test.js package.json package-lock.json
git commit -m "feat: add streak calculation with tests"
```

---

## Task 3: Racha color helper

**Files:**
- Modify: `src/theme/colors.js`

**Interfaces:**
- Produces: `getRachaColor(rachaDia: number) => string` (hex color). Task 5 (`CalendarGrid`) and Task 6 (`RachaScreen`) use this.

- [ ] **Step 1: Add the helper function**

Modify `src/theme/colors.js` to add at the end of the file:
```javascript
export function getRachaColor(rachaDia) {
  if (rachaDia >= 28) return colors.racha.violeta;
  if (rachaDia >= 21) return colors.racha.rojo;
  if (rachaDia >= 14) return colors.racha.naranja;
  if (rachaDia >= 7) return colors.racha.amarillo;
  return colors.racha.verde;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/theme/colors.js
git commit -m "feat: add streak color helper"
```

---

## Task 4: Data access — `src/lib/checkins.js`

**Files:**
- Create: `src/lib/checkins.js`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase.js`; `calcularRachaActual` from `src/lib/rachaCalculo.js` (Task 2).
- Produces:
  - `getCheckinsForRange(userId: string, fromDate: Date, toDate: Date) => Promise<{id, date, photo_path, racha_dia}[]>`
  - `getTodayCheckin(userId: string) => Promise<{id, date, photo_path, racha_dia} | null>`
  - `createCheckin(userId: string, photoUri: string) => Promise<{id, date, photo_path, racha_dia}>`
  - `getSignedPhotoUrl(photoPath: string) => Promise<string>`
  Task 6 (`RachaScreen`) and Task 6's `PhotoViewerModal` usage call these.

- [ ] **Step 1: Implement the module**

Create `src/lib/checkins.js`:
```javascript
import { supabase } from './supabase';
import { calcularRachaActual } from './rachaCalculo';

const BUCKET = 'checkins';

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getCheckinsForRange(userId, fromDate, toDate) {
  const { data, error } = await supabase
    .from('gym_checkins')
    .select('id, date, photo_path, racha_dia')
    .eq('user_id', userId)
    .gte('date', formatDate(fromDate))
    .lte('date', formatDate(toDate))
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getTodayCheckin(userId) {
  const hoy = formatDate(new Date());
  const { data, error } = await supabase
    .from('gym_checkins')
    .select('id, date, photo_path, racha_dia')
    .eq('user_id', userId)
    .eq('date', hoy)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createCheckin(userId, photoUri) {
  const hoy = formatDate(new Date());
  const desde = new Date();
  desde.setDate(desde.getDate() - 60);
  const recientes = await getCheckinsForRange(userId, desde, new Date());
  const rachaDia = calcularRachaActual(recientes.map((c) => c.date)) + 1;

  const photoPath = `${userId}/${hoy}.jpg`;
  const response = await fetch(photoUri);
  const blob = await response.blob();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(photoPath, blob, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('gym_checkins')
    .insert({ user_id: userId, date: hoy, photo_path: photoPath, racha_dia: rachaDia })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSignedPhotoUrl(photoPath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(photoPath, 60);
  if (error) throw error;
  return data.signedUrl;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/checkins.js
git commit -m "feat: add checkins data access module"
```

---

## Task 5: `CalendarGrid` and `PhotoViewerModal` components

**Files:**
- Create: `src/components/CalendarGrid.js`
- Create: `src/components/PhotoViewerModal.js`

**Interfaces:**
- Consumes: `colors`, `getRachaColor` from `src/theme/colors.js` (Task 3); `getSignedPhotoUrl` from `src/lib/checkins.js` (Task 4).
- Produces: `<CalendarGrid year={number} month={number} checkins={array} onDayPress={(checkin) => void} />` and `<PhotoViewerModal visible={boolean} photoPath={string|null} onClose={() => void} />`. Task 6 renders both.

- [ ] **Step 1: Implement `CalendarGrid`**

Create `src/components/CalendarGrid.js`:
```javascript
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, getRachaColor } from '../theme/colors';

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function buildGrid(year, month) {
  const primerDia = new Date(year, month, 1);
  const offset = (primerDia.getDay() + 6) % 7;
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let dia = 1; dia <= diasEnMes; dia++) celdas.push(dia);
  while (celdas.length % 7 !== 0) celdas.push(null);
  return celdas;
}

export default function CalendarGrid({ year, month, checkins, onDayPress }) {
  const celdas = buildGrid(year, month);
  const checkinsPorDia = {};
  checkins.forEach((c) => {
    const d = new Date(c.date + 'T00:00:00');
    if (d.getFullYear() === year && d.getMonth() === month) {
      checkinsPorDia[d.getDate()] = c;
    }
  });
  const hoy = new Date();
  const esHoy = (dia) =>
    dia === hoy.getDate() && month === hoy.getMonth() && year === hoy.getFullYear();

  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) {
    semanas.push(celdas.slice(i, i + 7));
  }

  return (
    <View>
      <View style={styles.fila}>
        {DIAS_SEMANA.map((d) => (
          <Text key={d} style={styles.diaSemana}>{d}</Text>
        ))}
      </View>
      {semanas.map((semana, i) => (
        <View key={i} style={styles.fila}>
          {semana.map((dia, idx) => {
            if (dia === null) return <View key={idx} style={styles.celda} />;
            const checkin = checkinsPorDia[dia];
            const bg = checkin ? getRachaColor(checkin.racha_dia) : colors.surface;
            return (
              <Pressable
                key={idx}
                style={[styles.celda, { backgroundColor: bg }, esHoy(dia) && styles.celdaHoy]}
                disabled={!checkin}
                onPress={() => checkin && onDayPress(checkin)}
              >
                <Text style={styles.numeroDia}>{dia}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  diaSemana: { width: 40, textAlign: 'center', color: colors.textTertiary, fontFamily: 'Inter_500Medium' },
  celda: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  celdaHoy: { borderWidth: 2, borderColor: '#fff' },
  numeroDia: { color: colors.textPrimary, fontFamily: 'Inter_500Medium', fontSize: 13 },
});
```

- [ ] **Step 2: Implement `PhotoViewerModal`**

Create `src/components/PhotoViewerModal.js`:
```javascript
import { useEffect, useState } from 'react';
import { Modal, View, Image, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { getSignedPhotoUrl } from '../lib/checkins';
import { colors } from '../theme/colors';

export default function PhotoViewerModal({ visible, photoPath, onClose }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible || !photoPath) return;
    setUrl(null);
    setError(null);
    getSignedPhotoUrl(photoPath)
      .then(setUrl)
      .catch(() => setError('No se pudo cargar la foto'));
  }, [visible, photoPath]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {error && <Text style={styles.error}>{error}</Text>}
        {!error && !url && <ActivityIndicator size="large" color={colors.cobalto} />}
        {url && <Image source={{ uri: url }} style={styles.image} resizeMode="contain" />}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  image: { width: '90%', height: '80%' },
  error: { color: colors.textPrimary, fontFamily: 'Inter_500Medium' },
});
```

- [ ] **Step 3: Commit**

```bash
git add src/components/CalendarGrid.js src/components/PhotoViewerModal.js
git commit -m "feat: add CalendarGrid and PhotoViewerModal components"
```

---

## Task 6: Wire it into `RachaScreen`

**Files:**
- Modify: `src/screens/RachaScreen.js`

**Interfaces:**
- Consumes: everything from Tasks 2–5 (`calcularRachaActual`, `getCheckinsForRange`, `createCheckin`, `CalendarGrid`, `PhotoViewerModal`, `colors`).

- [ ] **Step 1: Install expo-image-picker**

```bash
npx expo install expo-image-picker
```

- [ ] **Step 2: Rewrite the screen**

Replace `src/screens/RachaScreen.js` entirely:
```javascript
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { getCheckinsForRange, createCheckin } from '../lib/checkins';
import { calcularRachaActual } from '../lib/rachaCalculo';
import CalendarGrid from '../components/CalendarGrid';
import PhotoViewerModal from '../components/PhotoViewerModal';
import { colors } from '../theme/colors';

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function RachaScreen() {
  const [userId, setUserId] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [rachaActual, setRachaActual] = useState(0);
  const [checkinHoy, setCheckinHoy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [fotoSeleccionada, setFotoSeleccionada] = useState(null);

  const hoy = new Date();

  const cargarDatos = useCallback(async (uid) => {
    const desde = new Date();
    desde.setDate(desde.getDate() - 60);
    const lista = await getCheckinsForRange(uid, desde, new Date());
    setCheckins(lista);
    setRachaActual(calcularRachaActual(lista.map((c) => c.date)));
    setCheckinHoy(lista.find((c) => c.date === formatDate(hoy)) || null);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUserId(user.id);
      await cargarDatos(user.id);
      setLoading(false);
    });
  }, [cargarDatos]);

  async function elegirFoto(origen) {
    const permiso =
      origen === 'camara'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Activá el permiso correspondiente en Ajustes para poder registrar tu día.');
      return;
    }
    const resultado =
      origen === 'camara'
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (resultado.canceled) return;

    setSubiendo(true);
    try {
      await createCheckin(userId, resultado.assets[0].uri);
      await cargarDatos(userId);
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar, intentá de nuevo.');
    } finally {
      setSubiendo(false);
    }
  }

  function handleRegistrar() {
    Alert.alert('Registrar hoy', '¿Cómo querés agregar la foto?', [
      { text: 'Tomar foto', onPress: () => elegirFoto('camara') },
      { text: 'Elegir de galería', onPress: () => elegirFoto('galeria') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.cobalto} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Racha</Text>
      <View style={styles.contador}>
        <Text style={styles.llama}>🔥</Text>
        <Text style={styles.numero}>{rachaActual}</Text>
        <Text style={styles.dias}>días seguidos</Text>
      </View>
      <CalendarGrid
        year={hoy.getFullYear()}
        month={hoy.getMonth()}
        checkins={checkins}
        onDayPress={(checkin) => setFotoSeleccionada(checkin.photo_path)}
      />
      <Pressable
        style={[styles.boton, checkinHoy && styles.botonHecho]}
        disabled={!!checkinHoy || subiendo}
        onPress={handleRegistrar}
      >
        <Text style={styles.botonTexto}>
          {subiendo ? 'Subiendo...' : checkinHoy ? '✅ Ya fuiste hoy' : 'Registrar hoy'}
        </Text>
      </Pressable>
      <PhotoViewerModal
        visible={!!fotoSeleccionada}
        photoPath={fotoSeleccionada}
        onClose={() => setFotoSeleccionada(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 22 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginBottom: 16 },
  contador: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 24 },
  llama: { fontSize: 32, marginRight: 8 },
  numero: { fontSize: 48, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginRight: 8 },
  dias: { fontSize: 16, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  boton: { marginTop: 24, borderRadius: 20, paddingVertical: 16, alignItems: 'center', backgroundColor: colors.cobalto },
  botonHecho: { backgroundColor: colors.surface },
  botonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
});
```

- [ ] **Step 3: Manual verification on the iPhone**

Explicar al usuario: "Ahora en la pestaña Racha deberías ver el contador arriba, el calendario del mes, y el botón 'Registrar hoy' abajo."
Acción manual: tocar "Registrar hoy" → elegir "Tomar foto" → sacar una foto → confirmar. iOS va a pedir permiso de cámara la primera vez (avisar al usuario que toque "Permitir").
Expected: el botón pasa a "✅ Ya fuiste hoy", el día de hoy en el calendario se pinta de verde, y tocar ese día muestra la foto recién tomada.

- [ ] **Step 4: Commit**

```bash
git add src/screens/RachaScreen.js package.json package-lock.json
git commit -m "feat: wire daily check-in and calendar into RachaScreen"
```
