# Racha — Diseño Fase 1: Setup del proyecto

## Contexto
Este documento acompaña al spec técnico general en [README.md](../../../README.md). Cubre específicamente cómo vamos a ejecutar la **Fase 1** listada ahí ("Setup del proyecto + importar identidad visual + navegación de tabs"), adaptado para una persona que nunca programó ni hizo una app antes.

## Situación de partida
- Sistema operativo: Windows 11
- Dispositivo de prueba: iPhone (se usará la app "Expo Go")
- Cuentas existentes: Supabase, GitHub
- Cuenta pendiente de crear: Expo (EAS)
- Herramientas ya instaladas: Node.js v24, npm v11, git v2.53

## Alcance de la Fase 1
1. Crear el proyecto Expo (React Native) — base de código único para iOS/Android.
2. Instalar Expo Go en el iPhone del usuario para poder ver la app en tiempo real mientras se desarrolla.
3. Armar la navegación inferior (tabs) con las 5 secciones: Racha / Ejercicios / Físico / Objetivo / Perfil, todavía sin contenido funcional.
4. Crear el proyecto en Supabase (Postgres + Auth + Storage).
5. Conectar la app al proyecto de Supabase (variables de entorno con URL y clave pública).
6. Implementar pantallas de login/registro con Supabase Auth (email; Google/Apple quedan como posible extra, no bloqueante).
7. Importar la identidad visual ya diseñada en Claude Design (colores, tipografía) usando el MCP de diseño, según instrucciones del README.
8. Probar la app corriendo en el iPhone real vía Expo Go.
9. Subir el proyecto a GitHub (repo ya inicializado localmente en este paso de brainstorming).

## Fuera de alcance (se hace en fases posteriores, según README)
- Cualquier funcionalidad de los Módulos 1-5 (racha, ejercicios, cambio físico, objetivos, perfil) más allá de los tabs vacíos.
- Notificaciones push.
- Gráficas.

## Enfoque de trabajo
- Cada paso se explica en lenguaje simple antes de ejecutarse (qué hace y para qué sirve).
- Se avisa explícitamente cuándo hay una acción manual del usuario (instalar algo, tocar un botón, crear una cuenta, escanear un QR) y qué hacer exactamente.
- Se espera confirmación del usuario antes de pasar al siguiente paso.
- Si algo falla, se explica el error en términos simples antes de intentar solucionarlo.

## Criterio de éxito de la Fase 1
- La app abre correctamente en el iPhone del usuario vía Expo Go, mostrando los 5 tabs con la identidad visual aplicada.
- El usuario puede registrarse/loguearse con email y ese usuario queda guardado en Supabase.
- El código está subido a GitHub.

## Testing
No hay tests automatizados en esta fase (es puro setup). La verificación es manual: abrir la app en el celular y confirmar que navega entre tabs y que el login funciona contra Supabase.
