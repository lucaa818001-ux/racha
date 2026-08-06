# Objetivo: Historial y cierre — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Executed inline/conversationally: Task 4 needs manual verification on the phone.

**Goal:** Past goals survive as history instead of being overwritten; users can cancel or complete their active goal, see a closing summary on completion, and browse past goals with their charts in a history modal.

**Architecture:** `goals` gets a `status` column and a partial unique index (`unique(user_id) where status = 'activo'`) replacing the old table-wide unique constraint, so multiple historical rows can coexist per user while still guaranteeing one active goal. `goals.js` swaps `upsert`-based replacement for `insert` (new goal) + `update` (close old one). `HistorialObjetivosModal.js` reuses the existing `ObjetivoChart` per past goal — no new charting code.

**Tech Stack:** Supabase (schema change + partial unique index), existing Alert/Modal patterns already used elsewhere in the app.

## Global Constraints

- Only one `activo` goal per user, enforced by a partial unique index, not application logic — from design doc.
- Past goals are never deleted, only marked `completado`/`cancelado` — from design doc.
- The completion summary reuses `calcularRitmoSemanal` (no new calculation logic) — from design doc.

---

## File Structure

- Create: `supabase/migrations/0006_goals_status.sql` — status/ended_at columns + partial unique index.
- Modify: `src/lib/goals.js` — replace `getGoal`/`upsertGoal`/`deleteGoal` with `getActiveGoal`/`createGoal`/`cancelGoal`/`completeGoal`/`getGoalHistory`.
- Create: `src/components/HistorialObjetivosModal.js` — full-screen modal listing past goals with charts.
- Modify: `src/screens/ObjetivoScreen.js` — wire the new functions, add the "Historial" and "Dar por completado" buttons.

---

## Task 1: Migration — goal status tracking

**Files:**
- Create: `supabase/migrations/0006_goals_status.sql`

**Interfaces:**
- Produces: `goals.status` (`'activo' | 'completado' | 'cancelado'`, default `'activo'`), `goals.ended_at` (date, nullable), and a partial unique index `goals_un_activo_por_usuario` on `(user_id) where status = 'activo'` — replacing the old `unique(user_id)` constraint. Task 2 (`goals.js`) depends on this.

- [ ] **Step 1: Write and apply the migration**

Create `supabase/migrations/0006_goals_status.sql`:
```sql
alter table goals add column status text not null default 'activo' check (status in ('activo', 'completado', 'cancelado'));
alter table goals add column ended_at date;

alter table goals drop constraint goals_user_id_key;

create unique index goals_un_activo_por_usuario
  on goals (user_id)
  where status = 'activo';
```

Use the Supabase MCP tool `apply_migration` with `project_id: "holaqwecblmdgefeulrr"`, `name: "goals_status"`, and that SQL.

- [ ] **Step 2: Verify**

Use `execute_sql` with:
```sql
select column_name, data_type from information_schema.columns where table_name = 'goals' and column_name in ('status', 'ended_at');
select indexname from pg_indexes where tablename = 'goals';
```
Expected: both columns exist; `goals_un_activo_por_usuario` appears in the index list, `goals_user_id_key` does not.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0006_goals_status.sql
git commit -m "feat: add status tracking to goals for history support"
```

---

## Task 2: Rewrite `src/lib/goals.js`

**Files:**
- Modify: `src/lib/goals.js`

**Interfaces:**
- Produces:
  - `getActiveGoal(userId) => Promise<goal | null>`
  - `createGoal(userId, {type, targetValue, targetDate, startValue, startDate}) => Promise<goal>`
  - `cancelGoal(goalId) => Promise<void>`
  - `completeGoal(goalId) => Promise<void>`
  - `getGoalHistory(userId) => Promise<goal[]>` (status `completado`/`cancelado`, newest `ended_at` first)
  Task 4 (`ObjetivoScreen`) uses the first four; Task 3 (`HistorialObjetivosModal`) uses `getGoalHistory`.

- [ ] **Step 1: Replace the file**

Replace `src/lib/goals.js` entirely:
```javascript
import { supabase } from './supabase';

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getActiveGoal(userId) {
  const { data, error } = await supabase
    .from('goals')
    .select('id, type, target_value, target_date, start_value, start_date, status, ended_at')
    .eq('user_id', userId)
    .eq('status', 'activo')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createGoal(userId, { type, targetValue, targetDate, startValue, startDate }) {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      type,
      target_value: targetValue,
      target_date: targetDate ? formatDate(targetDate) : null,
      start_value: startValue,
      start_date: formatDate(startDate),
      status: 'activo',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cancelGoal(goalId) {
  const { error } = await supabase
    .from('goals')
    .update({ status: 'cancelado', ended_at: formatDate(new Date()) })
    .eq('id', goalId);
  if (error) throw error;
}

export async function completeGoal(goalId) {
  const { error } = await supabase
    .from('goals')
    .update({ status: 'completado', ended_at: formatDate(new Date()) })
    .eq('id', goalId);
  if (error) throw error;
}

export async function getGoalHistory(userId) {
  const { data, error } = await supabase
    .from('goals')
    .select('id, type, target_value, target_date, start_value, start_date, status, ended_at')
    .eq('user_id', userId)
    .in('status', ['completado', 'cancelado'])
    .order('ended_at', { ascending: false });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/goals.js
git commit -m "feat: replace goal overwrite with status-based history"
```

---

## Task 3: `HistorialObjetivosModal` component

**Files:**
- Create: `src/components/HistorialObjetivosModal.js`

**Interfaces:**
- Consumes: `getGoalHistory` (Task 2); `getBodyLogsForRange` (existing, `bodyLogs.js`); `ObjetivoChart` (existing).
- Produces: `<HistorialObjetivosModal visible={boolean} userId={string} onClose={() => void} />`. Task 4 uses this.

- [ ] **Step 1: Implement**

Create `src/components/HistorialObjetivosModal.js`:
```javascript
import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { getGoalHistory } from '../lib/goals';
import { getBodyLogsForRange } from '../lib/bodyLogs';
import ObjetivoChart from './ObjetivoChart';
import { colors } from '../theme/colors';

const ANCHO_GRAFICO = Dimensions.get('window').width - 44 - 32;

export default function HistorialObjetivosModal({ visible, userId, onClose }) {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setCargando(true);
    getGoalHistory(userId).then(async (goals) => {
      const conLogs = await Promise.all(
        goals.map(async (g) => {
          const logs = await getBodyLogsForRange(
            userId,
            new Date(g.start_date + 'T00:00:00'),
            new Date((g.ended_at || g.start_date) + 'T00:00:00')
          );
          return { goal: g, logs };
        })
      );
      setHistorial(conLogs);
      setCargando(false);
    });
  }, [visible, userId]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.contenedor}>
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>Historial de objetivos</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.cerrar}>✕</Text>
          </Pressable>
        </View>
        {cargando ? (
          <ActivityIndicator size="large" color={colors.cobalto} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 22 }}>
            {historial.length === 0 && (
              <Text style={styles.sinHistorial}>Todavía no tenés objetivos completados o cancelados.</Text>
            )}
            {historial.map(({ goal, logs }) => (
              <View key={goal.id} style={styles.item}>
                <Text style={styles.itemTitulo}>
                  {goal.status === 'completado' ? '🏆 Completado' : '✕ Cancelado'} ·{' '}
                  {goal.type === 'bajar' ? 'Bajar' : 'Subir'} de {goal.start_value}kg a {goal.target_value}kg
                </Text>
                <Text style={styles.itemFechas}>
                  {goal.start_date} → {goal.ended_at}
                </Text>
                <ObjetivoChart logs={logs} goal={goal} ancho={ANCHO_GRAFICO} />
              </View>
            ))}
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
  titulo: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: colors.textPrimary },
  cerrar: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: colors.textPrimary },
  sinHistorial: { fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  item: { marginBottom: 24 },
  itemTitulo: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.textPrimary, marginBottom: 4 },
  itemFechas: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textTertiary, marginBottom: 8 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/HistorialObjetivosModal.js
git commit -m "feat: add HistorialObjetivosModal component"
```

---

## Task 4: Wire into `ObjetivoScreen`

**Files:**
- Modify: `src/screens/ObjetivoScreen.js`

**Interfaces:**
- Consumes: `getActiveGoal`, `createGoal`, `cancelGoal`, `completeGoal` (Task 2); `HistorialObjetivosModal` (Task 3); `calcularRitmoSemanal`, `formatDateLarga` (existing in this file).

- [ ] **Step 1: Update imports**

In `src/screens/ObjetivoScreen.js`, replace:
```javascript
import { getGoal, upsertGoal, deleteGoal } from '../lib/goals';
```
with:
```javascript
import { getActiveGoal, createGoal, cancelGoal, completeGoal } from '../lib/goals';
import HistorialObjetivosModal from '../components/HistorialObjetivosModal';
```

- [ ] **Step 2: Add history modal state**

Add alongside the other `useState` calls:
```javascript
const [historialVisible, setHistorialVisible] = useState(false);
```

- [ ] **Step 3: Update `cargarDatos` to use `getActiveGoal`**

Replace the line `const objetivoActual = await getGoal(uid);` with:
```javascript
const objetivoActual = await getActiveGoal(uid);
```

- [ ] **Step 4: Update `handleCrear` to use `createGoal`**

Replace `handleCrear` entirely:
```javascript
async function handleCrear({ type, targetValue, targetDate, startValue }) {
  await createGoal(userId, { type, targetValue, targetDate, startValue, startDate: new Date() });
  await cargarDatos(userId);
  setModalVisible(false);
}
```

- [ ] **Step 5: Update `handleCancelar` to use `cancelGoal`**

Replace `handleCancelar` entirely:
```javascript
function handleCancelar() {
  Alert.alert('Cancelar objetivo', '¿Seguro que querés cancelar tu objetivo actual?', [
    { text: 'No', style: 'cancel' },
    {
      text: 'Sí, cancelar',
      style: 'destructive',
      onPress: async () => {
        await cancelGoal(goal.id);
        await cargarDatos(userId);
      },
    },
  ]);
}
```

- [ ] **Step 6: Add `handleCompletar`**

Add this new function right after `handleCancelar`:
```javascript
function handleCompletar() {
  const hoy = new Date();
  const dias = Math.round((hoy - new Date(goal.start_date + 'T00:00:00')) / (1000 * 60 * 60 * 24));
  const ritmo = calcularRitmoSemanal(goal.start_date, logs);
  const fechaObjetivoTexto = goal.target_date
    ? formatDateLarga(new Date(goal.target_date + 'T00:00:00'))
    : 'sin fecha objetivo';
  const resumen =
    `Fecha objetivo que habías puesto: ${fechaObjetivoTexto}\n` +
    `Fecha en la que llegaste: ${formatDateLarga(hoy)}\n` +
    `Días que te tomó: ${dias}\n` +
    `Promedio semanal: ${ritmo !== null ? `${Math.abs(ritmo)}kg/semana` : 'no calculado'}`;
  Alert.alert('¡Objetivo completado! 🏆', resumen, [
    {
      text: 'Genial',
      onPress: async () => {
        await completeGoal(goal.id);
        await cargarDatos(userId);
      },
    },
  ]);
}
```

- [ ] **Step 7: Add the header row with the "Historial" button**

Replace `<Text style={styles.titulo}>Objetivo</Text>` with:
```javascript
<View style={styles.encabezadoFila}>
  <Text style={styles.titulo}>Objetivo</Text>
  <Pressable onPress={() => setHistorialVisible(true)}>
    <Text style={styles.historialBoton}>Historial</Text>
  </Pressable>
</View>
```

- [ ] **Step 8: Add the "Dar por completado" button**

Right after the line `{progreso >= 100 && <Text style={styles.confeti}>🎉 🎊 🥳 🎊 🎉</Text>}`, add:
```javascript
{progreso >= 100 && (
  <Pressable style={styles.botonCompletar} onPress={handleCompletar}>
    <Text style={styles.botonCompletarTexto}>Dar por completado</Text>
  </Pressable>
)}
```

- [ ] **Step 9: Render the history modal**

Right after the closing `</Pressable>` of "Cancelar objetivo" (before `<CrearObjetivoModal ...>`), add:
```javascript
<HistorialObjetivosModal
  visible={historialVisible}
  userId={userId}
  onClose={() => setHistorialVisible(false)}
/>
```

- [ ] **Step 10: Update styles**

Change the existing `titulo` style (remove `marginBottom: 16`, since that now lives on the row) to:
```javascript
titulo: { fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary },
```

Add these new styles to the `StyleSheet.create` call:
```javascript
encabezadoFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
historialBoton: { fontFamily: 'Inter_500Medium', color: colors.cobalto, fontSize: 14 },
botonCompletar: {
  borderRadius: 20,
  paddingVertical: 14,
  alignItems: 'center',
  backgroundColor: colors.cobalto,
  marginBottom: 16,
},
botonCompletarTexto: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 15 },
```

- [ ] **Step 11: Manual verification on the iPhone**

Explicar al usuario: "Ahora en Objetivo vas a ver un botón 'Historial' arriba a la derecha. Con tu objetivo actual al 100%, debería aparecer 'Dar por completado' — tocalo, confirmá, y fijate que aparezca en el Historial con su gráfica. Después probá cancelar un objetivo nuevo y confirmá que también aparece en el historial marcado como cancelado."
Expected: crear un objetivo nuevo, cancelarlo, y verificar que aparece en "Historial" con "✕ Cancelado"; completar un objetivo y verificar que aparece con "🏆 Completado" y el resumen se mostró antes de cerrarlo.

- [ ] **Step 12: Commit**

```bash
git add src/screens/ObjetivoScreen.js
git commit -m "feat: wire goal history, completion summary, and cancel-as-history"
```
