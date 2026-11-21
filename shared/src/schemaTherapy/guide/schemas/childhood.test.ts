import { describe, expect, it } from 'vitest';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { buildSchemaGuides } from '../index';
import { SCHEMA_CHILDHOOD } from './childhood';

const guides = buildSchemaGuides((t) => t);

describe('вопросы о детстве по схемам', () => {
  it('есть у каждой схемы сайта и нет лишних id', () => {
    const ids = SCHEMA_DOMAINS.flatMap((d) =>
      d.schemas.map((s) => s.id),
    ).sort();
    expect(Object.keys(SCHEMA_CHILDHOOD).sort()).toEqual(ids);
  });

  it('лист схемы получает их последним пунктом «Подробнее»', () => {
    for (const g of guides)
      expect(g.more?.at(-1), g.schemaId).toBe(SCHEMA_CHILDHOOD[g.schemaId]);
  });

  it('ссылка на приложение попадает в источники только при «прил.» в тексте', () => {
    const vy = guides.find((g) => g.schemaId === 'abandonment');
    const neg = guides.find((g) => g.schemaId === 'negativity');
    expect(vy?.sources).toMatch(/\[Кембридж, прил\.\]$/);
    expect(neg?.sources).not.toContain('прил.');
  });
});
