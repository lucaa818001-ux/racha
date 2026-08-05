# Módulo 1 (Parte B): Estadísticas, vista anual y recordatorio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Executed inline/conversationally: Task 5 needs the user to grant a notification permission and Task 7 needs manual verification on the phone, per the project README.

**Goal:** The Racha screen shows lifetime-max streak and averages, lets the user browse past months and see a 12-month heatmap of the current year, and sends a configurable daily local reminder if the user hasn't checked in yet.

**Architecture:** Two new pure functions (`getRachaMaxima`, `calcularEstadisticas`) derive stats from data already being fetched. `CalendarGrid` gains a `compact` display mode reused by a new `YearHeatmap` component, avoiding duplicating grid-building logic. A new `recordatorio.js` module owns all `expo-notifications` calls behind three functions, called from both `RachaScreen` and `PerfilScreen`.

**Tech Stack:** `expo-notifications` (local notifications only), `@react-native-community/datetimepicker`, existing Supabase/Jest setup.

## Global Constraints

- Month navigation and the year heatmap are restricted to the current year — no browsing previous years (design decision, scope limit).
- The reminder time is a per-device preference stored in `AsyncStorage`, not synced to Supabase — from design doc.
- Reminders are rescheduled (not perfectly background-checked) each time the app opens or a check-in happens; the app does not attempt background fetch — from design doc, an explicit accepted limitation of Expo Go.
- Denied notification permission must not repeatedly prompt or alert the user — from design doc.

---

## File Structure

- Modify: `src/lib/checkins.js` — add `getRachaMaxima`.
- Create: `src/lib/estadisticas.js` + `src/lib/estadisticas.test.js` — pure stats calculation, TDD.
- Modify: `src/components/CalendarGrid.js` — add `compact` prop.
- Create: `src/components/MonthSelector.js` — month navigation arrows.
- Create: `src/components/YearHeatmap.js` — 12-month compact grid.
- Create: `src/lib/recordatorio.js` — notification scheduling.
- Modify: `src/screens/RachaScreen.js` — wire stats, toggle, month/year views.
- Modify: `src/screens/PerfilScreen.js` — add reminder time row.

---

## Task 1: Stats calculation (TDD)

**Files:**
- Modify: `src/lib/checkins.js`
- Create: `src/lib/estadisticas.js`
- Create: `src/lib/estadisticas.test.js`

**Interfaces:**
- Produces: `getRachaMaxima(userId: string) => Promise<number>` (in `checkins.js`); `calcularEstadisticas(checkinsDelAnio: {date: string}[], hoy?: Date) => { totalMes: number, totalAnio: number, promedioSemanal: number }` (in `estadisticas.js`). Task 6 (`RachaScreen`) consumes both.

- [ ] **Step 1: Add `getRachaMaxima` to `checkins.js`**

Add to the end of `src/lib/checkins.js`:
```javascript
export async function getRachaMaxima(userId) {
  const { data, error } = await supabase
    .from('gym_checkins')
    .select('racha_dia')
    .eq('user_id', userId)
    .order('racha_dia', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? data.racha_dia : 0;
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/estadisticas.test.js`:
```javascript
import { calcularEstadisticas } from './estadisticas';

const hoy = new Date('2026-08-05T12:00:00');

test('sin check-ins, todo en 0', () => {
  expect(calcularEstadisticas([], hoy)).toEqual({ totalMes: 0, totalAnio: 0, promedioSemanal: 0 });
});

test('cuenta check-ins del mes actual', () => {
  const checkins = [{ date: '2026-08-01' }, { date: '2026-08-03' }, { date: '2026-07-15' }];
  expect(calcularEstadisticas(checkins, hoy).totalMes).toBe(2);
});

test('cuenta el total del anio incluyendo otros meses', () => {
  const checkins = [{ date: '2026-01-05' }, { date: '2026-08-01' }];
  expect(calcularEstadisticas(checkins, hoy).totalAnio).toBe(2);
});

test('promedio semanal usa los ultimos 28 dias', () => {
  const checkins = [
    { date: '2026-08-05' }, { date: '2026-08-04' }, { date: '2026-08-03' }, { date: '2026-08-02' },
    { date: '2026-01-01' },
  ];
  expect(calcularEstadisticas(checkins, hoy).promedioSemanal).toBe(1);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- estadisticas`
Expected: FAIL with "Cannot find module './estadisticas'".

- [ ] **Step 4: Implement the minimal function**

Create `src/lib/estadisticas.js`:
```javascript
function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calcularEstadisticas(checkinsDelAnio, hoy = new Date()) {
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const hace28Dias = new Date(hoy);
  hace28Dias.setDate(hace28Dias.getDate() - 27);

  const totalMes = checkinsDelAnio.filter(
    (c) => c.date >= formatDate(inicioMes) && c.date <= formatDate(hoy)
  ).length;
  const totalAnio = checkinsDelAnio.length;
  const totalUltimas4Semanas = checkinsDelAnio.filter(
    (c) => c.date >= formatDate(hace28Dias) && c.date <= formatDate(hoy)
  ).length;
  const promedioSemanal = Math.round((totalUltimas4Semanas / 4) * 10) / 10;

  return { totalMes, totalAnio, promedioSemanal };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- estadisticas`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/checkins.js src/lib/estadisticas.js src/lib/estadisticas.test.js
git commit -m "feat: add streak-max and stats calculation with tests"
```

---

## Task 2: `CalendarGrid` compact mode

**Files:**
- Modify: `src/components/CalendarGrid.js`

**Interfaces:**
- Produces: `<CalendarGrid year month checkins onDayPress compact={boolean} />` — `compact` defaults to `false`; existing callers (Parte A) are unaffected. Task 4 (`YearHeatmap`) uses `compact`.

- [ ] **Step 1: Replace the file**

Replace `src/components/CalendarGrid.js` entirely:
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

export default function CalendarGrid({ year, month, checkins, onDayPress, compact = false }) {
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
      {!compact && (
        <View style={styles.fila}>
          {DIAS_SEMANA.map((d) => (
            <Text key={d} style={styles.diaSemana}>{d}</Text>
          ))}
        </View>
      )}
      {semanas.map((semana, i) => (
        <View key={i} style={[styles.fila, compact && styles.filaCompacta]}>
          {semana.map((dia, idx) => {
            if (dia === null) {
              return <View key={idx} style={compact ? styles.celdaCompacta : styles.celda} />;
            }
            const checkin = checkinsPorDia[dia];
            const bg = checkin ? getRachaColor(checkin.racha_dia) : colors.surface;
            return (
              <Pressable
                key={idx}
                style={[
                  compact ? styles.celdaCompacta : styles.celda,
                  { backgroundColor: bg },
                  esHoy(dia) && !compact && styles.celdaHoy,
                ]}
                disabled={compact || !checkin}
                onPress={() => !compact && checkin && onDayPress(checkin)}
              >
                {!compact && <Text style={styles.numeroDia}>{dia}</Text>}
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
  filaCompacta: { justifyContent: 'flex-start', marginBottom: 2 },
  diaSemana: { width: 40, textAlign: 'center', color: colors.textTertiary, fontFamily: 'Inter_500Medium' },
  celda: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  celdaCompacta: { width: 9, height: 9, borderRadius: 2, marginRight: 2 },
  celdaHoy: { borderWidth: 2, borderColor: '#fff' },
  numeroDia: { color: colors.textPrimary, fontFamily: 'Inter_500Medium', fontSize: 13 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CalendarGrid.js
git commit -m "feat: add compact mode to CalendarGrid"
```

---

## Task 3: `MonthSelector` component

**Files:**
- Create: `src/components/MonthSelector.js`

**Interfaces:**
- Produces: `<MonthSelector year={number} month={number} onChange={(year, month) => void} />`. Assumes `year` is always the current year (no previous-year navigation). Task 6 uses this.

- [ ] **Step 1: Implement**

Create `src/components/MonthSelector.js`:
```javascript
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function MonthSelector({ year, month, onChange }) {
  const hoy = new Date();
  const esMesActual = year === hoy.getFullYear() && month === hoy.getMonth();
  const esEnero = month === 0;

  function irAnterior() {
    if (esEnero) return;
    onChange(year, month - 1);
  }

  function irSiguiente() {
    if (esMesActual) return;
    onChange(year, month + 1);
  }

  return (
    <View style={styles.fila}>
      <Pressable onPress={irAnterior} disabled={esEnero} hitSlop={12}>
        <Text style={[styles.flecha, esEnero && styles.flechaDeshabilitada]}>‹</Text>
      </Pressable>
      <Text style={styles.titulo}>{NOMBRES_MES[month]} {year}</Text>
      <Pressable onPress={irSiguiente} disabled={esMesActual} hitSlop={12}>
        <Text style={[styles.flecha, esMesActual && styles.flechaDeshabilitada]}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  titulo: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.textPrimary },
  flecha: { fontSize: 28, color: colors.cobalto, paddingHorizontal: 12 },
  flechaDeshabilitada: { color: colors.textTertiary },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MonthSelector.js
git commit -m "feat: add MonthSelector component"
```

---

## Task 4: `YearHeatmap` component

**Files:**
- Create: `src/components/YearHeatmap.js`

**Interfaces:**
- Consumes: `CalendarGrid` with `compact` (Task 2).
- Produces: `<YearHeatmap year={number} checkins={array} />`. Task 6 uses this.

- [ ] **Step 1: Implement**

Create `src/components/YearHeatmap.js`:
```javascript
import { View, Text, StyleSheet } from 'react-native';
import CalendarGrid from './CalendarGrid';
import { colors } from '../theme/colors';

const NOMBRES_MES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function YearHeatmap({ year, checkins }) {
  return (
    <View style={styles.grilla}>
      {NOMBRES_MES_CORTOS.map((nombre, mes) => (
        <View key={mes} style={styles.bloqueMes}>
          <Text style={styles.nombreMes}>{nombre}</Text>
          <CalendarGrid year={year} month={mes} checkins={checkins} compact />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grilla: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  bloqueMes: { width: '31%', marginBottom: 16 },
  nombreMes: { fontFamily: 'Inter_500Medium', fontSize: 11, color: colors.textTertiary, marginBottom: 4 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/YearHeatmap.js
git commit -m "feat: add YearHeatmap component"
```

---

## Task 5: Reminder scheduling module

**Files:**
- Create: `src/lib/recordatorio.js`

**Interfaces:**
- Produces:
  - `getHoraRecordatorio() => Promise<string>` (e.g. `"20:00"`)
  - `setHoraRecordatorio(hora: string) => Promise<void>`
  - `sincronizarRecordatorios(checkins: {date: string}[]) => Promise<void>`
  Task 6 (`RachaScreen`) and Task 7 (`PerfilScreen`) both call these.

- [ ] **Step 1: Install dependencies**

```bash
npx expo install expo-notifications @react-native-community/datetimepicker
```

- [ ] **Step 2: Implement the module**

Create `src/lib/recordatorio.js`:
```javascript
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE_HORA = 'hora_recordatorio';
const HORA_DEFAULT = '20:00';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getHoraRecordatorio() {
  const guardada = await AsyncStorage.getItem(CLAVE_HORA);
  return guardada || HORA_DEFAULT;
}

export async function setHoraRecordatorio(hora) {
  await AsyncStorage.setItem(CLAVE_HORA, hora);
}

export async function sincronizarRecordatorios(checkins) {
  await Notifications.cancelAllScheduledNotificationsAsync();

  let permiso = await Notifications.getPermissionsAsync();
  if (permiso.status !== 'granted') {
    permiso = await Notifications.requestPermissionsAsync();
    if (permiso.status !== 'granted') return;
  }

  const hora = await getHoraRecordatorio();
  const [horas, minutos] = hora.split(':').map(Number);
  const fechasConCheckin = new Set(checkins.map((c) => c.date));

  for (let i = 0; i < 7; i++) {
    const dia = new Date();
    dia.setDate(dia.getDate() + i);
    const fechaStr = formatDate(dia);
    if (fechasConCheckin.has(fechaStr)) continue;

    const disparo = new Date(dia);
    disparo.setHours(horas, minutos, 0, 0);
    if (disparo.getTime() <= Date.now()) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Racha',
        body: 'Todavía no marcaste el gimnasio hoy 🔥',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: disparo },
    });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/recordatorio.js package.json package-lock.json
git commit -m "feat: add configurable local reminder scheduling"
```

---

## Task 6: Wire stats, month/year views, and reminders into `RachaScreen`

**Files:**
- Modify: `src/screens/RachaScreen.js`

**Interfaces:**
- Consumes: `getRachaMaxima`, `getCheckinsForRange`, `createCheckin` (`checkins.js`); `calcularEstadisticas`; `calcularRachaActual`; `sincronizarRecordatorios`; `CalendarGrid`, `MonthSelector`, `YearHeatmap`.

- [ ] **Step 1: Replace the file**

Replace `src/screens/RachaScreen.js` entirely:
```javascript
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { getCheckinsForRange, createCheckin, getRachaMaxima } from '../lib/checkins';
import { calcularRachaActual } from '../lib/rachaCalculo';
import { calcularEstadisticas } from '../lib/estadisticas';
import { sincronizarRecordatorios } from '../lib/recordatorio';
import CalendarGrid from '../components/CalendarGrid';
import MonthSelector from '../components/MonthSelector';
import YearHeatmap from '../components/YearHeatmap';
import PhotoViewerModal from '../components/PhotoViewerModal';
import { colors } from '../theme/colors';

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function RachaScreen() {
  const hoy = new Date();
  const [userId, setUserId] = useState(null);
  const [checkinsDelAnio, setCheckinsDelAnio] = useState([]);
  const [rachaActual, setRachaActual] = useState(0);
  const [rachaMaxima, setRachaMaxima] = useState(0);
  const [checkinHoy, setCheckinHoy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [fotoSeleccionada, setFotoSeleccionada] = useState(null);
  const [vista, setVista] = useState('mes');
  const [mesVisible, setMesVisible] = useState(hoy.getMonth());

  const cargarDatos = useCallback(async (uid) => {
    const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
    const finAnio = new Date(hoy.getFullYear(), 11, 31);
    const [lista, maxima] = await Promise.all([
      getCheckinsForRange(uid, inicioAnio, finAnio),
      getRachaMaxima(uid),
    ]);
    setCheckinsDelAnio(lista);
    setRachaMaxima(maxima);
    setRachaActual(calcularRachaActual(lista.map((c) => c.date)));
    setCheckinHoy(lista.find((c) => c.date === formatDate(hoy)) || null);
    await sincronizarRecordatorios(lista);
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
      console.error('Error en createCheckin:', e.message, e);
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

  const { totalMes, totalAnio, promedioSemanal } = calcularEstadisticas(checkinsDelAnio, hoy);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 22 }}>
      <Text style={styles.titulo}>Racha</Text>
      <View style={styles.contador}>
        <Text style={styles.llama}>🔥</Text>
        <Text style={styles.numero}>{rachaActual}</Text>
        <Text style={styles.dias}>días seguidos</Text>
      </View>

      <View style={styles.statsFila}>
        <View style={styles.stat}>
          <Text style={styles.statNumero}>{rachaMaxima}</Text>
          <Text style={styles.statLabel}>Racha máxima</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumero}>{totalMes}</Text>
          <Text style={styles.statLabel}>Este mes</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumero}>{totalAnio}</Text>
          <Text style={styles.statLabel}>Este año</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumero}>{promedioSemanal}</Text>
          <Text style={styles.statLabel}>Prom./semana</Text>
        </View>
      </View>

      <View style={styles.toggleFila}>
        <Pressable
          onPress={() => setVista('mes')}
          style={[styles.toggleBoton, vista === 'mes' && styles.toggleBotonActivo]}
        >
          <Text style={styles.toggleTexto}>Mes</Text>
        </Pressable>
        <Pressable
          onPress={() => setVista('anio')}
          style={[styles.toggleBoton, vista === 'anio' && styles.toggleBotonActivo]}
        >
          <Text style={styles.toggleTexto}>Año</Text>
        </Pressable>
      </View>

      {vista === 'mes' ? (
        <>
          <MonthSelector
            year={hoy.getFullYear()}
            month={mesVisible}
            onChange={(_year, month) => setMesVisible(month)}
          />
          <CalendarGrid
            year={hoy.getFullYear()}
            month={mesVisible}
            checkins={checkinsDelAnio}
            onDayPress={(checkin) => setFotoSeleccionada(checkin.photo_path)}
          />
        </>
      ) : (
        <YearHeatmap year={hoy.getFullYear()} checkins={checkinsDelAnio} />
      )}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginBottom: 16 },
  contador: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 20 },
  llama: { fontSize: 32, marginRight: 8 },
  numero: { fontSize: 48, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginRight: 8 },
  dias: { fontSize: 16, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  statsFila: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  stat: { alignItems: 'center' },
  statNumero: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 20, color: colors.textPrimary },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  toggleFila: { flexDirection: 'row', marginBottom: 16, backgroundColor: colors.surface, borderRadius: 12, padding: 4 },
  toggleBoton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  toggleBotonActivo: { backgroundColor: colors.cobalto },
  toggleTexto: { fontFamily: 'Inter_600SemiBold', color: colors.textPrimary, fontSize: 14 },
  boton: { marginTop: 24, borderRadius: 20, paddingVertical: 16, alignItems: 'center', backgroundColor: colors.cobalto },
  botonHecho: { backgroundColor: colors.surface },
  botonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
});
```

- [ ] **Step 2: Manual verification on the iPhone**

Explicar al usuario: "Ahora en Racha vas a ver los números de racha máxima/mes/año/promedio arriba, un selector Mes/Año, flechas para cambiar de mes, y la vista anual con los 12 meses chiquitos."
Expected: tocar "Año" muestra los 12 meses coloreados sin números; tocar "Mes" vuelve a la vista con flechas; las flechas cambian de mes sin recargar toda la pantalla; los números de estadísticas coinciden con lo esperado (ej. racha máxima = la racha más alta que tuviste hasta ahora).
La app va a pedir permiso de notificaciones la primera vez — avisar al usuario que toque "Permitir".

- [ ] **Step 3: Commit**

```bash
git add src/screens/RachaScreen.js
git commit -m "feat: add stats, month navigation, year heatmap, and reminder sync to RachaScreen"
```

---

## Task 7: Reminder time picker in `PerfilScreen`

**Files:**
- Modify: `src/screens/PerfilScreen.js`

**Interfaces:**
- Consumes: `getHoraRecordatorio`, `setHoraRecordatorio`, `sincronizarRecordatorios` (Task 5); `getCheckinsForRange` (existing, `checkins.js`).

- [ ] **Step 1: Replace the file**

Replace `src/screens/PerfilScreen.js` entirely:
```javascript
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { getCheckinsForRange } from '../lib/checkins';
import { getHoraRecordatorio, setHoraRecordatorio, sincronizarRecordatorios } from '../lib/recordatorio';
import { colors } from '../theme/colors';

export default function PerfilScreen() {
  const [hora, setHora] = useState('20:00');
  const [mostrarPicker, setMostrarPicker] = useState(false);

  useEffect(() => {
    getHoraRecordatorio().then(setHora);
  }, []);

  async function alCambiarHora(event, fecha) {
    setMostrarPicker(Platform.OS === 'ios' ? mostrarPicker : false);
    if (!fecha) return;
    const horaStr = `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
    setHora(horaStr);
    await setHoraRecordatorio(horaStr);

    const { data: { user } } = await supabase.auth.getUser();
    const hoy = new Date();
    const checkins = await getCheckinsForRange(
      user.id,
      new Date(hoy.getFullYear(), 0, 1),
      new Date(hoy.getFullYear(), 11, 31)
    );
    await sincronizarRecordatorios(checkins);
  }

  const [horas, minutos] = hora.split(':').map(Number);
  const valorPicker = new Date();
  valorPicker.setHours(horas, minutos, 0, 0);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Perfil</Text>
      <Pressable style={styles.fila} onPress={() => setMostrarPicker(true)}>
        <Text style={styles.filaTexto}>Recordatorio: {hora}</Text>
      </Pressable>
      {mostrarPicker && (
        <DateTimePicker value={valorPicker} mode="time" display="spinner" onChange={alCambiarHora} />
      )}
      <Pressable style={styles.signOutButton} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  text: { fontSize: 24, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginBottom: 24 },
  fila: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: colors.surface,
    marginBottom: 32,
  },
  filaTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 15 },
  signOutButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: colors.racha.rojo,
  },
  signOutText: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 15 },
});
```

- [ ] **Step 2: Manual verification on the iPhone**

Explicar al usuario: "En la pestaña Perfil, tocá 'Recordatorio: 20:00', elegí otra hora en el selector, y confirmá."
Expected: la fila muestra la nueva hora elegida; si volvés a la pestaña Racha y volvés a Perfil, la hora sigue guardada (persiste entre reinicios de la app).

- [ ] **Step 3: Commit**

```bash
git add src/screens/PerfilScreen.js
git commit -m "feat: add configurable reminder time picker to Perfil"
```

---

## Fin de la Parte B (y del Módulo 1 completo)

Con las Partes A y B, el Módulo 1 (Racha) del README queda completo: check-in diario con foto, racha actual y máxima, calendario mensual navegable, vista anual tipo heatmap, y recordatorio configurable. El siguiente módulo según las fases sugeridas del README es el Módulo 3 (Cambio físico).
