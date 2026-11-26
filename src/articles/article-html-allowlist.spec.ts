// Правило №4: allowlist серверного санитайзера статьи
// (article-html-allowlist.ts) обязан совпадать с allowlist'ом DOMPurify на
// клиенте (webapp/src/pages/ArticlesPage.tsx). Бэкенд не импортирует webapp,
// поэтому сверка — по тексту файла: тег, добавленный на одной стороне без
// другой, роняет jest.
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ARTICLE_ALLOWED_ATTR,
  ARTICLE_ALLOWED_TAGS,
} from './article-html-allowlist';

const CLIENT = join(__dirname, '../../webapp/src/pages/ArticlesPage.tsx');

/** Строковые литералы массива `KEY: [ … ]` из исходника клиента. */
function clientList(src: string, key: string): string[] {
  const m = new RegExp(`${key}:\\s*\\[([\\s\\S]*?)\\]`).exec(src);
  if (!m) throw new Error(`${key} не найден в ArticlesPage.tsx`);
  const body = m[1].replace(/\/\/.*$/gm, '');
  return [...body.matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

describe('allowlist статьи: сервер ↔ клиент (DOMPurify)', () => {
  const src = readFileSync(CLIENT, 'utf8');

  it('ALLOWED_TAGS совпадает', () => {
    expect([...ARTICLE_ALLOWED_TAGS].sort()).toEqual(
      clientList(src, 'ALLOWED_TAGS').sort(),
    );
  });

  it('ALLOWED_ATTR совпадает', () => {
    expect([...ARTICLE_ALLOWED_ATTR].sort()).toEqual(
      clientList(src, 'ALLOWED_ATTR').sort(),
    );
  });

  it('контроль: сверка видит расхождение (лишний тег на клиенте)', () => {
    const drifted = src.replace("'h2', 'h3',", "'h2', 'h3', 'iframe',");
    expect(drifted).not.toBe(src);
    expect(clientList(drifted, 'ALLOWED_TAGS')).toContain('iframe');
    expect([...ARTICLE_ALLOWED_TAGS]).not.toContain('iframe');
  });
});
