# Racha — Módulo 1 (Parte A): Check-in diario + calendario — Design

## Contexto
Primera mitad del Módulo 1 del [README.md](../../../README.md). Cubre el check-in diario con foto, el cálculo y color de racha, y el calendario mensual con "tocar un día para ver la foto". Se deja para la Parte B (spec separada, más adelante): racha máxima histórica, promedios, vista anual tipo heatmap, y la notificación push de las 8pm.

## Alcance
1. Botón "Registrar hoy" que abre cámara o galería, sube la foto y crea el check-in del día.
2. El botón cambia a "✅ Ya fuiste hoy" si ya hay check-in de hoy.
3. Contador de racha actual (🔥 + número de días consecutivos) en la parte superior de la pantalla Racha.
4. Calendario mensual (grid de 6 semanas × 7 días) con cada día marcado coloreado según la escala de racha vigente en el momento en que se registró ese día.
5. Tocar un día marcado abre un modal con la foto de ese día.

## Fuera de alcance (Parte B)
- Racha máxima histórica, promedio de días/semana, total mes/año.
- Vista anual tipo mapa de calor con toggle Mes/Año.
- Notificación push de las 8pm.

## Datos y almacenamiento

### Tabla `gym_checkins` (Postgres, vía Supabase)
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
```
- `photo_path`: ruta dentro del bucket de Storage (no una URL pública), ej. `"<user_id>/2026-08-05.jpg"`.
- `racha_dia`: la racha (en días consecutivos, incluyendo este) que tenía el usuario al momento de crear este check-in. Se calcula una vez, al insertar, y **no se vuelve a tocar** — así el color de días pasados no cambia si la racha se corta después.

### Storage: bucket `checkins`
- Bucket **privado** (no público).
- Cada foto se guarda en `<user_id>/<date>.jpg`, así cada usuario tiene su propia carpeta.
- Políticas: un usuario solo puede leer/escribir dentro de su propia carpeta (comparando el primer segmento del path con `auth.uid()`).
- Para mostrar una foto, la app pide una URL firmada de corta duración (`createSignedUrl`, ej. 60 segundos) en el momento de abrir el modal — no se guardan URLs públicas ni permanentes.

## Cálculo de racha actual
Al cargar la pantalla Racha:
1. Traer las fechas de check-in del usuario ordenadas descendente (alcanza con los últimos ~60 días).
2. Si hay check-in de hoy, contar hacia atrás días consecutivos (incluyendo hoy) hasta el primer hueco.
3. Si NO hay check-in de hoy, contar hacia atrás desde ayer (la racha "sigue viva" hasta que termine el día sin marcar).
4. Ese número es tanto la "racha actual" mostrada arriba como el `racha_dia` que se guardaría si el usuario marca hoy.

## Color por racha (igual a la escala del spec, ya en `src/theme/colors.js`)
- 1–6 → verde · 7–13 → amarillo · 14–20 → naranja · 21–27 → rojo · 28+ → violeta
- Días del mes sin check-in: gris oscuro (`colors.surface`), sin número resaltado.
- El día de hoy tiene un borde blanco de 2px (según diseño).

## Pantallas y archivos
- Modificar `src/screens/RachaScreen.js`: orquesta todo — trae los check-ins del mes actual, calcula la racha, renderiza contador + `CalendarGrid` + botón + `PhotoViewerModal`.
- Crear `src/lib/checkins.js`: funciones puras de acceso a datos —
  - `getCheckinsForRange(userId, fromDate, toDate)` → lista de check-ins.
  - `getTodayCheckin(userId)` → check-in de hoy o `null`.
  - `createCheckin(userId, photoUri)` → sube la foto, calcula `racha_dia`, inserta la fila, devuelve el check-in creado.
  - `getSignedPhotoUrl(photoPath)` → URL firmada temporal.
- Crear `src/components/CalendarGrid.js`: recibe el mes/año y la lista de check-ins, dibuja la grilla de 7 columnas, llama a `onDayPress(checkin)` cuando se toca un día con registro.
- Crear `src/components/PhotoViewerModal.js`: recibe `visible`, `photoPath`, `onClose`; pide la URL firmada y muestra la imagen a pantalla completa.
- Crear `src/lib/rachaCalculo.js`: función pura `calcularRachaActual(fechasCheckin: string[]) => number`, testeable sin depender de Supabase ni de React Native.

## Flujo de "Registrar hoy"
1. Si ya existe check-in de hoy → botón deshabilitado, texto "✅ Ya fuiste hoy".
2. Si no existe → al tocar, `expo-image-picker` muestra un menú nativo: "Tomar foto" / "Elegir de galería".
3. Tras elegir/tomar la foto: estado de carga en el botón ("Subiendo...").
4. Se sube la foto al bucket, se calcula la racha del día, se inserta la fila en `gym_checkins`.
5. Se refresca el calendario y el contador sin recargar toda la pantalla.

## Manejo de errores
- Si falla el permiso de cámara/galería: alerta explicando qué pasó y cómo habilitarlo desde Ajustes del iPhone.
- Si falla la subida de foto o el insert en la base: alerta genérica ("No se pudo guardar, intentá de nuevo"), el botón vuelve a "Registrar hoy" (no queda a medio camino ni se crea un registro sin foto).
- Si falla pedir la URL firmada al abrir una foto vieja: el modal muestra un texto de error en vez de quedarse cargando para siempre.

## Testing
- `calcularRachaActual` (en `src/lib/rachaCalculo.js`) se testea con Jest de forma aislada: casos con racha activa, racha cortada, sin check-ins, check-in de hoy vs. sin check-in de hoy. Es la primera lógica del proyecto con tests automatizados — hasta ahora todo fue configuración/UI verificada a mano.
- El resto (subida de foto, flujo de UI) se verifica manualmente en el iPhone, como en las fases anteriores.
