// @vitest-environment jsdom
// ModePickerSheet (webapp) — выбор своих режимов. Вынесен из SchemasSection.tsx
// (правило №10, потолок файла). Проверяем: предзаполнение, toggle,
// автосохранение вместо явной «Сохранить» (жалоба пользователя, закрытый
// PR #237). useHistorySheet требует MemoryRouter.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModePickerSheet } from './ModePickerSheet';

function renderSheet(props: {
  selected?: string[];
  onSave?: (ids: string[]) => void;
  onClose?: () => void;
}) {
  return render(
    <MemoryRouter>
      <ModePickerSheet
        selected={props.selected ?? []}
        onSave={props.onSave ?? (() => {})}
        onClose={props.onClose ?? (() => {})}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ModePickerSheet (webapp) — предзаполнение и toggle', () => {
  it('уже выбранный режим отмечен галочкой', () => {
    renderSheet({ selected: ['vulnerable_child'] });
    expect(screen.getByText('Готово · 1')).toBeTruthy();
  });

  it('тап по режиму добавляет его в счётчик, повторный — убирает', () => {
    renderSheet({});
    fireEvent.click(screen.getByText('Требовательный Критик'));
    expect(screen.getByText('Готово · 1')).toBeTruthy();
    fireEvent.click(screen.getByText('Требовательный Критик'));
    expect(screen.getByText('Готово')).toBeTruthy();
  });

  it('режим не из «С чего начать» тоже переключается', () => {
    renderSheet({});
    fireEvent.click(screen.getByText('Счастливый Ребёнок'));
    expect(screen.getByText('Готово · 1')).toBeTruthy();
  });
});

describe('ModePickerSheet (webapp) — автосохранение (баг PR #237)', () => {
  it('тап вызывает onSave после дебаунса с накопленным списком', () => {
    const onSave = vi.fn();
    renderSheet({ selected: ['demanding_critic'], onSave });
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    expect(onSave).not.toHaveBeenCalled();
    void act(() => vi.advanceTimersByTime(600));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toEqual(
      expect.arrayContaining(['demanding_critic', 'vulnerable_child']),
    );
  });

  it('закрытие сразу после тапа (до дебаунса) всё равно сохраняет один раз', () => {
    const onSave = vi.fn();
    const { unmount } = renderSheet({ onSave });
    fireEvent.click(screen.getByText('Счастливый Ребёнок'));
    expect(onSave).not.toHaveBeenCalled();
    unmount();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(['happy_child']);
  });

  it('«Готово» закрывает и не дублирует сохранение', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const { unmount } = renderSheet({ onSave, onClose });
    fireEvent.click(screen.getByText('Счастливый Ребёнок'));
    fireEvent.click(screen.getByText('Готово · 1'));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('без изменений — onSave не вызывается ни по таймеру, ни при размонтировании', () => {
    const onSave = vi.fn();
    const { unmount } = renderSheet({ onSave });
    void act(() => vi.advanceTimersByTime(600));
    unmount();
    expect(onSave).not.toHaveBeenCalled();
  });
});
