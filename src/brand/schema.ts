import { z } from 'zod';
import { isSupportedCountry } from 'libphonenumber-js/min';
import { defaultTexts } from './defaultTexts.ts';

const text = z.string().trim().min(1);
export const brandIdSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9_-]*$|^_template$/,
    'Usá un identificador de marca local: letras, números, guion o guion bajo.',
  );
const assetPath = z
  .string()
  .regex(
    /^assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:svg|png|jpe?g|webp|mp4|woff2|wav)$/,
    'Debe ser una ruta local dentro de assets/ (sin URLs ni ..).',
  );
const imagePath = assetPath.refine(
  (value) => /\.(svg|png|jpe?g|webp)$/.test(value),
  'Se requiere una imagen local.',
);
const font = z.strictObject({
  family: z.string().regex(/^[\p{L}\p{N} _-]+$/u),
  file: assetPath.refine(
    (value) => value.endsWith('.woff2'),
    'Se requiere una fuente woff2 local.',
  ),
  weight: z.number().int().min(100).max(900),
});
const color = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, 'Usá un color hexadecimal #RRGGBB.');
const positiveInt = z.number().int().positive();
const field = z
  .strictObject({
    id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
    type: z.enum(['text', 'email', 'tel']),
    label: text,
    required: z.boolean(),
    minLength: positiveInt.optional(),
    maxLength: positiveInt.optional(),
    defaultCountry: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .refine(isSupportedCountry, 'País de teléfono no soportado.')
      .optional(),
  })
  .refine(
    (value) => (value.minLength ?? 0) <= (value.maxLength ?? Infinity),
    'minLength no puede superar maxLength.',
  );

export const brandSchema = z.strictObject({
  schemaVersion: z.literal(1),
  gameHub: z
    .strictObject({
      endpoint: z.string().trim(),
      gameKey: z.string().trim(),
      brandId: z.string().trim(),
      brandName: z.string().trim(),
      gameId: z.string().trim(),
      gameName: z.string().trim(),
      gameVersion: z.string().trim().min(1).max(30).optional(),
      syncFeedbackDelayMs: z.number().int().nonnegative().default(10000),
      defaultCallingCode: z
        .string()
        .regex(/^[1-9]\d{0,2}$/)
        .optional(),
      allowPreview: z.boolean(),
    })
    .optional(),
  brand: z.strictObject({
    id: brandIdSchema,
    name: text,
    appName: text,
    androidAppId: z
      .string()
      .regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/),
    logo: imagePath,
    logoOnPrimary: imagePath,
  }),
  event: z.strictObject({
    id: text,
    name: text,
    locale: text.refine((value) => {
      try {
        new Intl.Locale(value);
        return true;
      } catch {
        return false;
      }
    }, 'Locale inválido.'),
  }),
  theme: z.strictObject({
    colors: z.strictObject({
      primary: color,
      onPrimary: color,
      secondary: color,
      onSecondary: color,
      background: color,
      surface: color,
      text: color,
      textMuted: color,
      success: color,
      danger: color,
      tileGap: color,
    }),
    fonts: z.strictObject({ heading: font, body: font }),
    radius: z.string().regex(/^\d+(?:\.\d+)?(?:px|rem)$/),
    backgroundImage: imagePath.nullable(),
  }),
  attract: z.strictObject({
    mode: z.enum(['video', 'slideshow']),
    media: z.array(assetPath).default([]),
    slideIntervalMs: positiveInt,
    headline: text,
    cta: text,
    startButton: text.default('Empezar juego'),
    rankingButton: text.default('Ver ranking'),
    backButton: text.default('Volver'),
    animation: z.enum(['puzzle-assemble', 'none']).default('puzzle-assemble'),
    animationCycleMs: positiveInt.default(9000),
    showLeaderboardEveryMs: z.number().int().nonnegative().optional(),
  }),
  form: z.strictObject({
    title: text,
    fields: z
      .array(field)
      .min(2)
      .superRefine((fields, ctx) => {
        if (
          fields.some(
            (field) => ['name', 'email'].includes(field.id) && !field.required,
          )
        )
          ctx.addIssue({
            code: 'custom',
            message:
              'name y email deben ser obligatorios para identificar la participación.',
          });
        if (
          fields.some((field) => field.id === 'phone' && field.type !== 'tel')
        )
          ctx.addIssue({
            code: 'custom',
            message: 'El campo phone debe ser de tipo tel.',
          });
        if (new Set(fields.map((entry) => entry.id)).size !== fields.length)
          ctx.addIssue({
            code: 'custom',
            message: 'Los ids de campos deben ser únicos.',
          });
        if (
          fields.filter((entry) => entry.id === 'name' && entry.type === 'text')
            .length !== 1
        )
          ctx.addIssue({
            code: 'custom',
            message: 'Debe existir exactamente un campo name de tipo text.',
          });
        if (
          (fields.filter(
            (entry) => entry.id === 'email' && entry.type === 'email',
          ).length !== 1 ||
            fields.filter((entry) => entry.type === 'email').length !== 1) &&
          !(
            fields.every((entry) => entry.type !== 'email') &&
            fields.some(
              (entry) =>
                entry.id === 'phone' && entry.type === 'tel' && entry.required,
            )
          )
        )
          ctx.addIssue({
            code: 'custom',
            message:
              'Se requiere email obligatorio o celular obligatorio, sin emails adicionales.',
          });
      }),
    consent: z.strictObject({ required: z.boolean(), version: text, text }),
    marketingOptIn: z.strictObject({ enabled: z.boolean(), text }),
    submit: text,
  }),
  game: z
    .strictObject({
      gridSize: z.union([z.literal(3), z.literal(4)], {
        error: 'gridSize debe ser 3 o 4.',
      }),
      images: z
        .array(
          z.strictObject({
            src: imagePath.refine(
              (value) => /\.(jpe?g|webp)$/.test(value),
              'El puzzle debe ser JPG o WebP.',
            ),
            focalPoint: z.strictObject({
              x: z.number().min(0).max(1),
              y: z.number().min(0).max(1),
            }),
          }),
        )
        .min(1),
      imageSelection: z.literal('random'),
      shuffleMoves: z.strictObject({
        '3': positiveInt.optional(),
        '4': positiveInt.optional(),
      }),
      showTileNumbers: z.boolean(),
      showPreviewButton: z.boolean(),
      countdownSec: positiveInt,
      maxDurationSec: positiveInt,
      tileAnimationMs: positiveInt,
      invalidMoveAnimationMs: positiveInt.default(120),
      victoryAnimationMs: positiveInt.default(400),
      swipeThresholdPx: positiveInt.default(24),
      sounds: z
        .strictObject({
          enabled: z.boolean(),
          move: assetPath.refine((path) => path.endsWith('.wav')).optional(),
          win: assetPath.refine((path) => path.endsWith('.wav')).optional(),
        })
        .refine(
          (sounds) => !sounds.enabled || Boolean(sounds.move && sounds.win),
          'sounds necesita move y win cuando está habilitado.',
        )
        .default({ enabled: false }),
    })
    .refine(
      (game) =>
        game.shuffleMoves[String(game.gridSize) as '3' | '4'] !== undefined,
      {
        path: ['shuffleMoves'],
        message: 'Falta shuffleMoves para el gridSize activo.',
      },
    ),
  leaderboard: z.strictObject({
    size: positiveInt,
    nameFormat: z.literal('firstNameLastInitial'),
    showCompany: z.boolean(),
    repeatPlayers: z.literal('bestScoreOnly'),
  }),
  kiosk: z
    .strictObject({
      orientation: z.enum(['landscape', 'portrait']),
      splashMs: positiveInt.default(1200),
      inactivityMs: z.strictObject({
        form: positiveInt,
        countdown: positiveInt,
        game: positiveInt,
        result: positiveInt,
        leaderboard: positiveInt,
        admin: positiveInt,
      }),
      warningMs: positiveInt,
      errorRecoveryMs: positiveInt.default(2000),
      admin: z
        .strictObject({
          pinTimeoutMs: positiveInt,
          resetHoldMs: positiveInt,
          deleteHoldMs: positiveInt,
          lockoutBaseMs: positiveInt,
          lockoutMaxMs: positiveInt,
          maxAttempts: positiveInt,
          exportFreshMs: positiveInt,
        })
        .default({
          pinTimeoutMs: 20000,
          resetHoldMs: 2000,
          deleteHoldMs: 3000,
          lockoutBaseMs: 30000,
          lockoutMaxMs: 900000,
          maxAttempts: 3,
          exportFreshMs: 600000,
        }),
      adminHotspot: z.enum([
        'top-right',
        'top-left',
        'bottom-right',
        'bottom-left',
      ]),
      adminTapCount: positiveInt,
      adminTapWindowMs: positiveInt,
    })
    .refine(
      (kiosk) =>
        Object.values(kiosk.inactivityMs).every(
          (timeout) => timeout > kiosk.warningMs,
        ),
      'warningMs debe ser menor que cada timeout de inactividad.',
    ),
  export: z.strictObject({
    filePrefix: z.string().regex(/^[A-Za-z0-9_-]+$/),
    csvSeparator: z.enum([';', ',']),
    includeXlsx: z.boolean(),
  }),
  texts: z
    .record(z.string(), text)
    .default({})
    .transform(
      (overrides) =>
        ({ ...defaultTexts, ...overrides }) as Record<string, string>,
    ),
});

export type BrandConfig = z.infer<typeof brandSchema>;
