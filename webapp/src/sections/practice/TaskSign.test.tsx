// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskSign } from './TaskSign';
import { taskEntity } from './taskEntity';
import { SignArt } from '../../components/art/SignArt';
import { ENTITY_LOOK, type SignKey } from '../../../../shared/src/theme/entityLook';

afterEach(cleanup);
const html = (type: string, text = '') => {
  const { container, unmount } = render(<TaskSign task={{ type, text } as never} />);
  const s = container.innerHTML;
  unmount();
  return s;
};

describe('TaskSign', () => {
  it('рисует знак для каждого типа', () => {
    for (const t of ['tracker_streak', 'diary_streak', 'childhood_wheel', 'schema_intro', 'mode_intro', 'custom', 'flashcard']) {
      expect(html(t), t).toContain('pp-art--row');
    }
  });
  it('знак зависит от маршрута: трекер, дневник, колесо, схема, режим и «сделано» различаются', () => {
    const set = new Set([
      html('tracker_streak'), html('diary_streak'), html('childhood_wheel'),
      html('schema_intro'), html('mode_intro'), html('custom'),
    ]);
    expect(set.size).toBe(6);
  });
  it('одинаковые маршруты — один знак: дневник схем = дневник, тест = слои', () => {
    expect(html('schema_diary')).toBe(html('diary_streak'));
    expect(html('ysq_test')).toBe(html('schema_intro'));
  });
  // b20 (ревью g4 r3): местный switch рисовал Check письму, безопасному месту, убеждению и «Мне плохо» — четыре
  // галочки подряд на «Практиках». Знак — из ENTITY_LOOK по сущности маршрута: у упражнений свой, Check — только своё.
  it('знак упражнения — его сущности из ENTITY_LOOK, а не «сделано»', () => {
    const sign = (key: SignKey) => {
      const { container, unmount } = render(<SignArt sign={key} size="row" />);
      const s = container.innerHTML;
      unmount();
      return s;
    };
    const cases: [string, SignKey][] = [
      ['belief_check', 'scales'], ['letter_to_self', 'sheets'], ['safe_place', 'haven'], ['flashcard', 'heart'],
      ['childhood_wheel', 'wheel'], ['custom', 'check'],
    ];
    for (const [type, key] of cases) {
      expect(ENTITY_LOOK[taskEntity({ type, text: '' })].sign, type).toBe(key);
      expect(html(type), type).toBe(sign(key));
    }
    expect(new Set(cases.map(([t]) => html(t))).size).toBe(cases.length);
  });
});
