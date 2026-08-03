// @vitest-environment jsdom
// FloatingPill — плавающая кнопка «записать момент» (0% покрытия). Проверяем
// открытие пикера, что каждый пункт зовёт свой колбэк и закрывает пикер
// (читерский баг класса «два пункта делят один onClick» — правило «одна
// механика — один компонент»/различимые аффордансы), плюс ты/вы в трекере.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { hasTyForms } from '../../../shared/src/utils/tyFormsSweep';
import { FloatingPill } from './FloatingPill';

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

afterEach(cleanup);

const baseProps = {
  onOpenSchemaDiary: vi.fn(),
  onOpenModeDiary: vi.fn(),
  onOpenGratitude: vi.fn(),
  onOpenTracker: vi.fn(),
};

describe('FloatingPill — открытие пикера', () => {
  it('изначально пикер закрыт', () => {
    render(<FloatingPill {...baseProps} />);
    expect(screen.queryByText('Записать момент')).toBeNull();
  });

  it('клик по кнопке открывает пикер с четырьмя пунктами', () => {
    render(<FloatingPill {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Быстрое действие'));
    expect(screen.getByText('Записать момент')).toBeTruthy();
    expect(screen.getByText('Схема')).toBeTruthy();
    expect(screen.getByText('Режим')).toBeTruthy();
    expect(screen.getByText('Благодарность')).toBeTruthy();
    expect(screen.getByText('Трекер потребностей')).toBeTruthy();
  });
});

describe('FloatingPill — каждый пункт зовёт свой колбэк и закрывает пикер', () => {
  it('«Схема» → onOpenSchemaDiary', () => {
    const onOpenSchemaDiary = vi.fn();
    render(
      <FloatingPill {...baseProps} onOpenSchemaDiary={onOpenSchemaDiary} />,
    );
    fireEvent.click(screen.getByLabelText('Быстрое действие'));
    fireEvent.click(screen.getByText('Схема'));
    expect(onOpenSchemaDiary).toHaveBeenCalled();
    expect(screen.queryByText('Записать момент')).toBeNull();
  });

  it('«Режим» → onOpenModeDiary', () => {
    const onOpenModeDiary = vi.fn();
    render(<FloatingPill {...baseProps} onOpenModeDiary={onOpenModeDiary} />);
    fireEvent.click(screen.getByLabelText('Быстрое действие'));
    fireEvent.click(screen.getByText('Режим'));
    expect(onOpenModeDiary).toHaveBeenCalled();
  });

  it('«Благодарность» → onOpenGratitude', () => {
    const onOpenGratitude = vi.fn();
    render(<FloatingPill {...baseProps} onOpenGratitude={onOpenGratitude} />);
    fireEvent.click(screen.getByLabelText('Быстрое действие'));
    fireEvent.click(screen.getByText('Благодарность'));
    expect(onOpenGratitude).toHaveBeenCalled();
  });

  it('«Трекер потребностей» → onOpenTracker', () => {
    const onOpenTracker = vi.fn();
    render(<FloatingPill {...baseProps} onOpenTracker={onOpenTracker} />);
    fireEvent.click(screen.getByLabelText('Быстрое действие'));
    fireEvent.click(screen.getByText('Трекер потребностей'));
    expect(onOpenTracker).toHaveBeenCalled();
  });
});

describe('FloatingPill — обращение ты/вы (подпись трекера)', () => {
  it('форма «ты»', () => {
    renderWithForm(<FloatingPill {...baseProps} />, 'ty');
    fireEvent.click(screen.getByLabelText('Быстрое действие'));
    expect(screen.getByText('Оцени день по пяти шкалам')).toBeTruthy();
  });

  it('форма «вы» — без остаточных «ты»-форм', () => {
    const { container } = renderWithForm(<FloatingPill {...baseProps} />, 'vy');
    fireEvent.click(screen.getByLabelText('Быстрое действие'));
    expect(screen.getByText('Оцените день по пяти шкалам')).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});
