# Racha — Módulo 3 (Parte B): Comparación de fotos, medidas e IMC — Design

## Contexto
Segunda mitad del Módulo 3, después de la Parte A (registro libre de peso/altura/foto con historial). Cubre lo que quedaba pendiente del README: galería/comparación de fotos con slider antes/después, medidas corporales opcionales, y el cálculo automático de IMC.

## Alcance
1. Modal "Comparar fotos": desde la pantalla Físico, elige por default la foto más antigua y la más reciente (de las que tengan foto), con un slider para revelar una encima de la otra, y un botón "Cambiar" por lado para elegir otra fecha.
2. Medidas opcionales en el formulario de registro: cintura, brazo, pierna (cm), guardadas en una columna `measurements` (jsonb) en `body_logs` — como ya definía el README original.
3. IMC calculado automáticamente (peso ÷ altura²) y mostrado arriba de la pantalla y en cada fila del historial.

## Fuera de alcance
- Editar medidas de un registro ya guardado (por ahora solo se pueden agregar al crear, o borrar el registro entero y crear uno nuevo).
- Categorías de IMC (bajo peso/normal/sobrepeso, etc.) — solo se muestra el número.

## Datos

### Migración: agregar `measurements` a `body_logs`
```sql
alter table body_logs add column measurements jsonb;
```
- Solo se guardan las claves que el usuario completó (ej. `{"cintura": 80}` si solo llenó cintura). `null` si no agregó ninguna.

### Consulta para la galería
Nueva función en `bodyLogs.js`: `getBodyLogsConFoto(userId) => Promise<{id, date, photo_path}[]>` — todos los registros del usuario que tengan `photo_path` no nulo, ordenados por fecha ascendente. De esa lista, el modal toma el primero (más viejo) y el último (más nuevo) como default.

## IMC
Nuevo archivo `src/lib/imc.js`, función pura y testeable:
```
calcularIMC(pesoKg: number, alturaCm: number) => number
```
`imc = pesoKg / (alturaCm / 100) ** 2`, redondeado a 1 decimal. Se usa tanto en `FisicoScreen` (arriba, con el peso/altura más reciente) como en cada fila del historial (con el peso/altura de ESE registro puntual).

## Componentes
- Crear `src/components/BeforeAfterSlider.js`: recibe `beforeUrl`, `afterUrl` (URLs ya resueltas, el componente no llama a Supabase). Dos `Image` superpuestas del mismo tamaño; la de "después" se recorta con `overflow: hidden` según la posición X de un `PanResponder` (nativo de React Native, sin librería nueva de gestos), con una línea/manija visual en el punto de corte.
- Crear `src/components/ComparacionFotosModal.js`: al abrirse, trae `getBodyLogsConFoto`, elige por default el primero/último, resuelve las URLs firmadas de esos dos, y renderiza `BeforeAfterSlider` + dos botones "Cambiar" que abren una lista simple de fechas (de los mismos registros con foto) para reemplazar ese lado.
- Modificar `RegistrarFisicoModal.js`: agregar un botón "Agregar medidas" que despliega 3 `TextInput` opcionales (cintura, brazo, pierna); si se completa alguno, se construye el objeto `measurements` correspondiente al guardar.
- Modificar `FisicoScreen.js`: agregar el IMC junto al peso arriba, un botón "Comparar fotos" (deshabilitado si hay menos de 2 fotos), IMC en cada fila del historial.

## Manejo de errores
- Si no hay al menos 2 registros con foto, el botón "Comparar fotos" queda deshabilitado con el texto "Necesitás al menos 2 fotos para comparar".
- Si falla resolver alguna de las URLs firmadas dentro del modal de comparación, se muestra un texto de error en ese lado en vez de la imagen (mismo criterio que `PhotoViewerModal`).

## Testing
- `calcularIMC` se testea con Jest (casos con distintos pesos/alturas, valor conocido de referencia).
- El resto (slider, formulario de medidas) se verifica a mano en el iPhone.
