# Racha — Módulo 3 (Parte A): Registro de peso/altura + gráfica — Design

## Contexto
Primera mitad del Módulo 3 del [README.md](../../../README.md), siguiendo el orden de fases sugerido (antes de Ejercicios, porque Objetivos depende de estos datos). Cubre registrar peso/altura/foto por día y visualizar la evolución del peso en una gráfica. Se deja para la Parte B (spec separada, más adelante): galería de fotos con slider "antes/después", medidas opcionales, y el cálculo de IMC.

## Alcance
1. Botón "Registrar" en la pestaña Físico que abre un formulario simple: peso, altura (precargada con la última registrada), y foto (cámara/galería, mismo flujo que Racha).
2. Un registro por usuario por día (igual regla que `gym_checkins`).
3. Peso actual mostrado en grande arriba de la pantalla.
4. Gráfica de línea del peso en las últimas ~12 semanas, dibujada con `react-native-svg` (sin librería de gráficos de terceros — decisión tomada para evitar el tipo de problemas de compatibilidad de versiones que tuvimos con otras librerías durante el Módulo 1).
5. Unidades fijas en kg/cm por ahora; el selector kg↔lb y cm↔in se construye en el Módulo 5 (Perfil).

## Fuera de alcance (Parte B)
- Galería/timeline de fotos con slider de comparación "antes/después".
- Medidas opcionales (cintura, brazo, pierna, etc.).
- Cálculo automático de IMC.

## Datos y almacenamiento

### Tabla `body_logs`
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
```
- `photo_path` es opcional (`nullable`) — a diferencia de Racha, la foto acá no es obligatoria para registrar el peso (el README no la marca como requisito estricto, y forzarla sería fricción innecesaria para un registro que se hace seguido).
- `weight`/`height` en `numeric` para permitir decimales (ej. 74.5 kg).

### Storage: bucket `body_photos`
- Privado, mismo patrón que `checkins`: carpeta por usuario (`<user_id>/<date>.jpg`), políticas RLS por carpeta, URLs firmadas de corta duración para mostrar.

## Gráfica de peso
- Componente `src/components/WeightChart.js`, dibujado a mano con `react-native-svg`:
  - Eje X: fechas de los registros (últimas ~12 semanas), espaciadas uniformemente por índice (no por escala temporal exacta — simplicidad, aceptable porque los registros son ~diarios).
  - Eje Y: escala lineal entre el mínimo y máximo peso del rango, con un margen del 10% arriba/abajo.
  - Línea del peso en color `colors.cobalto`, con un punto destacado (círculo) en el último registro.
  - Si hay menos de 2 registros, se muestra un texto "Registrá más días para ver tu evolución" en vez de la gráfica.

## Pantallas y archivos
- Completar `src/screens/FisicoScreen.js`: peso actual (grande, Space Grotesk) + `WeightChart` + botón "Registrar" (o "✅ Ya registraste hoy").
- Crear `src/lib/bodyLogs.js`: `getBodyLogsForRange(userId, from, to)`, `getTodayBodyLog(userId)`, `createBodyLog(userId, {weight, height, photoUri})`, `getSignedBodyPhotoUrl(photoPath)` — mismo patrón que `checkins.js`.
- Crear `src/components/RegistrarFisicoModal.js`: modal con dos `TextInput` numéricos (peso, altura) + botones "Tomar foto"/"Elegir de galería"/"Sin foto" + "Guardar".

## Manejo de errores
- Peso o altura vacíos/no numéricos: no se habilita "Guardar" (validación simple en el modal, sin librería de formularios).
- Falla al guardar (foto o insert): alerta genérica, el modal no se cierra, no queda un registro a medias.

## Testing
- Sin lógica nueva de cálculo que amerite tests unitarios esta vez. Verificación manual en el iPhone, igual que el resto de las pantallas construidas hasta ahora.
