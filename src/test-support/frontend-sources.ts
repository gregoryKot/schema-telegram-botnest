// Тексты всего, что исполняется в браузере пользователя: исходники обоих
// фронтов, shared, игры, публичные скрипты и index.html. Одна выборка для
// сверок «заголовок безопасности ↔ что код реально делает»
// (permissions-policy и csp-allowlist): иначе у двух трипваеров разъедутся
// списки каталогов, и один из них ослепнет на новом дереве.
import { existsSync, readFileSync } from 'fs';
import { join, relative } from 'path';

import { collectSourceFiles } from '../security/collect-source-files';

export interface SourceText {
  /** Путь от корня репозитория. */
  path: string;
  text: string;
}

const ROOT = join(__dirname, '../..');

const TREES = [
  'webapp/src',
  'webapp/public',
  'shared/src',
  'schema-miniapp/src',
  'game/src',
];

const PAGES = ['webapp/index.html', 'schema-miniapp/index.html'];

const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.html'];

export function frontendSources(root: string = ROOT): SourceText[] {
  const files: string[] = [];
  for (const tree of TREES) {
    const dir = join(root, tree);
    if (existsSync(dir)) {
      files.push(...collectSourceFiles(dir, { extensions: EXTENSIONS }));
    }
  }
  for (const page of PAGES) files.push(join(root, page));
  return files.map((f) => ({
    path: relative(root, f),
    text: readFileSync(f, 'utf8'),
  }));
}
