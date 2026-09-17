// @vitest-environment jsdom
// Колесо потребностей жило копией в обоих фронтендах (webapp — инлайном в
// HistoryView) — сведено в shared. Тест держит вычисления: средний индекс в
// центре, стрелка сравнения со вчера, контур «колеса детства», клик-зоны.
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { NeedsWheel } from './NeedsWheel';
import type { Need } from '../types';

const needs: Need[] = [
  { id: 'safety', name: 'Безопасность', emoji: '🛡' },
  { id: 'autonomy', name: 'Автономия', emoji: '🕊' },
] as Need[];

describe('NeedsWheel', () => {
  it('центр показывает средний индекс по оценкам', () => {
    const { container } = render(
      <NeedsWheel needs={needs} ratings={{ safety: 8, autonomy: 4 }} />,
    );
    expect(container.textContent).toContain('6.0');
    expect(container.textContent).toContain('индекс');
  });

  it('prevRatings рисует сравнение со вчера (↑/↓)', () => {
    const { container } = render(
      <NeedsWheel
        needs={needs}
        ratings={{ safety: 8, autonomy: 8 }}
        prevRatings={{ safety: 4, autonomy: 4 }}
      />,
    );
    expect(container.textContent).toContain('↑ вчера 4.0');
  });

  it('без prevRatings строки «вчера» нет', () => {
    const { container } = render(
      <NeedsWheel needs={needs} ratings={{ safety: 5, autonomy: 5 }} />,
    );
    expect(container.textContent).not.toContain('вчера');
  });

  it('вчера всё по нулям (prevAvg=0) — сравнение тоже скрыто', () => {
    const { container } = render(
      <NeedsWheel
        needs={needs}
        ratings={{ safety: 5, autonomy: 5 }}
        prevRatings={{ safety: 0, autonomy: 0 }}
      />,
    );
    expect(container.textContent).not.toContain('вчера');
  });

  it('childhoodRatings добавляет пунктирный контур (stroke-dasharray)', () => {
    const { container } = render(
      <NeedsWheel
        needs={needs}
        ratings={{ safety: 5, autonomy: 5 }}
        childhoodRatings={{ safety: 9 }}
      />,
    );
    expect(container.querySelector('[stroke-dasharray]')).toBeTruthy();
  });

  it('нулевые оценки — лепестки не рисуются (petalPath даёт пустой путь)', () => {
    const { container } = render(<NeedsWheel needs={needs} ratings={{}} />);
    // залитых лепестков нет: у всех value=0 → r<1 → d='' → null-ветка
    expect(container.textContent).toContain('0.0');
    expect(container.querySelectorAll('path[fill-opacity]').length).toBe(0);
  });

  it('потребность без цвета в реестре красится фолбэком #888', () => {
    const alien = [{ id: 'unknown_need', name: 'X', emoji: '❓' }] as Need[];
    const { container } = render(
      <NeedsWheel needs={alien} ratings={{ unknown_need: 9 }} />,
    );
    expect(container.querySelector('path[fill="#888"]')).toBeTruthy();
  });

  it('onClickNeed и onClickCenter зовутся по клик-зонам', () => {
    const onClickNeed = vi.fn();
    const onClickCenter = vi.fn();
    const { container } = render(
      <NeedsWheel
        needs={needs}
        ratings={{ safety: 5, autonomy: 5 }}
        onClickNeed={onClickNeed}
        onClickCenter={onClickCenter}
      />,
    );
    const hits = container.querySelectorAll('path[fill="transparent"]');
    fireEvent.click(hits[0]);
    expect(onClickNeed).toHaveBeenCalledWith(needs[0]);
    fireEvent.click(container.querySelector('circle[fill="transparent"]')!);
    expect(onClickCenter).toHaveBeenCalled();
  });
});
