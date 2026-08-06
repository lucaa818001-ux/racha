# Racha — Módulo 4: Objetivos — Design

## Contexto
Cuarto módulo del README, después de Racha y Cambio físico. Depende de los datos de `body_logs` (Módulo 3) para calcular el progreso. Cubre definir un objetivo de peso, ver el progreso hacia esa meta, y cancelarlo cuando quieras.

## Alcance
1. Un solo objetivo activo por usuario (crear uno nuevo reemplaza al anterior).
2. Formulario: tipo (bajar/subir peso), peso objetivo, fecha objetivo (opcional). `start_value`/`start_date` se completan solos con el peso más reciente registrado en Físico.
3. % de progreso, recalculado automáticamente con cada nuevo registro de peso.
4. Gráfica: peso real (línea sólida) vs. proyección lineal hacia la meta (línea punteada, solo si hay fecha objetivo).
5. Fecha estimada de logro según el ritmo actual (regresión lineal simple sobre los registros desde que arrancó el objetivo), si hay al menos 3 registros en ese período.
6. Botón "Cancelar objetivo" que borra el objetivo actual.

## Fuera de alcance
- Más de un objetivo activo a la vez.
- Objetivos que no sean de peso (fuerza, racha, etc. — la tabla `goals` los podría soportar a futuro, pero no ahora).
- Notificaciones relacionadas al objetivo.

## Datos

### Tabla `goals`
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
- La restricción `unique (user_id)` es lo que garantiza "un objetivo a la vez": crear uno nuevo hace un `upsert` que reemplaza la fila existente.

## Cálculo de progreso
Nuevo archivo `src/lib/objetivoCalculo.js`, funciones puras y testeables:
- `calcularProgreso(goal, pesoActual) => number` (0-100, redondeado, clampeado):
  - Tipo "bajar": `((start_value - pesoActual) / (start_value - target_value)) * 100`
  - Tipo "subir": `((pesoActual - start_value) / (target_value - start_value)) * 100`
  - Si `target_value === start_value`, progreso es 100 si `pesoActual` ya llegó, si no 0 (evita división por cero).
- `estimarFechaLogro(goal, logsDesdeInicio) => Date | null`:
  - Necesita al menos 3 registros de peso con fecha `>= start_date`.
  - Regresión lineal simple (mínimos cuadrados) de peso vs. días desde `start_date`.
  - Si la pendiente va en la dirección correcta hacia la meta, calcula en qué día cruzaría `target_value`; si no (pendiente en contra o nula), devuelve `null`.

## Pantallas y archivos
- Completar `src/screens/ObjetivoScreen.js`:
  - Si no hay objetivo: mensaje + botón "Crear objetivo".
  - Si hay objetivo: número grande de % de progreso, gráfica, fecha estimada de logro (si se pudo calcular), y botón "Cancelar objetivo".
- Crear `src/lib/goals.js`: `getGoal(userId)`, `upsertGoal(userId, {type, targetValue, targetDate, startValue, startDate})`, `deleteGoal(userId)` — mismo patrón que `bodyLogs.js` pero sin fotos.
- Crear `src/components/CrearObjetivoModal.js`: formulario con tipo (dos botones tipo toggle), peso objetivo, fecha objetivo opcional (mismo `DateTimePicker` compacto que ya usamos).
- Crear `src/components/ObjetivoChart.js`: extiende la idea de `WeightChart` pero dibuja dos líneas (real sólida, proyectada punteada) sobre el mismo rango de fechas.

## Manejo de errores
- Si no hay ningún registro de peso en Físico todavía, el botón "Crear objetivo" muestra un aviso: "Registrá tu peso en Físico primero" (no se puede fijar `start_value` sin un peso base).
- Si falla guardar o borrar el objetivo: alerta simple, sin dejar estado a medias.

## Testing
- `calcularProgreso` y `estimarFechaLogro` se testean con Jest: casos "bajar" y "subir", metas ya alcanzadas, sin datos suficientes para estimar fecha, pendiente en la dirección incorrecta.
- El resto (formulario, gráfica) se verifica a mano en el iPhone.
