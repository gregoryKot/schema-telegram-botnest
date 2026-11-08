// Запуск bash-скриптов бэкапа из спеков: асинхронно (скрипт ходит в
// поддельный S3 внутри того же процесса jest — spawnSync заблокировал бы
// сервер) и с подменой `curl`/`node` в PATH обёртками, пишущими аргументы в
// лог, — так спек доказывает, что ключи не попадают в командную строку.
import { spawn, spawnSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

export interface ScriptResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Кладёт в <bin> обёртку <cmd>, дописывающую аргументы в <log>. */
export function installSpy(bin: string, log: string, cmd: string): void {
  const real = spawnSync('which', [cmd], { encoding: 'utf8' }).stdout.trim();
  writeFileSync(
    join(bin, cmd),
    `#!/bin/bash\necho "${cmd} $*" >> '${log}'\nexec ${real} "$@"\n`,
    { mode: 0o755 },
  );
}

export function runScript(
  script: string,
  args: string[],
  env: Record<string, string | undefined>,
): Promise<ScriptResult> {
  return new Promise((resolve) => {
    const child = spawn('bash', [script, ...args], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}
