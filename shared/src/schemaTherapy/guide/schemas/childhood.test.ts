import { describe, expect, it } from 'vitest';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { buildSchemaGuides } from '../index';
import { SCHEMA_CHILDHOOD } from './childhood';
import { SCHEMA_CHILDHOOD_C } from './childhoodCambridgeC';

const guides = buildSchemaGuides((t) => t);

describe('вопросы о детстве по схемам', () => {
  it('есть у каждой схемы сайта и нет лишних id', () => {
    const ids = SCHEMA_DOMAINS.flatMap((d) =>
      d.schemas.map((s) => s.id),
    ).sort();
    expect(Object.keys(SCHEMA_CHILDHOOD).sort()).toEqual(ids);
  });

  it('лист схемы получает их пунктом «Подробнее», досбор идёт следом', () => {
    for (const g of guides) {
      const extra = SCHEMA_CHILDHOOD_C[g.schemaId]?.length ?? 0;
      expect(g.more?.at(-1 - extra), g.schemaId).toBe(
        SCHEMA_CHILDHOOD[g.schemaId],
      );
      if (extra)
        expect(g.more?.at(-1)).toBe(SCHEMA_CHILDHOOD_C[g.schemaId].at(-1));
    }
  });

  it('ссылка на приложение попадает в источники только при «прил.» в тексте', () => {
    const vy = guides.find((g) => g.schemaId === 'abandonment');
    const neg = guides.find((g) => g.schemaId === 'negativity');
    expect(vy?.sources).toMatch(/\[Кембридж, прил\.\]$/);
    expect(neg?.sources).not.toContain('прил.');
  });
});
