// Security-трипваер: XSS через сырой HTML во фронтендах (security-таск
// 2026-07-17). Терапевтический продукт хранит свободный текст пользователя
// (дневники, заметки, письма). Если такой текст отрендерить через
// dangerouslySetInnerHTML/innerHTML без санитайза — stored XSS: чужой
// «дневник» исполняет скрипт в браузере терапевта/пользователя.
// Инвариант: dangerouslySetInnerHTML — только в allowlist и только с
// DOMPurify-санитайзом; прямого innerHTML-присваивания нет вовсе.
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// Корни обоих фронтендов относительно webapp/src/security/.
const ROOTS = [
  join(__dirname, '..'), // webapp/src
  join(__dirname, '../../../schema-miniapp/src'), // schema-miniapp/src
];

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const FILES = ROOTS.flatMap(walk);

// Единственное осознанное использование: рендер статьи (админский контент),
// прогнанный через DOMPurify.sanitize. Ключ — суффикс пути.
const DSIH_ALLOWLIST = ['pages/ArticlesPage.tsx'];

describe('XSS-трипваер по обоим фронтендам', () => {
  it('dangerouslySetInnerHTML — только в allowlist', () => {
    const users = FILES.filter((f) =>
      readFileSync(f, 'utf8').includes('dangerouslySetInnerHTML'),
    ).map((f) => f.replace(/\\/g, '/'));
    const offenders = users.filter(
      (f) => !DSIH_ALLOWLIST.some((allowed) => f.endsWith(allowed)),
    );
    expect(offenders).toEqual([]);
  });

  it('allowlisted-файлы санитайзят через DOMPurify перед вставкой', () => {
    for (const allowed of DSIH_ALLOWLIST) {
      const file = FILES.find((f) => f.replace(/\\/g, '/').endsWith(allowed));
      expect(file).toBeDefined();
      const src = readFileSync(file!, 'utf8');
      expect(src).toMatch(/DOMPurify\.sanitize/);
    }
  });

  it('нет прямого присваивания .innerHTML (обход React)', () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (line.trimStart().startsWith('//')) return;
          // `.innerHTML =` (присваивание), но не `.innerHTML` в чтении/сравнении
          if (/\.innerHTML\s*=[^=]/.test(line))
            offenders.push(`${f.split('/src/')[1]}:${i + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it('allowlist не разросся (может только сокращаться)', () => {
    expect(DSIH_ALLOWLIST.length).toBeLessThanOrEqual(1);
  });
});
