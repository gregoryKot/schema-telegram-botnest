// Правило №4: списки кнопок и источников страницы ссылок на сайте
// (shared/src/analytics/linksPage.ts) и на сервере обязаны совпадать — иначе
// сервер молча отбрасывает клик. Бэкенд shared/ не импортирует: исходник
// транспилируется и исполняется как есть (приём launch-platforms.sync.spec.ts).
import { readFileSync } from 'fs';
import { join } from 'path';
import { runInNewContext } from 'vm';
import * as ts from 'typescript';
import {
  LINKS_PAGE_EVENTS,
  LINKS_PAGE_FROM,
  LINKS_PAGE_SOURCES,
  LINKS_PAGE_TARGETS,
  sanitizeLinksPageMeta,
} from './links-page.constants';

type Site = {
  LINKS_PAGE_TARGETS: readonly string[];
  LINKS_PAGE_SOURCES: readonly string[];
  linksPageFrom: (search: string) => string;
};
function loadSite(): Site {
  const path = join(__dirname, '../../shared/src/analytics/linksPage.ts');
  const js = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} as Site };
  runInNewContext(js, { module: mod, exports: mod.exports, URLSearchParams });
  return mod.exports;
}
const site = loadSite();

describe('links-page ↔ shared/src/analytics/linksPage.ts', () => {
  it('списки кнопок и источников совпадают', () => {
    expect([...site.LINKS_PAGE_TARGETS]).toEqual([...LINKS_PAGE_TARGETS]);
    expect([...site.LINKS_PAGE_SOURCES]).toEqual([...LINKS_PAGE_SOURCES]);
  });

  it.each(['?utm_source=max', '?utm_source=tiktok', ''])(
    'источник из адреса «%s» сервер принимает',
    (search) => {
      expect(LINKS_PAGE_FROM).toContain(site.linksPageFrom(search));
    },
  );

  it('имя события на сайте — то же, что в реестре', () => {
    const front = readFileSync(
      join(__dirname, '../../shared/src/share/analytics.ts'),
      'utf8',
    );
    expect(front).toContain(
      `LINKS_PAGE_CLICK_EVENT = '${LINKS_PAGE_EVENTS[0]}'`,
    );
  });
});

describe('sanitizeLinksPageMeta', () => {
  it('известные target и from проходят, лишние поля отрезаются', () => {
    expect(
      sanitizeLinksPageMeta({ target: 'booking', from: 'telegram', x: 1 }),
    ).toEqual({ target: 'booking', from: 'telegram' });
    expect(sanitizeLinksPageMeta({ target: 'write', from: 'direct' })).toEqual({
      target: 'write',
      from: 'direct',
    });
  });

  it.each([
    undefined,
    {},
    { target: 'booking' },
    { target: 'unknown', from: 'telegram' },
    { target: 'booking', from: 'facebook' },
    { target: 5, from: 'direct' },
  ])('неизвестное отбрасывается целиком: %p', (meta) => {
    expect(
      sanitizeLinksPageMeta(meta as Record<string, unknown> | undefined),
    ).toBeNull();
  });
});
