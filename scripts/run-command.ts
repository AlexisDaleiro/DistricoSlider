import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { projectRoot } from './validate-brand.ts';

export function runCommand(
  command: string,
  args: string[],
  cwd = projectRoot,
  env: NodeJS.ProcessEnv = process.env,
) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${command} terminó con código ${result.status ?? result.signal}.`,
    );
}
export function runNode(
  script: string,
  args: string[],
  cwd = projectRoot,
  env: NodeJS.ProcessEnv = process.env,
) {
  runCommand(process.execPath, [resolve(cwd, script), ...args], cwd, env);
}
