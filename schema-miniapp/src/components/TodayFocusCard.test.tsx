// @vitest-environment jsdom
// TodayFocusCard — карточка «одно дело на сегодня» (0% покрытия). Проверяем
// ветки done/не done для трекера (все оценки + есть avgScore) и для
// дневниковых практик (practiceDoneToday), боковое действие (История/Ещё) и
// обращение ты/вы в подписи done-состояния.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { hasTyForms } from '../../../shared/src/utils/tyFormsSweep';
import { TodayFocusCard } from './TodayFocusCard';

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

afterEach(cleanup);

describe('TodayFocusCard — трекер, не всё оценено', () => {
  it('показывает CTA заполнить трекер', () => {
    render(
      <TodayFocusCard
        practice="tracker"
        ratedCount={2}
        total={5}
        avgScore={null}
        onAction={() => {}}
      />,
    );
    expect(screen.getByText('Одно дело на сегодня')).toBeTruthy();
  });

  it('клик по CTA зовёт onAction', () => {
    const onAction = vi.fn();
    render(
      <TodayFocusCard
        practice="tracker"
        ratedCount={0}
        total={5}
        avgScore={null}
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByText('Одно дело на сегодня'));
    expect(onAction).toHaveBeenCalled();
  });
});

describe('TodayFocusCard — трекер, всё оценено (done)', () => {
  it('показывает «На сегодня — всё» и индекс дня', () => {
    render(
      <TodayFocusCard
        practice="tracker"
        ratedCount={5}
        total={5}
        avgScore="7.2"
        onAction={() => {}}
      />,
    );
    expect(screen.getByText('На сегодня — всё')).toBeTruthy();
    expect(screen.getByText(/Индекс дня 7.2\/10/)).toBeTruthy();
  });

  it('боковая кнопка «История» зовёт onOpenHistory (не onAction)', () => {
    const onOpenHistory = vi.fn();
    const onAction = vi.fn();
    render(
      <TodayFocusCard
        practice="tracker"
        ratedCount={5}
        total={5}
        avgScore="7.2"
        onAction={onAction}
        onOpenHistory={onOpenHistory}
      />,
    );
    fireEvent.click(screen.getByText('История'));
    expect(onOpenHistory).toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('нет onOpenHistory — боковая кнопка не рендерится', () => {
    render(
      <TodayFocusCard
        practice="tracker"
        ratedCount={5}
        total={5}
        avgScore="7.2"
        onAction={() => {}}
      />,
    );
    expect(screen.queryByText('История')).toBeNull();
  });

  it('shareSlot рендерится только для трекера в done-состоянии', () => {
    render(
      <TodayFocusCard
        practice="tracker"
        ratedCount={5}
        total={5}
        avgScore="7.2"
        onAction={() => {}}
        shareSlot={<div>Поделиться днём</div>}
      />,
    );
    expect(screen.getByText('Поделиться днём')).toBeTruthy();
  });
});

describe('TodayFocusCard — дневниковая практика (schema/mode/gratitude)', () => {
  it('не done — показывает CTA практики', () => {
    render(
      <TodayFocusCard
        practice="gratitude"
        ratedCount={0}
        total={0}
        avgScore={null}
        onAction={() => {}}
      />,
    );
    expect(screen.getByText('Три хорошие вещи')).toBeTruthy();
  });

  it('practiceDoneToday=true — done-состояние с боковой кнопкой «Ещё»', () => {
    const onAction = vi.fn();
    render(
      <TodayFocusCard
        practice="gratitude"
        ratedCount={0}
        total={0}
        avgScore={null}
        practiceDoneToday
        onAction={onAction}
      />,
    );
    expect(screen.getByText('На сегодня — всё')).toBeTruthy();
    expect(
      screen.getByText(/Благодарности на сегодня записаны\./),
    ).toBeTruthy();
    fireEvent.click(screen.getByText('Ещё'));
    expect(onAction).toHaveBeenCalled();
  });
});

describe('TodayFocusCard — обращение ты/вы (done-подпись)', () => {
  it('форма «ты»', () => {
    renderWithForm(
      <TodayFocusCard
        practice="tracker"
        ratedCount={5}
        total={5}
        avgScore="8"
        onAction={() => {}}
      />,
      'ty',
    );
    expect(screen.getByText(/Загляни завтра/)).toBeTruthy();
  });

  it('форма «вы» — без остаточных «ты»-форм', () => {
    const { container } = renderWithForm(
      <TodayFocusCard
        practice="tracker"
        ratedCount={5}
        total={5}
        avgScore="8"
        onAction={() => {}}
      />,
      'vy',
    );
    expect(screen.getByText(/Загляните завтра/)).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});
