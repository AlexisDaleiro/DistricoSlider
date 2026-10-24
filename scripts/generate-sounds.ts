import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRoot } from './validate-brand.ts';

/** PCM mono propio, sin muestras externas ni dependencias de audio. */
export function soundWav(kind: 'move' | 'win'): Buffer {
  const rate = 22050;
  const duration = kind === 'move' ? 0.065 : 0.35;
  const length = Math.round(rate * duration);
  const bytes = Buffer.alloc(44 + length * 2);
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) {
    const t = i / rate;
    const frequency =
      kind === 'move'
        ? 520
        : [523.25, 659.25, 783.99][Math.min(2, Math.floor(t / (duration / 3)))];
    const envelope =
      Math.min(1, t / 0.006) *
      Math.min(1, (duration - t) / 0.03) *
      Math.exp(-t * 3);
    bytes.writeInt16LE(
      Math.round(Math.sin(2 * Math.PI * frequency * t) * envelope * 5000),
      44 + i * 2,
    );
  }
  return bytes;
}
export async function generateSounds(id: string) {
  if (!/^(?:[a-z0-9][a-z0-9_-]*|_template)$/.test(id))
    throw new Error('Marca inválida.');
  const directory = resolve(projectRoot, 'brands', id, 'assets/sounds');
  await mkdir(directory, { recursive: true });
  for (const kind of ['move', 'win'] as const)
    await writeFile(resolve(directory, `${kind}.wav`), soundWav(kind));
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  for (const id of process.argv.slice(2).length
    ? process.argv.slice(2)
    : ['demo', '_template', 'biofresh', 'granplus'])
    await generateSounds(id);
