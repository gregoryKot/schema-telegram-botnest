// @vitest-environment jsdom
// SchemaPickerSheet — ручной выбор своих схем. Проверяем: toggle
// добавляет/убирает id, initial selected предзаполняет чекбоксы, ты/вы в
// подписи, и автосохранение (жалоба пользователя, закрытый PR #237: шит,
// закрытый крестиком/свайпом до кнопки внизу длинного списка, терял выбор —
// теперь сохраняется само, кнопка «Готово» только закрывает).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
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

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SchemaPickerSheet — выбор и счётчик', () => {
  it('изначально ничего не отмечено — «Готово» без счётчика', () => {
    render(
      <SchemaPickerSheet selected={[]} onSave={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByText('Готово')).toBeTruthy();
  });

  it('selected предзаполняет — галочка видна у нужной схемы, счётчик учитывает её', () => {
    render(
      <SchemaPickerSheet
        selected={['abandonment']}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Готово (1)')).toBeTruthy();
  });

  it('клик по схеме добавляет её — счётчик растёт', () => {
    render(
      <SchemaPickerSheet selected={[]} onSave={() => {}} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    expect(screen.getByText('Готово (1)')).toBeTruthy();
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
    expect(screen.getByText('Готово')).toBeTruthy();
    expect(screen.queryByText(/Готово \(/)).toBeNull();
  });
});

describe('SchemaPickerSheet — автосохранение (баг PR #237)', () => {
  it('тап по карточке вызывает onSave с новым списком после дебаунса', () => {
    const onSave = vi.fn();
    render(
      <SchemaPickerSheet selected={[]} onSave={onSave} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    expect(onSave).not.toHaveBeenCalled();
    void act(() => vi.advanceTimersByTime(600));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(['abandonment']);
  });

  it('закрытие сразу после тапа (до дебаунса) всё равно сохраняет один раз', () => {
    const onSave = vi.fn();
    const { unmount } = render(
      <SchemaPickerSheet selected={[]} onSave={onSave} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    expect(onSave).not.toHaveBeenCalled();
    unmount();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(['abandonment']);
  });

  it('«Готово» закрывает и не дублирует сохранение', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const { unmount } = render(
      <SchemaPickerSheet selected={[]} onSave={onSave} onClose={onClose} />,
    );
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    fireEvent.click(screen.getByText('Готово (1)'));
    expect(onClose).toHaveBeenCalledTimes(1);
    // BottomSheet реально размонтируется, когда родитель уберёт компонент по onClose —
    // в тесте это делаем явно, чтобы проверить, что unmount не шлёт второй save.
    unmount();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(['abandonment']);
  });

  it('без изменений — onSave не вызывается ни по таймеру, ни при размонтировании', () => {
    const onSave = vi.fn();
    const { unmount } = render(
      <SchemaPickerSheet selected={[]} onSave={onSave} onClose={() => {}} />,
    );
    void act(() => vi.advanceTimersByTime(600));
    unmount();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('SchemaPickerSheet — клавиатура', () => {
  function getCard(schemaName: string): HTMLElement {
    const label = screen.getByText(schemaName);
    const card = label.closest('[role="button"]');
    if (!card) throw new Error(`card not found for ${schemaName}`);
    return card as HTMLElement;
  }

  it('Enter отмечает схему — счётчик растёт', () => {
    render(
      <SchemaPickerSheet selected={[]} onSave={() => {}} onClose={() => {}} />,
    );
    const card = getCard('Покинутость / Нестабильность');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(screen.getByText('Готово (1)')).toBeTruthy();
  });

  it('Пробел снимает отметку у уже выбранной схемы', () => {
    render(
      <SchemaPickerSheet
        selected={['abandonment']}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    const card = getCard('Покинутость / Нестабильность');
    fireEvent.keyDown(card, { key: ' ' });
    expect(screen.getByText('Готово')).toBeTruthy();
    expect(screen.queryByText(/Готово \(/)).toBeNull();
  });

  it('прочие клавиши ничего не меняют', () => {
    render(
      <SchemaPickerSheet selected={[]} onSave={() => {}} onClose={() => {}} />,
    );
    const card = getCard('Покинутость / Нестабильность');
    fireEvent.keyDown(card, { key: 'a' });
    expect(screen.getByText('Готово')).toBeTruthy();
    expect(screen.queryByText(/Готово \(/)).toBeNull();
  });

  it('Enter с клавиатуры сохраняет так же, как клик — после дебаунса onSave вызван с id', () => {
    const onSave = vi.fn();
    render(
      <SchemaPickerSheet selected={[]} onSave={onSave} onClose={() => {}} />,
    );
    const card = getCard('Покинутость / Нестабильность');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onSave).not.toHaveBeenCalled();
    void act(() => vi.advanceTimersByTime(700));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(['abandonment']);
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
