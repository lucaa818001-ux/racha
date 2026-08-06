# Módulo 4: Objetivos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Executed inline/conversationally: Task 6 needs manual verification on the phone, per the project README.

**Goal:** Users can set one weight goal (bajar/subir), see their progress %, a real-vs-projected chart, and (once they have enough weigh-ins) an estimated completion date — and can cancel the goal at any time.

**Architecture:** `objetivoCalculo.js` holds two pure, unit-tested functions (`calcularProgreso`, `estimarFechaLogro`) with no Supabase dependency. `goals.js` mirrors the existing `bodyLogs.js` data-access pattern. `ObjetivoChart.js` reuses the SVG approach from `WeightChart.js` but draws two lines. `ObjetivoScreen.js` fetches the user's full weight history once and derives everything else (whether they can create a goal, the goal-scoped log subset) from it in memory.

**Tech Stack:** Supabase (Postgres table with a `unique(user_id)` constraint), existing SVG-chart and `DateTimePicker` patterns.

## Global Constraints

- Only one goal per user — enforced by a DB unique constraint, not app logic — from design doc.
- `start_value`/`start_date` are captured automatically from the user's most recent weight log, never typed by hand — from design doc.
- `estimarFechaLogro` requires at least 3 weight logs since the goal's `start_date`, and returns `null` if the trend points the wrong way — from design doc.
- Weight goals only for now (no strength/streak goals) — from design doc, deferred to when other goal types are actually needed.

---

## File Structure

- Create: `supabase/migrations/0005_goals.sql` — schema + RLS.
- Create: `src/lib/objetivoCalculo.js` + `src/lib/objetivoCalculo.test.js` — pure progress/estimate math, TDD.
- Create: `src/lib/goals.js` — Supabase data access for the goal.
- Create: `src/components/CrearObjetivoModal.js` — goal creation form.
- Create: `src/components/ObjetivoChart.js` — real-vs-projected SVG chart.
- Modify: `src/screens/ObjetivoScreen.js` — orchestrates the above.

---

## Task 1: Supabase schema and RLS

**Files:**
- Create: `supabase/migrations/0005_goals.sql`

**Interfaces:**
- Produces: table `goals(id, user_id, type, target_value, target_date, start_value, start_date, created_at)`, `unique(user_id)`, RLS restricting rows to `auth.uid() = user_id`. Task 3 (`goals.js`) depends on this.

- [ ] **Step 1: Write and apply the migration**

Create `supabase/migrations/0005_goals.sql`:
```sql
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('bajar', 'subir')),
  target_value numeric not null,
  target_date date,
  start_value numeric not null,
  start_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table goals enable row level security;

create policy "Users manage their own goal"
  on goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Use the Supabase MCP tool `apply_migration` with `project_id: "holaqwecblmdgefeulrr"`, `name: "goals"`, and that SQL.

- [ ] **Step 2: Verify**

Use `list_tables` with `project_id: "holaqwecblmdgefeulrr"`.
Expected: `goals` appears with RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_goals.sql
git commit -m "feat: add goals table with one-goal-per-user constraint"
```

---

## Task 2: Progress and estimate calculations (TDD)

**Files:**
- Create: `src/lib/objetivoCalculo.js`
- Create: `src/lib/objetivoCalculo.test.js`

**Interfaces:**
- Produces:
  - `calcularProgreso(goal: {type, target_value, start_value}, pesoActual: number) => number` (0-100, integer)
  - `estimarFechaLogro(goal: {type, target_value, start_date}, logsDesdeInicio: {date, weight}[]) => Date | null`
  Task 6 (`ObjetivoScreen`) calls both.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/objetivoCalculo.test.js`:
```javascript
import { calcularProgreso, estimarFechaLogro } from './objetivoCalculo';

test('bajar de peso: progreso a mitad de camino es 50', () => {
  const goal = { type: 'bajar', target_value: 70, start_value: 80 };
  expect(calcularProgreso(goal, 75)).toBe(50);
});

test('bajar de peso: sin avance todavia es 0', () => {
  const goal = { type: 'bajar', target_value: 70, start_value: 80 };
  expect(calcularProgreso(goal, 80)).toBe(0);
});

test('bajar de peso: superar la meta se limita a 100', () => {
  const goal = { type: 'bajar', target_value: 70, start_value: 80 };
  expect(calcularProgreso(goal, 65)).toBe(100);
});

test('subir de peso: progreso a mitad de camino es 50', () => {
  const goal = { type: 'subir', target_value: 70, start_value: 60 };
  expect(calcularProgreso(goal, 65)).toBe(50);
});

test('estimarFechaLogro: con menos de 3 registros devuelve null', () => {
  const goal = { type: 'bajar', target_value: 70, start_date: '2026-01-01' };
  const logs = [{ date: '2026-01-01', weight: 80 }, { date: '2026-01-08', weight: 78 }];
  expect(estimarFechaLogro(goal, logs)).toBeNull();
});

test('estimarFechaLogro: tendencia correcta calcula una fecha', () => {
  const goal = { type: 'bajar', target_value: 70, start_date: '2026-01-01' };
  const logs = [
    { date: '2026-01-01', weight: 80 },
    { date: '2026-01-08', weight: 78 },
    { date: '2026-01-15', weight: 76 },
  ];
  const fecha = estimarFechaLogro(goal, logs);
  expect(fecha.getFullYear()).toBe(2026);
  expect(fecha.getMonth()).toBe(1);
  expect(fecha.getDate()).toBe(5);
});

test('estimarFechaLogro: tendencia en contra devuelve null', () => {
  const goal = { type: 'bajar', target_value: 70, start_date: '2026-01-01' };
  const logs = [
    { date: '2026-01-01', weight: 80 },
    { date: '2026-01-08', weight: 82 },
    { date: '2026-01-15', weight: 84 },
  ];
  expect(estimarFechaLogro(goal, logs)).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- objetivoCalculo`
Expected: FAIL with "Cannot find module './objetivoCalculo'".

- [ ] **Step 3: Implement**

Create `src/lib/objetivoCalculo.js`:
```javascript
export function calcularProgreso(goal, pesoActual) {
  const { type, target_value, start_value } = goal;
  if (target_value === start_value) {
    const llego = type === 'bajar' ? pesoActual <= target_value : pesoActual >= target_value;
    return llego ? 100 : 0;
  }
  let progreso;
  if (type === 'bajar') {
    progreso = ((start_value - pesoActual) / (start_value - target_value)) * 100;
  } else {
    progreso = ((pesoActual - start_value) / (target_value - start_value)) * 100;
  }
  return Math.max(0, Math.min(100, Math.round(progreso)));
}

export function estimarFechaLogro(goal, logsDesdeInicio) {
  if (logsDesdeInicio.length < 3) return null;

  const startDate = new Date(goal.start_date + 'T00:00:00');
  const puntos = logsDesdeInicio.map((log) => {
    const dias = Math.round((new Date(log.date + 'T00:00:00') - startDate) / (1000 * 60 * 60 * 24));
    return { x: dias, y: log.weight };
  });

  const n = puntos.length;
  const sumX = puntos.reduce((acc, p) => acc + p.x, 0);
  const sumY = puntos.reduce((acc, p) => acc + p.y, 0);
  const sumXY = puntos.reduce((acc, p) => acc + p.x * p.y, 0);
  const sumX2 = puntos.reduce((acc, p) => acc + p.x * p.x, 0);

  const denominador = n * sumX2 - sumX * sumX;
  if (denominador === 0) return null;

  const pendiente = (n * sumXY - sumX * sumY) / denominador;
  const ordenada = (sumY - pendiente * sumX) / n;

  const direccionCorrecta = goal.type === 'bajar' ? pendiente < 0 : pendiente > 0;
  if (!direccionCorrecta) return null;

  const diasHastaMeta = (goal.target_value - ordenada) / pendiente;
  if (!Number.isFinite(diasHastaMeta)) return null;

  const fechaEstimada = new Date(startDate);
  fechaEstimada.setDate(fechaEstimada.getDate() + Math.round(diasHastaMeta));
  return fechaEstimada;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- objetivoCalculo`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/objetivoCalculo.js src/lib/objetivoCalculo.test.js
git commit -m "feat: add goal progress and completion-date estimate with tests"
```

---

## Task 3: Data access — `src/lib/goals.js`

**Files:**
- Create: `src/lib/goals.js`

**Interfaces:**
- Produces:
  - `getGoal(userId: string) => Promise<{id, type, target_value, target_date, start_value, start_date} | null>`
  - `upsertGoal(userId: string, { type, targetValue, targetDate: Date|null, startValue, startDate: Date }) => Promise<goal>`
  - `deleteGoal(userId: string) => Promise<void>`
  Task 6 (`ObjetivoScreen`) calls all three.

- [ ] **Step 1: Implement**

Create `src/lib/goals.js`:
```javascript
import { supabase } from './supabase';

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getGoal(userId) {
  const { data, error } = await supabase
    .from('goals')
    .select('id, type, target_value, target_date, start_value, start_date')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertGoal(userId, { type, targetValue, targetDate, startValue, startDate }) {
  const { data, error } = await supabase
    .from('goals')
    .upsert(
      {
        user_id: userId,
        type,
        target_value: targetValue,
        target_date: targetDate ? formatDate(targetDate) : null,
        start_value: startValue,
        start_date: formatDate(startDate),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGoal(userId) {
  const { error } = await supabase.from('goals').delete().eq('user_id', userId);
  if (error) throw error;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/goals.js
git commit -m "feat: add goals data access module"
```

---

## Task 4: `CrearObjetivoModal` component

**Files:**
- Create: `src/components/CrearObjetivoModal.js`

**Interfaces:**
- Produces: `<CrearObjetivoModal visible={boolean} onGuardar={({type, targetValue, targetDate}) => Promise<void>} onClose={() => void} />`. Task 6 uses this.

- [ ] **Step 1: Implement**

Create `src/components/CrearObjetivoModal.js`:
```javascript
import { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../theme/colors';

export default function CrearObjetivoModal({ visible, onGuardar, onClose }) {
  const [tipo, setTipo] = useState('bajar');
  const [valor, setValor] = useState('');
  const [mostrarFecha, setMostrarFecha] = useState(false);
  const [fecha, setFecha] = useState(new Date());
  const [guardando, setGuardando] = useState(false);

  const valorValido = valor.trim() !== '' && !Number.isNaN(Number(valor));

  async function handleGuardar() {
    setGuardando(true);
    try {
      await onGuardar({ type: tipo, targetValue: Number(valor), targetDate: mostrarFecha ? fecha : null });
      setValor('');
      setMostrarFecha(false);
    } catch (e) {
      console.error('Error al guardar objetivo:', e.message, e);
      Alert.alert('Error', 'No se pudo guardar, intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.titulo}>Crear objetivo</Text>
          <View style={styles.tipoFila}>
            <Pressable
              style={[styles.tipoBoton, tipo === 'bajar' && styles.tipoBotonActivo]}
              onPress={() => setTipo('bajar')}
            >
              <Text style={styles.tipoBotonTexto}>Bajar de peso</Text>
            </Pressable>
            <Pressable
              style={[styles.tipoBoton, tipo === 'subir' && styles.tipoBotonActivo]}
              onPress={() => setTipo('subir')}
            >
              <Text style={styles.tipoBotonTexto}>Subir de peso</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Peso objetivo (kg)"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            value={valor}
            onChangeText={setValor}
          />
          <Pressable style={styles.fechaButton} onPress={() => setMostrarFecha(!mostrarFecha)}>
            <Text style={styles.fechaButtonTexto}>
              {mostrarFecha ? 'Quitar fecha objetivo' : 'Agregar fecha objetivo (opcional)'}
            </Text>
          </Pressable>
          {mostrarFecha && (
            <View style={styles.fechaFila}>
              <DateTimePicker
                value={fecha}
                mode="date"
                display={Platform.OS === 'ios' ? 'compact' : 'default'}
                themeVariant="dark"
                minimumDate={new Date()}
                onChange={(event, valorFecha) => valorFecha && setFecha(valorFecha)}
              />
            </View>
          )}
          <Pressable
            style={[styles.guardarButton, (!valorValido || guardando) && styles.guardarButtonDeshabilitado]}
            disabled={!valorValido || guardando}
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
  tipoFila: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 4,
  },
  tipoBoton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tipoBotonActivo: { backgroundColor: colors.cobalto },
  tipoBotonTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 13 },
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
  fechaButton: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  fechaButtonTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary },
  fechaFila: { alignItems: 'center', marginBottom: 12 },
  guardarButton: { borderRadius: 20, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.cobalto },
  guardarButtonDeshabilitado: { opacity: 0.5 },
  guardarButtonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
  cancelar: { textAlign: 'center', marginTop: 16, fontFamily: 'Inter_500Medium', color: colors.textSecondary },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CrearObjetivoModal.js
git commit -m "feat: add CrearObjetivoModal component"
```

---

## Task 5: `ObjetivoChart` component

**Files:**
- Create: `src/components/ObjetivoChart.js`

**Interfaces:**
- Produces: `<ObjetivoChart logs={[{date, weight}]} goal={{type, target_value, target_date, start_value, start_date}} ancho={number} />`. `logs` sorted ascending. Task 6 renders this.

- [ ] **Step 1: Implement**

Create `src/components/ObjetivoChart.js`:
```javascript
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { colors } from '../theme/colors';

const ALTO_GRAFICO = 160;
const MARGEN_ETIQUETA = 24;
const MARGEN_LATERAL = 18;
const ALTO_TOTAL = ALTO_GRAFICO + MARGEN_ETIQUETA * 2;

export default function ObjetivoChart({ logs, goal, ancho }) {
  if (logs.length < 2) {
    return (
      <View style={[styles.tarjeta, styles.centrado]}>
        <Text style={styles.mensaje}>Registrá más pesos para ver tu progreso</Text>
      </View>
    );
  }

  const pesos = logs.map((l) => l.weight).concat([goal.target_value, goal.start_value]);
  const min = Math.min(...pesos);
  const max = Math.max(...pesos);
  const margen = (max - min) * 0.1 || 1;
  const pesoMin = min - margen;
  const pesoMax = max + margen;

  const anchoUtil = ancho - MARGEN_LATERAL * 2;
  const fechaInicio = new Date(goal.start_date + 'T00:00:00');
  const fechaFin = goal.target_date
    ? new Date(goal.target_date + 'T00:00:00')
    : new Date(logs[logs.length - 1].date + 'T00:00:00');
  const totalDias = Math.max(1, (fechaFin - fechaInicio) / (1000 * 60 * 60 * 24));

  function xParaFecha(fechaStr) {
    const dias = (new Date(fechaStr + 'T00:00:00') - fechaInicio) / (1000 * 60 * 60 * 24);
    return MARGEN_LATERAL + (dias / totalDias) * anchoUtil;
  }

  function yParaPeso(peso) {
    return MARGEN_ETIQUETA + ALTO_GRAFICO - ((peso - pesoMin) / (pesoMax - pesoMin)) * ALTO_GRAFICO;
  }

  const puntosReales = logs.map((log) => ({ x: xParaFecha(log.date), y: yParaPeso(log.weight) }));
  const puntosRealesStr = puntosReales.map((p) => `${p.x},${p.y}`).join(' ');

  const proyeccionStr = goal.target_date
    ? `${xParaFecha(goal.start_date)},${yParaPeso(goal.start_value)} ${xParaFecha(goal.target_date)},${yParaPeso(
        goal.target_value
      )}`
    : null;

  return (
    <View style={styles.tarjeta}>
      <Svg width={ancho} height={ALTO_TOTAL}>
        {proyeccionStr && (
          <Polyline
            points={proyeccionStr}
            fill="none"
            stroke={colors.textTertiary}
            strokeWidth={2}
            strokeDasharray="6,6"
          />
        )}
        <Polyline points={puntosRealesStr} fill="none" stroke={colors.cobalto} strokeWidth={2} />
        {puntosReales.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill={colors.cobalto} />
        ))}
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
git add src/components/ObjetivoChart.js
git commit -m "feat: add ObjetivoChart component"
```

---

## Task 6: Wire into `ObjetivoScreen`

**Files:**
- Modify: `src/screens/ObjetivoScreen.js`

**Interfaces:**
- Consumes: `getGoal`, `upsertGoal`, `deleteGoal` (Task 3); `calcularProgreso`, `estimarFechaLogro` (Task 2); `CrearObjetivoModal` (Task 4); `ObjetivoChart` (Task 5); `getBodyLogsForRange` (existing, `bodyLogs.js`).

- [ ] **Step 1: Replace the file**

Replace `src/screens/ObjetivoScreen.js` entirely:
```javascript
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getBodyLogsForRange } from '../lib/bodyLogs';
import { getGoal, upsertGoal, deleteGoal } from '../lib/goals';
import { calcularProgreso, estimarFechaLogro } from '../lib/objetivoCalculo';
import CrearObjetivoModal from '../components/CrearObjetivoModal';
import ObjetivoChart from '../components/ObjetivoChart';
import { colors } from '../theme/colors';

const ANCHO_GRAFICO = Dimensions.get('window').width - 44 - 32;

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ObjetivoScreen() {
  const [userId, setUserId] = useState(null);
  const [goal, setGoal] = useState(null);
  const [logs, setLogs] = useState([]);
  const [tienePeso, setTienePeso] = useState(false);
  const [pesoMasReciente, setPesoMasReciente] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const cargarDatos = useCallback(async (uid) => {
    const hoy = new Date();
    const desde = new Date(2000, 0, 1);
    const historialCompleto = await getBodyLogsForRange(uid, desde, hoy);
    setTienePeso(historialCompleto.length > 0);
    setPesoMasReciente(historialCompleto.length > 0 ? historialCompleto[historialCompleto.length - 1].weight : null);

    const objetivoActual = await getGoal(uid);
    setGoal(objetivoActual);
    setLogs(objetivoActual ? historialCompleto.filter((l) => l.date >= objetivoActual.start_date) : []);
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

  async function handleCrear({ type, targetValue, targetDate }) {
    await upsertGoal(userId, {
      type,
      targetValue,
      targetDate,
      startValue: pesoMasReciente,
      startDate: new Date(),
    });
    await cargarDatos(userId);
    setModalVisible(false);
  }

  function handleCancelar() {
    Alert.alert('Cancelar objetivo', '¿Seguro que querés cancelar tu objetivo actual?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          await deleteGoal(userId);
          await cargarDatos(userId);
        },
      },
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 22 }}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={handleRefrescar} tintColor={colors.cobalto} />
      }
    >
      <Text style={styles.titulo}>Objetivo</Text>
      {!goal ? (
        <>
          {tienePeso ? (
            <Pressable style={styles.boton} onPress={() => setModalVisible(true)}>
              <Text style={styles.botonTexto}>Crear objetivo</Text>
            </Pressable>
          ) : (
            <Text style={styles.sinObjetivo}>Registrá tu peso en Físico primero para poder crear un objetivo.</Text>
          )}
        </>
      ) : (
        <>
          <Text style={styles.progresoNumero}>
            {calcularProgreso(goal, logs.length > 0 ? logs[logs.length - 1].weight : goal.start_value)}%
          </Text>
          <Text style={styles.progresoDetalle}>
            {goal.type === 'bajar' ? 'Bajar' : 'Subir'} de {goal.start_value}kg a {goal.target_value}kg
          </Text>
          <ObjetivoChart logs={logs} goal={goal} ancho={ANCHO_GRAFICO} />
          {(() => {
            const fechaEstimada = estimarFechaLogro(goal, logs);
            return fechaEstimada ? (
              <Text style={styles.fechaEstimada}>Al ritmo actual, llegarías el {formatDate(fechaEstimada)}</Text>
            ) : null;
          })()}
          <Pressable style={styles.botonCancelar} onPress={handleCancelar}>
            <Text style={styles.botonCancelarTexto}>Cancelar objetivo</Text>
          </Pressable>
        </>
      )}
      <CrearObjetivoModal visible={modalVisible} onGuardar={handleCrear} onClose={() => setModalVisible(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, marginBottom: 16 },
  sinObjetivo: { fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  boton: { borderRadius: 20, paddingVertical: 16, alignItems: 'center', backgroundColor: colors.cobalto },
  botonTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 16 },
  progresoNumero: { fontSize: 48, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary },
  progresoDetalle: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginBottom: 8 },
  fechaEstimada: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginBottom: 16 },
  botonCancelar: {
    marginTop: 8,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  botonCancelarTexto: { fontFamily: 'Inter_500Medium', color: colors.racha.rojo, fontSize: 14 },
});
```

- [ ] **Step 2: Manual verification on the iPhone**

Explicar al usuario: "En Objetivo, si no registraste peso todavía en Físico, va a pedirte que lo hagas primero. Si ya tenés peso registrado, tocá 'Crear objetivo', elegí 'Bajar de peso' o 'Subir de peso', un valor, y opcionalmente una fecha."
Expected: después de crear, aparece el % de progreso, la gráfica (línea sólida con tu peso, línea punteada si pusiste fecha), y el botón "Cancelar objetivo" funciona y vuelve a la pantalla vacía.

- [ ] **Step 3: Commit**

```bash
git add src/screens/ObjetivoScreen.js
git commit -m "feat: wire goal creation, progress, chart, and cancel into ObjetivoScreen"
```
