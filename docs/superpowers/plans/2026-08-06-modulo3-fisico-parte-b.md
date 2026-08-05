# Módulo 3 (Parte B): Comparación de fotos, medidas e IMC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Executed inline/conversationally: Task 7 needs manual verification of the drag slider on the phone, per the project README.

**Goal:** Users can compare their oldest vs. newest progress photo with a drag slider (swappable per side), optionally log waist/arm/leg measurements, and see their BMI automatically.

**Architecture:** `imc.js` is a pure, unit-tested calculation. `BeforeAfterSlider.js` is a presentational component driven by `PanResponder` (no new gesture library). `ComparacionFotosModal.js` owns the photo-selection state and resolves signed URLs, handing plain URLs to the slider. `RegistrarFisicoModal.js` and `FisicoScreen.js` get incremental additions rather than rewrites.

**Tech Stack:** `PanResponder` (built into React Native, no new dependency), existing Supabase/Jest setup.

## Global Constraints

- No new gesture/animation library — build the slider with `PanResponder` — from design doc.
- `measurements` only stores keys the user actually filled in (partial objects are fine) — from design doc.
- BMI is display-only, no category labels (just the number) — from design doc.

---

## File Structure

- Create: `supabase/migrations/0004_body_logs_measurements.sql` — adds `measurements jsonb`.
- Create: `src/lib/imc.js` + `src/lib/imc.test.js` — pure BMI calculation, TDD.
- Modify: `src/lib/bodyLogs.js` — add `getBodyLogsConFoto`, extend `createBodyLog` with `measurements`.
- Create: `src/components/BeforeAfterSlider.js` — drag-to-reveal comparison.
- Create: `src/components/ComparacionFotosModal.js` — photo selection + slider host.
- Modify: `src/components/RegistrarFisicoModal.js` — optional measurements fields.
- Modify: `src/screens/FisicoScreen.js` — BMI display, "Comparar fotos" entry point.

---

## Task 1: Add `measurements` column

**Files:**
- Create: `supabase/migrations/0004_body_logs_measurements.sql`

**Interfaces:**
- Produces: `body_logs.measurements` (jsonb, nullable). Task 2 (`bodyLogs.js`) writes to it.

- [ ] **Step 1: Write and apply the migration**

Create `supabase/migrations/0004_body_logs_measurements.sql`:
```sql
alter table body_logs add column measurements jsonb;
```

Use the Supabase MCP tool `apply_migration` with `project_id: "holaqwecblmdgefeulrr"`, `name: "body_logs_measurements"`, and that SQL.

- [ ] **Step 2: Verify**

Use `execute_sql` with:
```sql
select column_name, data_type from information_schema.columns where table_name = 'body_logs' and column_name = 'measurements';
```
Expected: one row, `data_type = 'jsonb'`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_body_logs_measurements.sql
git commit -m "feat: add measurements column to body_logs"
```

---

## Task 2: BMI calculation (TDD)

**Files:**
- Create: `src/lib/imc.js`
- Create: `src/lib/imc.test.js`

**Interfaces:**
- Produces: `calcularIMC(pesoKg: number, alturaCm: number) => number`. Task 7 (`FisicoScreen`) calls this.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/imc.test.js`:
```javascript
import { calcularIMC } from './imc';

test('peso 70kg y altura 175cm da IMC 22.9', () => {
  expect(calcularIMC(70, 175)).toBe(22.9);
});

test('peso 100kg y altura 200cm da IMC 25.0', () => {
  expect(calcularIMC(100, 200)).toBe(25);
});

test('redondea a un decimal', () => {
  expect(calcularIMC(68, 170)).toBe(23.5);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- imc`
Expected: FAIL with "Cannot find module './imc'".

- [ ] **Step 3: Implement**

Create `src/lib/imc.js`:
```javascript
export function calcularIMC(pesoKg, alturaCm) {
  const alturaM = alturaCm / 100;
  const imc = pesoKg / (alturaM * alturaM);
  return Math.round(imc * 10) / 10;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- imc`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/imc.js src/lib/imc.test.js
git commit -m "feat: add BMI calculation with tests"
```

---

## Task 3: Extend `bodyLogs.js`

**Files:**
- Modify: `src/lib/bodyLogs.js`

**Interfaces:**
- Produces:
  - `getBodyLogsConFoto(userId: string) => Promise<{id, date, photo_path}[]>` (ascending by date, only rows with `photo_path` set).
  - `createBodyLog(userId, { date, weight, height, photoUri, measurements })` — `measurements` is `object|null`, new param.
  Task 5 (`ComparacionFotosModal`) uses the first; Task 4 (`RegistrarFisicoModal`) and Task 7 use the second.

- [ ] **Step 1: Add `getBodyLogsConFoto`**

Add to `src/lib/bodyLogs.js`:
```javascript
export async function getBodyLogsConFoto(userId) {
  const { data, error } = await supabase
    .from('body_logs')
    .select('id, date, photo_path')
    .eq('user_id', userId)
    .not('photo_path', 'is', null)
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Extend `createBodyLog` to accept and store `measurements`**

Modify the `createBodyLog` function signature and insert call:
```javascript
export async function createBodyLog(userId, { date, weight, height, photoUri, measurements }) {
  const fecha = formatDate(date);
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
    .from('body_logs')
    .insert({ user_id: userId, date: fecha, weight, height, photo_path: photoPath, measurements: measurements || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/bodyLogs.js
git commit -m "feat: add getBodyLogsConFoto and measurements support"
```

---

## Task 4: `BeforeAfterSlider` component

**Files:**
- Create: `src/components/BeforeAfterSlider.js`

**Interfaces:**
- Produces: `<BeforeAfterSlider beforeUrl={string} afterUrl={string} />`. Purely presentational — no Supabase calls. Task 5 renders this.

- [ ] **Step 1: Implement**

Create `src/components/BeforeAfterSlider.js`:
```javascript
import { useRef, useState } from 'react';
import { View, Image, PanResponder, StyleSheet, Dimensions } from 'react-native';
import { colors } from '../theme/colors';

const ANCHO = Dimensions.get('window').width - 44;
const ALTO = 380;

export default function BeforeAfterSlider({ beforeUrl, afterUrl }) {
  const posRef = useRef(ANCHO / 2);
  const inicioRef = useRef(ANCHO / 2);
  const [posicion, setPosicion] = useState(ANCHO / 2);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        inicioRef.current = posRef.current;
      },
      onPanResponderMove: (_evt, gesture) => {
        const nueva = Math.max(0, Math.min(ANCHO, inicioRef.current + gesture.dx));
        posRef.current = nueva;
        setPosicion(nueva);
      },
    })
  ).current;

  return (
    <View style={styles.contenedor}>
      <Image source={{ uri: afterUrl }} style={styles.imagenBase} resizeMode="cover" />
      <View style={[styles.imagenRecortada, { width: posicion }]}>
        <Image source={{ uri: beforeUrl }} style={styles.imagenBase} resizeMode="cover" />
      </View>
      <View {...panResponder.panHandlers} style={[styles.manija, { left: posicion - 20 }]}>
        <View style={styles.linea} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    width: ANCHO,
    height: ALTO,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  imagenBase: { width: ANCHO, height: ALTO, position: 'absolute' },
  imagenRecortada: { height: ALTO, overflow: 'hidden', position: 'absolute', left: 0, top: 0 },
  manija: { position: 'absolute', top: 0, bottom: 0, width: 40, alignItems: 'center', justifyContent: 'center' },
  linea: { width: 3, height: '100%', backgroundColor: '#fff' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BeforeAfterSlider.js
git commit -m "feat: add BeforeAfterSlider component"
```

---

## Task 5: `ComparacionFotosModal` component

**Files:**
- Create: `src/components/ComparacionFotosModal.js`

**Interfaces:**
- Consumes: `getBodyLogsConFoto`, `getSignedBodyPhotoUrl` (Task 3, existing); `BeforeAfterSlider` (Task 4).
- Produces: `<ComparacionFotosModal visible={boolean} userId={string} onClose={() => void} />`. Task 7 uses this.

- [ ] **Step 1: Implement**

Create `src/components/ComparacionFotosModal.js`:
```javascript
import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { getBodyLogsConFoto, getSignedBodyPhotoUrl } from '../lib/bodyLogs';
import BeforeAfterSlider from './BeforeAfterSlider';
import { colors } from '../theme/colors';

export default function ComparacionFotosModal({ visible, userId, onClose }) {
  const [fotos, setFotos] = useState([]);
  const [antesId, setAntesId] = useState(null);
  const [despuesId, setDespuesId] = useState(null);
  const [beforeUrl, setBeforeUrl] = useState(null);
  const [afterUrl, setAfterUrl] = useState(null);
  const [eligiendo, setEligiendo] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setCargando(true);
    getBodyLogsConFoto(userId).then((lista) => {
      setFotos(lista);
      if (lista.length >= 2) {
        setAntesId(lista[0].id);
        setDespuesId(lista[lista.length - 1].id);
      }
      setCargando(false);
    });
  }, [visible, userId]);

  useEffect(() => {
    const foto = fotos.find((f) => f.id === antesId);
    if (foto) getSignedBodyPhotoUrl(foto.photo_path).then(setBeforeUrl);
  }, [antesId, fotos]);

  useEffect(() => {
    const foto = fotos.find((f) => f.id === despuesId);
    if (foto) getSignedBodyPhotoUrl(foto.photo_path).then(setAfterUrl);
  }, [despuesId, fotos]);

  function elegir(id) {
    if (eligiendo === 'antes') setAntesId(id);
    if (eligiendo === 'despues') setDespuesId(id);
    setEligiendo(null);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.cerrar} onPress={onClose} hitSlop={12}>
          <Text style={styles.cerrarTexto}>✕ Volver</Text>
        </Pressable>
        {cargando && <ActivityIndicator size="large" color={colors.cobalto} />}
        {!cargando && eligiendo && (
          <ScrollView style={styles.listaFechas}>
            {fotos.map((f) => (
              <Pressable key={f.id} style={styles.filaFecha} onPress={() => elegir(f.id)}>
                <Text style={styles.filaFechaTexto}>{f.date}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {!cargando && !eligiendo && beforeUrl && afterUrl && (
          <>
            <BeforeAfterSlider beforeUrl={beforeUrl} afterUrl={afterUrl} />
            <View style={styles.botonesFila}>
              <Pressable onPress={() => setEligiendo('antes')}>
                <Text style={styles.cambiarTexto}>Cambiar "antes"</Text>
              </Pressable>
              <Pressable onPress={() => setEligiendo('despues')}>
                <Text style={styles.cambiarTexto}>Cambiar "después"</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  cerrar: { position: 'absolute', top: 60, left: 22, zIndex: 1 },
  cerrarTexto: { color: colors.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  botonesFila: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 16 },
  cambiarTexto: { fontFamily: 'Inter_500Medium', color: colors.cobalto },
  listaFechas: { width: '100%', marginTop: 100 },
  filaFecha: { padding: 14, backgroundColor: colors.surface, borderRadius: 12, marginBottom: 8 },
  filaFechaTexto: { color: colors.textPrimary, fontFamily: 'Inter_500Medium' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ComparacionFotosModal.js
git commit -m "feat: add ComparacionFotosModal component"
```

---

## Task 6: Optional measurements in `RegistrarFisicoModal`

**Files:**
- Modify: `src/components/RegistrarFisicoModal.js`

**Interfaces:**
- Produces: `onGuardar` now also receives `measurements: object|null` alongside the existing fields.

- [ ] **Step 1: Add the measurements fields and toggle**

Add state near the top of the component (after existing `useState` calls):
```javascript
const [mostrarMedidas, setMostrarMedidas] = useState(false);
const [cintura, setCintura] = useState('');
const [brazo, setBrazo] = useState('');
const [pierna, setPierna] = useState('');
```

- [ ] **Step 2: Build the `measurements` object on save**

Modify `handleGuardar`:
```javascript
async function handleGuardar() {
  setGuardando(true);
  try {
    const measurements = {};
    if (cintura.trim() !== '' && !Number.isNaN(Number(cintura))) measurements.cintura = Number(cintura);
    if (brazo.trim() !== '' && !Number.isNaN(Number(brazo))) measurements.brazo = Number(brazo);
    if (pierna.trim() !== '' && !Number.isNaN(Number(pierna))) measurements.pierna = Number(pierna);

    await onGuardar({
      date: fecha,
      weight: Number(peso),
      height: Number(altura),
      photoUri,
      measurements: Object.keys(measurements).length > 0 ? measurements : null,
    });
    setPeso('');
    setPhotoUri(null);
    setFecha(new Date());
    setCintura('');
    setBrazo('');
    setPierna('');
    setMostrarMedidas(false);
  } catch (e) {
    console.error('Error al guardar registro físico:', e.message, e);
    Alert.alert('Error', 'No se pudo guardar, intentá de nuevo.');
  } finally {
    setGuardando(false);
  }
}
```

- [ ] **Step 3: Add the UI toggle and fields**

Add right after the "Agregar foto" `Pressable` (before the "Guardar" button):
```javascript
<Pressable style={styles.fotoButton} onPress={() => setMostrarMedidas(!mostrarMedidas)}>
  <Text style={styles.fotoButtonTexto}>{mostrarMedidas ? 'Ocultar medidas' : 'Agregar medidas (opcional)'}</Text>
</Pressable>
{mostrarMedidas && (
  <>
    <TextInput
      style={styles.input}
      placeholder="Cintura (cm)"
      placeholderTextColor={colors.textTertiary}
      keyboardType="decimal-pad"
      value={cintura}
      onChangeText={setCintura}
    />
    <TextInput
      style={styles.input}
      placeholder="Brazo (cm)"
      placeholderTextColor={colors.textTertiary}
      keyboardType="decimal-pad"
      value={brazo}
      onChangeText={setBrazo}
    />
    <TextInput
      style={styles.input}
      placeholder="Pierna (cm)"
      placeholderTextColor={colors.textTertiary}
      keyboardType="decimal-pad"
      value={pierna}
      onChangeText={setPierna}
    />
  </>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/RegistrarFisicoModal.js
git commit -m "feat: add optional measurements fields to RegistrarFisicoModal"
```

---

## Task 7: Wire BMI and photo comparison into `FisicoScreen`

**Files:**
- Modify: `src/screens/FisicoScreen.js`

**Interfaces:**
- Consumes: `calcularIMC` (Task 2); `getBodyLogsConFoto` indirectly via `ComparacionFotosModal` (Task 5); `createBodyLog` now passes through `measurements` (Task 3/6).

- [ ] **Step 1: Import the new pieces**

Add imports at the top of `src/screens/FisicoScreen.js`:
```javascript
import { calcularIMC } from '../lib/imc';
import ComparacionFotosModal from '../components/ComparacionFotosModal';
```

- [ ] **Step 2: Add state and the comparison entry point**

Add state alongside the existing `modalVisible`/`fotoSeleccionada`:
```javascript
const [comparacionVisible, setComparacionVisible] = useState(false);
```

Update `handleGuardar` to forward `measurements`:
```javascript
async function handleGuardar({ date, weight, height, photoUri, measurements }) {
  await createBodyLog(userId, { date, weight, height, photoUri, measurements });
  await cargarDatos(userId);
  setModalVisible(false);
}
```

- [ ] **Step 3: Show BMI and the "Comparar fotos" button**

Add right after the `pesoFila` block (before `<WeightChart logs={logs} />`):
```javascript
{pesoActual !== null && (
  <Text style={styles.imcTexto}>IMC: {calcularIMC(pesoActual, ultimaAltura)}</Text>
)}
```

Add after the "Registrar" `Pressable` (before the "Historial" title):
```javascript
<Pressable
  style={[styles.botonSecundario, fotosDisponibles < 2 && styles.botonDeshabilitado]}
  disabled={fotosDisponibles < 2}
  onPress={() => setComparacionVisible(true)}
>
  <Text style={styles.botonSecundarioTexto}>
    {fotosDisponibles < 2 ? 'Necesitás al menos 2 fotos para comparar' : 'Comparar fotos'}
  </Text>
</Pressable>
```

Add this derived value alongside `pesoActual`/`ultimaAltura`:
```javascript
const fotosDisponibles = logs.filter((l) => l.photo_path).length;
```

Add IMC to each history row — modify the `filaDetalle` `Text` to:
```javascript
<Text style={styles.filaDetalle}>
  {log.weight} kg · {log.height} cm · IMC {calcularIMC(log.weight, log.height)}
  {log.photo_path ? ' · con foto' : ''}
</Text>
```

Render the modal at the end, alongside the other modals:
```javascript
<ComparacionFotosModal
  visible={comparacionVisible}
  userId={userId}
  onClose={() => setComparacionVisible(false)}
/>
```

- [ ] **Step 4: Add the new styles**

Add to the `StyleSheet.create` call:
```javascript
imcTexto: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginBottom: 4 },
botonSecundario: {
  marginTop: 12,
  borderRadius: 20,
  paddingVertical: 14,
  alignItems: 'center',
  backgroundColor: colors.surface,
},
botonDeshabilitado: { opacity: 0.5 },
botonSecundarioTexto: { fontFamily: 'Inter_500Medium', color: colors.textPrimary, fontSize: 14 },
```

- [ ] **Step 5: Manual verification on the iPhone**

Explicar al usuario: "Ahora en Físico deberías ver tu IMC debajo del peso, un botón 'Comparar fotos' (activo si tenés 2+ fotos), y el formulario de registro con la opción de agregar medidas."
Acción manual: tocar "Agregar medidas (opcional)", completar cintura/brazo/pierna, guardar. Después tocar "Comparar fotos": debería abrir el slider con tu foto más vieja y más nueva, arrastrable, y los botones "Cambiar" funcionando.
Expected: el IMC se ve razonable (ej. ~22-25 para un peso/altura típico), el slider revela una foto sobre la otra al arrastrar, y "Cambiar" te deja elegir otra fecha.

- [ ] **Step 6: Commit**

```bash
git add src/screens/FisicoScreen.js
git commit -m "feat: wire BMI display and photo comparison into FisicoScreen"
```
