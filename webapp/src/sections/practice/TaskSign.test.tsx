// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskSign } from './TaskSign';

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
  // ENTITY_LOOK, строка «Цель, задание»: у упражнения — знак своей сущности, как у клиента в «Практиках»
  // (b31: терапевт и клиент говорят одними знаками), а не «сделано».
  it('упражнение — знак своей сущности: убеждение, письмо, безопасное место, «Мне плохо» различаются и не «сделано»', () => {
    const ex = ['belief_check', 'letter_to_self', 'safe_place', 'flashcard'].map((t) => html(t));
    expect(new Set(ex).size).toBe(4);
    for (const s of ex) expect(s).not.toBe(html('custom'));
  });
});
