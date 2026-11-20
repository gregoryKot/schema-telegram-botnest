// Сторожа адресов справочника (#1484): каждый адрес находит текст, каждый вид
// статьи даёт адреса, известный адрес не пропадает без строки в реестре переименований.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import type { Tr } from '../types';
import {
  GUIDE_ADDRESS_RENAMES,
  GUIDE_ARTICLE_KINDS,
  addressTarget,
  formatAddress,
  listAddresses,
  normalizeAddress,
  parseAddress,
  resolveAddress,
} from './index';
import { SECTION_TITLES } from './addressTitles';

const BASELINE = fileURLToPath(
  new URL('../../../../../scripts/guide-addresses-baseline.json', import.meta.url),
);
const UPDATE =
  'UPDATE_GUIDE_ADDRESSES=1 npx vitest run src/schemaTherapy/guide/address (в shared/)';
const ty: Tr = (t) => t;

describe('адреса разделов справочника', () => {
  const all = listAddresses();

  it('адреса уникальны, каждый находит непустой текст в обеих формах обращения', () => {
    expect(new Set(all).size).toBe(all.length);
    for (const a of all) {
      expect(resolveAddress(a)?.text.trim(), a).toBeTruthy();
      expect(resolveAddress(a, ty)?.text.trim(), a).toBeTruthy();
    }
  });

  it.each(GUIDE_ARTICLE_KINDS)(
    'вид «%s» перечисляет адреса, у каждого раздела есть заголовок',
    (kind) => {
      const own = listAddresses(kind);
      expect(own.length).toBeGreaterThan(0);
      for (const a of own) {
        const parts = parseAddress(a);
        expect(parts?.kind).toBe(kind);
        expect(
          SECTION_TITLES[kind][parts?.path ?? ''],
          `${a}: заголовок раздела — в addressTitles.ts`,
        ).toBeTruthy();
      }
    },
  );

  it('копинг схемы адресуется тремя стилями', () => {
    const r = resolveAddress('schema:subjugation/coping.surrender');
    expect(r).toMatchObject({
      kind: 'schema',
      articleId: 'subjugation',
      sectionTitle: 'Капитуляция',
    });
    expect(listAddresses('schema')).toEqual(
      expect.arrayContaining([
        'schema:subjugation/coping.avoidance',
        'schema:subjugation/coping.overcompensation',
      ]),
    );
  });

  it('известный адрес не пропадает без строки «старый → новый» в addressRenames.ts', () => {
    const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<
      string,
      string
    >;
    const current = new Set(all);
    const lost = Object.keys(baseline).filter(
      (a) => !current.has(normalizeAddress(a)),
    );
    expect(
      lost,
      `Адрес пропал: строка в GUIDE_ADDRESS_RENAMES (старый → новый), иначе отметки клиентов теряются`,
    ).toEqual([]);
    const fresh = all.filter((a) => !(a in baseline));
    if (fresh.length > 0 && process.env.UPDATE_GUIDE_ADDRESSES) {
      const next = {
        ...baseline,
        ...Object.fromEntries(
          fresh.map((a) => [a, resolveAddress(a)?.sectionTitle ?? '']),
        ),
      };
      const sorted = Object.fromEntries(
        Object.entries(next).sort(([x], [y]) => x.localeCompare(y)),
      );
      writeFileSync(BASELINE, `${JSON.stringify(sorted, null, 2)}\n`);
      return;
    }
    expect(fresh, `Новые адреса — допиши в бейслайн: ${UPDATE}`).toEqual([]);
  });

  it('цель каждой строки реестра существует', () => {
    for (const [from, to] of Object.entries(GUIDE_ADDRESS_RENAMES)) {
      if (!from.includes('*'))
        expect(resolveAddress(to), `${from} → ${to}`).not.toBeNull();
    }
  });
});

describe('parse/format и реестр переименований', () => {
  it('parse и format обратимы на всех адресах', () => {
    for (const a of listAddresses()) {
      const parts = parseAddress(a);
      expect(parts, a).not.toBeNull();
      expect(formatAddress(parts!)).toBe(a);
    }
  });

  it('чужая строка — не адрес', () => {
    for (const bad of [
      '',
      'schema:x',
      'need:x/what',
      'schema:x/',
      'schema:x/1a',
      'schema:x/a..b',
      'schema:/a',
    ]) {
      expect(parseAddress(bad), bad).toBeNull();
    }
  });

  it('нормализация идёт по цепочке и по полю у всех статей вида', () => {
    const renames = {
      'mode:a/x': 'mode:a/y',
      'mode:a/y': 'mode:a/z',
      'technique:*/when': 'technique:*/whenToUse',
    };
    expect(normalizeAddress('mode:a/x', renames)).toBe('mode:a/z');
    expect(normalizeAddress('technique:chairwork/when', renames)).toBe(
      'technique:chairwork/whenToUse',
    );
    expect(normalizeAddress('note:q/points', renames)).toBe('note:q/points');
    expect(
      normalizeAddress('mode:a/x', {
        'mode:a/x': 'mode:a/y',
        'mode:a/y': 'mode:a/x',
      }),
    ).toMatch(/^mode:a\/[xy]$/);
  });
});

describe('таблица смыслов адреса', () => {
  it('копинг схемы → schemaLinks, остальное → guideMark', () => {
    expect(addressTarget('schema:subjugation/coping.surrender')).toBe(
      'schemaLinks',
    );
    expect(addressTarget('schema:subjugation/need')).toBe('guideMark');
    expect(addressTarget('mode:vulnerable_child/experiential')).toBe(
      'guideMark',
    );
    expect(addressTarget('technique:chairwork/when')).toBe('guideMark');
    expect(addressTarget('мусор')).toBe('guideMark');
  });

  it('все адреса копинга и только они идут в schemaLinks', () => {
    for (const a of listAddresses()) {
      expect(addressTarget(a), a).toBe(
        /^schema:[^/]+\/coping\./.test(a) ? 'schemaLinks' : 'guideMark',
      );
    }
  });
});
