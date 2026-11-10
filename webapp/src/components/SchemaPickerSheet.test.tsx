// @vitest-environment jsdom
// SchemaPickerSheet — ручной выбор своих схем. Проверяем: toggle
// добавляет/убирает id, initial selected предзаполняет чекбоксы, ты/вы в
// подписи, и автосохранение (жалоба пользователя, закрытый PR #237: шит,
// закрытый до кнопки внизу длинного списка, терял выбор — теперь
// сохраняется само, кнопка «Готово» только закрывает).
// useHistorySheet требует MemoryRouter (useNavigate/useLocation).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { hasTyForms } from '../../../shared/src/utils/tyFormsSweep';
import { SchemaPickerSheet } from './SchemaPickerSheet';

function renderSheet(props: {
  selected?: string[];
  onSave?: (ids: string[]) => void;
  onClose?: () => void;
}) {
  return render(
    <MemoryRouter>
      <SchemaPickerSheet
        selected={props.selected ?? []}
        onSave={props.onSave ?? (() => {})}
        onClose={props.onClose ?? (() => {})}
      />
    </MemoryRouter>,
  );
}

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <MemoryRouter>
      <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
        {ui}
      </AddressFormContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SchemaPickerSheet — выбор', () => {
  it('клик по схеме отмечает её галочкой (is-selected)', () => {
    renderSheet({});
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    const row = screen
      .getByText('Покинутость / Нестабильность')
      .closest('[role="button"]');
    expect(row?.className).toContain('is-selected');
  });

  it('повторный клик снимает отметку', () => {
    renderSheet({ selected: ['abandonment'] });
    const row = screen
      .getByText('Покинутость / Нестабильность')
      .closest('[role="button"]');
    expect(row?.className).toContain('is-selected');
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    expect(row?.className).not.toContain('is-selected');
  });

  it('«Готово» видна всегда — не завязана на счётчик (внизу листа и в шапке, b15)', () => {
    renderSheet({});
    // Без выбора обе кнопки — «Готово»: в шапке счётчик появляется только с выбором («Готово · N»).
    expect(screen.getAllByRole('button', { name: 'Готово' })).toHaveLength(2);
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    expect(screen.getByRole('button', { name: 'Готово · 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Готово' })).toBeTruthy();
  });
});

describe('SchemaPickerSheet — автосохранение (баг PR #237)', () => {
  it('тап по карточке вызывает onSave с новым списком после дебаунса', () => {
    const onSave = vi.fn();
    renderSheet({ onSave });
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    expect(onSave).not.toHaveBeenCalled();
    void act(() => vi.advanceTimersByTime(600));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(['abandonment']);
  });

  it('закрытие сразу после тапа (до дебаунса) всё равно сохраняет один раз', () => {
    const onSave = vi.fn();
    const { unmount } = renderSheet({ onSave });
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    expect(onSave).not.toHaveBeenCalled();
    unmount();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(['abandonment']);
  });

  it('«Готово» закрывает и не дублирует сохранение', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const { unmount } = renderSheet({ onSave, onClose });
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    fireEvent.click(screen.getByRole('button', { name: 'Готово · 1' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(['abandonment']);
  });

  it('без изменений — onSave не вызывается ни по таймеру, ни при размонтировании', () => {
    const onSave = vi.fn();
    const { unmount } = renderSheet({ onSave });
    void act(() => vi.advanceTimersByTime(600));
    unmount();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('SchemaPickerSheet — обращение ты/вы', () => {
  it('форма «ты»', () => {
    renderWithForm(
      <SchemaPickerSheet selected={[]} onSave={() => {}} onClose={() => {}} />,
      'ty',
    );
    expect(screen.getByText(/Выбери схемы/)).toBeTruthy();
  });

  it('форма «вы» — без остаточных «ты»-форм', () => {
    const { container } = renderWithForm(
      <SchemaPickerSheet selected={[]} onSave={() => {}} onClose={() => {}} />,
      'vy',
    );
    expect(screen.getByText(/Выберите схемы/)).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});
