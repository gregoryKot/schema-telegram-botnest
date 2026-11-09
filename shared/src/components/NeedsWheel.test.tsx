// @vitest-environment jsdom
// Колесо потребностей жило копией в обоих фронтендах (webapp — инлайном в
// HistoryView) — сведено в shared. Тест держит вычисления: средний индекс в
// центре, стрелка сравнения со вчера, контур «колеса детства», клик-зоны.
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { NeedsWheel } from './NeedsWheel';
import type { Need } from '../types';
import { NEED_COLORS } from '../needs/needColors';

const needs: Need[] = [
  { id: 'safety', name: 'Безопасность', emoji: '🛡' },
  { id: 'autonomy', name: 'Автономия', emoji: '🕊' },
] as Need[];

describe('NeedsWheel', () => {
  it('центр показывает средний индекс по оценкам', () => {
    const { container } = render(
      <NeedsWheel needs={needs} ratings={{ safety: 8, autonomy: 4 }} />,
    );
    expect(container.textContent).toContain('6,0');
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
    expect(container.textContent).toContain('↑ вчера 4,0');
  });

  it('без prevRatings строки «вчера» нет', () => {
    const { container } = render(
      <NeedsWheel needs={needs} ratings={{ safety: 5, autonomy: 5 }} />,
    );
    expect(container.textContent).not.toContain('вчера');
  });

  it('вчера всё по нулям (в истории 0 — «не заполнено») — сравнение скрыто', () => {
    const { container } = render(
      <NeedsWheel
        needs={needs}
        ratings={{ safety: 5, autonomy: 5 }}
        prevRatings={{ safety: 0, autonomy: 0 }}
      />,
    );
    expect(container.textContent).not.toContain('вчера');
  });

  // Редизайн 2026-11: контур детства — сплошная линия, пунктира в колесе нет.
  it('childhoodRatings добавляет контур детства — сплошной, без пунктира', () => {
    const { container } = render(
      <NeedsWheel
        needs={needs}
        ratings={{ safety: 5, autonomy: 5 }}
        childhoodRatings={{ safety: 9 }}
      />,
    );
    expect(
      container.querySelectorAll('[data-layer="childhood"] path').length,
    ).toBe(1);
    expect(container.querySelector('[stroke-dasharray]')).toBeNull();
  });

  it('без оценок детства контура нет', () => {
    const { container } = render(
      <NeedsWheel needs={needs} ratings={{ safety: 5 }} />,
    );
    expect(container.querySelector('[data-layer="childhood"]')).toBeNull();
  });

  it('нулевые оценки — лепестки не рисуются (petalPath даёт пустой путь)', () => {
    const { container } = render(<NeedsWheel needs={needs} ratings={{}} />);
    // залитых лепестков нет: у всех value=0 → r<1 → d='' → лепесток не рисуется
    expect(container.querySelectorAll('path[data-petal]').length).toBe(0);
  });

  // QA 2026-11 (B-З6): пустой день показывал «индекс 0.0 ↓ вчера 6.0».
  it('пустой день после заполненного — «—» в центре, без стрелки падения', () => {
    const { container } = render(
      <NeedsWheel
        needs={needs}
        ratings={{}}
        prevRatings={{ safety: 6, autonomy: 6 }}
      />,
    );
    expect(container.textContent).toContain('—');
    expect(container.textContent).not.toContain('0.0');
    expect(container.textContent).not.toContain('↓');
    expect(container.textContent).toContain('вчера 6,0');
  });

  // QA 2026-11 (B-З7): колесо красило потребности старой палитрой COLORS.
  it('цвет лепестка — из NEED_COLORS, как на остальных экранах', () => {
    const { container } = render(
      <NeedsWheel
        needs={[{ id: 'autonomy' } as Need]}
        ratings={{ autonomy: 9 }}
      />,
    );
    expect(
      container.querySelector(`path[fill="${NEED_COLORS.autonomy}"]`),
    ).toBeTruthy();
  });

  // Решение 7 (docs/design/APP_2026-11.md, «Палитра данных»): лепесток — цвет данных потребности.
  it('ink задаёт цвет лепестка по id потребности; лепесток длиннее при большей оценке', () => {
    const { container } = render(
      <NeedsWheel
        needs={needs}
        ratings={{ safety: 9, autonomy: 2 }}
        ink={{ safety: 'var(--c-clay)', autonomy: 'var(--c-amber-strong)' }}
      />,
    );
    const safety = container.querySelector('path[data-petal="safety"]')!;
    expect(safety.getAttribute('fill')).toBe('var(--c-clay)');
    expect(
      container
        .querySelector('path[data-petal="autonomy"]')!
        .getAttribute('fill'),
    ).toBe('var(--c-amber-strong)');
    // Длина лепестка — радиус дуги «A r r» в пути: у оценки 9 он больше, чем у 2.
    const arc = (el: Element) =>
      Number(/ A (\d+(?:\.\d+)?) /.exec(el.getAttribute('d')!)![1]);
    const low = render(
      <NeedsWheel needs={needs} ratings={{ safety: 2 }} />,
    ).container.querySelector('path[data-petal="safety"]')!;
    expect(arc(safety)).toBeGreaterThan(arc(low));
  });

  it('потребность без цвета в реестре красится запасным токеном --text-sub, а не hex-литералом', () => {
    const alien = [{ id: 'unknown_need', name: 'X', emoji: '❓' }] as Need[];
    const { container } = render(
      <NeedsWheel needs={alien} ratings={{ unknown_need: 9 }} />,
    );
    expect(
      container.querySelector('path[fill="var(--text-sub)"]'),
    ).toBeTruthy();
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
