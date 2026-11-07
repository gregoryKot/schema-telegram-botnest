// Сборка раздела режима и схемы для плашки и листов (#995): техники приходят
// из библиотеки в порядке раздела, неизвестная пропускается, без раздела —
// null. Тексты — фикстура, тест не зависит от guide/modes|schemas|techniques.
import { describe, it, expect } from 'vitest';
import {
  FIXTURE_DOMAIN_NOTE,
  FIXTURE_GUIDE,
  FIXTURE_SCHEMA_GUIDE,
  FIXTURE_TECHNIQUES,
} from './conceptGuide.fixture';
import { resolveModeGuide, resolveSchemaGuide } from './conceptGuide';

const texts = {
  modeGuide: (_tr: unknown, modeId: string) =>
    modeId === 'vulnerable_child'
      ? {
          ...FIXTURE_GUIDE,
          techniques: [
            'chairwork' as const,
            'mindfulness' as const,
            'imagery_rescripting' as const,
          ],
        }
      : null,
  buildTechniqueGuides: () => FIXTURE_TECHNIQUES,
};
const ty = (t: string) => t;

describe('resolveModeGuide', () => {
  it('техники — из библиотеки в порядке раздела, id без статьи пропускается', () => {
    const view = resolveModeGuide(texts, ty, 'vulnerable_child');
    expect(view?.guide.goal).toBe(FIXTURE_GUIDE.goal);
    expect(view?.techniques.map((t) => t.id)).toEqual([
      'chairwork',
      'imagery_rescripting',
    ]);
  });

  it('свой режим терапевта раздела не имеет — null, плашка покажет строку группы', () => {
    expect(resolveModeGuide(texts, ty, 'custom_mode_xyz')).toBeNull();
  });
});

describe('resolveSchemaGuide', () => {
  const schemaTexts = {
    schemaGuide: (_tr: unknown, id: string) =>
      id === 'abandonment'
        ? {
            guide: {
              ...FIXTURE_SCHEMA_GUIDE,
              techniques: [
                'imagery_rescripting' as const,
                'flashcards' as const,
                'chairwork' as const,
              ],
            },
            domainNote: FIXTURE_DOMAIN_NOTE,
          }
        : null,
    buildTechniqueGuides: () => FIXTURE_TECHNIQUES,
  };

  it('раздел схемы с «общим для домена»; техники из библиотеки в порядке раздела', () => {
    const view = resolveSchemaGuide(schemaTexts, ty, 'abandonment');
    expect(view?.guide.goal).toBe(FIXTURE_SCHEMA_GUIDE.goal);
    expect(view?.domainNote).toBe(FIXTURE_DOMAIN_NOTE);
    expect(view?.techniques.map((t) => t.id)).toEqual([
      'imagery_rescripting',
      'chairwork',
    ]);
  });

  it('схема без раздела — null, плашки нет', () => {
    expect(
      resolveSchemaGuide(schemaTexts, ty, 'emotional_deprivation'),
    ).toBeNull();
  });
});
