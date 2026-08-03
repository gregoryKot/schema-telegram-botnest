// @vitest-environment jsdom
// SchemaPickerSheet — ручной выбор своих схем (0% покрытия). Проверяем:
// toggle добавляет/убирает id, initial selected предзаполняет чекбоксы,
// «Сохранить» отдаёт актуальный список (а не исходный selected — баг был бы
// «отметил, но не сохранилось»), и ты/вы в подписи.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { hasTyForms } from '../../../shared/src/utils/tyFormsSweep';
import { SchemaPickerSheet } from './SchemaPickerSheet';

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

afterEach(cleanup);

describe('SchemaPickerSheet — выбор и сохранение', () => {
  it('изначально ничего не отмечено — кнопка «Сохранить» без счётчика', () => {
    render(
      <SchemaPickerSheet selected={[]} onSave={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByText('Сохранить')).toBeTruthy();
  });

  it('selected предзаполняет — галочка видна у нужной схемы, счётчик учитывает её', () => {
    render(
      <SchemaPickerSheet
        selected={['abandonment']}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Сохранить (1)')).toBeTruthy();
  });

  it('клик по схеме добавляет её — счётчик растёт', () => {
    render(
      <SchemaPickerSheet selected={[]} onSave={() => {}} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    expect(screen.getByText('Сохранить (1)')).toBeTruthy();
  });

  it('повторный клик снимает отметку — счётчик уменьшается', () => {
    render(
      <SchemaPickerSheet
        selected={['abandonment']}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    expect(screen.getByText('Сохранить')).toBeTruthy();
    expect(screen.queryByText(/Сохранить \(/)).toBeNull();
  });

  it('«Сохранить» отдаёт АКТУАЛЬНЫЙ список изменений, а не исходный selected', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <SchemaPickerSheet selected={[]} onSave={onSave} onClose={onClose} />,
    );
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    fireEvent.click(screen.getByText('Сохранить (1)'));
    expect(onSave).toHaveBeenCalledWith(['abandonment']);
    expect(onClose).toHaveBeenCalled();
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
