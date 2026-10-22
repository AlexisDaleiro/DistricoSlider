# Kiosk Puzzle — Fases 1 a 4

Scaffolding white-label offline, motor puro y UI jugable de puzzle deslizable 3×3 / 4×4, según [el spec recibido](brief%20base/SPEC_KIOSK_PUZZLE.md). Incluye formulario configurable, persistencia IndexedDB y flujo FORM → COUNTDOWN → GAME → RESULT → LEADERBOARD. El lead y su sesión se guardan juntos antes del countdown; el resultado se guarda antes de mostrar RESULT.

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

La suite actual tiene **96 tests en 13 archivos**, incluidas las pruebas de las fases anteriores y 10.000 mezclas por tamaño (20.000 en total). El motor no depende de React ni del DOM. Los repositorios se prueban con `fake-indexeddb` y bases aisladas; las pruebas no borran la base del navegador. El límite de 30 segundos del property test es solo del runner, no un timeout de producto.

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

`GameScreen` conserva el contrato `{ status, durationMs, moves }` mediante `onFinish`. Fase 4 conecta ese contrato con los repositorios y las pantallas de datos. La coordinación sigue usando estado local de React; la máquina de flujo de kiosco corresponde a Fase 5.

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

Los datos se conservan en el almacenamiento del navegador de ese origen. `storage.persist` solicita protección contra la expulsión automática y registra su respuesta; su denegación no impide capturar si IndexedDB funciona. Los controles de exportación, borrado protegido, backups nativos e inactividad no forman parte de esta fase. El texto de consentimiento sigue siendo el de demostración de cada config.

Pruebas adicionales: `npm test -- src/features/lead-form src/features/leaderboard src/features/game/__tests__/App.test.tsx`. Cubren validación dinámica, teléfonos, atributos de privacidad, doble submit, errores y reintentos, flujo real, ranking sin email y reapertura de los datos.

La revisión de navegador usó datos ficticios en un origen separado, puerto 5177, para conservar los datos de la demo abierta en 5175. Se resolvió una partida con foto, se revisó RESULT/ranking, se recargó y se comprobó una nueva entrada vacía. Evidencia local ignorada: `artifacts/districo-phase4-form.png`, `districo-phase4-game.png`, `districo-phase4-result.png`, `districo-phase4-ranking.png`.

## Archivos de Fase 4

- Creados: `src/data/types.ts`, `db.ts`, `initialize.ts`; `src/data/repos/leadsRepo.ts`, `sessionsRepo.ts`, `leaderboardRepo.ts`, `settingsRepo.ts`, `auditRepo.ts`; `src/shared/lib/normalize.ts`.
- Formulario: `src/features/lead-form/LeadFormScreen.tsx`, `buildLeadSchema.ts`, `normalize.ts`; `fields/InputField.tsx`, `TextField.tsx`, `EmailField.tsx`, `PhoneField.tsx`, `ConsentCheckbox.tsx`.
- Resultados: `src/features/result/ResultScreen.tsx`, `src/features/leaderboard/LeaderboardScreen.tsx`, `formatPlayerName.ts`; selección: `src/features/game/image/selectGameImage.ts`.
- Tests creados: `src/data/__tests__/repos.test.ts`, `src/features/lead-form/__tests__/schema.test.ts`, `LeadFormScreen.test.tsx`, `src/features/leaderboard/__tests__/screens.test.tsx`.
- Fotos agregadas: `brands/districo/assets/puzzle/biofresh.jpg`, `granplus-carne.jpg`, `granplus-salmon.jpg`.
- Modificados sobre Fase 3: `src/app/App.tsx`, `src/features/game/GameScreen.tsx`, `src/features/game/__tests__/App.test.tsx`, `src/shared/lib/time.ts`, `src/brand/schema.ts`, `src/brand/defaultTexts.ts`, `src/styles/index.css`, `brands/districo/theme.config.json`, `package.json`, `package-lock.json`, `README.md`, `DECISIONS.md`.

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

Las fases 5–8 siguen pendientes. El regreso automático por inactividad, máquina de estados de kiosco, admin/exportación, Capacitor, APK, `brand:build`, `patch-android.ts` y preparación operativa del dispositivo se implementarán en su fase. Consultar [DECISIONS.md](DECISIONS.md) para las correcciones de referencia y las decisiones de compatibilidad.
