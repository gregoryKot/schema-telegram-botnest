import { describe, it, expect } from 'vitest';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import {
  rankExpressed, groupMap, countSchemas, domainCountLabel, needLevel,
  shortName, readLocalIds, findSchema, schemasWord, domainsWord,
} from './schemasModel';

const [a, b, c] = SCHEMA_DOMAINS[0].schemas;

describe('rankExpressed', () => {
  it('сортирует по среднему баллу, затем по доле 5+', () => {
    const r = rankExpressed(SCHEMA_DOMAINS, [a.id, b.id, c.id], {
      [a.id]: { avg: 3, pct5plus: 10 },
      [b.id]: { avg: 5, pct5plus: 40 },
      [c.id]: { avg: 3, pct5plus: 30 },
    });
    expect(r.map(x => x.id)).toEqual([b.id, c.id, a.id]);
  });
  it('без баллов сохраняет порядок профиля, бар 0, подпись «–»', () => {
    const r = rankExpressed(SCHEMA_DOMAINS, [b.id, a.id], {});
    expect(r.map(x => x.id)).toEqual([b.id, a.id]);
    expect(r[0]).toMatchObject({ barPct: 0, valueLabel: '–' });
  });
  it('бар по среднему (1–6), подпись avg/6, запасной вариант — процент', () => {
    const r = rankExpressed(SCHEMA_DOMAINS, [a.id, b.id], {
      [a.id]: { avg: 4.5, pct5plus: 80 },
      [b.id]: { avg: 0, pct5plus: 25 },
    });
    expect(r[0]).toMatchObject({ id: a.id, barPct: 70, valueLabel: '4.5/6' });
    expect(r[1]).toMatchObject({ id: b.id, barPct: 0, valueLabel: '25%' });
  });
  it('неизвестные id отбрасываются, оттенок — домена', () => {
    const r = rankExpressed(SCHEMA_DOMAINS, ['nope', a.id], {});
    expect(r).toHaveLength(1);
    expect(r[0].hue).toBe(28);
  });
});

describe('groupMap', () => {
  it('число схем берётся из данных, а отмеченные помечаются', () => {
    const g = groupMap(SCHEMA_DOMAINS, [a.id]);
    expect(g).toHaveLength(SCHEMA_DOMAINS.length);
    expect(g.reduce((n, d) => n + d.total, 0)).toBe(countSchemas(SCHEMA_DOMAINS));
    expect(g[0].activeCount).toBe(1);
    expect(g[0].schemas.find(s => s.id === a.id)?.isMine).toBe(true);
    expect(g[1].activeCount).toBe(0);
  });
  it('подпись домена', () => {
    expect(domainCountLabel({ total: 4, activeCount: 0 })).toBe('4 схемы');
    expect(domainCountLabel({ total: 5, activeCount: 0 })).toBe('5 схем');
    expect(domainCountLabel({ total: 4, activeCount: 2 })).toBe('2 из 4 отмечены');
  });
});

describe('мелочи', () => {
  it('needLevel', () => {
    expect([needLevel(2), needLevel(3), needLevel(5), needLevel(7)]).toEqual(['err', 'err', 'warn', 'ok']);
  });
  it('shortName', () => {
    expect(shortName('Эмоциональная депривация')).toBe('Эмоц. депривация');
    expect(shortName('Покинутость / Нестабильность')).toBe('Покинутость');
  });
  it('readLocalIds терпит мусор', () => {
    expect(readLocalIds('["a",1,"b"]')).toEqual(['a', 'b']);
    expect(readLocalIds('{oops')).toEqual([]);
    expect(readLocalIds(null)).toEqual([]);
  });
  it('findSchema и плюрализация', () => {
    expect(findSchema(SCHEMA_DOMAINS, a.id)?.domain.id).toBe('rejection');
    expect(findSchema(SCHEMA_DOMAINS, 'x')).toBeNull();
    expect(domainsWord(5)).toBe('доменов');
    expect(schemasWord(21)).toBe('схема');
  });
});
