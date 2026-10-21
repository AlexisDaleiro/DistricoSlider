# SPEC — Kiosk Puzzle (activación B2B offline para tablets Android)

> **Para Codex:** este documento es la especificación completa del producto. Leelo entero antes de escribir código. Implementá por **fases** (sección 12), respetando las **reglas no negociables** (sección 0). Cuando algo no esté definido acá, elegí la opción más simple, robusta y offline, y dejalo documentado en `DECISIONS.md`.

---

## 0. Reglas no negociables

1. **100% offline.** Cero requests de red en runtime. Nada de CDNs, Google Fonts, analytics, Sentry, etc. Todas las fuentes, imágenes, videos y librerías se empaquetan en el bundle. Si una librería hace fetch a red, no se usa.
2. **TypeScript `strict: true`**, sin `any` implícito. ESLint + Prettier.
3. **White-label total:** ningún color, texto visible, logo, imagen o tiempo de timeout puede estar hardcodeado en componentes. Todo sale de `theme.config.json` de la marca activa (sección 2).
4. **Nunca perder un lead.** El lead se persiste en IndexedDB **en el momento en que se envía el formulario**, antes de empezar el juego. Ninguna acción de usuario normal borra datos; "reiniciar ranking" **no borra** registros (ver 5.4).
5. **Nada de `alert()`, `confirm()`, `prompt()`** ni diálogos nativos del navegador: todos los modales son componentes propios, controlables por el timeout de inactividad.
6. **Privacidad en kiosco:** ningún dato de un visitante puede quedar visible o sugerido al siguiente (sin autocompletado, formulario limpio al resetear, ranking sin emails).
7. **El motor del juego es puro** (sin React, sin DOM) y tiene tests unitarios. La UI solo lo consume.
8. Rendimiento objetivo: animaciones a 60 fps en una tablet Android de gama media-baja (ej. 3 GB RAM, Android 11+). Solo animar `transform` y `opacity`.

---

## 1. Visión general

### 1.1 Producto
App Android (APK, Capacitor) que corre en modo kiosco dentro de un stand de exposición. Flujo del visitante:

```
ATTRACT (loop de branding)
   │ tap en cualquier lugar
   ▼
FORM (captura de lead + consentimiento)
   │ submit válido → se guarda lead + se crea GameSession(status=started)
   ▼
COUNTDOWN (3, 2, 1 — muestra la imagen completa como pista)
   ▼
GAME (puzzle deslizable, cronómetro, contador de movimientos)
   │ resuelto → GameSession(status=completed, durationMs, moves)
   ▼
RESULT (tiempo, movimientos, posición en ranking)
   ▼
LEADERBOARD (top N del día)
   │ timeout o botón "Terminar"
   ▼
ATTRACT
```

Paralelo: **ADMIN** (oculto, con PIN) accesible desde ATTRACT.

Cualquier pantalla ≠ ATTRACT vuelve a ATTRACT por inactividad (sección 8). Si el visitante abandona en GAME, la sesión queda `status=abandoned` (el lead ya está guardado).

### 1.2 Stack (decidido)
| Capa | Elección | Motivo |
|---|---|---|
| Build | Vite (última estable) | rápido, output estático |
| UI | **React 18/19 + TypeScript** | ecosistema, previsibilidad para generación de código |
| Estilos | **Tailwind CSS v4** con tokens CSS variables | theming en runtime vía `:root` |
| Estado de flujo | **Zustand** con tabla de transiciones explícita | simple, testeable |
| Validación | **Zod** (config de marca + formulario) | un solo lenguaje de esquemas |
| Persistencia | **Dexie.js 4** sobre IndexedDB | índices compuestos, transacciones |
| Excel opcional | **SheetJS (xlsx)** empaquetado localmente | export .xlsx sin red |
| Nativo | **Capacitor** (última estable; verificar versión al iniciar) | APK, plugins |
| Tests | **Vitest** (+ fake-indexeddb para la capa de datos) | |

Animaciones del puzzle: **CSS `transform: translate3d` + `transition`**, NO Framer Motion (ver 3.4).

---

## 2. Arquitectura del proyecto

### 2.1 Árbol de directorios

```
kiosk-puzzle/
├─ brands/                         # Una carpeta por cliente. Única cosa que cambia entre clientes.
│  ├─ _template/
│  │  ├─ theme.config.json
│  │  └─ assets/
│  │     ├─ logo.svg
│  │     ├─ logo-mono.svg          # versión para fondos de color
│  │     ├─ puzzle/                # imágenes del puzzle (jpg/webp, >= 1200px de lado)
│  │     ├─ attract/               # video mp4 (H.264) o imágenes del loop
│  │     ├─ fonts/                 # woff2 locales
│  │     └─ icon/                  # icon-1024.png, splash-2732.png (para generar recursos Android)
│  └─ demo/                        # marca de demostración funcional (para vender el producto)
│
├─ scripts/
│  ├─ validate-brand.ts            # valida config con Zod + existencia/tamaño de assets
│  ├─ build-brand.ts               # VITE_BRAND=<id> → valida, build web, patch android, cap sync
│  └─ patch-android.ts             # appId, appName, orientación, íconos/splash por marca
│
├─ src/
│  ├─ main.tsx
│  ├─ app/
│  │  ├─ App.tsx                   # renderiza la pantalla según el flow store
│  │  ├─ ScreenRouter.tsx
│  │  └─ ErrorBoundary.tsx         # ante error: log a audit + volver a ATTRACT
│  │
│  ├─ brand/
│  │  ├─ schema.ts                 # Zod schema de theme.config.json (fuente de verdad)
│  │  ├─ brand.ts                  # import estático de @brand/theme.config.json + assets
│  │  ├─ applyTheme.ts             # escribe CSS vars en :root, registra @font-face
│  │  ├─ BrandProvider.tsx         # contexto con config tipada
│  │  └─ t.ts                      # helper de textos: t('form.submit')
│  │
│  ├─ flow/
│  │  ├─ flowStore.ts              # Zustand: screen actual, leadUuid, sessionUuid, transiciones
│  │  └─ transitions.ts            # tabla de transiciones permitidas (testeada)
│  │
│  ├─ features/
│  │  ├─ attract/                  # AttractScreen, AttractMedia (video/slideshow)
│  │  ├─ lead-form/
│  │  │  ├─ LeadFormScreen.tsx
│  │  │  ├─ buildLeadSchema.ts     # Zod dinámico según config.form.fields
│  │  │  ├─ normalize.ts           # trim, lowercase email, phone E.164
│  │  │  └─ fields/                # TextField, EmailField, PhoneField, ConsentCheckbox
│  │  ├─ game/
│  │  │  ├─ engine/                # PURO, sin React/DOM
│  │  │  │  ├─ types.ts
│  │  │  │  ├─ board.ts            # createSolved, neighbors, move, slideLine, isSolved
│  │  │  │  ├─ shuffle.ts          # mezcla por movimientos inversos válidos
│  │  │  │  ├─ solvability.ts      # isSolvable por inversiones (validación/tests)
│  │  │  │  ├─ rng.ts              # mulberry32 seedeable
│  │  │  │  └─ __tests__/
│  │  │  ├─ image/prepareImage.ts  # recorte cuadrado + resize con canvas → objectURL
│  │  │  ├─ ui/
│  │  │  │  ├─ PuzzleBoard.tsx
│  │  │  │  ├─ Tile.tsx
│  │  │  │  ├─ useSwipe.ts
│  │  │  │  └─ HUD.tsx             # cronómetro + movimientos
│  │  │  ├─ useGameTimer.ts
│  │  │  ├─ CountdownScreen.tsx
│  │  │  └─ GameScreen.tsx
│  │  ├─ result/ResultScreen.tsx
│  │  ├─ leaderboard/
│  │  │  ├─ LeaderboardScreen.tsx
│  │  │  └─ formatPlayerName.ts    # enmascarado según config
│  │  └─ admin/
│  │     ├─ AdminHotspot.tsx       # zona invisible + useSecretTap
│  │     ├─ useSecretTap.ts
│  │     ├─ PinPad.tsx             # teclado numérico propio (no el del sistema)
│  │     ├─ pin.ts                 # hash PBKDF2, verificación, lockout
│  │     ├─ AdminDashboard.tsx     # métricas, export, reset ranking, cambiar PIN
│  │     └─ HoldToConfirmButton.tsx
│  │
│  ├─ kiosk/
│  │  ├─ activityTracker.ts        # listener global único (singleton)
│  │  ├─ useInactivity.ts
│  │  ├─ InactivityWarning.tsx     # "¿Seguís ahí?" con cuenta regresiva
│  │  └─ native.ts                 # orientación, keep-awake, backButton, appState
│  │
│  ├─ data/
│  │  ├─ db.ts                     # Dexie schema + migraciones
│  │  ├─ types.ts
│  │  ├─ repos/
│  │  │  ├─ leadsRepo.ts
│  │  │  ├─ sessionsRepo.ts
│  │  │  ├─ leaderboardRepo.ts
│  │  │  ├─ settingsRepo.ts
│  │  │  └─ auditRepo.ts
│  │  ├─ export/
│  │  │  ├─ csv.ts                 # toCsv puro (testeado)
│  │  │  ├─ xlsx.ts                # opcional, SheetJS
│  │  │  ├─ buildExportRows.ts     # join leads + mejor sesión
│  │  │  └─ saveExportFile.ts      # Filesystem + Share (nativo) / Blob (web dev)
│  │  └─ backup.ts                 # snapshot JSON automático a Filesystem
│  │
│  ├─ shared/
│  │  ├─ ui/                       # Button, Modal, Screen, Logo, Spinner
│  │  └─ lib/                      # time.ts (dayKey, formatDuration), uuid.ts, sleep.ts
│  └─ styles/index.css             # @import "tailwindcss"; @theme con CSS vars
│
├─ android/                        # generado por Capacitor, SÍ versionado (MainActivity, manifest)
├─ capacitor.config.ts
├─ vite.config.ts                  # alias @brand → brands/${VITE_BRAND}
├─ DECISIONS.md
└─ README.md                       # cómo crear un cliente nuevo y buildear su APK
```

### 2.2 Principios de capas
- `features/*` depende de `data/repos`, `brand`, `flow`, `shared`. Nunca de Dexie directamente.
- `game/engine` no depende de nada.
- `kiosk/native.ts` es el **único** lugar que importa plugins de Capacitor relacionados a kiosco; todo envuelto en `if (Capacitor.isNativePlatform())` para que la app corra en `npm run dev` en un navegador de escritorio.

### 2.3 Estrategia white-label: build-time por cliente
Cada cliente genera **su propio APK** (`appId` distinto, ícono, nombre). Se elige la marca con `VITE_BRAND`:

```ts
// vite.config.ts (extracto)
const brand = process.env.VITE_BRAND ?? 'demo';
export default defineConfig({
  resolve: { alias: { '@brand': path.resolve(__dirname, `brands/${brand}`) } },
  build: { assetsInlineLimit: 0, target: 'es2020' },
});
```

```ts
// src/brand/brand.ts
import raw from '@brand/theme.config.json';
import { brandSchema, type BrandConfig } from './schema';

const assetUrls = import.meta.glob('@brand/assets/**/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const brand: BrandConfig = brandSchema.parse(raw);
/** Resuelve una ruta relativa del config ("assets/logo.svg") a la URL final del bundle. */
export function asset(relPath: string): string {
  const key = Object.keys(assetUrls).find(k => k.endsWith('/' + relPath));
  if (!key) throw new Error(`Asset no encontrado en la marca: ${relPath}`);
  return assetUrls[key];
}
```

`npm run brand:build -- acme` → `scripts/build-brand.ts`: valida (falla rápido con mensajes claros), `vite build`, aplica `patch-android.ts`, `npx cap sync android`, y opcionalmente `./gradlew assembleRelease`.

---

## 3. Configuración de marca — `theme.config.json`

### 3.1 Ejemplo completo

```json
{
  "schemaVersion": 1,
  "brand": {
    "id": "acme",
    "name": "ACME Corp",
    "appName": "ACME Puzzle",
    "androidAppId": "uy.kioskpuzzle.acme",
    "logo": "assets/logo.svg",
    "logoOnPrimary": "assets/logo-mono.svg"
  },
  "event": {
    "id": "expo-alimentaria-2026",
    "name": "Expo Alimentaria 2026",
    "locale": "es-UY"
  },
  "theme": {
    "colors": {
      "primary": "#E30613",
      "onPrimary": "#FFFFFF",
      "secondary": "#1D1D1B",
      "onSecondary": "#FFFFFF",
      "background": "#0F0F10",
      "surface": "#1C1C1F",
      "text": "#FFFFFF",
      "textMuted": "#A1A1AA",
      "success": "#22C55E",
      "danger": "#EF4444",
      "tileGap": "#0F0F10"
    },
    "fonts": {
      "heading": { "family": "Montserrat", "file": "assets/fonts/Montserrat-ExtraBold.woff2", "weight": 800 },
      "body": { "family": "Inter", "file": "assets/fonts/Inter-Regular.woff2", "weight": 400 }
    },
    "radius": "16px",
    "backgroundImage": null
  },
  "attract": {
    "mode": "video",
    "media": ["assets/attract/loop.mp4"],
    "slideIntervalMs": 6000,
    "headline": "¿Podés armar nuestra marca en menos de 30 segundos?",
    "cta": "Tocá para jugar"
  },
  "form": {
    "title": "Dejanos tus datos para participar",
    "fields": [
      { "id": "name", "type": "text", "label": "Nombre y apellido", "required": true, "minLength": 3, "maxLength": 80 },
      { "id": "email", "type": "email", "label": "Email", "required": true },
      { "id": "company", "type": "text", "label": "Empresa", "required": false, "maxLength": 80 },
      { "id": "phone", "type": "tel", "label": "Teléfono", "required": false, "defaultCountry": "UY" }
    ],
    "consent": {
      "required": true,
      "version": "2026-10-01",
      "text": "Acepto que ACME Corp trate mis datos para contactarme con fines comerciales, conforme a la Ley N° 18.331."
    },
    "marketingOptIn": { "enabled": true, "text": "Quiero recibir novedades y promociones." },
    "submit": "¡Jugar!"
  },
  "game": {
    "gridSize": 3,
    "images": [
      { "src": "assets/puzzle/hero.jpg", "focalPoint": { "x": 0.5, "y": 0.5 } }
    ],
    "imageSelection": "random",
    "shuffleMoves": { "3": 60, "4": 160 },
    "showTileNumbers": false,
    "showPreviewButton": true,
    "countdownSec": 3,
    "maxDurationSec": 300,
    "tileAnimationMs": 130
  },
  "leaderboard": {
    "size": 10,
    "nameFormat": "firstNameLastInitial",
    "showCompany": true,
    "repeatPlayers": "bestScoreOnly"
  },
  "kiosk": {
    "orientation": "landscape",
    "inactivityMs": {
      "form": 60000,
      "countdown": 30000,
      "game": 90000,
      "result": 15000,
      "leaderboard": 20000,
      "admin": 60000
    },
    "warningMs": 10000,
    "adminHotspot": "top-right",
    "adminTapCount": 5,
    "adminTapWindowMs": 3000
  },
  "export": {
    "filePrefix": "leads_acme",
    "csvSeparator": ";",
    "includeXlsx": true
  },
  "texts": {
    "game.moves": "Movimientos",
    "game.time": "Tiempo",
    "game.preview": "Ver imagen",
    "result.title": "¡Lo lograste!",
    "result.rank": "Quedaste en el puesto {rank}",
    "result.outOfTop": "¡Buen intento! El top {size} está difícil hoy.",
    "leaderboard.title": "Ranking del día",
    "leaderboard.empty": "¡Sé el primero en el ranking!",
    "inactivity.title": "¿Seguís ahí?",
    "inactivity.body": "Volvemos al inicio en {seconds} s",
    "inactivity.continue": "Sigo acá",
    "form.errors.required": "Este campo es obligatorio",
    "form.errors.email": "Ingresá un email válido",
    "form.errors.phone": "Ingresá un teléfono válido",
    "form.errors.consent": "Necesitamos tu consentimiento para continuar",
    "common.finish": "Terminar"
  }
}
```

### 3.2 Reglas del schema (implementar en `src/brand/schema.ts` con Zod)
- Colores: regex `^#([0-9a-fA-F]{6})$`. Validar contraste mínimo 4.5:1 entre `primary/onPrimary` y `background/text` en `validate-brand.ts` (warning, no error).
- `gridSize ∈ {3, 4}`. `shuffleMoves` debe tener claves para el `gridSize` usado.
- `form.fields`: debe existir **exactamente un** campo `email` y uno `name`. Ids únicos. Tipos permitidos: `text | email | tel`.
- `texts`: se mergea sobre un diccionario por defecto en español (`src/brand/defaultTexts.ts`), así la marca solo sobreescribe lo que necesita. `t()` interpola `{var}`.
- Todas las rutas de assets se verifican en `validate-brand.ts` (existencia + imágenes del puzzle ≥ 1000px del lado menor + video ≤ 50 MB).
- El PIN de admin **NO** va en este JSON (ver 7.3).

### 3.3 Aplicación del tema
`applyTheme(brand)` corre antes del primer render:
- Escribe `--brand-primary`, `--brand-on-primary`, etc. en `document.documentElement.style`.
- Inyecta `@font-face` con las URLs resueltas por `asset()`.
- Tailwind v4 mapea los tokens:

```css
/* src/styles/index.css */
@import "tailwindcss";
@theme {
  --color-primary: var(--brand-primary);
  --color-on-primary: var(--brand-on-primary);
  --color-secondary: var(--brand-secondary);
  --color-bg: var(--brand-background);
  --color-surface: var(--brand-surface);
  --color-fg: var(--brand-text);
  --color-muted: var(--brand-text-muted);
  --color-success: var(--brand-success);
  --color-danger: var(--brand-danger);
  --radius-brand: var(--brand-radius);
  --font-heading: var(--brand-font-heading), system-ui, sans-serif;
  --font-body: var(--brand-font-body), system-ui, sans-serif;
}
html, body, #root { height: 100%; overscroll-behavior: none; user-select: none; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
input, textarea { user-select: text; }
```

Uso en componentes: `bg-primary text-on-primary rounded-brand font-heading`.

---

## 4. Motor del rompecabezas (core)

### 4.1 Modelo
- El tablero es un array plano `tiles` de longitud `n*n`. **Índice = posición** en la grilla (fila-mayor), **valor = id de ficha**.
- Ficha `id` va de `0` a `n*n-1`; el **hueco es el id `n*n-1`** (su posición resuelta es abajo a la derecha).
- Resuelto ⇔ `tiles[i] === i` para todo `i`.
- Estado inmutable: cada movimiento devuelve un nuevo estado.

### 4.2 Implementación de referencia (`src/features/game/engine/`)

```ts
// types.ts
export type GridSize = 3 | 4;
export interface PuzzleState {
  readonly size: GridSize;
  readonly tiles: readonly number[];
  readonly emptyIndex: number;
}
export type Direction = 'up' | 'down' | 'left' | 'right';
```

```ts
// rng.ts — PRNG seedeable para tests reproducibles
export type Rng = () => number; // [0, 1)
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const defaultRng: Rng = () => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
};
```

```ts
// board.ts
import type { GridSize, PuzzleState, Direction } from './types';

export const emptyId = (size: GridSize) => size * size - 1;
export const rowOf = (i: number, size: number) => Math.floor(i / size);
export const colOf = (i: number, size: number) => i % size;

export function createSolved(size: GridSize): PuzzleState {
  const tiles = Array.from({ length: size * size }, (_, i) => i);
  return { size, tiles, emptyIndex: size * size - 1 };
}

/** Índices ortogonalmente adyacentes a `index`. */
export function neighbors(index: number, size: number): number[] {
  const r = rowOf(index, size), c = colOf(index, size);
  const out: number[] = [];
  if (r > 0) out.push(index - size);
  if (r < size - 1) out.push(index + size);
  if (c > 0) out.push(index - 1);
  if (c < size - 1) out.push(index + 1);
  return out;
}

function swap(tiles: readonly number[], a: number, b: number): number[] {
  const next = tiles.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/** Mueve UNA ficha adyacente al hueco. Devuelve null si el movimiento es inválido. */
export function moveTileAt(state: PuzzleState, index: number): PuzzleState | null {
  if (!neighbors(state.emptyIndex, state.size).includes(index)) return null;
  return { ...state, tiles: swap(state.tiles, index, state.emptyIndex), emptyIndex: index };
}

/**
 * Comportamiento "real" de un slide puzzle: tocar una ficha en la misma fila/columna
 * que el hueco desliza todas las fichas intermedias. Devuelve el nuevo estado y
 * cuántas fichas se movieron (cada ficha cuenta como 1 movimiento).
 */
export function slideLineTo(state: PuzzleState, index: number): { state: PuzzleState; moved: number } | null {
  const { size, emptyIndex } = state;
  if (index === emptyIndex) return null;
  const sameRow = rowOf(index, size) === rowOf(emptyIndex, size);
  const sameCol = colOf(index, size) === colOf(emptyIndex, size);
  if (!sameRow && !sameCol) return null;

  const step = sameRow ? Math.sign(index - emptyIndex) : Math.sign(index - emptyIndex) * size;
  let current = state;
  let moved = 0;
  while (current.emptyIndex !== index) {
    const next = moveTileAt(current, current.emptyIndex + step);
    if (!next) return null; // no debería ocurrir
    current = next;
    moved++;
  }
  return { state: current, moved };
}

/**
 * Swipe: la ficha que está al lado del hueco, del lado OPUESTO a la dirección del gesto,
 * se mueve hacia el hueco. Ej: swipe 'left' mueve la ficha que está a la derecha del hueco.
 */
export function moveByDirection(state: PuzzleState, dir: Direction): PuzzleState | null {
  const { size, emptyIndex } = state;
  const r = rowOf(emptyIndex, size), c = colOf(emptyIndex, size);
  const source =
    dir === 'left'  ? (c < size - 1 ? emptyIndex + 1 : -1) :
    dir === 'right' ? (c > 0 ? emptyIndex - 1 : -1) :
    dir === 'up'    ? (r < size - 1 ? emptyIndex + size : -1) :
                      (r > 0 ? emptyIndex - size : -1);
  return source < 0 ? null : moveTileAt(state, source);
}

export function isSolved(state: PuzzleState): boolean {
  return state.tiles.every((id, i) => id === i);
}

/** Suma de distancias Manhattan de cada ficha (sin hueco) a su posición resuelta. */
export function manhattan(state: PuzzleState): number {
  const { size, tiles } = state;
  let d = 0;
  tiles.forEach((id, i) => {
    if (id === size * size - 1) return;
    d += Math.abs(rowOf(id, size) - rowOf(i, size)) + Math.abs(colOf(id, size) - colOf(i, size));
  });
  return d;
}
```

```ts
// shuffle.ts — SIEMPRE resolvible por construcción
import { createSolved, neighbors, isSolved, manhattan } from './board';
import type { GridSize, PuzzleState } from './types';
import { defaultRng, type Rng } from './rng';

export interface ShuffleOptions {
  moves: number;               // cantidad de movimientos aleatorios del hueco
  rng?: Rng;
  minManhattan?: number;       // dificultad mínima garantizada
}

/**
 * Parte del estado resuelto y aplica `moves` movimientos VÁLIDOS del hueco.
 * Como cada movimiento es reversible, el estado final es alcanzable desde el
 * resuelto y por lo tanto resolvible. Se evita deshacer el movimiento anterior
 * (no volver a la celda previa del hueco) para que la mezcla sea efectiva.
 */
export function shuffle(size: GridSize, opts: ShuffleOptions): PuzzleState {
  const rng = opts.rng ?? defaultRng;
  const minM = opts.minManhattan ?? (size === 3 ? 10 : 24);
  const tiles = createSolved(size).tiles.slice();
  let empty = size * size - 1;
  let prev = -1;
  let i = 0;
  const hardCap = opts.moves * 10;

  const current = (): PuzzleState => ({ size, tiles: tiles.slice(), emptyIndex: empty });

  while (i < hardCap) {
    const options = neighbors(empty, size).filter(n => n !== prev);
    const pick = options[Math.floor(rng() * options.length)];
    [tiles[empty], tiles[pick]] = [tiles[pick], tiles[empty]];
    prev = empty;
    empty = pick;
    i++;
    if (i >= opts.moves) {
      const s = current();
      if (!isSolved(s) && manhattan(s) >= minM) return s;
    }
  }
  return current(); // con hardCap alcanzado; en la práctica no pasa
}
```

```ts
// solvability.ts — validación independiente (tests y sanity check en runtime en dev)
import type { PuzzleState } from './types';

export function countInversions(tiles: readonly number[], emptyId: number): number {
  const arr = tiles.filter(t => t !== emptyId);
  let inv = 0;
  for (let i = 0; i < arr.length; i++)
    for (let j = i + 1; j < arr.length; j++)
      if (arr[i] > arr[j]) inv++;
  return inv;
}

/**
 * Con el hueco objetivo abajo-derecha:
 * - ancho impar: resolvible ⇔ inversiones pares.
 * - ancho par: resolvible ⇔ (inversiones + filaDelHuecoContandoDesdeAbajo[1..n]) es impar.
 */
export function isSolvable(state: PuzzleState): boolean {
  const { size, tiles, emptyIndex } = state;
  const inv = countInversions(tiles, size * size - 1);
  if (size % 2 === 1) return inv % 2 === 0;
  const rowFromBottom = size - Math.floor(emptyIndex / size);
  return (inv + rowFromBottom) % 2 === 1;
}
```

### 4.3 Tests obligatorios (`engine/__tests__/`)
- `createSolved` es resuelto; `isSolvable(createSolved(n))` es true para 3 y 4.
- Property test: 10.000 `shuffle` con seeds distintas → todos `isSolvable`, ninguno `isSolved`, `manhattan ≥ min`.
- Un estado con dos fichas intercambiadas a mano → `isSolvable === false`.
- `moveTileAt` con índice no adyacente → `null`; con adyacente → hueco cambia de lugar.
- `slideLineTo` en la misma fila desplaza N fichas y `moved === N`; en diagonal → `null`.
- `moveByDirection` en los bordes → `null`.
- Reproducibilidad: misma seed ⇒ mismo tablero.

### 4.4 Render y animación (decisión técnica)

**Técnica:** un contenedor cuadrado `position: relative` y cada ficha `position: absolute` con tamaño `100%/n`, posicionada con `transform: translate3d(col*100%, row*100%, 0)`. Los porcentajes de `translate` son relativos al **propio tamaño de la ficha**, así que no hay que medir nada en píxeles y escala perfecto con cualquier resolución.

- Cada `<Tile>` usa `key={tileId}` (NO la posición). Así el nodo DOM persiste y al cambiar su posición el navegador interpola el `transform` con `transition`. Cero re-montajes.
- **La imagen se recorta con `background-image`** (un solo objectURL compartido): `background-size: n*100% n*100%` y `background-position: (colSolved/(n-1))*100% (rowSolved/(n-1))*100%`. Sin generar n² imágenes.
- El separador entre fichas es un `inset` interno (padding + inner div), no `gap`, para no romper la matemática.
- Por qué no Framer Motion: agrega ~40 KB, layout animations miden el DOM (costoso en tablets baratas) y no aporta nada sobre una transición de `transform` en GPU.
- Por qué no CSS Grid con `grid-area`: cambiar el área de la grilla no es animable con transición; requeriría FLIP manual.

```tsx
// ui/Tile.tsx
import { memo } from 'react';

interface TileProps {
  id: number; position: number; size: number; imageUrl: string;
  durationMs: number; showNumber: boolean; onTap: (position: number) => void;
}

export const Tile = memo(function Tile({ id, position, size, imageUrl, durationMs, showNumber, onTap }: TileProps) {
  const row = Math.floor(position / size), col = position % size;
  const solvedRow = Math.floor(id / size), solvedCol = id % size;
  const pct = (v: number) => (size === 1 ? 0 : (v / (size - 1)) * 100);
  return (
    <div
      data-position={position}
      onPointerDown={() => onTap(position)}
      className="absolute left-0 top-0 p-[2px]"
      style={{
        width: `${100 / size}%`, height: `${100 / size}%`,
        transform: `translate3d(${col * 100}%, ${row * 100}%, 0)`,
        transition: `transform ${durationMs}ms cubic-bezier(.2,.8,.2,1)`,
        willChange: 'transform',
      }}
    >
      <div
        className="relative h-full w-full rounded-[6px] shadow-md"
        style={{
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: `${size * 100}% ${size * 100}%`,
          backgroundPosition: `${pct(solvedCol)}% ${pct(solvedRow)}%`,
        }}
      >
        {showNumber && <span className="absolute left-1 top-1 text-xs font-bold text-white drop-shadow">{id + 1}</span>}
      </div>
    </div>
  );
});
```

```tsx
// ui/PuzzleBoard.tsx (esqueleto)
export function PuzzleBoard({ state, imageUrl, onTapPosition, onSwipe, ...cfg }: Props) {
  const swipe = useSwipe(onSwipe, { threshold: 24 });
  const emptyId = state.size * state.size - 1;
  return (
    <div className="relative aspect-square w-[min(80vh,80vw)] select-none touch-none bg-[var(--brand-tile-gap)]" {...swipe}>
      {state.tiles.map((id, position) =>
        id === emptyId ? null : (
          <Tile key={id} id={id} position={position} size={state.size} imageUrl={imageUrl}
                durationMs={cfg.durationMs} showNumber={cfg.showNumber} onTap={onTapPosition} />
        ))}
    </div>
  );
}
```

**Input:**
- **Tap** sobre una ficha → `slideLineTo(state, position)`; si `null`, feedback leve (shake de 120 ms vía clase CSS) + haptic opcional.
- **Swipe** sobre el tablero (pointer events, `touch-action: none`): en `pointerdown` guardar origen; en `pointerup` si `|dx|` o `|dy| ≥ 24px`, dirección dominante → `moveByDirection`. Si el desplazamiento es menor al umbral, se trata como tap (no disparar ambos).
- Los movimientos NO se bloquean durante la animación: el estado es la verdad y las transiciones se re-interpolan; esto permite jugar rápido.
- Contador de movimientos: suma `moved` (cada ficha desplazada cuenta 1).

### 4.5 Preparación de imagen (`image/prepareImage.ts`)
Antes del COUNTDOWN (precargar en FORM para que esté lista):
1. Cargar la imagen del bundle con `createImageBitmap(await (await fetch(url)).blob())`.
2. Recorte **cuadrado** centrado en `focalPoint` (clamp a bordes).
3. Dibujar en un canvas de **1024×1024** (o el lado del tablero × `devicePixelRatio`, máx. 1536).
4. `canvas.toBlob('image/webp', 0.9)` → `URL.createObjectURL`. Cachear por `src`; revocar al cambiar de imagen.
5. `await img.decode()` del objectURL antes de mostrar el tablero (evita flash).

### 4.6 Cronómetro (`useGameTimer`)
- Inicia en el **primer movimiento** (no al montar), con `performance.now()`.
- UI actualizada con `requestAnimationFrame` limitado a ~10 Hz; formato `mm:ss.d`.
- `durationMs = Math.round(performance.now() - start)` al resolver. Se guarda entero en ms.
- Si `elapsed > maxDurationSec` → fin por tiempo: sesión `status='timeout'`, pantalla RESULT con mensaje amable (no entra al ranking).
- Al pasar la app a background (`appStateChange`), pausar no: se considera abandono si no vuelve antes del timeout de inactividad.

### 4.7 Detección de victoria
Tras cada movimiento: `if (isSolved(next))` → bloquear input, esperar fin de la transición (`durationMs`), animar "completado" (fade in de la imagen completa sin separadores, 400 ms), guardar sesión, ir a RESULT.

---

## 5. Persistencia offline (Dexie / IndexedDB)

### 5.1 Tipos y schema

```ts
// data/types.ts
export interface Lead {
  id?: number;
  uuid: string;
  eventId: string;
  brandId: string;
  createdAt: number;          // epoch ms
  dayKey: string;             // 'YYYY-MM-DD' hora local del dispositivo
  name: string;
  email: string;
  emailNormalized: string;    // trim + lowercase
  company?: string;
  phone?: string;             // E.164 si se pudo normalizar, si no, tal cual
  extra?: Record<string, string>;
  consent: boolean;
  consentVersion: string;
  marketingOptIn: boolean;
  exportedAt?: number;        // última vez incluido en un export
}

export type SessionStatus = 'started' | 'completed' | 'abandoned' | 'timeout';

export interface GameSession {
  id?: number;
  uuid: string;
  leadUuid: string;
  eventId: string;
  dayKey: string;
  gridSize: 3 | 4;
  imageSrc: string;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  moves?: number;
  status: SessionStatus;
}

export interface Setting { key: string; value: unknown; }
export interface AuditEntry { id?: number; at: number; action: string; detail?: string; }
```

```ts
// data/db.ts
import Dexie, { type Table } from 'dexie';
import type { Lead, GameSession, Setting, AuditEntry } from './types';

export class KioskDB extends Dexie {
  leads!: Table<Lead, number>;
  sessions!: Table<GameSession, number>;
  settings!: Table<Setting, string>;
  audit!: Table<AuditEntry, number>;

  constructor() {
    super('kiosk-puzzle');
    this.version(1).stores({
      leads: '++id, &uuid, eventId, createdAt, dayKey, emailNormalized, [eventId+emailNormalized]',
      sessions: '++id, &uuid, leadUuid, eventId, status, startedAt, [eventId+dayKey+gridSize+status]',
      settings: '&key',
      audit: '++id, at',
    });
  }
}
export const db = new KioskDB();
```

- Al arrancar: `navigator.storage?.persist?.()` (pedir almacenamiento persistente) y registrar el resultado en `audit`.
- **Migraciones:** toda modificación futura del schema va en un nuevo `this.version(n)` con `.upgrade()`. Nunca editar la versión 1.

### 5.2 Operaciones clave (repos)
- `leadsRepo.create(input)`: normaliza, genera `uuid` (`crypto.randomUUID()`), guarda. Si `repeatPlayers` es `bestScoreOnly` igual se guarda el lead nuevo (el registro de cada participación tiene valor comercial); el ranking deduplica.
- `sessionsRepo.start(leadUuid, gridSize, imageSrc)` → `status='started'`.
- `sessionsRepo.finish(uuid, { durationMs, moves })` → `completed`.
- `sessionsRepo.markAbandoned(uuid)` / `markTimeout(uuid)`.
- Al **arrancar la app**: toda sesión `started` con `startedAt` > 15 min atrás → `abandoned` (recuperación tras crash/reinicio).
- Lead + sesión se crean en **una transacción** `db.transaction('rw', db.leads, db.sessions, ...)`.

### 5.3 Leaderboard

```ts
// data/repos/leaderboardRepo.ts
export async function getLeaderboard(eventId: string, dayKey: string, gridSize: 3 | 4, limit: number) {
  const resetAt = (await settingsRepo.get<number>(`leaderboardResetAt:${eventId}:${dayKey}`)) ?? 0;
  const sessions = await db.sessions
    .where('[eventId+dayKey+gridSize+status]').equals([eventId, dayKey, gridSize, 'completed'])
    .filter(s => (s.finishedAt ?? 0) > resetAt)
    .toArray();

  // Mejor resultado por persona (email normalizado), desempate por movimientos y luego por quién llegó primero
  const leads = new Map((await db.leads.where('uuid').anyOf(sessions.map(s => s.leadUuid)).toArray()).map(l => [l.uuid, l]));
  const best = new Map<string, { session: GameSession; lead: Lead }>();
  for (const s of sessions) {
    const lead = leads.get(s.leadUuid); if (!lead) continue;
    const prev = best.get(lead.emailNormalized);
    if (!prev || compare(s, prev.session) < 0) best.set(lead.emailNormalized, { session: s, lead });
  }
  return [...best.values()].sort((a, b) => compare(a.session, b.session)).slice(0, limit);
}
const compare = (a: GameSession, b: GameSession) =>
  (a.durationMs! - b.durationMs!) || (a.moves! - b.moves!) || (a.finishedAt! - b.finishedAt!);
```

Volumen esperado: cientos a pocos miles de sesiones por día → ordenar en memoria es correcto y simple.

`getRankFor(sessionUuid)` reusa la misma función para mostrar "Quedaste en el puesto X" en RESULT.

### 5.4 Reinicio de ranking (no destructivo)
"Reiniciar ranking" **no borra** sesiones: guarda `leaderboardResetAt:<eventId>:<dayKey> = Date.now()` y registra en `audit`. El cambio de día reinicia naturalmente (el `dayKey` cambia). Los datos para export permanecen intactos.

Acción separada y extra protegida en admin: **"Borrar todos los datos del evento"** — solo habilitada si hubo un export en los últimos 10 minutos, requiere re-ingresar el PIN y mantener presionado 3 s.

### 5.5 Backup automático
`data/backup.ts`: cada 10 leads nuevos y al entrar a admin, escribir un snapshot JSON (`leads` + `sessions`) con `@capacitor/filesystem` en `Directory.Documents/KioskPuzzle/backups/backup_<eventId>_<YYYYMMDD-HHmm>.json`, conservando los últimos 5. Protege contra borrado accidental de datos de la app. Fallos de backup se registran en `audit` y nunca interrumpen el flujo del visitante.

---

## 6. Exportación CSV / Excel (client-side, offline)

### 6.1 Filas de export
`buildExportRows(eventId)`: una fila **por lead**, con su mejor sesión completada:

`fecha_hora | nombre | email | empresa | telefono | consentimiento | version_consentimiento | acepta_marketing | mejor_tiempo_seg | movimientos | partidas_jugadas | estado_ultima_partida | evento | lead_id`

Fechas en hora local legible (`YYYY-MM-DD HH:mm:ss`), tiempo en segundos con coma o punto según `csvSeparator` (`;` ⇒ coma decimal, para Excel en español).

### 6.2 Generador CSV puro (`data/export/csv.ts`)

```ts
export interface CsvColumn<T> { header: string; value: (row: T) => string | number | boolean | null | undefined; }

const FORMULA_START = /^[=+\-@\t\r]/;

/** Escapa un valor para CSV y neutraliza CSV/Formula Injection (OWASP). */
export function escapeCsvValue(v: unknown, sep: string): string {
  let s = v == null ? '' : typeof v === 'boolean' ? (v ? 'SI' : 'NO') : String(v);
  if (FORMULA_START.test(s)) s = `'${s}`;
  if (s.includes('"') || s.includes(sep) || /[\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[], sep = ';'): string {
  const head = columns.map(c => escapeCsvValue(c.header, sep)).join(sep);
  const body = rows.map(r => columns.map(c => escapeCsvValue(c.value(r), sep)).join(sep));
  return [head, ...body].join('\r\n') + '\r\n';
}

/** Bytes UTF-8 con BOM (EF BB BF) para que Excel detecte el encoding y respete tildes/ñ. */
export function csvToUtf8BomBytes(csv: string): Uint8Array {
  const body = new TextEncoder().encode(csv);
  const out = new Uint8Array(body.length + 3);
  out.set([0xef, 0xbb, 0xbf], 0);
  out.set(body, 3);
  return out;
}
```

Notas para Codex:
- **Separador `;` por defecto**: Excel con configuración regional en español usa `;` como separador de lista; con `,` abre todo en una columna. Configurable por marca.
- **No** agregar la línea `sep=;`: en Excel hace que se ignore el BOM y rompe tildes.
- Teléfonos con `+` quedan prefijados con `'` por la protección anti-fórmula: es esperado y Excel los muestra como texto.

Tests: comillas, saltos de línea, separador dentro del valor, `=CMD()` neutralizado, primeros 3 bytes = BOM, `ñ`/`á` roundtrip.

### 6.3 Guardar y compartir el archivo (`saveExportFile.ts`)
En el WebView de Android **no funciona** `<a download>` con blobs. Estrategia:

```ts
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

export async function saveExportFile(fileName: string, bytes: Uint8Array, mime: string) {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    return { uri: url, location: 'Descargas del navegador' };
  }
  const path = `KioskPuzzle/exports/${fileName}`;
  let result;
  try {
    // Sin `encoding` ⇒ Capacitor interpreta `data` como base64 y escribe bytes exactos (BOM incluido).
    result = await Filesystem.writeFile({ path, data: bytesToBase64(bytes), directory: Directory.Documents, recursive: true });
  } catch {
    // Fallback si el dispositivo no permite escribir en Documents públicos
    result = await Filesystem.writeFile({ path, data: bytesToBase64(bytes), directory: Directory.Data, recursive: true });
  }
  return { uri: result.uri, location: `Documentos/${path}` };
}

export async function shareExportFile(uri: string, title: string) {
  await Share.share({ title, url: uri, dialogTitle: title }); // permite enviarlo a Archivos, USB, Drive (cuando haya red), email…
}
```

UI del admin tras exportar: mostrar la ruta ("Guardado en Documentos/KioskPuzzle/exports/…"), botón **"Compartir / Guardar en…"** (abre el share sheet nativo, funciona offline hacia el gestor de archivos o un pendrive OTG) y marcar `exportedAt` en los leads incluidos. Registrar en `audit`.

El archivo en `Documents` también es accesible conectando la tablet por USB (MTP) a una notebook.

### 6.4 XLSX opcional
Si `export.includeXlsx`: generar con SheetJS (`XLSX.utils.json_to_sheet` + `XLSX.write({ type: 'array', bookType: 'xlsx' })`) y guardar con `saveExportFile`. Instalar SheetJS **desde su distribución oficial** (la versión del registro npm puede estar desactualizada; verificar en la doc de SheetJS) y cargarlo con `import()` dinámico solo en admin para no inflar el bundle inicial.

---

## 7. Panel de administración

### 7.1 Acceso
- `AdminHotspot`: zona invisible de 96×96 px en la esquina configurada (`kiosk.adminHotspot`), **solo en ATTRACT**. Se usa una esquina y no el logo porque los visitantes tocan el logo.
- `useSecretTap(count=5, windowMs=3000)`: cuenta toques consecutivos dentro de la ventana; al llegar abre el modal PIN. Sin feedback visual de los toques.

```ts
export function useSecretTap(count: number, windowMs: number, onUnlock: () => void) {
  const taps = useRef<number[]>([]);
  return useCallback(() => {
    const now = performance.now();
    taps.current = [...taps.current.filter(t => now - t < windowMs), now];
    if (taps.current.length >= count) { taps.current = []; onUnlock(); }
  }, [count, windowMs, onUnlock]);
}
```

### 7.2 PinPad
- Teclado numérico **propio** (botones grandes 0–9, borrar), no el teclado del sistema. 4 dígitos, puntos de progreso, validación automática al 4° dígito.
- Lockout: 3 intentos fallidos → bloqueo 30 s; luego 60 s, 120 s… (duplicando, máx. 15 min). Estado de lockout persistido en `settings` (sobrevive reinicios). Cada intento fallido → `audit`.
- El modal PIN tiene timeout de 20 s → cierra y vuelve a ATTRACT.

### 7.3 Almacenamiento del PIN
- PIN inicial por variable de build `ADMIN_PIN` (no en el JSON de marca, no commiteado). Si no se define, `0000` y el dashboard muestra banner "Cambiá el PIN por defecto".
- En el primer arranque se guarda **hasheado**: PBKDF2-SHA256 (WebCrypto `crypto.subtle`, disponible porque Capacitor sirve en `https://localhost`), salt aleatorio de 16 bytes, 100.000 iteraciones. Guardar `{ salt, hash, iterations }` en `settings`.
- Comparación en tiempo constante sobre los bytes del hash.
- Opción "Cambiar PIN" en el dashboard (pide PIN actual + nuevo dos veces).
- Ser honesto en el README: un PIN de 4 dígitos en un dispositivo físico es una barrera contra visitantes curiosos, no contra un atacante con acceso al dispositivo; los datos de IndexedDB no están cifrados. Recomendar al cliente cifrado de dispositivo de Android activado (default en Android 10+).

### 7.4 Dashboard
- **Métricas** (del evento activo): leads totales, leads hoy, partidas completadas / abandonadas / timeout, tasa de finalización, mejor tiempo del día, tiempo promedio, leads por hora (barras simples con divs, sin librería de charts), % opt-in de marketing, última exportación, espacio de almacenamiento usado (`navigator.storage.estimate()`), batería (`@capacitor/device`).
- **Acciones:** Exportar CSV, Exportar Excel, Compartir último export, Reiniciar ranking de hoy (hold-to-confirm 2 s), Cambiar tamaño de grilla para la sesión (3×3 / 4×4, persistido en `settings`, override del config), Cambiar PIN, Ver log de auditoría (últimas 100 entradas), Borrar datos del evento (ver 5.4), Salir.
- Versión de app, `brandId`, `eventId` visibles al pie (útil para soporte).
- Inactividad en admin: 60 s → salir a ATTRACT (sin aviso largo; warning de 10 s).

---

## 8. Experiencia kiosco y tolerancia a fallos

### 8.1 Tracker de actividad global (singleton)

```ts
// kiosk/activityTracker.ts
let lastActivity = performance.now();
const EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;
let started = false;

export function startActivityTracking() {
  if (started) return; started = true;
  const mark = () => { lastActivity = performance.now(); };
  // capture: true → se registra aunque un componente haga stopPropagation
  EVENTS.forEach(e => window.addEventListener(e, mark, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkNow(); });
}
export const getIdleMs = () => performance.now() - lastActivity;
export const markActivity = () => { lastActivity = performance.now(); };
let checkNow = () => {};
export const setCheckNow = (fn: () => void) => { checkNow = fn; };
```

`pointermove` throttleado no es necesario: solo asigna un número. No se crean/borran timers por evento.

### 8.2 Hook `useInactivity`

```ts
// kiosk/useInactivity.ts
interface Options { timeoutMs: number; warningMs: number; enabled: boolean; onTimeout: () => void; }

export function useInactivity({ timeoutMs, warningMs, enabled, onTimeout }: Options) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled) { setSecondsLeft(null); return; }
    markActivity(); firedRef.current = false;
    const tick = () => {
      const idle = getIdleMs();
      if (idle >= timeoutMs) {
        if (!firedRef.current) { firedRef.current = true; setSecondsLeft(null); onTimeout(); }
      } else if (idle >= timeoutMs - warningMs) {
        setSecondsLeft(Math.ceil((timeoutMs - idle) / 1000));
      } else setSecondsLeft(null);
    };
    setCheckNow(tick);
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [enabled, timeoutMs, warningMs, onTimeout]);

  return { secondsLeft, keepAlive: markActivity };
}
```

- Se monta **una sola vez** en `App.tsx`, con `timeoutMs = brand.kiosk.inactivityMs[screen]` y `enabled = screen !== 'attract'`.
- `InactivityWarning` se muestra cuando `secondsLeft !== null`: modal grande con cuenta regresiva y botón "Sigo acá" (tocar cualquier parte también cuenta como actividad).
- `onTimeout` → `flowStore.resetToAttract('inactivity')`, que:
  1. Si hay sesión `started` → `markAbandoned` (await con try/catch, nunca bloquea el reset).
  2. Limpia estado del formulario y del juego (desmontando las pantallas; no dejar valores en stores globales).
  3. Cierra cualquier modal, hace `document.activeElement?.blur()` para cerrar el teclado.
  4. Registra en `audit`.
- Además, al volver de background (`App.addListener('appStateChange')` con `isActive`) se ejecuta `tick()` inmediatamente.

### 8.3 Máquina de flujo

```ts
// flow/transitions.ts
export type Screen = 'attract' | 'form' | 'countdown' | 'game' | 'result' | 'leaderboard' | 'admin';
export const TRANSITIONS: Record<Screen, Screen[]> = {
  attract: ['form', 'admin', 'leaderboard'],
  form: ['countdown', 'attract'],
  countdown: ['game', 'attract'],
  game: ['result', 'attract'],
  result: ['leaderboard', 'attract'],
  leaderboard: ['attract'],
  admin: ['attract'],
};
```
`flowStore.go(to)` lanza error en dev si la transición no está permitida (y en prod hace `resetToAttract`). Test unitario de la tabla.

Opcional en ATTRACT: alternar cada 20 s entre el loop de marca y el leaderboard del día (genera competencia en el stand). Configurable `attract.showLeaderboardEveryMs` (0 = desactivado).

### 8.4 Formulario de leads
- Schema Zod generado desde `brand.form.fields`. Email: `z.string().trim().toLowerCase().email()` + rechazar dominios con un solo label (`a@b`). Teléfono: `libphonenumber-js` (bundle "min") con `defaultCountry` del config; guardar en E.164.
- Validación **en blur y en submit** (no mientras escribe, molesta). Errores debajo del campo, con color `danger`.
- Atributos de teclado nativo:
  - Nombre/Empresa: `type="text" inputMode="text" autoCapitalize="words" enterKeyHint="next"`
  - Email: `type="email" inputMode="email" autoCapitalize="none" enterKeyHint="next"`
  - Teléfono: `type="tel" inputMode="tel" enterKeyHint="done"`
  - **Todos:** `autoComplete="off" autoCorrect="off" spellCheck={false}` y `name` aleatorio por montaje (evita que el WebView sugiera datos de visitantes anteriores).
- "Siguiente" del teclado mueve el foco al próximo campo; "Listo" en el último intenta submit.
- Con el teclado abierto, el campo enfocado debe quedar visible: `windowSoftInputMode="adjustResize"` en el manifest + `scrollIntoView({ block: 'center' })` al enfocar. Layout del form en una columna centrada, sin depender de `100vh` fijo (usar `100dvh`).
- Checkbox de consentimiento obligatorio (si `consent.required`), con área táctil ≥ 48 px. Se guarda `consentVersion`.
- Botón submit deshabilitado mientras guarda (evitar doble lead).

### 8.5 Robustez general
- `ErrorBoundary` global: ante error de render → registrar en `audit` (mensaje + stack truncado), mostrar pantalla "Un momento…" 2 s, `resetToAttract`.
- `window.onerror` y `unhandledrejection` → `audit`.
- Bloquear: menú contextual (`contextmenu` preventDefault), zoom por pinch (`<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">`), selección de texto, arrastre de imágenes (`draggable={false}`), pull-to-refresh (`overscroll-behavior: none`).
- Botón Atrás de Android: `App.addListener('backButton', ...)` → ignorar siempre (en admin: cerrar modal / volver al dashboard).
- Video de attract: `muted playsInline loop autoPlay preload="auto"`; si falla la reproducción, caer a slideshow de imágenes o logo estático. No dejar el `<video>` montado fuera de ATTRACT.
- Memoria: revocar objectURLs, no acumular listeners; probar 500 ciclos completos automatizados sin crecimiento de memoria (ver sección 11).

---

## 9. Capacitor y Android

### 9.1 Plugins
| Plugin | Uso |
|---|---|
| `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` | base |
| `@capacitor/app` | botón Atrás, `appStateChange`, versión de la app |
| `@capacitor/screen-orientation` | bloquear orientación en runtime (refuerzo del manifest) |
| `@capacitor-community/keep-awake` | mantener pantalla encendida (refuerzo; ver nota) |
| `@capacitor/filesystem` | exportaciones y backups |
| `@capacitor/share` | share sheet nativo para sacar el archivo del dispositivo |
| `@capacitor/splash-screen` | splash con marca |
| `@capacitor/device` | batería / info para admin |
| `@capacitor/haptics` (opcional) | vibración leve al mover/ganar |

No se necesita `@capacitor/dialog` (modales propios) ni `@capacitor/status-bar` (se resuelve con modo inmersivo nativo).

**Nota keep awake:** la fuente principal es la flag nativa `FLAG_KEEP_SCREEN_ON` en `MainActivity` (funciona aunque el JS falle). El plugin se llama además al iniciar como refuerzo.

Verificar compatibilidad de versiones de cada plugin con la versión de Capacitor instalada antes de fijarlas en `package.json`.

### 9.2 `capacitor.config.ts`

```ts
import type { CapacitorConfig } from '@capacitor/cli';
import brandConfig from './brands/current/theme.config.json'; // lo escribe build-brand.ts (o leer por VITE_BRAND)

const isProd = process.env.NODE_ENV === 'production';

const config: CapacitorConfig = {
  appId: brandConfig.brand.androidAppId,
  appName: brandConfig.brand.appName,
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: !isProd,
    backgroundColor: brandConfig.theme.colors.background,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: brandConfig.theme.colors.background,
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};
export default config;
```

(`server.url` nunca se setea en release; solo para live reload en dev.)

### 9.3 `MainActivity.java` — modo inmersivo + pantalla encendida

```java
package uy.kioskpuzzle.app; // patch-android.ts reemplaza por el appId de la marca

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    enterImmersive();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) enterImmersive(); // re-aplicar tras teclado, share sheet, notificaciones
  }

  @Override
  public void onResume() {
    super.onResume();
    enterImmersive();
  }

  private void enterImmersive() {
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    c.hide(WindowInsetsCompat.Type.systemBars());
    c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
  }
}
```

Con `setDecorFitsSystemWindows(false)` el WebView ocupa toda la pantalla: usar `env(safe-area-inset-*)` en el layout raíz por si hay notch/cámara.

### 9.4 `AndroidManifest.xml` (cambios clave en la `<activity>` principal)

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
          xmlns:tools="http://schemas.android.com/tools">

  <!-- Solo para export en Android ≤ 10 a Documents públicos -->
  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />

  <application
      android:allowBackup="false"
      android:usesCleartextTraffic="false"
      ...>
    <activity
        android:name=".MainActivity"
        android:screenOrientation="sensorLandscape"
        android:windowSoftInputMode="adjustResize"
        android:launchMode="singleTask"
        android:resizeableActivity="false"
        android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation"
        android:exported="true">
      <!-- intent-filter MAIN/LAUNCHER existente -->
    </activity>
  </application>
</manifest>
```

- `screenOrientation`: `sensorLandscape` o `sensorPortrait` según `kiosk.orientation` (lo escribe `patch-android.ts`). `sensor*` permite girar 180° si la tablet está montada al revés en un soporte.
- **Quitar INTERNET en release** (la app no la necesita: Capacitor sirve los assets localmente). Crear `android/app/src/release/AndroidManifest.xml`:
  ```xml
  <manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
    <uses-permission android:name="android.permission.INTERNET" tools:node="remove" />
  </manifest>
  ```
  Esto es además un argumento de venta: "la app no puede enviar datos a ningún lado". Verificar que el build release arranque bien sin el permiso.
- `allowBackup="false"`: evita que los leads (datos personales) terminen en backups de Google del dispositivo.

### 9.5 `kiosk/native.ts`

```ts
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { KeepAwake } from '@capacitor-community/keep-awake';

export async function initNativeKiosk(orientation: 'landscape' | 'portrait', onBack: () => void, onResume: () => void) {
  if (!Capacitor.isNativePlatform()) return;
  await Promise.allSettled([
    ScreenOrientation.lock({ orientation }),
    KeepAwake.keepAwake(),
  ]);
  App.addListener('backButton', onBack);
  App.addListener('appStateChange', ({ isActive }) => { if (isActive) onResume(); });
}
```

### 9.6 Fijado de pantalla (lock task) — fase 2
El modo inmersivo no impide salir de la app con gestos. Para kiosco real:
- **Mínimo (documentar en README para el staff):** activar "Fijar app / App pinning" en Ajustes de Android y fijar la app antes del evento.
- **Fase 2 (opcional):** plugin Capacitor local mínimo que expone `startLockTask()` / `stopLockTask()`, con toggle en el admin. Sin device owner, Android muestra confirmación al usuario; con device owner (provisionamiento por `adb` en tablets dedicadas) es silencioso. No implementar device owner en el MVP.

### 9.7 Recursos por marca
`patch-android.ts` usa `@capacitor/assets` para generar íconos y splash desde `brands/<id>/assets/icon/`, y reemplaza `appId` (namespace/applicationId en `build.gradle`, paquete de `MainActivity`), `app_name` en `strings.xml` y la orientación.

---

## 10. Checklist de preparación del dispositivo (incluir en README para el cliente/staff)
1. Android 11+ actualizado; desactivar actualizaciones automáticas de apps durante el evento.
2. Modo No Molestar activado (sin notificaciones sobre el juego).
3. Desactivar optimización de batería para la app; dejar la tablet enchufada.
4. Brillo fijo alto, desactivar brillo adaptativo y protector de pantalla.
5. En el teclado (Gboard): desactivar "Sugerencias personalizadas" / aprendizaje, para que no sugiera emails de visitantes anteriores.
6. Fijar la app (App pinning) y bloquear con PIN del dispositivo para desfijar.
7. Fecha/hora correctas (afecta el ranking diario y el export).
8. Al cierre de cada día: Exportar CSV desde el admin y copiarlo fuera de la tablet.

---

## 11. Calidad y testing
- **Unit (Vitest):** engine completo (4.3), `csv.ts`, `transitions.ts`, `formatPlayerName`, `buildLeadSchema`, `pin.ts` (hash/verify/lockout), repos con `fake-indexeddb` (crear lead+sesión, leaderboard con dedupe y reset, recuperación de sesiones `started` huérfanas).
- **Modo demo/QA** (solo dev, `?qa=1`): botón "resolver" en GAME, timeouts acortados ×0.1, y un "soak test" que recorre el flujo completo 500 veces con datos falsos para detectar leaks.
- **Prueba manual en dispositivo real** (checklist en README): rotación, teclado tapando campos, inactividad en cada pantalla, botón Atrás, reinicio de la tablet a mitad de partida, export y apertura del CSV en Excel con tildes/ñ correctas, release sin INTERNET.
- Bundle inicial objetivo < 500 KB gzip (sin contar assets de marca). SheetJS en chunk dinámico.

---

## 12. Plan de implementación por fases (para Codex)

Cada fase termina con: código compilando, tests verdes, `DECISIONS.md` actualizado y un resumen de lo hecho.

**Fase 1 — Scaffolding y marca**
- Vite + React + TS strict + Tailwind v4 + ESLint/Prettier + Vitest.
- `brands/_template` y `brands/demo` (assets placeholder generados: logo SVG simple, imagen de puzzle con colores y formas variadas para que se note el orden).
- `schema.ts`, `brand.ts`, `applyTheme.ts`, `t()`, `validate-brand.ts`.
- ✅ Aceptación: `VITE_BRAND=demo npm run dev` muestra una pantalla con colores, fuente y logo del config; un config inválido falla con error legible.

**Fase 2 — Motor del juego**
- `engine/*` completo + tests (4.3).
- ✅ Aceptación: 100% de tests del engine verdes, incluido el property test de 10.000 mezclas.

**Fase 3 — UI del juego**
- `prepareImage`, `PuzzleBoard`, `Tile`, `useSwipe`, `useGameTimer`, `HUD`, `CountdownScreen`, `GameScreen`, botón "Ver imagen" (overlay mientras se mantiene presionado), animación de victoria.
- ✅ Aceptación: se juega fluido con tap (incluido deslizar fila/columna) y swipe en 3×3 y 4×4; el tiempo arranca en el primer movimiento; al resolver se detecta victoria.

**Fase 4 — Datos**
- Dexie (`db.ts`, repos, recuperación de sesiones huérfanas, `storage.persist`), formulario de leads completo con Zod, flujo FORM → COUNTDOWN → GAME → RESULT → LEADERBOARD con persistencia real.
- ✅ Aceptación: tests de repos verdes; recargar la página no pierde datos; el ranking deduplica por email y desempata por movimientos.

**Fase 5 — Kiosco**
- `flowStore` + tabla de transiciones, `activityTracker`, `useInactivity`, `InactivityWarning`, `resetToAttract`, `ErrorBoundary`, bloqueos de gestos, AttractScreen con video/slideshow.
- ✅ Aceptación: dejar cualquier pantalla quieta muestra el aviso y vuelve a ATTRACT con el formulario limpio; un abandono en GAME queda `abandoned`.

**Fase 6 — Admin y export**
- `AdminHotspot`, `useSecretTap`, `PinPad`, `pin.ts` (PBKDF2 + lockout), `AdminDashboard`, `csv.ts` + tests, `buildExportRows`, `saveExportFile`, share, XLSX dinámico, reinicio de ranking no destructivo, borrado protegido, log de auditoría, `backup.ts`.
- ✅ Aceptación: 5 toques en la esquina + PIN correcto abren el panel; 3 PIN incorrectos bloquean; el CSV abre en Excel (es-UY) con columnas separadas y tildes correctas.

**Fase 7 — Android**
- `npx cap add android`, plugins, `capacitor.config.ts`, `MainActivity` inmersivo, manifest (orientación, adjustResize, allowBackup, release sin INTERNET), `native.ts`, `patch-android.ts`, `build-brand.ts`, íconos/splash por marca.
- ✅ Aceptación: `npm run brand:build -- demo` produce un APK que arranca en pantalla completa, bloqueado en orientación, sin apagar pantalla, con Atrás deshabilitado, y exporta el CSV a Documentos.

**Fase 8 — Pulido**
- README (crear cliente nuevo, buildear, checklist de dispositivo), modo QA/soak test, revisión de accesibilidad de contraste y tamaños táctiles (≥ 48 px), sonidos opcionales (archivos locales, `game.sounds` en config, apagados por defecto).

---

## 13. Fuera de alcance del MVP (no implementar salvo pedido)
- Sincronización con CRM/nube (la arquitectura lo permite después vía `exportedAt` y una cola de sync).
- Panel web para el cliente, multi-idioma en runtime, múltiples juegos, device owner / MDM.
