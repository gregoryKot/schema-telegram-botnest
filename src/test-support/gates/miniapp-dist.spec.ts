// Инварианты собранного schema-miniapp/dist (он коммитится в git, поэтому
// проверяем прямо коммит — CI отдельно следит, что dist не разошёлся с
// исходником, джоба `miniapp`).
//
// Оба инварианта ломаются молча — ни один тест и ни один гейт их не заметит,
// а последствия дорогие:
//
//  1. Контент-хеш в имени ассета. Пока dist в git, хешированное имя означает,
//     что у каждой пары параллельных PR имя файла расходится, и git ловит
//     rename/rename — конфликт, который merge-драйвер miniapp-dist починить
//     не может (он сводит содержимое, а не переименования). Со стабильными
//     именами dist/index.html вообще не меняется от сборки к сборке.
//  2. `revision: null` в прекэше service worker'а. Так workbox помечает файлы,
//     чьё имя само себе версия. У нас имена стабильные, поэтому null означал
//     бы «этот бандл неизменяем» — пользователь PWA навсегда остался бы на
//     той версии, которую скачал первой. Проверено вживую: с дефолтным
//     dontCacheBustURLsMatching workbox писал сюда именно null.
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DIST = join(__dirname, '..', '..', '..', 'schema-miniapp', 'dist');

describe('schema-miniapp/dist: инварианты закоммиченной сборки', () => {
  it('имена ассетов без контент-хеша — index.html стабилен между сборками', () => {
    const assets = readdirSync(join(DIST, 'assets'));
    expect(assets.length).toBeGreaterThan(0);
    // vite вставляет хеш как `index-BNPYjMxG.js` — дефис и 8+ символов
    // base64url перед расширением.
    const hashed = assets.filter((name) =>
      /-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(name),
    );
    expect(hashed).toEqual([]);
  });

  it('у каждой записи прекэша есть revision — SW обновляет бандл', () => {
    const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
    const match = sw.match(/\[\{[^\]]*"url"[^\]]*\}\]/);
    expect(match).not.toBeNull();

    const entries = JSON.parse(match![0]) as Array<{
      url: string;
      revision: string | null;
    }>;
    expect(entries.length).toBeGreaterThan(0);

    const withoutRevision = entries
      .filter((e) => e.revision === null)
      .map((e) => e.url);
    expect(withoutRevision).toEqual([]);
  });
});
