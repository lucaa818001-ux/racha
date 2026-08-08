# Racha/KeepIt — Módulo 5: Perfil — Design

## Contexto
Último módulo del README. La pantalla actual (`PerfilScreen.js`) solo tiene el horario del recordatorio diario y "Cerrar sesión". El README pide un resumen general (racha actual, peso actual, progreso del objetivo, foto más reciente) con respaldo automático en la nube y sin funciones sociales. Se amplía inspirándose en el dashboard de perfil de apps como Strava/Apple Fitness y el sistema de logros de Duolingo (insignias personales, sin ranking ni comparación con otros).

## Alcance
1. Encabezado: foto más reciente del check-in de Racha (circular), nombre editable, "Miembro desde [fecha]".
2. Grid de stats: 🔥 racha actual, 🏆 racha máxima, ⚖️ peso actual, 🎯 progreso del objetivo activo (si hay uno).
3. Logros/insignias personales, desbloqueados automáticamente según racha máxima histórica, objetivos completados y entrenamientos totales.
4. Galería horizontal de fotos recientes de check-in, tocar una la abre grande.
5. Mini gráfica (sparkline) de la tendencia de peso de los últimos registros.
6. Totales históricos: cantidad de entrenamientos y volumen total levantado (kg).
7. Indicador "☁️ Todo respaldado en la nube".
8. Se mantiene lo existente: horario de recordatorio y botón de cerrar sesión.

## Fuera de alcance
- Funciones sociales (amigos, comparar rachas, ranking) — explícito en el README.
- Foto de perfil separada de las fotos de check-in.
- Persistir los logros en la base (se recalculan en cada carga, no hay "fecha en que lo desbloqueaste").
- Editar peso/altura desde Perfil (eso es de Físico).

## Datos
No se crea ninguna tabla nueva.

- **Nombre**: se guarda en `auth.users.user_metadata.nombre` vía `supabase.auth.updateUser({ data: { nombre } })`. Se lee de `user.user_metadata.nombre` (vacío si nunca se puso).
- **Miembro desde**: `user.created_at` (ya lo da Supabase Auth).
- **Racha actual/máxima y foto reciente**: `getCheckinsForRange`, `getRachaMaxima` (`src/lib/checkins.js`, ya existen) + `calcularRachaActual` (`src/lib/rachaCalculo.js`, ya existe). La foto más reciente es el check-in más nuevo con `photo_path`, resuelta con `getSignedPhotoUrl`.
- **Peso actual y tendencia**: `getBodyLogsForRange` (`src/lib/bodyLogs.js`, ya existe), pidiendo los últimos ~10 registros.
- **Objetivo activo**: `getActiveGoal` (`src/lib/goals.js`) + `calcularProgreso` (`src/lib/objetivoCalculo.js`), ambos ya existentes.
- **Objetivos completados**: `getGoalHistory` (`src/lib/goals.js`, ya existe), contando `status === 'completado'`.
- **Entrenamientos totales y volumen histórico**: nueva función `getAllFinishedWorkouts(userId)` en `src/lib/workouts.js` (igual que `getRecentWorkouts` pero sin `.limit()`), sumando el volumen de cada uno con `calcularVolumenTotal` (`src/lib/workoutsCalculo.js`, ya existe).

## Logros
Nuevo archivo `src/lib/logros.js`, función pura y testeable:
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
`stats` es `{ rachaMaxima, objetivosCompletados, totalEntrenamientos }`. Los logros no cumplidos simplemente no aparecen en el resultado (no se muestran "bloqueados" en gris, para mantenerlo simple).

## Pantallas y componentes
- Reescribir `src/screens/PerfilScreen.js`: carga todos los datos de arriba en el `useFocusEffect` existente, arma el `stats` para `calcularLogrosDesbloqueados`, y renderiza encabezado, grid de stats, grid de logros, galería, sparkline, indicador de nube, y al final el bloque de recordatorio + cerrar sesión que ya existe (sin tocar esa lógica).
- Crear `src/components/EditarNombreModal.js`: modal simple (input de texto + Guardar/Cancelar), mismo patrón que `CrearCarpetaModal.js`. Seguro como `<Modal>` propio porque se abre desde `PerfilScreen`, que no es un modal.
- Crear `src/components/MiniSparkline.js`: SVG chico (sin ejes, sin etiquetas, solo la línea) usando `react-native-svg`, mismo enfoque hand-rolled que `WeightChart.js`/`ObjetivoChart.js` pero minimalista. Props: `{ valores: number[], ancho, alto }`.
- Reutilizar `PhotoViewerModal.js` (ya existe, genérico vía prop `getSignedUrl`) para ver una foto de la galería en grande.

## Manejo de errores
- Si falla `updateUser` al guardar el nombre: alerta simple, el modal no se cierra (se puede reintentar).
- Si no hay fotos de check-in todavía: la galería muestra un mensaje simple en vez de la tira horizontal.
- Si no hay objetivo activo: esa parte del grid de stats no se muestra (en vez de mostrar 0%).
- Si no hay suficientes registros de peso para el sparkline (menos de 2): no se dibuja la mini gráfica.

## Testing
- `logros.js` se testea con Jest: cada umbral (justo en el límite y un paso antes), varios logros desbloqueados a la vez, estado sin ningún logro.
- El resto (pantalla, galería, sparkline, modal de nombre) se verifica a mano en el iPhone, como en los módulos anteriores.
