# Módulo 3 (Parte A): Registro de peso/altura + gráfica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Executed inline/conversationally: Task 5 needs manual verification on the phone (camera/gallery permissions), per the project README.

**Goal:** Users can tap "Registrar" in the Físico tab, log today's weight/height (with an optional photo), and see their current weight plus a line chart of recent weigh-ins.

**Architecture:** `bodyLogs.js` mirrors the existing `checkins.js` data-access pattern (Supabase table + private Storage bucket + signed URLs). `WeightChart.js` is a small hand-rolled `react-native-svg` line chart with no third-party charting dependency. `RegistrarFisicoModal.js` is a self-contained form; `FisicoScreen.js` orchestrates fetch → render → save, following the same `useFocusEffect` + pull-to-refresh pattern already used in `RachaScreen.js`.

**Tech Stack:** Supabase (Postgres table + private Storage bucket), `react-native-svg`, existing `expo-image-picker`/`expo-file-system` upload pattern.

## Global Constraints

- One `body_logs` row per user per day, enforced by a DB unique constraint — from design doc.
- Units are kg/cm only for now; the kg↔lb and cm↔in switch is Módulo 5 (Perfil) work, out of scope here — from design doc.
- The photo is optional on this log (unlike Racha's check-in, which requires one) — from design doc.
- No third-party charting library — build the line chart with `react-native-svg` directly — from design doc, to avoid the SDK-version compatibility issues hit in Módulo 1.

---

## File Structure

- Create: `supabase/migrations/0002_body_logs.sql` — schema + RLS + storage bucket/policies.
- Create: `src/lib/bodyLogs.js` — Supabase data access for body logs.
- Create: `src/components/WeightChart.js` — SVG line chart.
- Create: `src/components/RegistrarFisicoModal.js` — weight/height/photo entry form.
- Modify: `src/screens/FisicoScreen.js` — orchestrates the above.

---

## Task 1: Supabase schema, RLS, and Storage bucket

**Files:**
- Create: `supabase/migrations/0002_body_logs.sql`

**Interfaces:**
- Produces: table `body_logs(id, user_id, date, weight, height, photo_path, created_at)` with RLS restricting rows to `auth.uid() = user_id`; Storage bucket `body_photos` (private) with RLS restricting objects to their owner's folder. Task 2 (`bodyLogs.js`) depends on both existing.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0002_body_logs.sql`:
```sql
create table body_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight numeric not null,
  height numeric not null,
  photo_path text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table body_logs enable row level security;

create policy "Users manage their own body logs"
  on body_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('body_photos', 'body_photos', false);

create policy "Users manage their own body photos"
  on storage.objects for all
  using (bucket_id = 'body_photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'body_photos' and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 2: Apply the migration to the Supabase project**

Use the Supabase MCP tool `apply_migration` with `project_id: "holaqwecblmdgefeulrr"`, `name: "body_logs"`, and the SQL content above.

- [ ] **Step 3: Verify the table and bucket exist**

Use the Supabase MCP tool `list_tables` with `project_id: "holaqwecblmdgefeulrr"`.
Expected: `body_logs` appears with RLS enabled.

Use `execute_sql` with:
```sql
select id, public from storage.buckets where id = 'body_photos';
```
Expected: the `body_photos` bucket exists with `public = false`.

- [ ] **Step 4: Commit the migration file**

```bash
git add supabase/migrations/0002_body_logs.sql
git commit -m "feat: add body_logs table and private body_photos storage bucket"
```

---

## Task 2: Data access — `src/lib/bodyLogs.js`

**Files:**
- Create: `src/lib/bodyLogs.js`

**Interfaces:**
- Produces:
  - `getBodyLogsForRange(userId: string, fromDate: Date, toDate: Date) => Promise<{id, date, weight, height, photo_path}[]>`
  - `getTodayBodyLog(userId: string) => Promise<{id, date, weight, height, photo_path} | null>`
  - `createBodyLog(userId: string, { weight: number, height: number, photoUri: string|null }) => Promise<{id, date, weight, height, photo_path}>`
  - `getSignedBodyPhotoUrl(photoPath: string) => Promise<string>`
  Task 5 (`FisicoScreen`) calls these.

- [ ] **Step 1: Implement the module**

Create `src/lib/bodyLogs.js`:
```javascript
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

const BUCKET = 'body_photos';

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getBodyLogsForRange(userId, fromDate, toDate) {
  const { data, error } = await supabase
    .from('body_logs')
    .select('id, date, weight, height, photo_path')
    .eq('user_id', userId)
    .gte('date', formatDate(fromDate))
    .lte('date', formatDate(toDate))
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getTodayBodyLog(userId) {
  const hoy = formatDate(new Date());
  const { data, error } = await supabase
    .from('body_logs')
    .select('id, date, weight, height, photo_path')
    .eq('user_id', userId)
    .eq('date', hoy)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createBodyLog(userId, { weight, height, photoUri }) {
  const hoy = formatDate(new Date());
  let photoPath = null;

  if (photoUri) {
    photoPath = `${userId}/${hoy}.jpg`;
    const base64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(photoPath, decode(base64), { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;
  }

  const { data, error } = await supabase
    .from('body_logs')
    .insert({ user_id: userId, date: hoy, weight, height, photo_path: photoPath })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSignedBodyPhotoUrl(photoPath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(photoPath, 60);
  if (error) throw error;
  return data.signedUrl;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bodyLogs.js
git commit -m "feat: add body logs data access module"
```

---

## Task 3: `WeightChart` component

**Files:**
- Create: `src/components/WeightChart.js`

**Interfaces:**
- Produces: `<WeightChart logs={[{date, weight}]} />` — `logs` must be sorted ascending by date. Task 5 (`FisicoScreen`) renders this.

- [ ] **Step 1: Install react-native-svg**

```bash
npx expo install react-native-svg
```

- [ ] **Step 2: Implement the component**

Create `src/components/WeightChart.js`:
```javascript
import { Dimensions, View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { colors } from '../theme/colors';

const ALTURA = 160;
const ANCHO = Dimensions.get('window').width - 44;

export default function WeightChart({ logs }) {
  if (logs.length < 2) {
    return (
      <View style={[styles.contenedor, styles.centrado]}>
        <Text style={styles.mensaje}>Registrá más días para ver tu evolución</Text>
      </View>
    );
  }

  const pesos = logs.map((l) => l.weight);
  const min = Math.min(...pesos);
  const max = Math.max(...pesos);
  const margen = (max - min) * 0.1 || 1;
  const pesoMin = min - margen;
  const pesoMax = max + margen;

  const puntos = logs.map((log, i) => {
    const x = (i / (logs.length - 1)) * ANCHO;
    const y = ALTURA - ((log.weight - pesoMin) / (pesoMax - pesoMin)) * (ALTURA - 16) - 8;
    return { x, y };
  });

  const puntosStr = puntos.map((p) => `${p.x},${p.y}`).join(' ');
  const ultimo = puntos[puntos.length - 1];

  return (
    <View style={styles.contenedor}>
      <Svg width={ANCHO} height={ALTURA}>
        <Polyline points={puntosStr} fill="none" stroke={colors.cobalto} strokeWidth={2} />
        <Circle cx={ultimo.x} cy={ultimo.y} r={4} fill={colors.cobalto} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginVertical: 16 },
  centrado: { height: ALTURA, alignItems: 'center', justifyContent: 'center' },
  mensaje: { fontFamily: 'Inter_400Regular', color: colors.textTertiary, textAlign: 'center' },
});
```

- [ ] **Step 3: Commit**

```bash
git add src/components/WeightChart.js package.json package-lock.json
git commit -m "feat: add hand-rolled SVG weight chart"
```

---

## Task 4: `RegistrarFisicoModal` component

**Files:**
- Create: `src/components/RegistrarFisicoModal.js`

**Interfaces:**
- Produces: `<RegistrarFisicoModal visible={boolean} alturaInicial={number|null} onGuardar={({weight, height, photoUri}) => Promise<void>} onClose={() => void} />`. Task 5 uses this.

- [ ] **Step 1: Implement**

Create `src/components/RegistrarFisicoModal.js`:
```javascript
import { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';

export default function RegistrarFisicoModal({ visible, alturaInicial, onGuardar, onClose }) {
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState(alturaInicial ? String(alturaInicial) : '');
  const [photoUri, setPhotoUri] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const pesoValido = peso.trim() !== '' && !Number.isNaN(Number(peso));
  const alturaValida = altura.trim() !== '' && !Number.isNaN(Number(altura));

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

  async function handleGuardar() {
    setGuardando(true);
    try {
      await onGuardar({ weight: Number(peso), height: Number(altura), photoUri });
      setPeso('');
      setPhotoUri(null);
    } catch (e) {
      console.error('Error al guardar registro físico:', e.message, e);
      Alert.alert('Error', 'No se pudo guardar, intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.titulo}>Registrar hoy</Text>
          <TextInput
            style={styles.input}
            placeholder="Peso (kg)"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            value={peso}
            onChangeText={setPeso}
          />
          <TextInput
            style={styles.input}
            placeholder="Altura (cm)"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            value={altura}
            onChangeText={setAltura}
          />
          <Pressable style={styles.fotoButton} onPress={elegirOrigenFoto}>
            <Text style={styles.fotoButtonTexto}>{photoUri ? 'Foto lista ✓' : 'Agregar foto (opcional)'}</Text>
          </Pressable>
          <Pressable
            style={[
              styles.guardarButton,
              (!pesoValido || !alturaValida || guardando) && styles.guardarButtonDeshabilitado,
            ]}
            disabled={!pesoValido || !alturaValida || guardando}
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
    marginBottom: 12,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  fotoButton: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  fotoButtonTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary },
  guardarButton: { borderRadius: 20, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.cobalto },
  guardarButtonDeshabilitado: { opacity: 0.5 },
  guardarButtonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
  cancelar: { textAlign: 'center', marginTop: 16, fontFamily: 'Inter_500Medium', color: colors.textSecondary },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RegistrarFisicoModal.js
git commit -m "feat: add RegistrarFisicoModal component"
```

---

## Task 5: Wire into `FisicoScreen`

**Files:**
- Modify: `src/screens/FisicoScreen.js`

**Interfaces:**
- Consumes: `getBodyLogsForRange`, `createBodyLog` (Task 2); `WeightChart` (Task 3); `RegistrarFisicoModal` (Task 4).

- [ ] **Step 1: Replace the file**

Replace `src/screens/FisicoScreen.js` entirely:
```javascript
import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getBodyLogsForRange, createBodyLog } from '../lib/bodyLogs';
import WeightChart from '../components/WeightChart';
import RegistrarFisicoModal from '../components/RegistrarFisicoModal';
import { colors } from '../theme/colors';

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function FisicoScreen() {
  const [userId, setUserId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logHoy, setLogHoy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const cargarDatos = useCallback(async (uid) => {
    const hoy = new Date();
    const desde = new Date();
    desde.setDate(desde.getDate() - 84);
    const lista = await getBodyLogsForRange(uid, desde, hoy);
    setLogs(lista);
    setLogHoy(lista.find((l) => l.date === formatDate(hoy)) || null);
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

  async function handleGuardar({ weight, height, photoUri }) {
    await createBodyLog(userId, { weight, height, photoUri });
    await cargarDatos(userId);
    setModalVisible(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.cobalto} />
      </View>
    );
  }

  const pesoActual = logs.length > 0 ? logs[logs.length - 1].weight : null;
  const ultimaAltura = logs.length > 0 ? logs[logs.length - 1].height : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 22 }}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={handleRefrescar} tintColor={colors.cobalto} />
      }
    >
      <Text style={styles.titulo}>Físico</Text>
      <View style={styles.pesoFila}>
        <Text style={styles.pesoNumero}>{pesoActual ?? '--'}</Text>
        <Text style={styles.pesoUnidad}>kg</Text>
      </View>
      <WeightChart logs={logs} />
      <Pressable
        style={[styles.boton, logHoy && styles.botonHecho]}
        disabled={!!logHoy}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.botonTexto}>{logHoy ? '✅ Ya registraste hoy' : 'Registrar'}</Text>
      </Pressable>
      <RegistrarFisicoModal
        visible={modalVisible}
        alturaInicial={ultimaAltura}
        onGuardar={handleGuardar}
        onClose={() => setModalVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginBottom: 16 },
  pesoFila: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  pesoNumero: { fontSize: 44, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginRight: 8 },
  pesoUnidad: { fontSize: 18, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  boton: { marginTop: 24, borderRadius: 20, paddingVertical: 16, alignItems: 'center', backgroundColor: colors.cobalto },
  botonHecho: { backgroundColor: colors.surface },
  botonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
});
```

- [ ] **Step 2: Manual verification on the iPhone**

Explicar al usuario: "En la pestaña Físico vas a ver '--' de peso inicialmente, un mensaje pidiendo más días para la gráfica, y el botón 'Registrar'."
Acción manual: tocar "Registrar", poner un peso y una altura, opcionalmente agregar foto, tocar "Guardar".
Expected: el peso actual se actualiza arriba, el botón pasa a "✅ Ya registraste hoy". Repetir al día siguiente (o insertando un dato de prueba vía SQL) para ver aparecer la gráfica con 2+ puntos.

- [ ] **Step 3: Commit**

```bash
git add src/screens/FisicoScreen.js
git commit -m "feat: wire weight/height logging and chart into FisicoScreen"
```
