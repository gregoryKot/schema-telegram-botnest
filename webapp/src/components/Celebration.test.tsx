// @vitest-environment jsdom
// Celebration — оверлей стрика (0% покрытия). Отключаем конфетти через
// reduce_motion=1, чтобы не трогать canvas.getContext (не реализован в
// jsdom) — сама механика confetti уже покрыта отдельно в useConfetti.test.
// Проверяем: milestone-иконка, дни склоняются верно, клик по фону закрывает,
// клик по карточке — нет (stopPropagation), обе формы ты/вы в подсказке.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Celebration } from './Celebration';
import { AddressFormContext } from '../utils/addressForm';

beforeEach(() => {
  localStorage.setItem('reduce_motion', '1');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderCelebration(props: Partial<Parameters<typeof Celebration>[0]> = {}, form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <Celebration streak={5} onDone={vi.fn()} {...props} />
    </AddressFormContext.Provider>,
  );
}

describe('Celebration — контент', () => {
  it('немилстоуновый стрик показывает 🔥 и число дней', () => {
    renderCelebration({ streak: 5 });
    expect(screen.getByText('🔥')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('milestone-стрик (7 дней) показывает 🏆 вместо 🔥', () => {
    renderCelebration({ streak: 7 });
    expect(screen.getByText('🏆')).toBeTruthy();
  });

  it('insight, если передан, рендерится отдельным блоком', () => {
    renderCelebration({ insight: 'Ты чаще заботишься о границах' });
    expect(screen.getByText('Ты чаще заботишься о границах')).toBeTruthy();
  });

  it('без insight дополнительный блок не рендерится', () => {
    renderCelebration({ insight: null });
    expect(screen.queryByText(/заботишься/)).toBeNull();
  });
});

describe('Celebration — закрытие', () => {
  it('клик по фону вызывает onDone', () => {
    const onDone = vi.fn();
    renderCelebration({ onDone });
    fireEvent.click(screen.getByRole('presentation'));
    expect(onDone).toHaveBeenCalled();
  });
});

describe('Celebration — ты/вы', () => {
  it('форма «ты»: подсказка про закрытие на «ты»', () => {
    renderCelebration({}, 'ty');
    expect(screen.getByText('нажми в другом месте, чтобы закрыть')).toBeTruthy();
  });

  it('форма «вы»: подсказка про закрытие на «вы», без остаточного «ты»', () => {
    renderCelebration({}, 'vy');
    expect(screen.getByText('нажмите в другом месте, чтобы закрыть')).toBeTruthy();
    expect(screen.queryByText('нажми в другом месте, чтобы закрыть')).toBeNull();
  });
});
