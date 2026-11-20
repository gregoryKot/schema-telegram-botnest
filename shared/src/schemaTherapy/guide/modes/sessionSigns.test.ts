// Табл. 3.3 Кембриджа: пункт «Как узнать на сессии» доходит до раздела режима, ловушки — в «Где застревают».
import { describe, it, expect } from 'vitest';
import { buildModeGuides } from '../index';
import { SESSION_SIGN_MODE_IDS } from './sessionSigns';
import type { Tr } from '../types';

const ty: Tr = (t) => t;
const REF = '[Кембридж, табл. 3.3]';

describe('режимы по табл. 3.3', () => {
  const guides = buildModeGuides(ty);

  it.each(SESSION_SIGN_MODE_IDS)(
    '%s: пункт последним в «Подробнее» и ловушки в stuck',
    (id) => {
      const g = guides.find((x) => x.modeId === id);
      expect(g, id).toBeDefined();
      expect(g!.more?.at(-1)).toContain(REF);
      expect(g!.stuck).toMatch(/Кембридж, табл\. 3\.3\]/);
      expect(g!.sources).toContain('табл. 3.3');
    },
  );

  it('режим без строки таблицы остаётся как был', () => {
    const g = guides.find((x) => x.modeId === 'bully_attack')!;
    expect((g.more ?? []).join(' ')).not.toContain(REF);
  });
});
