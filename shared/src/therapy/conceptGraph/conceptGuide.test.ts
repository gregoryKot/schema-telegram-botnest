// Сборка раздела режима для плашки и листов (#995): техники приходят из
// библиотеки в порядке раздела, неизвестная пропускается, у режима без раздела
// — null. Тексты — фикстура, тест не зависит от guide/modes|techniques.
import { describe, it, expect } from 'vitest';
import { FIXTURE_GUIDE, FIXTURE_TECHNIQUES } from './conceptGuide.fixture';
import { resolveModeGuide } from './conceptGuide';

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
