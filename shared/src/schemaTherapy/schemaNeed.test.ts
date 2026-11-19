// Связка схема → домен → потребность: пять доменов на пять потребностей, вместе — все 20 схем по разу.
// Сверку с needId теста на схемы держит ysqSchemas.test.ts.
import { describe, it, expect } from 'vitest';
import { NEED_ORDER } from '../needs/types';
import { DOMAIN_HUE, NEED_HUE } from '../theme/entityHue';
import { SCHEMA_DOMAINS } from './content/schemaDomains';
import { domainNeedId, needDomain } from './schemaNeed';

describe('domainNeedId', () => {
  it('каждый домен — своя потребность того же оттенка, все пять разные', () => {
    const needs = Object.keys(DOMAIN_HUE).map((d) => domainNeedId(d));
    expect(new Set(needs).size).toBe(5);
    for (const d of Object.keys(DOMAIN_HUE)) {
      const n = domainNeedId(d);
      expect(n && NEED_ORDER.includes(n)).toBeTruthy();
      expect(NEED_HUE[n!]).toBe(DOMAIN_HUE[d]);
    }
    expect(domainNeedId('rejection')).toBe('attachment');
    expect(domainNeedId('other_directed')).toBe('expression');
    expect(domainNeedId('vigilance')).toBe('play');
  });

  it('нет домена или неизвестный — без потребности', () => {
    expect(domainNeedId(null)).toBeNull();
    expect(domainNeedId('nope')).toBeNull();
  });
});

describe('needDomain', () => {
  it('у каждой потребности один домен, вместе они покрывают все 20 схем по разу', () => {
    const ids = NEED_ORDER.flatMap((n) =>
      needDomain(n)!.schemas.map((s) => s.id),
    );
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
    expect(new Set(ids)).toEqual(
      new Set(SCHEMA_DOMAINS.flatMap((d) => d.schemas.map((s) => s.id))),
    );
  });

  it('«Выражение чувств» — только «Направленность на других», без сверхбдительности', () => {
    expect(needDomain('expression')?.id).toBe('other_directed');
    expect(needDomain('nope')).toBeUndefined();
  });
});
