import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { projectRoot } from './validate-brand';

// Arte geométrico propio: nueve zonas diferentes y trazos que cruzan la grilla.
// También permite distinguir las dieciséis fichas si se usa una grilla 4×4.
const puzzle = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1440" viewBox="0 0 1440 1440">
<path fill="#ff875f" d="M0 0h480v480H0z"/><path fill="#bce956" d="M480 0h480v480H480z"/><path fill="#5bbbd5" d="M960 0h480v480H960z"/>
<path fill="#b5a1ea" d="M0 480h480v480H0z"/><path fill="#f5edd4" d="M480 480h480v480H480z"/><path fill="#e7789c" d="M960 480h480v480H960z"/>
<path fill="#e8bf4e" d="M0 960h480v480H0z"/><path fill="#518c76" d="M480 960h480v480H480z"/><path fill="#577bb7" d="M960 960h480v480H960z"/>
<g fill="#172735">
<circle cx="240" cy="240" r="155"/>
<path d="M540 380 720 80 900 380z"/>
<path d="M1050 70h120v120h180v120h-180v120h-120z"/>
<path d="m240 540 180 180-180 180L60 720z"/>
<path d="M570 570h300v300H570z"/>
<path d="M1020 780a180 180 0 0 1 360 0h-100a80 80 0 0 0-160 0z"/>
<path d="M90 1050h300v80H90zm0 110h220v80H90zm0 110h140v80H90z"/>
<circle cx="720" cy="1200" r="164"/>
<path d="m1200 1020 48 120 128 8-100 86 32 126-108-70-108 70 32-126-100-86 128-8z"/>
</g>
<g fill="#f5edd4"><circle cx="210" cy="210" r="52"/><path d="m720 195 60 105H660z"/><circle cx="720" cy="1200" r="84"/></g>
<path d="M0 440C370 420 380 1010 735 1000S1090 420 1440 460" fill="none" stroke="#f5edd4" stroke-width="18"/>
<circle cx="650" cy="650" r="35" fill="#ff875f"/><circle cx="790" cy="790" r="57" fill="#5bbbd5"/>
</svg>`;

for (const id of ['_template', 'demo']) {
  const directory = resolve(projectRoot, 'brands', id);
  for (const folder of ['puzzle', 'attract', 'fonts', 'icon'])
    await mkdir(resolve(directory, 'assets', folder), { recursive: true });
  const primary = id === 'demo' ? '#c4f454' : '#70d9e8';
  const logo = (color: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g fill="${color}"><rect width="28" height="28" rx="7"/><rect x="36" width="28" height="28" rx="14"/><path d="M0 64V36h28z"/><rect x="36" y="36" width="28" height="28" rx="7"/></g></svg>`;
  await writeFile(resolve(directory, 'assets/logo.svg'), logo(primary));
  await writeFile(resolve(directory, 'assets/logo-mono.svg'), logo('#172016'));
  await sharp(Buffer.from(puzzle))
    .webp({ quality: 94 })
    .toFile(resolve(directory, 'assets/puzzle/hero.webp'));
  await sharp(Buffer.from(puzzle))
    .resize(1440, 960, { fit: 'cover' })
    .webp({ quality: 90 })
    .toFile(resolve(directory, 'assets/attract/cover.webp'));
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" rx="200" fill="#111b24"/><g transform="translate(256 256) scale(8)">${logo(primary).replace(/<svg[^>]*>|<\/svg>/g, '')}</g></svg>`;
  await sharp(Buffer.from(icon))
    .png()
    .toFile(resolve(directory, 'assets/icon/icon-1024.png'));
  await sharp(Buffer.from(icon))
    .resize(2732, 2732)
    .png()
    .toFile(resolve(directory, 'assets/icon/splash-2732.png'));
  for (const [packageName, file] of [
    ['space-grotesk', 'space-grotesk-latin-700-normal.woff2'],
    ['dm-sans', 'dm-sans-latin-400-normal.woff2'],
  ]) {
    await copyFile(
      resolve(
        projectRoot,
        'node_modules',
        '@fontsource',
        packageName,
        'files',
        file,
      ),
      resolve(directory, 'assets/fonts', file),
    );
    await copyFile(
      resolve(
        projectRoot,
        'node_modules',
        '@fontsource',
        packageName,
        'LICENSE',
      ),
      resolve(directory, 'assets/fonts', `${packageName}-LICENSE.txt`),
    );
  }
  const config = {
    schemaVersion: 1,
    brand: {
      id,
      name: id === 'demo' ? 'Pieza' : 'Tu marca',
      appName: id === 'demo' ? 'Pieza Puzzle' : 'Tu marca Puzzle',
      androidAppId:
        id === 'demo' ? 'uy.kioskpuzzle.demo' : 'uy.kioskpuzzle.template',
      logo: 'assets/logo.svg',
      logoOnPrimary: 'assets/logo-mono.svg',
    },
    event: {
      id: 'demo-2026',
      name: 'Experiencias que conectan',
      locale: 'es-UY',
    },
    theme: {
      colors: {
        primary,
        onPrimary: '#172016',
        secondary: '#FF8C67',
        onSecondary: '#231A14',
        background: '#111B24',
        surface: '#1B2935',
        text: '#F5F7F3',
        textMuted: '#A6B5C0',
        success: '#79DCA7',
        danger: '#FF8993',
        tileGap: '#111B24',
      },
      fonts: {
        heading: {
          family: 'Space Grotesk',
          file: 'assets/fonts/space-grotesk-latin-700-normal.woff2',
          weight: 700,
        },
        body: {
          family: 'DM Sans',
          file: 'assets/fonts/dm-sans-latin-400-normal.woff2',
          weight: 400,
        },
      },
      radius: '20px',
      backgroundImage: null,
    },
    attract: {
      mode: 'slideshow',
      media: ['assets/attract/cover.webp'],
      slideIntervalMs: 6000,
      headline: 'Cada pieza cuenta.',
      cta: 'Tocá para jugar',
    },
    form: {
      title: 'Dejanos tus datos para participar',
      fields: [
        {
          id: 'name',
          type: 'text',
          label: 'Nombre y apellido',
          required: true,
          minLength: 3,
          maxLength: 80,
        },
        { id: 'email', type: 'email', label: 'Email', required: true },
        {
          id: 'company',
          type: 'text',
          label: 'Empresa',
          required: false,
          maxLength: 80,
        },
        {
          id: 'phone',
          type: 'tel',
          label: 'Teléfono',
          required: false,
          defaultCountry: 'UY',
        },
      ],
      consent: {
        required: true,
        version: '2026-10-01',
        text: 'Acepto el tratamiento de mis datos para participar. Texto de demostración: reemplazar antes de un evento.',
      },
      marketingOptIn: {
        enabled: true,
        text: 'Quiero recibir novedades y promociones.',
      },
      submit: '¡Jugar!',
    },
    game: {
      gridSize: 3,
      images: [
        { src: 'assets/puzzle/hero.webp', focalPoint: { x: 0.5, y: 0.5 } },
      ],
      imageSelection: 'random',
      shuffleMoves: { '3': 60, '4': 160 },
      showTileNumbers: false,
      showPreviewButton: true,
      countdownSec: 3,
      maxDurationSec: 300,
      tileAnimationMs: 130,
    },
    leaderboard: {
      size: 10,
      nameFormat: 'firstNameLastInitial',
      showCompany: true,
      repeatPlayers: 'bestScoreOnly',
    },
    kiosk: {
      orientation: 'landscape',
      inactivityMs: {
        form: 60000,
        countdown: 30000,
        game: 90000,
        result: 15000,
        leaderboard: 20000,
        admin: 60000,
      },
      warningMs: 10000,
      adminHotspot: 'top-right',
      adminTapCount: 5,
      adminTapWindowMs: 3000,
    },
    export: { filePrefix: `leads_${id}`, csvSeparator: ';', includeXlsx: true },
    texts: {
      'showcase.eyebrow': 'Una marca. Todas sus piezas.',
      'showcase.description':
        'Formas, colores y un desafío por descubrir. Una experiencia pensada para conectar con tu marca.',
      'showcase.status': 'Identidad lista · Motor verificado',
      'showcase.imageAlt':
        'Composición de nueve zonas de colores con círculo, triángulo, cruz, rombo, cuadrado, arco, barras, anillo y estrella.',
      'showcase.imageCaption': 'La imagen que da forma al desafío',
      'showcase.grid': '{size} × {size}',
      'showcase.scope': 'Vista de marca · Fases 1 y 2',
    },
  };
  await writeFile(
    resolve(directory, 'theme.config.json'),
    JSON.stringify(config, null, 2) + '\n',
  );
}
console.log(
  'Assets propios y configuraciones generados para _template y demo.',
);
