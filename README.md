# Racha — Spec técnico

## Resumen
App de fitness para iOS y Android. Un usuario registra su racha diaria de gimnasio (con foto), sus ejercicios y pesos, su cambio físico (peso/altura/fotos) y objetivos con gráfica de progreso. Multiusuario desde el día 1 (cuenta + nube), sin funciones sociales por ahora.

## Nota importante para Claude Code
La persona que va a ejecutar este proyecto **nunca hizo una app para celular y no sabe programar**. Claude Code debe:
- Explicar cada paso antes de ejecutarlo, en lenguaje simple (qué se va a hacer y para qué sirve, sin asumir conocimiento previo de términos técnicos)
- Ir de a un paso por vez, esperando confirmación antes de seguir al siguiente
- Avisar claramente cuándo la persona tiene que hacer algo manual (por ejemplo: instalar una app, crear una cuenta, tocar un botón en el celular, escanear un QR, etc.) y qué tiene que hacer exactamente
- Si algo falla, explicar qué pasó en términos simples antes de intentar arreglarlo
- Evitar dar por sentado que la persona sabe usar la terminal, Xcode, Android Studio, o similares — explicar también eso si hace falta

## Stack técnico
- **Frontend:** React Native + Expo (un solo código para iOS y Android)
- **Backend:** Supabase (Auth + Postgres + Storage para fotos)
- **Navegación:** React Navigation (tabs abajo: Racha / Ejercicios / Físico / Objetivo / Perfil)
- **Gráficas:** Victory Native o react-native-svg-charts
- **Notificaciones:** Expo Notifications (recordatorio diario)

## Autenticación
- Registro/login con email o Google/Apple (Supabase Auth)
- Perfil básico: nombre, foto, fecha de inicio

---

## Módulo 1: Racha de gimnasio
**Funcionalidad:**
- Botón "Marqué el gimnasio hoy" → abre cámara/galería → sube foto → guarda registro (fecha + foto + user_id)
- Un solo registro por día (si ya marcaste hoy, el botón cambia a "✅ Ya fuiste hoy")
- Calendario mensual (grid de días), tocar un día con registro muestra la foto de ese día

**Color progresivo según duración de la racha:** el cuadrado de cada día marcado cambia de color según cuántos días consecutivos lleva la racha activa en ese momento (no siempre verde). Escala tipo "temperatura":
- 1-6 días → verde
- 7-13 días → amarillo/naranja claro
- 14-20 días → naranja
- 21-27 días → rojo
- 28+ días → violeta
- Si la racha se corta, el próximo check-in reinicia en verde. Los días ya marcados NO cambian retroactivamente de color — quedan con el color que tenían al registrarse.

**Vista "Mes / Año" con toggle:** además de la vista mensual (con número en cada día), vista anual tipo mapa de calor estilo GitHub: los 12 meses juntos en grilla compacta, cuadraditos coloreados con la misma escala pero SIN número dentro (vista "de lejos", patrón visual general del año).

**Extras:** racha actual y racha máxima histórica, estadística de promedio días/semana y total mes/año, notificación push si a las 8pm no marcaste el día.

**Tabla Supabase:** `gym_checkins` (id, user_id, date, photo_url, created_at)

---

## Módulo 2: Ejercicios
**Funcionalidad:**
- Crear ejercicio propio: nombre, grupo muscular (dropdown: pecho, espalda, piernas, etc.), tipo (peso/reps o tiempo)
- Registrar sesión: elegir ejercicio, cargar series (peso x reps), fecha automática
- Historial por ejercicio: lista/gráfica de evolución de peso a lo largo del tiempo

**Extras:** rutinas/plantillas (agrupar ejercicios bajo un nombre, ej: "Rutina Push"), marcar "récord personal" automáticamente cuando se supera la mejor marca.

**Tablas Supabase:** `exercises` (id, user_id, name, muscle_group, type), `exercise_logs` (id, exercise_id, date, sets [jsonb: {weight, reps}])

---

## Módulo 3: Cambio físico
**Funcionalidad:**
- Registrar: peso, altura, foto, fecha
- Timeline/galería para comparar fotos (slider antes/después)
- Gráfica de peso en el tiempo

**Extras:** medidas opcionales (cintura, brazo, pierna, etc.), cálculo automático de IMC.

**Tabla Supabase:** `body_logs` (id, user_id, date, weight, height, photo_url, measurements jsonb)

---

## Módulo 4: Objetivos
**Funcionalidad:**
- Definir meta: tipo (bajar/subir peso), valor objetivo (ej: 70kg), fecha objetivo opcional
- Gráfica tipo MyFitnessPal: línea de peso real vs línea proyectada hacia la meta
- % de progreso calculado automáticamente en base a `body_logs`

**Extras:** proyección de fecha estimada de logro según ritmo actual (regresión simple sobre los últimos registros).

**Tabla Supabase:** `goals` (id, user_id, type, target_value, target_date, start_value, start_date)

---

## Módulo 5: Perfil
- Resumen general: racha actual, peso actual, progreso hacia el objetivo, foto más reciente
- Datos respaldados automáticamente en la nube vía Supabase
- Sin funciones sociales (amigos, ranking) por ahora

---

## Identidad visual (Claude Design)
Proyecto de diseño ya creado: https://claude.ai/design/p/8e8abfbf-685f-4c2b-8e6c-7ef7f8f5ae4b?file=Racha+-+Identidad+Visual.dc.html

Prompt para importar el diseño:
```
Use the claude_design MCP (https://api.anthropic.com/v1/design/mcp, auth via /design-login) to import this project:
https://claude.ai/design/p/8e8abfbf-685f-4c2b-8e6c-7ef7f8f5ae4b?file=Racha+-+Identidad+Visual.dc.html
Focus on these files (the whole project is readable):
- `Racha - Identidad Visual.dc.html`
Also read these files the selection imports:
- `ios-frame.jsx`
- `support.js`
Implement: `Racha - Identidad Visual.dc.html`
```

---

## Fases sugeridas de desarrollo
1. Setup del proyecto (Expo + Supabase + Auth) + importar identidad visual + navegación de tabs
2. Módulo Racha completo
3. Módulo Cambio físico + gráfica de peso
4. Módulo Objetivos (depende del módulo anterior)
5. Módulo Ejercicios
6. Perfil con resumen general
