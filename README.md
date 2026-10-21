# Kiosk Puzzle — Fases 1 y 2

Scaffolding white-label offline y motor puro de puzzle deslizable 3×3 / 4×4, según [el spec recibido](brief%20base/SPEC_KIOSK_PUZZLE.md). La pantalla actual es una muestra estática de marca. La UI jugable corresponde a Fase 3 y todavía no está implementada.

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

La suite actual tiene **44 tests**, todos en entorno Node; el motor no depende de React ni del DOM. El límite de 30 segundos del property test es solo del runner, no un timeout de producto.

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

Las fases 3–8 siguen pendientes. No hay captura de datos ni partidas jugables. Capacitor, APK, `brand:build`, `patch-android.ts` y preparación operativa del dispositivo se implementarán en su fase. Consultar [DECISIONS.md](DECISIONS.md) para las correcciones de referencia y las decisiones de compatibilidad.
