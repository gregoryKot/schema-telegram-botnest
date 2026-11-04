import { describe, it, expect, vi } from 'vitest';
import { openTaskRoute } from './openTaskRoute';
import { taskRoute } from '../../../../shared/src/tasks/taskRoute';

function targets() {
  return {
    overlays: {
      show: vi.fn(),
      setIntroSchemaId: vi.fn(),
      setIntroModeId: vi.fn(),
    },
    onOpenDiaries: vi.fn(),
    onOpenTracker: vi.fn(),
    onOpenChildhoodWheel: vi.fn(),
    onOpenYsq: vi.fn(),
  };
}
const open = (type: string, text = '') => {
  const t = targets();
  openTaskRoute(taskRoute({ type, text }), t);
  return t;
};

describe('openTaskRoute — задание «Помощи» мини-аппа открывает своё', () => {
  // QA 2026-11, К1: запрос терапевта пройти тест — задание ysq_test.
  it('«Пройти тест на схемы» от терапевта открывает тест', () => {
    const t = open('ysq_test', 'Пройти тест на схемы');
    expect(t.onOpenYsq).toHaveBeenCalledTimes(1);
    expect(t.overlays.show).not.toHaveBeenCalled();
  });

  it('упражнение — свой оверлей, серии — дневник и трекер', () => {
    expect(open('safe_place').overlays.show).toHaveBeenCalledWith('safePlace');
    expect(open('diary_streak').onOpenDiaries).toHaveBeenCalledTimes(1);
    expect(open('tracker_streak').onOpenTracker).toHaveBeenCalledTimes(1);
  });

  it('карточка схемы — с id; «Своё задание» не открывает ничего', () => {
    const schema = open('schema_intro', 'abandonment');
    expect(schema.overlays.setIntroSchemaId).toHaveBeenCalledWith(
      'abandonment',
    );
    const self = open('custom', 'позвонить другу');
    expect(self.overlays.show).not.toHaveBeenCalled();
    expect(self.onOpenYsq).not.toHaveBeenCalled();
  });
});
