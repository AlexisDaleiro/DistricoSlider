# Kiosk Puzzle — Fases 1 a 8

Districo incorpora el registro obligatorio de nombre y celular y el protocolo de la central Google Sheets + Apps Script, con la configuración publicada de Biofresh / Puzzle (`biofresh-puzzle`). Ver [GAMEHUB.md](GAMEHUB.md) para probar y compilar. Su producción requiere registro confirmado por la central; el modo offline descrito en las fases anteriores corresponde al flujo local de demo y a las pruebas explícitas.

Scaffolding white-label offline, motor puro y UI jugable de puzzle deslizable 3×3 / 4×4, según [el spec recibido](brief%20base/SPEC_KIOSK_PUZZLE.md). Incluye formulario configurable, persistencia IndexedDB y flujo ATTRACT → FORM → COUNTDOWN → GAME → RESULT → LEADERBOARD. El lead y su sesión se guardan juntos antes del countdown; el resultado se guarda antes de mostrar RESULT. Incluye kiosco con inactividad, admin con PIN, exportación offline CSV/XLSX y APK Android por marca.

Requisitos: Node.js 24+ y npm. Las versiones exactas verificadas están en `package.json`, `package-lock.json` y [DECISIONS.md](DECISIONS.md).

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Para iniciar la demo en PowerShell:

```powershell
$env:VITE_BRAND = 'demo'
npm run dev
```

En una shell POSIX:

```sh
VITE_BRAND=demo npm run dev
```

Abrir la URL local informada por Vite. `demo` también es la marca por defecto. Verás el logo geométrico de Pieza, el fondo oscuro, el acento verde, el título en Space Grotesk y el cuerpo en DM Sans, junto a la imagen completa del puzzle. Todos provienen de la marca activa y sus archivos locales.

## Verificar aceptación

| Criterio                                                             | Verificación                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fase 1: Vite, React, TS strict, Tailwind v4, ESLint/Prettier, Vitest | `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.                                                                                                                                                                                                               |
| Fase 1: demo con colores, fuente y logo del config                   | Iniciar dev como arriba; contrastar con `brands/demo/theme.config.json`. En DevTools, `:root` contiene `--brand-*` y `#brand-fonts` contiene dos `@font-face` locales.                                                                                                                    |
| Fase 1: ambas marcas con assets válidos                              | `npm run brand:validate -- demo` y `npm run brand:validate -- _template`.                                                                                                                                                                                                                 |
| Fase 1: configuración inválida falla con error legible               | `npm test -- scripts/validate-brand.test.ts`; el caso de config inválido comprueba el prefijo y la ruta `game.gridSize`. Para verlo por CLI, cambiar temporalmente `game.gridSize` a `5` en una copia de marca y ejecutar `brand:validate`; también bloquea dev/build. Restaurar después. |
| Fase 1: assets y contraste                                           | Los tests del validador cubren archivos ausentes, puzzle menor a 1000 px, fuente corrupta, video mayor a 50 MiB y contraste bajo como warning.                                                                                                                                            |
| Fase 2: motor completo                                               | `npm test -- src/features/game/engine`. Comprueba las funciones de los seis módulos del motor.                                                                                                                                                                                            |
| Fase 2: property test de 10.000 mezclas                              | `npm test -- src/features/game/engine/__tests__/shuffle.test.ts`. Ejecuta 10.000 seeds por tamaño, 20.000 mezclas en total.                                                                                                                                                               |
| Sin dependencias remotas en runtime                                  | `npm run build` y `npm run preview`; en la pestaña Network solo deben aparecer recursos del origen local. Fuentes, logos e imágenes se incluyen en `dist/assets`. El WebSocket HMR pertenece solo a dev.                                                                                  |

La suite incluye las pruebas de las fases anteriores y 10.000 mezclas por tamaño (20.000 en total). El motor no depende de React ni del DOM. Los repositorios se prueban con `fake-indexeddb` y bases aisladas; las pruebas no borran la base del navegador. El límite de 30 segundos del property test es solo del runner, no un timeout de producto.

## Districo y aceptación manual de Fase 3

```powershell
$env:VITE_BRAND = 'districo'
npm run dev
```

En POSIX: `VITE_BRAND=districo npm run dev`. Para producción web: definir la misma variable y ejecutar `npm run build`. `demo` sigue siendo el valor por defecto. Validar Districo con `npm run brand:validate -- districo`.

Districo usa el logo JPG adjunto, copiado sin modificaciones, y una paleta basada en [su web](https://www.districo.com.uy/): azul petróleo `#204F5F`, lima `#B1CA00`, blanco y neutros derivados. Las fuentes locales y la portada geométrica se conservaron. Desde Fase 4, cada partida usa una de las tres fotos de producto adjuntas, elegida al azar sin selector. No hay llamadas a esa web en runtime.

Para repetir las pruebas de Fase 3, primero completar el formulario válido y aceptar el consentimiento de demostración. El countdown comienza cuando la imagen está preparada y la transacción terminó.

| Criterio                                | Pasos manuales y resultado esperado                                                                                                                                                                                                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Imagen antes del juego y countdown      | Pulsar **Empezar el desafío**, completar el formulario y pulsar **¡Jugar!**. El submit espera la preparación/decodificación local y el guardado. Se muestra la imagen completa durante 3, 2, 1 según `countdownSec`.                                                                                           |
| Tap y filas/columnas                    | Tocar una ficha junto al hueco: cuenta 1. Tocar una ficha más alejada en su fila o columna: se desplazan todas las intermedias y el contador suma cada una. Una diagonal no mueve ni inicia el reloj; produce un shake leve.                                                                                   |
| Swipe sin doble movimiento              | Deslizar al menos 24 px sobre el tablero. La ficha se mueve en la dirección del dedo; el hueco va al lado opuesto. El contador sube solo 1. Un gesto menor al umbral se trata como tap. Probar las cuatro direcciones y los bordes.                                                                            |
| Juego rápido                            | Tocar varias fichas válidas antes de que termine cada transición. El input continúa habilitado y las posiciones se reinterpolan; los nodos conservan su identidad por ficha.                                                                                                                                   |
| Ambas grillas                           | Primero probar `game.gridSize: 3`. Cambiar a `4` en el config de la marca y recargar; aparecen 15 fichas y un hueco. Ambas claves de `shuffleMoves` ya están configuradas. Repetir tap, fila/columna y swipe; restaurar el tamaño elegido al terminar. No se agregó un selector de dificultad de admin.        |
| Reloj desde primer movimiento           | Esperar antes de tocar: sigue `00:00.0`. Un movimiento inválido tampoco lo inicia. Tras el primer movimiento válido avanza en formato `mm:ss.d`. El preview no pausa el reloj.                                                                                                                                 |
| Preview mientras se mantiene presionado | Mantener **Ver imagen**: la imagen completa cubre el tablero. Soltar, cancelar el gesto o perder el foco: desaparece inmediatamente. También funciona manteniendo Espacio o Enter con el botón enfocado.                                                                                                       |
| Victoria                                | Resolver: las fichas se bloquean; después de `tileAnimationMs` aparece la imagen sin separadores mediante fade de `victoryAnimationMs`. El tiempo queda fijo, excluyendo las animaciones. Desde Fase 4 se guarda el resultado y se abre RESULT, con acceso al ranking y **Terminar** para volver a la entrada. |
| Límite de tiempo                        | Para comprobarlo rápido, bajar temporalmente `maxDurationSec`, recargar e iniciar un movimiento. Al superar ese límite se bloquea el tablero y se muestra el resultado de tiempo agotado. La sesión queda `timeout` y no entra al ranking. Restaurar el valor al terminar.                                     |

`invalidMoveAnimationMs`, `victoryAnimationMs` y `swipeThresholdPx` se definen por marca, con valores compatibles por defecto 120 ms, 400 ms y 24 px. Los otros tiempos ya existían en el config. `prefers-reduced-motion` evita el movimiento visual sin alterar el tiempo de juego.

Tests de esta fase: `npm test -- src/features/game/__tests__`. Incluyen UI 3×3/4×4, reloj, gestos, deadline antes del siguiente rAF, victoria, timeout, preview, navegación temporal, recorte de imagen, caché, StrictMode y liberación de recursos. La comprobación física de 60 fps en una tablet Android queda pendiente de disponer del dispositivo; no se instaló Capacitor.

`GameScreen` conserva el contrato `{ status, durationMs, moves }` mediante `onFinish`. Fase 4 conecta ese contrato con los repositorios y las pantallas de datos. Desde Fase 5, Zustand coordina las transiciones; formulario/tablero/imagen continúan locales a su montaje para poder limpiarlos por completo.

## Archivos de Fase 3

- Creados: `src/features/game/image/prepareImage.ts`, `image/usePreparedImage.ts`, `ui/Tile.tsx`, `ui/PuzzleBoard.tsx`, `ui/useSwipe.ts`, `ui/HUD.tsx`, `ui/PreviewButton.tsx`, `useGameTimer.ts`, `CountdownScreen.tsx`, `GameScreen.tsx`; `src/shared/lib/time.ts`.
- Tests nuevos: `src/features/game/__tests__/App.test.tsx`, `GameScreen.test.tsx`, `useGameTimer.test.tsx`, `useSwipe.test.tsx`, `prepareImage.test.tsx` y el helper `testUtils.ts`.
- Marca nueva: `brands/districo/theme.config.json`, `assets/logo.jpg`, `assets/puzzle/hero.webp`, `assets/attract/cover.webp`, las dos fuentes WOFF2 y sus licencias en `assets/fonts/`.
- Modificados: `src/app/App.tsx`, `src/brand/schema.ts`, `src/brand/defaultTexts.ts`, `src/brand/__tests__/schema.test.ts`, `src/styles/index.css`, `vite.config.ts`, `package.json`, `package-lock.json`, `brands/demo/theme.config.json`, `brands/_template/theme.config.json`, `scripts/generate-placeholders.ts`, `scripts/validate-brand.test.ts`, `README.md`, `DECISIONS.md`.
- Evidencia local ignorada en `artifacts/`: `districo-phase3-victory.png`, `districo-phase3-4x4.png` y `districo-phase3-game.png`.

## Aceptación manual de Fase 4

Usar `VITE_BRAND=districo` como arriba y mantener la misma URL y puerto al recargar: IndexedDB se aísla por origen. En DevTools → Application → IndexedDB → `kiosk-puzzle` se pueden inspeccionar `leads`, `sessions`, `settings` y `audit`; refrescar la vista de la tabla después de jugar.

| Criterio                       | Pasos y resultado esperado                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests de repos verdes          | `npm test -- src/data/__tests__/repos.test.ts`: transacción atómica, rollback, reapertura de base, resultados idempotentes, ranking, reset sin borrado, recuperación y auditoría de persistencia.                                                                                                                                                                                                                                   |
| Formulario y guardado previo   | Abrir **Empezar el desafío**. Escribir `a@b`: el error aparece al salir del campo, no mientras se escribe. Nombre/email son obligatorios; el consentimiento requerido bloquea el envío. Probar teléfono local válido con país del config; queda E.164 en `leads`. Al enviar, el botón se deshabilita y hay un lead nuevo y una sesión `started` antes de COUNTDOWN. Un fallo de escritura muestra reintento y conserva el borrador. |
| Flujo con datos reales         | Enviar → COUNTDOWN → GAME; resolver → RESULT → **Ver ranking**. RESULT muestra el tiempo/movimientos guardados y la posición; LEADERBOARD muestra nombre abreviado, empresa si está habilitada, tiempo y movimientos, sin email. En `sessions` queda `completed`. **Terminar** durante GAME guarda `abandoned`; superar el límite guarda `timeout`, excluido del ranking.                                                           |
| Recargar no pierde datos       | Completar una partida y anotar los conteos de tablas. Recargar la misma URL, pulsar **Ver ranking**: conserva el resultado y los registros. Repetir recargando durante GAME: conserva el lead y la sesión, sin restaurar el formulario ni la partida. En el siguiente arranque, una sesión `started` de más de 15 minutos pasa a `abandoned`. El caso se comprueba también sin esperar con el test de recuperación.                 |
| Deduplicación por email        | Jugar dos veces con el mismo email, variando mayúsculas/espacios. Se conservan dos leads y dos sesiones; solo el mejor tiempo ocupa una fila. La identidad normalizada se puede comparar en `leads.emailNormalized`.                                                                                                                                                                                                                |
| Desempate por movimientos      | Con igual tiempo gana la sesión con menos movimientos; si también empatan, gana el menor `finishedAt`. El test de ranking en `repos.test.ts` crea esas igualdades exactas, además de separar evento, día y tamaño de grilla.                                                                                                                                                                                                        |
| Privacidad entre participantes | **Terminar** en RESULT/ranking o cancelar el formulario; iniciar otra participación: inputs vacíos y consentimiento desmarcado. Inspeccionar inputs: `autocomplete="off"`, `autocorrect="off"`, `spellcheck="false"` y nuevos `name` aleatorios. Enter avanza de campo y el último intenta submit; el foco desplaza el campo al centro.                                                                                             |
| Auditoría y reset sin borrar   | En `audit` aparece el resultado de `storage.persist`: concedido, denegado, no disponible o fallo. La API de reset guarda el marcador y auditoría sin borrar leads/sesiones, comprobado en el test de repos. Su control de admin pertenece a Fase 6.                                                                                                                                                                                 |
| Fotos aleatorias locales       | Iniciar varias participaciones: COUNTDOWN/preview/tablero usan Biofresh, Gran Plus carne o Gran Plus salmón, sin selector. La selección puede repetirse. Las cuatro imágenes adjuntas contenían un duplicado exacto: se empaquetaron tres originales de 1024×1024, sin modificarlos.                                                                                                                                                |

Los datos se conservan en el almacenamiento del navegador de ese origen. `storage.persist` solicita protección contra la expulsión automática y registra su respuesta; su denegación no impide capturar si IndexedDB funciona. Exportación y borrado protegido se incorporan en Fase 6; el guardado de backups fuera de IndexedDB espera la integración nativa de Fase 7. La inactividad se incorpora en Fase 5, detallada abajo. El texto de consentimiento sigue siendo el de demostración de cada config.

Pruebas adicionales: `npm test -- src/features/lead-form src/features/leaderboard src/features/game/__tests__/App.test.tsx`. Cubren validación dinámica, teléfonos, atributos de privacidad, doble submit, errores y reintentos, flujo real, ranking sin email y reapertura de los datos.

La revisión de navegador usó datos ficticios en un origen separado, puerto 5177, para conservar los datos de la demo abierta en 5175. Se resolvió una partida con foto, se revisó RESULT/ranking, se recargó y se comprobó una nueva entrada vacía. Evidencia local ignorada: `artifacts/districo-phase4-form.png`, `districo-phase4-game.png`, `districo-phase4-result.png`, `districo-phase4-ranking.png`.

## Archivos de Fase 4

- Creados: `src/data/types.ts`, `db.ts`, `initialize.ts`; `src/data/repos/leadsRepo.ts`, `sessionsRepo.ts`, `leaderboardRepo.ts`, `settingsRepo.ts`, `auditRepo.ts`; `src/shared/lib/normalize.ts`.
- Formulario: `src/features/lead-form/LeadFormScreen.tsx`, `buildLeadSchema.ts`, `normalize.ts`; `fields/InputField.tsx`, `TextField.tsx`, `EmailField.tsx`, `PhoneField.tsx`, `ConsentCheckbox.tsx`.
- Resultados: `src/features/result/ResultScreen.tsx`, `src/features/leaderboard/LeaderboardScreen.tsx`, `formatPlayerName.ts`; selección: `src/features/game/image/selectGameImage.ts`.
- Tests creados: `src/data/__tests__/repos.test.ts`, `src/features/lead-form/__tests__/schema.test.ts`, `LeadFormScreen.test.tsx`, `src/features/leaderboard/__tests__/screens.test.tsx`.
- Fotos agregadas: `brands/districo/assets/puzzle/biofresh.jpg`, `granplus-carne.jpg`, `granplus-salmon.jpg`.
- Modificados sobre Fase 3: `src/app/App.tsx`, `src/features/game/GameScreen.tsx`, `src/features/game/__tests__/App.test.tsx`, `src/shared/lib/time.ts`, `src/brand/schema.ts`, `src/brand/defaultTexts.ts`, `src/styles/index.css`, `brands/districo/theme.config.json`, `package.json`, `package-lock.json`, `README.md`, `DECISIONS.md`.

## Aceptación manual de Fase 5

Iniciar Districo con el comando anterior y usar datos ficticios. El estado del flujo no se persiste en localStorage; al recargar se abre ATTRACT y se conservan los datos de IndexedDB.

| Pantalla                                        | Sin actividad: aviso → reset con el config actual                                                                                                                                                          |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FORM                                            | Aviso a los 50 s, ATTRACT a los 60 s.                                                                                                                                                                      |
| COUNTDOWN                                       | Aviso a los 20 s, ATTRACT a los 30 s si el countdown sigue montado. Normalmente termina a los 3 s; para probar el timeout manualmente, subir temporalmente `game.countdownSec` a 35 y restaurarlo después. |
| GAME, incluido guardado/reintento del resultado | Aviso a los 80 s, ATTRACT a los 90 s.                                                                                                                                                                      |
| RESULT                                          | Aviso a los 5 s, ATTRACT a los 15 s.                                                                                                                                                                       |
| LEADERBOARD                                     | Aviso a los 10 s, ATTRACT a los 20 s.                                                                                                                                                                      |
| ATTRACT / ADMIN                                 | ATTRACT sin timeout ni aviso. ADMIN, incorporado en Fase 6: aviso a los 50 s y reset a los 60 s; los modales PIN vencen a los 20 s.                                                                        |

No mover el puntero durante estas comprobaciones: `pointermove` cuenta como actividad, además de pointerdown, teclado, rueda y touchstart. Los plazos se renuevan al cambiar de pantalla. Con otras marcas se usan sus propios `kiosk.inactivityMs` y `warningMs`.

| Criterio                            | Verificación manual                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aviso y continuación                | Completar parcialmente FORM y esperar el aviso. **Sigo acá** o tocar cualquier parte del overlay renueva el plazo; el aviso desaparece (como máximo en el siguiente tick de 250 ms) y conserva el borrador. Tab queda dentro del aviso; el contenido de atrás está `inert` y no recibe clicks.                                                                                                                                          |
| Reset limpio de cualquier pantalla  | Dejar vencer el plazo en cada pantalla de la tabla. Vuelve a la portada, desaparecen aviso/preview/tablero y se quita el foco del input para cerrar el teclado. Volver a tocar la portada: inputs vacíos, nuevos nombres aleatorios y consentimiento desmarcado. También comprobarlo tras un fallo/reintento de guardado.                                                                                                               |
| Abandono sin perder lead            | Enviar un formulario válido, entrar en GAME y dejar vencer el plazo. En DevTools → Application → IndexedDB → `kiosk-puzzle`, refrescar `sessions`: la sesión pasa de `started` a `abandoned`; el lead permanece en `leads`. En COUNTDOWN sucede lo mismo. Una sesión ya completada conserva su resultado al resetear RESULT/ranking. `audit` registra `flow_reset` con motivo/pantalla.                                                 |
| Background                          | En FORM o GAME, cambiar de pestaña/app durante más del plazo y volver: `visibilitychange` comprueba el deadline inmediatamente, sin conceder un plazo nuevo. El puente nativo `appStateChange` se agrega en Fase 7.                                                                                                                                                                                                                     |
| ATTRACT y medios locales            | Tocar portada, encabezado o CTA abre FORM. **Ver ranking** abre solo el ranking. Para slideshow, agregar dos imágenes locales a `attract.media`: alternan según `slideIntervalMs`. Para video, configurar `mode: "video"` y un MP4 local; debe estar muted/playsInline/loop/autoplay/preload. Un error o rechazo de autoplay cae a las imágenes configuradas, o al logo si no hay imágenes. Al entrar a FORM no queda un video montado. |
| Gestos y errores                    | Click derecho no abre menú; imágenes no se arrastran; selección de texto solo en inputs. En tablet, probar pinch/pull-to-refresh. El test de robustez comprueba también ctrl+wheel, logging global y error de render → mensaje **Un momento…** → ATTRACT a los `errorRecoveryMs` del config (2000 por defecto). Los errores de render/globales quedan en `audit` con detalle truncado; si falla audit, la UI igualmente se recupera.    |
| Transiciones y carreras de guardado | `npm test -- src/flow src/kiosk src/features/attract src/features/game/__tests__/App.test.tsx`. Verifica todas las combinaciones de la tabla, transición inválida en dev/producción, timers/listeners con cleanup, callback actualizado, pantallas con timeout, commit y resultado tardíos que no reviven una visita anterior.                                                                                                          |

El abandono se solicita al resetear pero la limpieza visual ocurre inmediatamente, sin esperar a IndexedDB. Si falla esa escritura se audita y la recuperación de huérfanas sigue disponible en el próximo arranque. No se borra ningún lead ni resultado. El guardado pendiente mantiene el timeout de GAME; no se inventa otra pantalla ni otro tiempo de configuración.

La opción de alternar automáticamente ATTRACT con ranking es opcional en el spec y queda sin activar/implementar; el ranking tiene acceso manual y su timeout. La prueba de 500 ciclos con modo QA pertenece a Fase 8. Los bloqueos nativos de Atrás, orientación, keep-awake y `adjustResize` esperan Fase 7; no se instaló Capacitor.

Evidencia local de navegador: `artifacts/districo-phase5-warning.png` y `districo-phase5-clean-form.png` (ignorados por Git).

## Archivos de Fase 5

- Creados: `src/flow/transitions.ts`, `flowStore.ts`; `src/kiosk/activityTracker.ts`, `useInactivity.ts`, `InactivityWarning.tsx`, `browserKiosk.ts`, `auditError.ts`; `src/app/ScreenRouter.tsx`, `ErrorBoundary.tsx`; `src/features/attract/AttractScreen.tsx`, `AttractMedia.tsx`; `src/shared/ui/BrandHeader.tsx`.
- Tests creados: `src/flow/__tests__/flowStore.test.ts`, `src/kiosk/__tests__/inactivity.test.tsx`, `robustness.test.tsx`, `src/features/attract/__tests__/AttractMedia.test.tsx`.
- Modificados sobre Fase 4: `src/app/App.tsx`, `src/main.tsx`, `src/features/game/__tests__/App.test.tsx`, `src/brand/schema.ts`, `defaultTexts.ts`, `src/styles/index.css`, `index.html`, configs de las tres marcas, `scripts/generate-placeholders.ts`, `package.json`, `package-lock.json`, `README.md`, `DECISIONS.md`.

## Fase 6 — Admin y exportación

En ATTRACT, tocar **5 veces en menos de 3 segundos la esquina superior derecha** (96×96 px, configurable). El logo no abre admin. Aparece el teclado PIN propio. Sin `ADMIN_PIN` en el entorno de dev/build, el PIN inicial es **0000** y el dashboard muestra el aviso para cambiarlo. Un PIN ya guardado en este origen/dispositivo se conserva aunque cambie la variable del próximo build. Para producción, definir `ADMIN_PIN` con exactamente cuatro dígitos antes del primer build y no guardarlo en Git ni en el JSON de marca.

El PIN tiene PBKDF2-SHA256, salt aleatorio de 16 bytes y 100.000 iteraciones; se guarda el hash en `settings`. El hash inicial se calcula al construir y se copia en el primer arranque; el valor sin hash no se incluye en el bundle. Los cambios de PIN usan WebCrypto. El lockout se guarda por marca: tres fallos bloquean 30 s, luego 60 s, 120 s, hasta 15 minutos; validar correctamente reinicia esa escalada. Cerrar/reabrir o recargar no elimina el bloqueo. El modal PIN vence a los 20 s; el panel usa el plazo de admin de Fase 5 (aviso a los 50 s y reset a los 60 s).

Un PIN de cuatro dígitos es una barrera frente a visitantes curiosos, **no frente a un atacante con acceso físico o a DevTools**. IndexedDB, snapshots y el último archivo exportado no están cifrados. Mantener el cifrado de dispositivo Android activado (habitual por defecto en Android 10+). Este panel opera sobre el almacenamiento de este origen/dispositivo, sin enviar leads a un servidor.

| Criterio                          | Verificación manual                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cinco toques + PIN                | En ATTRACT tocar cuatro veces la esquina: no sucede nada visible. El quinto toque abre el PIN. Ingresar el PIN con los botones 0–9: se muestran solo puntos; al cuarto dígito se valida y abre **Administración del evento**. Salir y volver a entrar exige PIN otra vez.                                                                                                                                                                                          |
| Tres fallos y lockout persistente | Ingresar un PIN incorrecto tres veces. Las teclas se deshabilitan y aparece la cuenta de bloqueo. Cerrar, volver a abrir o recargar: sigue bloqueado hasta cumplir el plazo. Tras vencer, otros tres fallos duplican el bloqueo. Los intentos fallidos quedan en auditoría.                                                                                                                                                                                        |
| Cambiar PIN                       | Abrir **Cambiar PIN**, ingresar el actual, el nuevo y repetirlo. Una repetición diferente no cambia nada. Conservar el nuevo PIN; volver a entrar con él y comprobar que desaparece el aviso de PIN por defecto si ya no es 0000. No se usa teclado nativo ni diálogos `alert/confirm/prompt`.                                                                                                                                                                     |
| Métricas y log                    | Contrastar los conteos del evento con IndexedDB: leads totales/hoy; estados; finalización; mejor tiempo del día/promedio; marketing; leads por hora local; última exportación. **Log de auditoría** muestra las últimas 100 entradas. Uso de almacenamiento viene de `storage.estimate()`; batería indica **No disponible** en web y se conectará en Fase 7. Pie con versión/marca/evento.                                                                         |
| CSV en Excel es-UY                | Crear participaciones ficticias con `María Peña`, empresa `A;B`, comillas y teléfono. Exportar CSV y abrirlo en Excel con región es-UY: 14 columnas separadas por `;`, `á/ñ` correctas, booleanos SI/NO y tiempo decimal con coma. La primera fila son los encabezados; no existe una línea `sep=;`. Una fila por lead, incluso emails repetidos, con su mejor sesión propia. Teléfonos `+` y textos que parezcan fórmulas van como texto con apóstrofo protector. |
| XLSX y compartir                  | Si `includeXlsx` está activo, **Exportar Excel** produce XLSX con números reales. SheetJS se carga solo al exportar Excel, desde el bundle local. Tras exportar se muestra nombre/ubicación, se marcan `exportedAt` y auditoría; **Compartir / Guardar en…** usa Web Share si el navegador admite archivos, o vuelve a descargar. Salir/reabrir conserva el último archivo para compartir. Cancelar un share no borra datos.                                       |
| Grilla persistida                 | Elegir 4×4, salir y empezar una partida: aparecen 15 fichas y hueco. Recargar mantiene el override por evento. Volver a 3×3 repite el comportamiento; el ranking se mantiene separado por tamaño. Una grilla sin `shuffleMoves` configurado está deshabilitada en admin.                                                                                                                                                                                           |
| Reset de ranking no destructivo   | Completar una partida, exportar y comprobar los conteos. **Reiniciar ranking de hoy** abre explicación; mantener presionado 2 s. Soltar antes o salir del botón cancela. El ranking queda vacío por su marcador, pero leads/sesiones/exportaciones se conservan.                                                                                                                                                                                                   |
| Borrado protegido                 | Solo con datos descartables en un origen de prueba: exportar todos los leads, pulsar **Borrar todos los datos del evento**, reingresar PIN y mantener 3 s. Sin exportación de los últimos 10 minutos queda deshabilitado. Si entró otro lead o cambió alguna sesión después del export, el repositorio rechaza el borrado y exige volver a exportar. No afecta a otros eventos; conserva PIN, auditoría y backups.                                                 |
| Inactividad y privacidad          | Dejar abierto admin o uno de sus modales hasta vencer su plazo. Se cierra y vuelve a ATTRACT; al reingresar exige PIN. Formularios/PINs y referencias del archivo en UI se desmontan. Un export que todavía no comenzó a guardarse se cancela si la autorización expiró mientras generaba los bytes.                                                                                                                                                               |
| Backups                           | Tras cada 10 leads nuevos y al entrar a admin se conserva snapshot JSON de leads + sesiones del evento. Web: revisar `settings`, claves `backups:<evento>` (últimos 5) y `backupLeadCount:<evento>`. Fallar la copia agrega `backup_failed` y no interrumpe la captura. Las copias de IndexedDB se pierden si se elimina el almacenamiento del sitio: no sustituyen sacar una exportación fuera del dispositivo.                                                   |

Los nombres/rutas del export se generan con el prefijo de marca, evento y fecha en epoch ms. En web se inicia la descarga estándar: el navegador no ofrece confirmación de escritura física, así que conservar y comprobar el archivo descargado antes de borrar. El último archivo queda cacheado en IndexedDB para compartir tras reabrir el panel; el borrado protegido retira esa caché. Los archivos ya descargados y los backups se conservan.

Fase 6 dejó `FilePlatform` listo y probado para Documents → Data, bytes base64 exactos y share nativo. La conexión real con `@capacitor/filesystem`, `@capacitor/share` y `@capacitor/device` está implementada en Fase 7, detallada abajo: Android guarda los backups en `Documents/KioskPuzzle/backups/` y conserva cinco archivos por evento. Los backups web son snapshots de IndexedDB, sin descargas ni permisos automáticos.

Verificación automática específica:

```sh
npm test -- src/features/admin src/data/export src/data/__tests__/adminData.test.ts
```

Se revisó en navegador el acceso de cinco toques, PIN, métricas con registros ficticios, mensajes de generación de CSV/XLSX, auditoría y reset por inactividad, usando el origen aislado 5177. El navegador integrado no entregó un archivo descargado a la automatización; no se afirma apertura manual en Excel de escritorio. Los tests verifican BOM/CRLF/UTF-8, fórmulas y reapertura de CSV/XLSX con SheetJS, incluyendo tildes y columnas. Evidencia local: `artifacts/districo-phase6-admin.png`.

## Archivos de Fase 6

- Admin: `src/features/admin/AdminHotspot.tsx`, `useSecretTap.ts`, `PinPad.tsx`, `PinGate.tsx`, `pin.ts`, `AdminScreen.tsx`, `AdminDashboard.tsx`, `ChangePin.tsx`, `HoldToConfirmButton.tsx`; modal compartido `src/shared/ui/Modal.tsx`.
- Datos/export: `src/data/repos/eventRepo.ts`, `pinRepo.ts`; `src/data/export/csv.ts`, `buildExportRows.ts`, `exportEvent.ts`, `xlsx.ts`, `saveExportFile.ts`; `src/data/backup.ts`, `src/data/files/platform.ts`, `src/env.d.ts`.
- Dependencia: `vendor/xlsx-0.20.3.tgz` de la distribución oficial de SheetJS (instalación local reproducible y sin CDN en runtime).
- Tests nuevos: `src/features/admin/__tests__/pin.test.ts`, `controls.test.tsx`, `Admin.test.tsx`; `src/data/export/__tests__/export.test.ts`, `files.test.ts`, `exportEvent.test.ts`; `src/data/__tests__/adminData.test.ts`.
- Modificados: `src/app/ScreenRouter.tsx`, `src/features/attract/AttractScreen.tsx`, `src/features/game/__tests__/App.test.tsx`, `src/data/initialize.ts`, `repos/leadsRepo.ts`, `repos/auditRepo.ts`, `types.ts`, `src/brand/schema.ts`, `defaultTexts.ts`, las tres configuraciones de marca, `scripts/generate-placeholders.ts`, `vite.config.ts`, `package.json`, `package-lock.json`, `README.md`, `DECISIONS.md`.

## Crear otra marca

1. Copiar `brands/_template` a `brands/<id>`; usar letras minúsculas, números, guiones o guion bajo. Mantener `brand.id` igual al nombre de carpeta.
2. Editar `theme.config.json`: identidad, evento, colores, fuentes locales, textos y rutas. Reemplazar el consentimiento de demostración antes de un uso real.
3. Reemplazar logos y assets locales; puzzles JPG/WebP de al menos 1000 px del lado menor (recomendado 1200 o más), WOFF2 en `assets/fonts`, videos de hasta 50 MiB si se configuran. Conservar las licencias correspondientes.
4. Ejecutar `npm run brand:validate -- <id>`. Los errores detienen el proceso; los contrastes menores a 4.5:1 generan advertencias.
5. Definir `VITE_BRAND=<id>` e iniciar dev o `npm run build`. El resultado web queda en `dist/`.

El config se valida con Zod tanto en los scripts como en el bundle; `t()` mergea defaults españoles e interpola `{variable}`. `applyTheme()` se ejecuta antes del primer render. No editar los componentes para cambiar de cliente.

`npm run assets:generate` regenera **y sobreescribe** las dos marcas placeholder y sus configs desde el arte geométrico propio del script. No usarlo para conservar cambios personalizados sobre demo o template. Las imágenes ya están versionadas; no hace falta regenerarlas para desarrollar.

## Archivos creados

- Raíz: `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `index.html`, `README.md`, `DECISIONS.md`.
- `brands/_template/` y `brands/demo/`: cada una contiene `theme.config.json`, `assets/logo.svg`, `assets/logo-mono.svg`, `assets/puzzle/hero.webp`, `assets/attract/cover.webp`, `assets/icon/icon-1024.png`, `assets/icon/splash-2732.png`, `assets/fonts/space-grotesk-latin-700-normal.woff2`, `assets/fonts/dm-sans-latin-400-normal.woff2` y las dos licencias OFL.
- `scripts/`: `validate-brand.ts`, `validate-brand.test.ts`, `generate-placeholders.ts`.
- `src/`: `main.tsx`, `app/App.tsx`, `styles/index.css`.
- `src/brand/`: `schema.ts`, `brand.ts`, `applyTheme.ts`, `BrandProvider.tsx`, `defaultTexts.ts`, `t.ts`, `__tests__/schema.test.ts`.
- `src/features/game/engine/`: `types.ts`, `board.ts`, `rng.ts`, `shuffle.ts`, `solvability.ts`, `__tests__/board.test.ts`, `__tests__/shuffle.test.ts`.
- Evidencia local ignorada: `artifacts/demo-brand.png`.

## Alcance pendiente

Las ocho fases están implementadas. Las comprobaciones físicas de la tablet elegida siguen requiriendo ese dispositivo: ver los procedimientos de Fase 7 y el checklist de Fase 8. Consultar [DECISIONS.md](DECISIONS.md) para decisiones, evidencia y límites de las pruebas.

## Android — Fase 7

Se conecta el adaptador de Fase 6 a Filesystem, Share y Device. Android guarda exportaciones en `Documents/KioskPuzzle/exports/`, snapshots en `Documents/KioskPuzzle/backups/` y muestra batería real en admin. Si Documents falla al exportar, guarda en Data privada e informa la ubicación real; **Compartir** permite extraer también ese archivo. Los permisos de almacenamiento solo se declaran hasta Android 10; no se pide acceso a todos los archivos. En Android 10 se habilita el almacenamiento heredado; en Android 11+ solo se accede a archivos de la propia app. [Contrato de Filesystem](https://capacitorjs.com/docs/apis/filesystem).

Requisitos adicionales de compilación: JDK 21 (`JAVA_HOME`), Android SDK Platform 36 y Build Tools 35.0.0 (los usa AGP 8.13; 36.0.0 también sirve para inspeccionar APK), licencias del SDK aceptadas. Capacitor 8 usa Gradle 8.14.3, incluido como wrapper; no hace falta instalar Gradle global. Android mínimo: API 24; objetivo operativo del spec: tablet Android 11+. El primer build descarga dependencias de desarrollo; el APK funciona sin conexión. [Requisitos de Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup).

En esta máquina el SDK autorizado quedó en `.android-sdk/`, las cachés en `.gradle-cache/` y las claves en `.android-keys/`, todos ignorados por Git. En otra máquina, instalar SDK con Android Studio o las herramientas oficiales y configurar `ANDROID_HOME`; también se acepta `ANDROID_SDK_ROOT`. `local.properties` se genera localmente, sin versionar rutas personales. El proyecto `android/`, sus fuentes, wrapper y recursos sí se incluyen en el repositorio; no se incluyen builds ni copias de `dist`.

```powershell
# Si usás un SDK externo al proyecto:
$env:ANDROID_HOME = 'C:\ruta\Android\Sdk'
# El PIN inicial sigue admitiendo ADMIN_PIN; no pisa uno ya guardado.
npm ci
npm run brand:build -- demo
npm run brand:build -- districo
```

El comando valida config/assets e íconos, comprueba TypeScript, construye Vite, aplica la marca a Android, genera recursos con `@capacitor/assets`, ejecuta `cap sync android` en producción y `assembleRelease`. Deja el APK en `artifacts/android/<marca>-development-release.apk`. Sin SDK se puede preparar web/Android con `npm run brand:build -- demo --sync-only`; ese modo **no genera APK**. `npm run android:patch -- demo` actualiza únicamente identidad y recursos nativos. No ejecutar builds de dos marcas al mismo tiempo: comparten `dist/` y `android/`.

Cada marca debe tener `assets/icon/icon-1024.png` de 1024×1024 y `splash-2732.png` de 2732×2732. `patch-android.ts` adapta esos nombres al generador, conserva el cuerpo de MainActivity al mover su paquete, actualiza namespace/applicationId, app_name, versión de `package.json`, colores y orientación. Demo y template conservan sus placeholders; Districo usa el logo adjunto con márgenes sobre el fondo de marca. Android 12+ usa además el splash del sistema con el ícono, conforme a la plataforma.

### Firma y actualización

Sin variables de firma se genera una clave local de **desarrollo** para obtener un APK instalable de tipo **release**, con depuración desactivada y sin Internet. El nombre del archivo y el CLI indican esa firma. Conservar `.android-keys/development.jks` para actualizar esa instalación. Para distribución, configurar las cuatro variables `ANDROID_KEYSTORE` (ruta absoluta), `ANDROID_KEY_ALIAS`, `ANDROID_STORE_PASSWORD` y `ANDROID_KEY_PASSWORD` mediante el entorno; nunca subir claves ni contraseñas a Git. El APK propio se llama `<marca>-release.apk`. Una configuración parcial de firma falla. Al publicar una actualización incrementar `package.json.version`; `versionCode = major * 1000000 + minor * 1000 + patch + 1`.

Actualizar con el mismo appId y certificado conserva IndexedDB. Cambiar de marca produce otra app y otro almacenamiento. No desinstalar ni borrar almacenamiento para resolver un conflicto de firmas sin exportar primero los datos.

### Aceptación manual de Fase 7

Usar demo y datos ficticios para la prueba. Copiar el APK a una tablet e instalarlo, o habilitar depuración USB y usar `adb install -r artifacts/android/demo-development-release.apk`. La instalación debe mostrar **Pieza Puzzle**; Districo debe mostrar su nombre/logo y las tres fotos aleatorias anteriores.

| Criterio                            | Pasos y resultado esperado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `brand:build` produce APK           | Ejecutar el comando demo de arriba: termina con `BUILD SUCCESSFUL` y la ruta del APK firmado. Repetir con Districo comprueba identidad independiente. Abrir cada app desde su ícono.                                                                                                                                                                                                                                                                                                                                                                |
| Arranca offline y fullscreen        | Activar modo avión antes de abrir por primera vez. Deben aparecer splash/marca y ATTRACT; completar un formulario y jugar sin red. No quedan barras de estado/navegación persistentes. Tras abrir/cerrar teclado o compartir, vuelve el modo inmersivo. Un swipe de borde puede mostrar barras transitorias del sistema.                                                                                                                                                                                                                            |
| Orientación                         | Girar 90°: conserva landscape según config; girar 180°: admite la posición invertida. Para comprobar portrait, crear una copia de marca con otro appId y `kiosk.orientation=portrait`, generar e instalar su APK. Se conserva `sensor*` aunque se invoque el plugin. Android 16 tiene la excepción de compatibilidad para tablets; los fabricantes pueden aplicar políticas propias.                                                                                                                                                                |
| Pantalla encendida                  | Poner el apagado automático de Android en 30 s y dejar ATTRACT sin tocar durante más de un minuto: sigue encendida. Repetir después de volver desde otra app. La flag nativa permanece incluso si falla el refuerzo JS.                                                                                                                                                                                                                                                                                                                             |
| Atrás deshabilitado para visitantes | Pulsar Atrás en ATTRACT, FORM, COUNTDOWN, GAME, RESULT y LEADERBOARD: no cierra la app ni vuelve al historial. En admin, Atrás cierra primero el modal actual, después sale del panel; volver a entrar requiere PIN. En el acceso PIN, Atrás vuelve a ATTRACT.                                                                                                                                                                                                                                                                                      |
| Volver del background               | En FORM escribir un dato, ir a otra app durante más de `kiosk.inactivityMs.form` y volver: retorna inmediatamente a ATTRACT; el próximo formulario está vacío. Repetir desde GAME: conserva el lead, abandona la sesión y no ofrece el borrador al siguiente visitante. Una ausencia corta no reinicia el cronómetro.                                                                                                                                                                                                                               |
| CSV en Documents                    | Capturar un lead de prueba; entrar a admin (cinco toques en la esquina configurada, PIN inicial 0000 si no se cambió), exportar CSV. El mensaje debe indicar Documents y `KioskPuzzle/exports/<archivo>.csv`; comprobarlo en la app Archivos o por USB/MTP en `Documents/KioskPuzzle/exports/`. Abrirlo y comprobar acentos, columnas y ese lead. También probar XLSX y **Compartir**, cancelando el selector o guardando una copia local. En Android ≤10 conceder almacenamiento al staff; si se deniega debe informarse Data, sin perder el lead. |
| Backups/batería y persistencia      | Entrar a admin dispara un JSON en `Documents/KioskPuzzle/backups/`; tras diez nuevas capturas hay otro y se conservan cinco por evento. Batería debe mostrar un porcentaje. Cerrar/abrir la app conserva leads y ranking.                                                                                                                                                                                                                                                                                                                           |

Para inspeccionar el APK con las herramientas del SDK: `aapt dump permissions <apk>` no debe listar `android.permission.INTERNET`; `apksigner verify --verbose <apk>` debe confirmar firma válida. Revisar `capacitor.config.json` empaquetado: no tiene `server.url` y desactiva `webContentsDebuggingEnabled`.

La prueba nativa en `android/app/src/androidTest/java/uy/kioskpuzzle/tests/KioskActivityTest.java` comprueba permiso Internet ausente, backup/debug desactivados, arranque de Activity, flag keep-awake y orientación sensor. Con una tablet/emulador de prueba conectado, después de `brand:build`, ejecutar desde `android/`: `gradlew.bat :app:connectedReleaseAndroidTest` (POSIX: `./gradlew :app:connectedReleaseAndroidTest`). Usar el mismo `JAVA_HOME`, `ANDROID_HOME` y `GRADLE_USER_HOME` del build; en esta máquina este último es la ruta absoluta de `.gradle-cache/`. Esta prueba requiere dispositivo; compilarla no significa haberla ejecutado.

### Preparar el stand

En Ajustes de Android activar **Fijar aplicaciones** y exigir el PIN/patrón del dispositivo para salir. Abrir el puzzle, entrar a Recientes, tocar el ícono de la app y elegir **Fijar**; los nombres varían según fabricante. Para retirarlo, el staff usa el gesto/botones indicados por Android e ingresa la credencial del dispositivo. El PIN del sistema es distinto al PIN de admin. El modo inmersivo por sí solo no bloquea Inicio/Recientes; no se implementa device owner ni un plugin de lock task. [Guía oficial de fijado](https://support.google.com/android/answer/9455138?hl=es).

Antes del evento, probar export/Compartir con el fijado activo: algunos dispositivos restringen abrir el selector de otra app. El staff puede desfijar temporalmente para extraer archivos o usar USB/MTP, y volver a fijar. Mantener guardada la clave de firma para futuras actualizaciones.

### Archivos de Fase 7

- Creados: `capacitor.config.ts`; `scripts/build-brand.ts`, `scripts/patch-android.ts`, `scripts/run-command.ts`, `scripts/patch-android.test.ts`; `src/kiosk/native.ts`, `src/kiosk/backNavigation.ts`; `src/data/files/nativePlatform.ts`; `src/kiosk/__tests__/native.test.ts`, `src/kiosk/__tests__/nativeLifecycle.test.tsx`, `src/data/__tests__/nativePlatform.test.ts`.
- Creado `android/`: proyectos/settings/variables Gradle, wrapper (`gradlew`, `gradlew.bat`, jar y properties), manifest principal y overlay release, MainActivity por paquete de marca, strings/colors/styles, FileProvider y 74 recursos de ícono/splash generados por marca; test nativo `KioskActivityTest.java`. Se retiraron los tests de ejemplo de Capacitor, cuyo package esperado era incorrecto para cualquier marca.
- Creados: `brands/districo/assets/icon/icon-1024.png` y `splash-2732.png`.
- Modificados: `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.js`, `.gitignore`, `.prettierignore`; `src/main.tsx`, `src/app/App.tsx`, `src/brand/schema.ts`, `src/data/files/platform.ts`, `src/features/admin/AdminDashboard.tsx`, `src/features/admin/__tests__/Admin.test.tsx`; los tres `theme.config.json` y `scripts/generate-placeholders.ts` por `kiosk.splashMs`; `README.md`, `DECISIONS.md`.
- APK y logs de verificación quedan en `artifacts/`, ignorados. No se altera el motor, las tablas ni el flujo de datos anterior; no se implementa Fase 8.

## Pulido — Fase 8

### Crear un cliente nuevo

No hace falta cambiar componentes. Desde la raíz, copiar la plantilla a una carpeta nueva:

```powershell
if (Test-Path 'brands/acme') { throw 'La marca acme ya existe' }
Copy-Item -Recurse -LiteralPath 'brands/_template' -Destination 'brands/acme'
```

Editar `brands/acme/theme.config.json`: `brand.id="acme"`, nombre, `appName`, `androidAppId` único (por ejemplo `uy.kioskpuzzle.acme`), `event.id` y nombre del evento. Reemplazar logos, portada, imágenes de puzzle, fuentes locales y PNG de ícono/splash. Las fotos necesitan al menos 1000 px del lado menor; los PNG nativos, 1024×1024 y 2732×2732. Actualizar las rutas relativas, paleta y textos, incluido el consentimiento/versionado del cliente. Conservar el PIN fuera del JSON.

```powershell
npm run brand:validate -- acme
$env:VITE_BRAND = 'acme'
npm run dev
# Para web de producción:
npm run build
# Para APK, con el SDK/firma descriptos en Fase 7:
npm run brand:build -- acme
```

El validador informa contraste inferior a 4,5:1 sin bloquear, como pide el spec; revisar y corregir la paleta antes del evento. El build produce `.vite/manifest.json` y verifica automáticamente JS/CSS iniciales por debajo de 500 KiB gzip, excluyendo fuentes/imágenes y chunks dinámicos. También rechaza código de herramientas QA en **cualquier** chunk JS de producción. SheetJS mantiene su chunk dinámico. Para revisar un `dist` ya generado: `npm run web:check`.

### QA de desarrollo y 500 recorridos

Iniciar Vite con la marca deseada y abrir `http://127.0.0.1:<puerto>/?qa=1`. Aparece **QA — datos de prueba aislados**, y en GAME el botón **Resolver (QA)**. Sin el query exacto, y en cualquier build/preview/APK de producción aunque tenga `?qa=1`, no hay herramientas QA.

QA usa **otra base**, `kiosk-puzzle-qa`: no lee ni escribe los leads/PIN/ranking normales. El adaptador de archivos nativo tampoco se instala en QA, para no mezclar backups ficticios con Documents del evento. No se borra automáticamente la base QA: los registros de cada corrida quedan disponibles para inspección. Los datos ficticios usan el dominio reservado `example.invalid`; nunca se envían a ningún servidor.

En QA se multiplican por 0,1 los plazos de inactividad/aviso, recuperación de errores y entrada de PIN, límite del juego, countdown y duraciones de animación. Acortar también la presentación hace viable recorrer 500 partidas. Los holds de borrado/reset, intentos y lockout de PIN conservan sus protecciones normales.

Pulsar **Probar 500 ciclos** y mantener esta pestaña visible hasta terminar (varios minutos). Se ejecuta la UI real **ATTRACT → FORM → COUNTDOWN → GAME → RESULT → LEADERBOARD → ATTRACT**, con IndexedDB real: comprueba formulario vacío y checks desmarcados, guarda el lead antes del juego, resuelve desde la herramienta QA pasando por la finalización normal, comprueba resultado persistido y ranking sin emails, y verifica limpieza de IDs al resetear. No fuerza transiciones ni reemplaza las escrituras por mocks. La automatización renueva actividad mientras espera trabajo asíncrono; para comprobar los timeouts usar el QA manual sin el soak activo.

No editar fuentes/config ni reiniciar Vite durante la corrida: HMR puede remontar el panel y cancelar o invalidar el ensayo.

Solo se permite una corrida simultánea. **Detener prueba** o desmontar el panel cancela el trabajo, restaura la instrumentación y vuelve a ATTRACT; se conservan las capturas ya guardadas. Un error muestra etapa y diagnóstico parcial. Al terminar debe indicar **500/500 — Prueba completada**. Expandir **Diagnóstico de recursos y memoria**: toma muestras cada 25 vueltas en ATTRACT de objectURLs, listeners explícitos de window/document, timeouts, intervalos, rAF y cantidad de nodos. El muestreo final no debe superar al primero. No retiene nodos para instrumentarlos.

`heapBytes` muestra memoria JS si Chromium expone `performance.memory`; en otros motores es `null`. No fuerza GC ni mide memoria gráfica/nativa: estabilidad de esos recursos es evidencia contra sus fugas, no una garantía sobre toda la memoria de una tablet. Una parada/fallo preserva el informe parcial para diagnóstico. El aumento de registros/almacenamiento de IndexedDB es esperado y no se interpreta como una fuga.

Evidencia ejecutada: **500/500 en navegador**, 43 nodos en las 20 muestras y sin crecimiento de los recursos contabilizados. El heap osciló entre 33,8 y 87,0 MB; terminó en 86,4 MB frente a 41,1 MB iniciales, por lo que no se afirma que el heap total haya quedado estable. Informe y captura locales en `artifacts/districo-phase8-soak.{json,png}`. La suite completa pasó **193 tests en 34 archivos**. Los builds de demo y Districo pasaron el gate de producción; inicial JS/CSS: aproximadamente 186,7/186,8 KiB gzip.

`npm test` incluye otro ensayo de **500 recorridos de App**, con repos reales sobre fake-indexeddb y rasterización simulada por falta de canvas en JSDOM. Usa tiempos de presentación aún menores para el runner; conserva comprobaciones de persistencia, base normal intacta, formulario limpio y objectURLs liberadas. Puede tardar varios minutos. Para correrlo solo: `npm test -- src/qa/__tests__/soak.test.tsx`.

### Contraste, controles y sonidos

Se revisan 12 combinaciones a 4,5:1: primary/onPrimary, secondary/onSecondary y texto, texto secundario, primary, danger y success contra background/surface. Las tres marcas incluidas pasan; no se cambió su paleta. Los botones tienen al menos 48×48 px, también en PIN y QA. El tablero tiene lado mínimo `48 × gridSize`, para que 4×4 no reduzca sus fichas por debajo de ese objetivo en una ventana baja. Los checkboxes conservan su marca visual compacta y el label completo como área táctil de al menos 48 px de alto. Se mantienen foco visible, etiquetas, navegación por Tab/Enter, preview con teclado y `prefers-reduced-motion` existentes. La revisión de tokens no reemplaza revisar texto sobre imágenes personalizadas.

Las tres marcas incluyen `assets/sounds/move.wav` y `win.wav`, sintetizados localmente sin muestras de terceros. Configuración:

```json
"sounds": {
  "enabled": false,
  "move": "assets/sounds/move.wav",
  "win": "assets/sounds/win.wav"
}
```

Es un campo de `game`. Omitir `game.sounds` también significa apagado. Para activarlo cambiar `enabled` a `true` y reconstruir; se requieren ambos WAV locales. No hay toggle nuevo para visitantes. Un gesto válido reproduce move una vez; la jugada ganadora reproduce win. Una jugada inválida y la entrada/countdown no emiten sonido. Los reproductores solo se crean tras interacción si están habilitados, se reutilizan y se liberan al salir; el rechazo de autoplay o la falta de audio no bloquean el juego. `npm run assets:sounds -- acme` genera esos dos sonidos para una marca existente; no modifica su JSON. `assets:generate` también regenera los WAV de los placeholders y sigue sobreescribiendo solo demo/template.

### Checklist del dispositivo y aceptación manual

1. Android 11+ actualizado; desactivar actualizaciones automáticas de apps durante el evento.
2. Activar No Molestar para evitar notificaciones sobre el juego.
3. Excluir la app de optimización de batería y dejar la tablet enchufada.
4. Usar brillo fijo alto; desactivar brillo adaptativo y protector de pantalla.
5. En Gboard/teclado, desactivar sugerencias personalizadas y aprendizaje; probar que no ofrece emails previos.
6. Fijar la app y exigir la credencial del dispositivo para desfijar, según Fase 7.
7. Comprobar fecha, hora y zona del dispositivo: afectan ranking diario y exports.
8. Al cierre de cada día, exportar CSV desde admin y copiarlo fuera de la tablet; comprobar el archivo antes de borrar datos.

| Criterio de Fase 8             | Verificación manual                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documentación de cliente/build | Copiar `_template` siguiendo esta sección, asignar otro id/appId/evento, reemplazar assets, validar y generar web/APK. Debe verse la nueva marca sin editar componentes.                                                                                                                                                                                    |
| QA exclusivo de dev            | Abrir dev con `?qa=1`: panel y resolver presentes; quitar query y recargar: ausentes. Construir, abrir preview con el mismo query: siguen ausentes; `web:check` confirma el artefacto.                                                                                                                                                                      |
| Soak y limpieza                | Pulsar **Probar 500 ciclos**, esperar 500/500 y abrir diagnóstico; repetir/Detener para comprobar exclusión y cancelación. Inspeccionar registros ficticios en `kiosk-puzzle-qa` y confirmar que `kiosk-puzzle` conserva sus datos.                                                                                                                         |
| Inactividad reducida           | Sin soak activo, abrir FORM en QA y no tocar: aviso y ATTRACT en una décima parte del plazo del config. Repetir GAME, RESULT, ranking y admin; el formulario siguiente queda vacío.                                                                                                                                                                         |
| Contraste/táctil               | Validar las tres marcas; en la tablet probar todos los botones, teclado PIN, fichas 3×3/4×4, preview y labels de consentimientos. En devtools medir bounding boxes de botones ≥48×48 y el label completo de cada checkbox ≥48 px de alto. Probar Tab/Enter y foco; habilitar movimiento reducido y comprobar que desaparecen shake/transiciones.            |
| Sonidos opcionales             | Por defecto jugar: no debe sonar. En una copia de marca habilitar `game.sounds`, validar y recargar: gesto válido y victoria suenan una vez; inválido no suena. Salir durante reproducción no deja audio ni errores. Probar sin sonido del dispositivo/autoplay: el juego continúa.                                                                         |
| Dispositivo real               | Con el APK comprobar giro 90°/180°, teclado sin tapar campos/submit, aviso y reset en cada pantalla, Atrás, reinicio de tablet a mitad de una partida y conservación del lead. Exportar y abrir CSV en Excel con tildes/ñ y columnas correctas. Arrancar en modo avión y verificar release sin INTERNET. FPS y memoria nativa requieren la tablet objetivo. |

### Archivos de Fase 8

- Creados: `src/qa/config.ts`, `QaPanel.tsx`, `soak.ts`, `resources.ts` y sus tres archivos de tests; `src/brand/contrast.ts`, `src/brand/__tests__/polish.test.ts`; `src/features/game/useGameSounds.ts`, `src/features/game/__tests__/sounds.test.tsx`; `scripts/generate-sounds.ts`, `scripts/check-web-build.ts` y su test; los seis WAV en `brands/{_template,demo,districo}/assets/sounds/`.
- Modificados: `src/brand/{brand,schema,defaultTexts}.ts`, `src/data/db.ts`, `src/main.tsx`, `src/app/App.tsx`, `src/features/game/{GameScreen,CountdownScreen}.tsx`, `src/features/game/ui/PuzzleBoard.tsx`, `src/features/lead-form/fields/InputField.tsx`, `src/styles/index.css`; `scripts/{validate-brand,validate-brand.test,generate-placeholders,build-brand}.ts`, `vite.config.ts`, `package.json`; los tres configs de marca, `README.md` y `DECISIONS.md`. Los recursos Android pueden regenerarse por marca al verificar APK.
- No se incorporan nuevas dependencias, sincronización, CRM, MDM, idiomas ni otras funciones de la sección 13.

## Probar la portada del stand

```powershell
$env:VITE_BRAND = 'districo'
npm run dev
```

- Portada: observar durante al menos 10 segundos el ciclo de fichas flotantes → encaje → destello → dispersión. Solo usa fotos y medios locales. `attract.animationCycleMs` cambia el ciclo; `attract.animation="none"` o la preferencia del sistema de reducir movimiento muestran el puzzle armado estático. Cambiar de pestaña pausa el loop; salir de la portada lo desmonta.
- **Empezar juego**: abre un formulario limpio. El registro confirmado de GameHub sigue siendo obligatorio antes de instrucciones y countdown. Cancelar o cambiar de participante vuelve a la portada.
- **Ver ranking**: abre el ranking del día sin completar el formulario. **Volver** regresa a la portada. Dejar el ranking sin interacción durante 20 s también regresa, con aviso en los últimos 10 s.
- Inactividad: escribir un borrador en el formulario y dejarlo quieto durante 60 s; al volver a empezar, nombre, celular y consentimiento deben estar vacíos. La portada puede quedarse indefinidamente sin avisos ni timeout. Los plazos se configuran en `kiosk.inactivityMs` y `kiosk.warningMs`.
- Admin: tocar cinco veces la esquina superior derecha dentro de 3 s para abrir el PIN. La esquina y la cuenta salen de `kiosk.adminHotspot`, `adminTapCount` y `adminTapWindowMs`. En una instalación sin PIN cambiado el valor inicial sigue siendo `0000`; el acceso conserva su timeout y bloqueo existentes.

Para un recorrido local rápido y sin envíos a la central, usar desarrollo con `?qa=1`: la base es aislada y el modo de prueba se indica en pantalla. FORM vuelve a la portada tras 6 s y LEADERBOARD tras 2 s. Los tiempos normales y la animación configurada no se modifican en producción. Más detalles en [DECISIONS.md](DECISIONS.md), sección «Portada de stand y retorno del kiosco».
