# Racha — Módulo 1 (Parte B): Estadísticas, vista anual y recordatorio — Design

## Contexto
Segunda mitad del Módulo 1, continuando después de la Parte A (check-in diario + calendario mensual, ya implementada). Cubre lo que quedó pendiente del README: racha máxima histórica, promedio de días/semana, total mes/año, vista anual tipo mapa de calor con selector de mes/año, y una notificación de recordatorio diaria (con hora configurable, no fija a las 8pm, por pedido explícito del usuario).

## Alcance
1. Estadísticas: racha máxima histórica, total de check-ins este mes, total este año, promedio semanal (últimas 4 semanas).
2. Toggle "Mes" / "Año" arriba del calendario en `RachaScreen`.
3. Vista Mes: el calendario existente + flechas para navegar entre meses del año actual.
4. Vista Año: los 12 meses del año actual en grilla compacta, sin números, no interactiva.
5. Recordatorio diario configurable: fila nueva en Perfil para elegir la hora; se reprograma automáticamente al abrir la app o marcar el día.

## Fuera de alcance
- Navegar a años anteriores (queda para cuando haya demanda real de eso).
- Notificaciones remotas / push desde servidor (no aplica, es 100% local).
- Sincronizar la hora del recordatorio entre dispositivos (se guarda solo en el celular).

## Datos: estadísticas y vista anual comparten una sola consulta
Al entrar a la pantalla Racha, se trae **una sola vez** la lista completa de check-ins del año actual (`getCheckinsForRange(userId, 1-enero, 31-diciembre)`), y de ahí se derivan, sin más consultas:
- **Racha máxima histórica** = el valor más alto de `racha_dia` entre todos los check-ins del usuario (no solo el año actual — para esto se hace una consulta aparte, `select max(racha_dia)`, ya que la racha máxima puede venir de un año anterior).
- **Total este mes** = cantidad de check-ins con fecha dentro del mes actual.
- **Total este año** = cantidad total de check-ins en la lista ya traída.
- **Promedio semanal** = check-ins de los últimos 28 días ÷ 4.
- **Vista mensual** = filtrar la misma lista por el mes que se esté mostrando.
- **Vista anual** = la lista completa, agrupada por mes.

Nueva función en `src/lib/checkins.js`: `getRachaMaxima(userId) => Promise<number>`.
Nuevo archivo `src/lib/estadisticas.js`: función pura `calcularEstadisticas(checkinsDelAnio: {date}[], hoy?: Date) => { totalMes, totalAnio, promedioSemanal }` (testeable igual que `rachaCalculo.js`).

## Componentes
- Modificar `src/components/CalendarGrid.js`: agregar prop `compact` (boolean, default `false`). En modo compacto: celdas más chicas, sin número de día, sin `onDayPress` (no interactivo), sin encabezado de días de semana.
- Crear `src/components/MonthSelector.js`: fila con `< Mes Año >`, recibe `year`, `month`, `onChange(year, month)`; deshabilita la flecha "siguiente" si ya está en el mes actual, y la de "anterior" si el mes mostrado es enero del año actual (no se navega a años anteriores).
- Crear `src/components/YearHeatmap.js`: recibe `year` y la lista completa de check-ins del año; renderiza 12 `CalendarGrid` en modo `compact` (uno por mes) con su etiqueta ("Ene", "Feb", ...) en una grilla de 3 columnas.
- Modificar `src/screens/RachaScreen.js`: agrega el toggle Mes/Año, usa `MonthSelector` en modo mes, `YearHeatmap` en modo año, y muestra la fila de estadísticas arriba de todo.

## Recordatorio configurable
- Nuevo archivo `src/lib/recordatorio.js`:
  - `getHoraRecordatorio() => Promise<string>` — lee de `AsyncStorage` (clave `"hora_recordatorio"`), default `"20:00"`.
  - `setHoraRecordatorio(hora: string) => Promise<void>` — guarda en `AsyncStorage`.
  - `sincronizarRecordatorios(checkins: {date}[]) => Promise<void>` — cancela todas las notificaciones programadas (`cancelAllScheduledNotificationsAsync`), pide permiso si hace falta (si lo niegan, no programa nada y no insiste), y programa una notificación de tipo `DATE` para cada uno de los próximos 7 días que no tenga check-in en la hora configurada (si es hoy y esa hora ya pasó, no programa la de hoy).
- Se llama a `sincronizarRecordatorios` después de cargar los datos de la pantalla Racha y después de cada check-in exitoso.
- Nueva fila en `PerfilScreen.js`: "Recordatorio: 20:00" (o la hora guardada) — al tocarla, abre `@react-native-community/datetimepicker` en modo hora; al confirmar, llama a `setHoraRecordatorio` y vuelve a sincronizar.
- **Limitación conocida (se explica en la propia app, no solo acá)**: como no hay servidor, esto depende de abrir la app al menos una vez cada varios días para que seguir renovando el recordatorio. Sin build nativa propia (fuera de Expo Go), no hay forma de chequear en segundo plano si el usuario ya marcó el día.

## Manejo de errores
- Si se niega el permiso de notificaciones: no se programa nada, sin alertas insistentes (se puede reactivar luego desde Ajustes del iPhone).
- Si falla guardar la hora en `AsyncStorage`: se mantiene la hora anterior y se muestra una alerta simple.

## Testing
- `calcularEstadisticas` (en `src/lib/estadisticas.js`) se testea con Jest, igual que `calcularRachaActual`: casos con check-ins repartidos en distintos meses, semanas vacías, etc.
- El resto (navegación de mes, vista anual, notificaciones) se verifica a mano en el iPhone.
