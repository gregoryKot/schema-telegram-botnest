// @vitest-environment jsdom
// Регрессия инцидента 2026-08 (жалоба пользователя): отметил свои режимы,
// закрыл шит не долистав до кнопки внизу — выбор пропадал. Проверяем именно
// связку «тапнул по режиму → выбор ушёл наверх», без нажатия кнопки.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { ModePickerSheet } from './ModePickerSheet';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ModePickerSheet — выбор сохраняется сам', () => {
  it('тап по режиму сохраняет выбор без кнопки', () => {
    const onSave = vi.fn();
    render(
      <ModePickerSheet selected={[]} onSave={onSave} onClose={() => {}} />,
    );

    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onSave).toHaveBeenCalledWith(['vulnerable_child']);
  });

  it('закрытие шита сразу после тапа не теряет выбор', () => {
    const onSave = vi.fn();
    const { unmount } = render(
      <ModePickerSheet selected={[]} onSave={onSave} onClose={() => {}} />,
    );

    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    unmount(); // свайп вниз / тап мимо шита
    expect(onSave).toHaveBeenCalledWith(['vulnerable_child']);
  });

  it('кнопка «Готово» доступна сразу, без прокрутки списка, и закрывает шит', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(<ModePickerSheet selected={[]} onSave={onSave} onClose={onClose} />);

    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    fireEvent.click(screen.getByText(/^Готово/));
    expect(onSave).toHaveBeenCalledWith(['vulnerable_child']);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
