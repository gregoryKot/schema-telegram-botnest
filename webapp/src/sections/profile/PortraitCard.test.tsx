// @vitest-environment jsdom
// Плитка «Мой портрет» на витрине профиля: пустое состояние объясняет «откуда
// и зачем» и ведёт на тест; с данными — подпись и итог из данных (полосы, дата
// теста и дельта — в листе, PortraitTestLine.test); вся плитка — одно действие,
// вложенная кнопка теста не открывает лист.
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
    expect(screen.queryByText(/твой|твоих/)).toBeNull();
  });

  it('плитка — бумага и знак ENTITY_LOOK.portrait, заголовок h2', () => {
    renderCard();
    const tile = screen.getByLabelText('Мой портрет');
    expect(tile.classList.contains('pp-paper')).toBe(true);
    expect(tile.getAttribute('style')).toContain('--h: 135');
    expect(screen.getByRole('heading', { level: 2, name: 'Мой портрет' })).toBeTruthy();
    expect(tile.querySelector('.cpf-tile-art svg.pp-art')).not.toBeNull();
  });
});

describe('PortraitCard — с данными', () => {
  const portrait = buildPortrait({ manualSchemaIds: ['abandonment', 'mistrust'], myModeIds: ['vulnerable_child'] });

  it('с данными: подпись «откуда и зачем» и итог из данных; полос и даты теста на плитке нет', () => {
    renderCard({ portrait, ysqCompletedAt: '2026-08-01T10:00:00.000Z' });
    expect(screen.getByText(/Сколько твоих активных схем/)).toBeTruthy();
    expect(screen.getByText('2 схемы · 1 режим')).toBeTruthy();
    expect(document.querySelector('.cpf-bar')).toBeNull();
    expect(screen.queryByText(/Тест на схемы · /)).toBeNull();
    expect(screen.queryByRole('button', { name: /Пройти тест/ })).toBeNull();
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
