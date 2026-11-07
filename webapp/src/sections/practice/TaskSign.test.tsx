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
  it('одинаковые маршруты — один знак: дневник схем = дневник, тест = слои, упражнение = «сделано»', () => {
    expect(html('schema_diary')).toBe(html('diary_streak'));
    expect(html('ysq_test')).toBe(html('schema_intro'));
    expect(html('belief_check')).toBe(html('custom'));
  });
});
