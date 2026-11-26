// Сверка выжимок копинга (правило №4): у каждой схемы реестра три непустые выжимки, набор схем — как у
// полных текстов SCHEMA_COPING, выжимка короче полного текста.
import { describe, it, expect } from 'vitest';
import { SCHEMA_DOMAINS } from '../../content/schemaDomains';
import { COPING_STYLES } from '../copingStyles';
import { SCHEMA_COPING } from './coping';
import { SCHEMA_COPING_HEADLINES } from './copingHeadlines';

const schemaIds = SCHEMA_DOMAINS.flatMap((d) => d.schemas.map((s) => s.id));

describe('SCHEMA_COPING_HEADLINES', () => {
  it('набор схем — как у SCHEMA_COPING и реестра схем', () => {
    expect(Object.keys(SCHEMA_COPING_HEADLINES).sort()).toEqual(
      Object.keys(SCHEMA_COPING).sort(),
    );
    expect(Object.keys(SCHEMA_COPING_HEADLINES).sort()).toEqual(
      [...schemaIds].sort(),
    );
  });

  it('у каждой схемы три выжимки по 2–4 слова, короче полного текста', () => {
    for (const id of schemaIds) {
      const h =
        SCHEMA_COPING_HEADLINES[id as keyof typeof SCHEMA_COPING_HEADLINES];
      const full = SCHEMA_COPING[id as keyof typeof SCHEMA_COPING];
      for (const { id: style } of COPING_STYLES) {
        const words = h[style].split(/\s+/).filter((w) => /[а-яё]/i.test(w));
        expect(words.length, `${id}.${style}`).toBeGreaterThanOrEqual(1);
        expect(words.length, `${id}.${style}`).toBeLessThanOrEqual(5);
        expect(h[style].length, `${id}.${style}`).toBeLessThan(
          full[style].length,
        );
      }
    }
  });
});

describe('COPING_STYLES', () => {
  it('три стиля в порядке листа схемы, у каждого свой знак и свой цвет', () => {
    expect(COPING_STYLES.map((s) => s.id)).toEqual([
      'surrender',
      'avoidance',
      'overcompensation',
    ]);
    expect(new Set(COPING_STYLES.map((s) => s.sign)).size).toBe(3);
    expect(new Set(COPING_STYLES.map((s) => s.color)).size).toBe(3);
  });
});
