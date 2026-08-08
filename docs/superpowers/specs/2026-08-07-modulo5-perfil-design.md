# Racha/KeepIt — Módulo 5: Perfil — Design

## Contexto
Último módulo del README. La pantalla actual (`PerfilScreen.js`) solo tiene el horario del recordatorio diario y "Cerrar sesión". El README pide un resumen general (racha actual, peso actual, progreso del objetivo, foto más reciente) con respaldo automático en la nube y sin funciones sociales. Se amplía inspirándose en el dashboard de perfil de apps como Strava/Apple Fitness y el sistema de logros de Duolingo (insignias personales, sin ranking ni comparación con otros).

## Alcance
1. Encabezado: foto de perfil propia (separada de las fotos de check-in, se sube/reemplaza tocándola), nombre editable, "Miembro desde [fecha]".
2. Grid de stats: 🔥 racha actual, 🏆 racha máxima, ⚖️ peso actual, 🎯 progreso del objetivo activo (si hay uno).
3. Logros/insignias personales, persistidos en la base con la fecha real en que se desbloquearon (no se recalculan desde cero cada vez), según racha máxima histórica, objetivos completados y entrenamientos totales.
4. Galería horizontal de fotos recientes de check-in, tocar una la abre grande.
5. Mini gráfica (sparkline) de la tendencia de peso de los últimos registros.
6. Totales históricos: cantidad de entrenamientos y volumen total levantado (kg).
7. Indicador "☁️ Todo respaldado en la nube".
8. Se mantiene lo existente: horario de recordatorio y botón de cerrar sesión.

## Fuera de alcance
- Funciones sociales (amigos, comparar rachas, ranking) — explícito en el README.
- Editar peso/altura desde Perfil (eso es de Físico).
- Notificación o animación especial al desbloquear un logro nuevo (por ahora solo aparece en la lista, sin aviso en el momento).

## Datos

### Migración: tabla de logros desbloqueados + bucket de foto de perfil
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
- El `unique (user_id, logro_key)` evita duplicar un logro ya desbloqueado; insertar de nuevo la misma fila simplemente no debe hacerse (se verifica antes) — no se usa upsert porque `unlocked_at` no debe pisarse una vez seteado.
- La foto de perfil se guarda siempre en la misma ruta determinística `${userId}/foto.jpg` dentro de `profile_photos` (subir una nueva sobrescribe la anterior con `upsert: true`, igual que el resto de las fotos de la app). No hace falta guardar la ruta en ninguna tabla: si el archivo existe, `getSignedUrl` lo resuelve; si no existe, el error de "no encontrado" se interpreta como "todavía no subió foto" y se muestra el ícono con la inicial.

### El resto de los datos (sin tablas nuevas)
- **Nombre**: se guarda en `auth.users.user_metadata.nombre` vía `supabase.auth.updateUser({ data: { nombre } })`. Se lee de `user.user_metadata.nombre` (vacío si nunca se puso).
- **Miembro desde**: `user.created_at` (ya lo da Supabase Auth).
- **Racha actual/máxima**: `getCheckinsForRange`, `getRachaMaxima` (`src/lib/checkins.js`, ya existen) + `calcularRachaActual` (`src/lib/rachaCalculo.js`, ya existe).
- **Fotos recientes de check-in** (para la galería, no para la foto de perfil): mismas funciones de `checkins.js`, filtrando las que tienen `photo_path`.
- **Peso actual y tendencia**: `getBodyLogsForRange` (`src/lib/bodyLogs.js`, ya existe), pidiendo los últimos ~10 registros.
- **Objetivo activo**: `getActiveGoal` (`src/lib/goals.js`) + `calcularProgreso` (`src/lib/objetivoCalculo.js`), ambos ya existentes.
- **Objetivos completados**: `getGoalHistory` (`src/lib/goals.js`, ya existe), contando `status === 'completado'`.
- **Entrenamientos totales y volumen histórico**: nueva función `getAllFinishedWorkouts(userId)` en `src/lib/workouts.js` (igual que `getRecentWorkouts` pero sin `.limit()`), sumando el volumen de cada uno con `calcularVolumenTotal` (`src/lib/workoutsCalculo.js`, ya existe).

## Logros
Nuevo archivo `src/lib/logros.js` — solo la definición y el cálculo puro, sin nada de Supabase (testeable con Jest sin mocks):
```js
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
`stats` es `{ rachaMaxima, objetivosCompletados, totalEntrenamientos }`.

Nuevo archivo `src/lib/logrosDb.js` (con Supabase, sin tests, mismo patrón que el resto de los archivos de acceso a datos):
- `getLogrosGuardados(userId)`: trae las filas de `unlocked_logros` del usuario (`logro_key`, `unlocked_at`), ordenadas por `unlocked_at` ascendente.
- `guardarLogroNuevo(userId, logroKey)`: inserta una fila nueva en `unlocked_logros` (si ya existe por la restricción única, Postgres devuelve un error de violación de unicidad — se debe llamar solo para claves que `getLogrosGuardados` todavía no tiene, nunca a ciegas).
- `sincronizarLogros(userId, stats)`: calcula los elegibles con `calcularLogrosDesbloqueados(stats)`, trae los ya guardados con `getLogrosGuardados`, guarda los que faltan con `guardarLogroNuevo`, y devuelve la lista final combinada (cada logro de `LOGROS` que esté guardado, con su `unlocked_at` real y sus datos de `emoji`/`label` sacados de `LOGROS`).
- `getProfilePhotoPath(userId)`: devuelve siempre `` `${userId}/foto.jpg` `` (función pura de conveniencia, no llama a Supabase).
- `uploadProfilePhoto(userId, photoUri)`: sube la foto a `profile_photos` en la ruta de arriba con `upsert: true` (mismo patrón de lectura de archivo base64 que `bodyLogs.js`/`exercises.js`).
- `getSignedProfilePhotoUrl(userId)`: pide la URL firmada de `profile_photos/${userId}/foto.jpg`; si Supabase devuelve error (no existe todavía), lo relanza tal cual — quien lo llama decide mostrar el ícono con la inicial en el `catch`.

## Pantallas y componentes
- Reescribir `src/screens/PerfilScreen.js`: carga todos los datos de arriba en el `useFocusEffect` existente (incluyendo `sincronizarLogros` y el intento de traer la foto de perfil), y renderiza encabezado (foto propia tocable para subir/cambiar, nombre editable, miembro desde), grid de stats, grid de logros (mostrando la fecha de cada uno), galería, sparkline, totales, indicador de nube, y al final el bloque de recordatorio + cerrar sesión que ya existe (sin tocar esa lógica).
- Crear `src/components/EditarNombreModal.js`: modal simple (input de texto + Guardar/Cancelar), mismo patrón que `CrearCarpetaModal.js`. Seguro como `<Modal>` propio porque se abre desde `PerfilScreen`, que no es un modal.
- Crear `src/components/MiniSparkline.js`: SVG chico (sin ejes, sin etiquetas, solo la línea) usando `react-native-svg`, mismo enfoque hand-rolled que `WeightChart.js`/`ObjetivoChart.js` pero minimalista. Props: `{ valores: number[], ancho, alto }`.
- Reutilizar `PhotoViewerModal.js` (ya existe, genérico vía prop `getSignedUrl`) para ver una foto de la galería en grande. Para la foto de perfil no hace falta un visor grande — tocarla abre directo el selector de cámara/galería para reemplazarla (mismo flujo de `elegirOrigenFoto` que ya existe en `RegistrarFisicoModal.js`/`BibliotecaEjerciciosModal.js`).

## Manejo de errores
- Si falla `updateUser` al guardar el nombre: alerta simple, el modal no se cierra (se puede reintentar).
- Si falla subir la foto de perfil: alerta simple, se mantiene la foto anterior (o el ícono con inicial si nunca tuvo una).
- Si no hay fotos de check-in todavía: la galería muestra un mensaje simple en vez de la tira horizontal.
- Si no hay objetivo activo: esa parte del grid de stats no se muestra (en vez de mostrar 0%).
- Si no hay suficientes registros de peso para el sparkline (menos de 2): no se dibuja la mini gráfica.

## Testing
- `logros.js` se testea con Jest: cada umbral (justo en el límite y un paso antes), varios logros desbloqueados a la vez, estado sin ningún logro. Es la única función con lógica no trivial en este módulo (`logrosDb.js` es puro acceso a datos + una función de conveniencia de una línea, sin tests, mismo criterio que el resto de los `*.js` de `src/lib`).
- El resto (pantalla, galería, sparkline, modal de nombre, subida de foto de perfil) se verifica a mano en el iPhone, como en los módulos anteriores.
