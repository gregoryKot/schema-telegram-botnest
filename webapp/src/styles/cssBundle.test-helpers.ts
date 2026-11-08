// Текст css из styles/ с подставленными `@import './x.css';` — как его собирает Vite (раскрой 2026-11):
// сборник (sheet-tasks.css) или файл экрана с вынесенными разделами (sheet-exercises.css) читается целиком,
// со всеми своими частями, и сверки по имени файла смотрят на весь раздел, а не на одни строки @import.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function cssBundle(name: string): string {
  return readFileSync(join(__dirname, name), 'utf8').replace(/@import\s+'\.\/([^']+)';/g, (_, f: string) => cssBundle(f));
}
