// @vitest-environment jsdom
// Карточка «Мой портрет» в профиле сайта: пустое состояние объясняет «откуда
// и зачем» и ведёт на тест; с данными — полосы по пяти потребностям, итог и
// дельта; вся карточка — одно действие, вложенная кнопка теста не открывает лист.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import { buildPortrait } from '../../../../shared/src/portrait/portraitData';
import { PortraitCard } from './PortraitCard';

afterEach(cleanup);

function renderCard(props: Partial<Parameters<typeof PortraitCard>[0]> = {}, form: 'ty' | 'vy' = 'ty') {
  const onOpenSheet = vi.fn();
  const onTakeTest = vi.fn();
  render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <PortraitCard portrait={buildPortrait({})} ysqCompletedAt={null} onOpenSheet={onOpenSheet} onTakeTest={onTakeTest} {...props} />
    </AddressFormContext.Provider>,
  );
  return { onOpenSheet, onTakeTest };
}

describe('PortraitCard — пусто', () => {
  it('объясняет, что это и откуда берётся, и не рисует выдуманных цифр', () => {
    renderCard();
    expect(screen.getByText(/Здесь соберётся твой портрет/)).toBeTruthy();
    expect(screen.queryByText(/схем ·/)).toBeNull();
    expect(screen.queryByText(/с прошлого теста/)).toBeNull();
  });

  it('«Пройти тест» ведёт на тест и не открывает лист', () => {
    const { onOpenSheet, onTakeTest } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Пройти тест' }));
    expect(onTakeTest).toHaveBeenCalledTimes(1);
    expect(onOpenSheet).not.toHaveBeenCalled();
  });

  it('форма «вы» — без «ты»', () => {
    renderCard({}, 'vy');
    expect(screen.getByText(/Здесь соберётся ваш портрет/)).toBeTruthy();
    expect(screen.getByText(/ваших активных схем/)).toBeTruthy();
  });
});

describe('PortraitCard — с данными', () => {
  const portrait = buildPortrait({ manualSchemaIds: ['abandonment', 'mistrust'], myModeIds: ['vulnerable_child'] });

  it('показывает пять строк потребностей, итог и дату теста', () => {
    renderCard({ portrait, ysqCompletedAt: '2026-08-01T10:00:00.000Z' });
    expect(portrait.needs).toHaveLength(5);
    for (const n of portrait.needs) expect(screen.getByText(n.label)).toBeTruthy();
    expect(screen.getByText(/2 схемы · 1 режим/)).toBeTruthy();
    expect(screen.getByText(/Тест на схемы · /)).toBeTruthy();
  });

  it('дельта: улучшение со знаком минус, рост с плюсом, ноль и null скрыты', () => {
    const at = '2026-08-01T10:00:00.000Z';
    const { unmount } = render(
      <PortraitCard portrait={{ ...portrait, delta: -2 }} ysqCompletedAt={at} onOpenSheet={vi.fn()} />,
    );
    expect(screen.getByText('-2 с прошлого теста')).toBeTruthy();
    unmount();
    const r2 = render(<PortraitCard portrait={{ ...portrait, delta: 3 }} ysqCompletedAt={at} onOpenSheet={vi.fn()} />);
    expect(screen.getByText('+3 с прошлого теста')).toBeTruthy();
    r2.unmount();
    render(<PortraitCard portrait={{ ...portrait, delta: 0 }} ysqCompletedAt={at} onOpenSheet={vi.fn()} />);
    expect(screen.queryByText(/с прошлого теста/)).toBeNull();
  });

  it('вся карточка открывает лист', () => {
    const { onOpenSheet } = renderCard({ portrait, ysqCompletedAt: null });
    fireEvent.click(screen.getByLabelText('Мой портрет'));
    expect(onOpenSheet).toHaveBeenCalledTimes(1);
  });

  it('тест не пройден, но схемы отмечены вручную — приглашение пройти тест, лист не открывается', () => {
    const { onOpenSheet, onTakeTest } = renderCard({ portrait, ysqCompletedAt: null });
    fireEvent.click(screen.getByRole('button', { name: /Пройти тест на схемы/ }));
    expect(onTakeTest).toHaveBeenCalledTimes(1);
    expect(onOpenSheet).not.toHaveBeenCalled();
  });
});
