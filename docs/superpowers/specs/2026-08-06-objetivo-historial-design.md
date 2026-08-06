# Racha — Módulo 4 (extensión): Historial y cierre de objetivos — Design

## Contexto
Extensión del Módulo 4 (Objetivos), pedida por el usuario tras usar la versión inicial (que solo soportaba un objetivo a la vez, reemplazando el anterior sin dejar rastro). Cubre: guardar un historial de objetivos pasados, un botón "Dar por completado" con resumen de cierre al llegar al 100%, y un modal de historial con la gráfica de cada objetivo pasado.

## Alcance
1. `goals` deja de sobreescribir: cada objetivo nuevo es una fila nueva; los viejos quedan marcados como `completado` o `cancelado`, no se borran.
2. Solo puede haber un objetivo `activo` por usuario a la vez (la regla de negocio no cambia, solo cómo se implementa).
3. "Cancelar objetivo" ahora marca el objetivo como `cancelado` en vez de borrarlo.
4. Nuevo botón "Dar por completado", visible solo cuando el progreso llega a 100%. Al confirmar, marca el objetivo como `completado` y muestra un resumen: fecha objetivo que había puesto, fecha real en que llegó, días que le tomó, promedio semanal logrado.
5. Botón "Historial" (arriba a la derecha de la pantalla Objetivo) que abre un modal con la lista de objetivos pasados (completados y cancelados), cada uno con su propia gráfica.

## Fuera de alcance
- Editar un objetivo ya cerrado.
- Borrar objetivos del historial (quedan para siempre, como registro).
- Estadísticas agregadas sobre el historial (ej. "promedio de objetivos logrados").

## Datos

### Migración: `goals` — agregar `status` y `ended_at`, cambiar la restricción única
```sql
alter table goals add column status text not null default 'activo' check (status in ('activo', 'completado', 'cancelado'));
alter table goals add column ended_at date;

alter table goals drop constraint goals_user_id_key;

create unique index goals_un_activo_por_usuario
  on goals (user_id)
  where status = 'activo';
```
- El índice único parcial (`where status = 'activo'`) es lo que garantiza "solo un objetivo activo a la vez", sin impedir tener varias filas `completado`/`cancelado` para el mismo usuario.
- Las filas existentes (creadas antes de este cambio) quedan con `status = 'activo'` por el default, que es correcto ya que representan el objetivo actual.

## Acceso a datos (`src/lib/goals.js`)
- `getActiveGoal(userId)` — reemplaza a `getGoal`, filtra por `status = 'activo'`.
- `createGoal(userId, {type, targetValue, targetDate, startValue, startDate})` — `insert` (ya no `upsert`), siempre crea una fila nueva con `status: 'activo'`.
- `cancelGoal(goalId)` — `update` a `status: 'cancelado', ended_at: hoy` (antes borraba la fila).
- `completeGoal(goalId)` — `update` a `status: 'completado', ended_at: hoy`.
- `getGoalHistory(userId)` — filas con `status in ('completado', 'cancelado')`, ordenadas por `ended_at` descendente.

## Resumen de cierre al completar
Se calcula con datos que ya tenemos, sin lógica nueva:
- Fecha objetivo puesta: `goal.target_date` (o "sin fecha" si no tenía).
- Fecha real de logro: hoy (`ended_at`).
- Días que tomó: `ended_at - start_date` en días.
- Promedio semanal: `calcularRitmoSemanal(goal.start_date, logs)` (ya existe).

Se muestra en un `Alert` con los 4 datos antes de volver a la pantalla vacía de "no tenés objetivo".

## Pantallas y componentes
- Modificar `ObjetivoScreen.js`: usa `getActiveGoal`/`createGoal`/`cancelGoal`/`completeGoal`; agrega el botón "Historial" (arriba a la derecha, junto al título) y el botón "Dar por completado" (visible solo si progreso ≥ 100%).
- Crear `src/components/HistorialObjetivosModal.js`: al abrirse, trae `getGoalHistory` + los `body_logs` de cada objetivo pasado (entre su `start_date` y `ended_at`), y renderiza una lista con `ObjetivoChart` por cada uno (mismo componente que ya existe, sin cambios).

## Manejo de errores
- Si falla completar/cancelar: alerta simple, el objetivo sigue activo (no se pierde nada a medias).
- Si un objetivo del historial no tiene suficientes registros de peso para graficar, `ObjetivoChart` ya muestra su mensaje de "Registrá más pesos..." — se reutiliza tal cual.

## Testing
- Sin lógica nueva de cálculo (el resumen de cierre reutiliza `calcularRitmoSemanal`, ya testeado). Verificación manual en el iPhone: cancelar, completar, y ver ambos aparecer en el historial con su gráfica.
