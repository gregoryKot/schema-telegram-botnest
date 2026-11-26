// Файловая обвязка тестов kb/: корень репозитория, чтение и обход деревьев кода.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

export const exists = (file: string) => existsSync(join(ROOT, file));
export const readText = (file: string) =>
  readFileSync(join(ROOT, file), 'utf8');

const SKIP = /\.(test|spec)\.|test-helpers|fixture/;

/** Файлы кода дерева (путь от корня), без тестов, обвязки и фикстур. */
export function codeFiles(tree: string): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    for (const name of readdirSync(join(ROOT, rel))) {
      if (
        name === 'node_modules' ||
        name === 'test-support' ||
        name.startsWith('.')
      )
        continue;
      const path = `${rel}/${name}`;
      if (statSync(join(ROOT, path)).isDirectory()) walk(path);
      else if (
        /\.tsx?$/.test(name) &&
        !name.endsWith('.d.ts') &&
        !SKIP.test(name)
      )
        out.push(path);
    }
  };
  walk(tree);
  return out;
}
