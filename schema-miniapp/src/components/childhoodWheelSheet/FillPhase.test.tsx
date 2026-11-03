// @vitest-environment jsdom
// BACKLOG «Колесо детства»: ничего не тронув, человек сохранял 5/5/5/5/5 как
// свои оценки. Неоценённая потребность — «не оценено», кнопка недоступна,
// подсказка считает остаток; всё выставлено — кнопка работает.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FillPhase } from './FillPhase';
import { buildNeedMeta } from './needMeta';
import { defaultChildhoodRatings } from '../../../../shared/src/childhoodWheel/childhoodWheel';
import type { NeedId } from './types';

afterEach(cleanup);

function setup(unrated: NeedId[]) {
  const onSave = vi.fn();
  render(
    <FillPhase
      NEED_META={buildNeedMeta((ty) => ty)}
      ratings={defaultChildhoodRatings()}
      unrated={unrated}
      onRate={vi.fn()}
      openExampleId={null}
      setOpenExampleId={vi.fn()}
      openExampleIdx={null}
      setOpenExampleIdx={vi.fn()}
      saving={false}
      onSave={onSave}
    />,
  );
  return {
    onSave,
    button: screen.getByRole<HTMLButtonElement>('button', {
      name: 'Посмотреть результат',
    }),
  };
}

describe('FillPhase — сохранить можно, только когда выставлены все', () => {
  it('две не оценены: кнопка недоступна, подсказка «2 из 5», два «не оценено»', () => {
    const { button, onSave } = setup(['play', 'limits']);
    expect(button.disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toBe(
      'Ещё не оценено: 2 из 5',
    );
    expect(screen.getAllByText(/не оценено$/).length).toBe(2);
    fireEvent.click(button);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('контроль: все выставлены — кнопка доступна, подсказки нет', () => {
    const { button, onSave } = setup([]);
    expect(button.disabled).toBe(false);
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(button);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
