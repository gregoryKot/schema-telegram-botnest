// @vitest-environment jsdom
// ModePickerSheet — выбор своих режимов: предзаполнение из уже сохранённого
// выбора, тап переключает режим (toggle, не только добавление),
// автосохранение вместо явной кнопки «Сохранить» (жалоба пользователя,
// закрытый PR #237: шит, закрытый крестиком/свайпом до кнопки внизу
// длинного списка, терял выбор).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { ModePickerSheet } from './ModePickerSheet';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ModePickerSheet — предзаполнение выбора', () => {
  it('уже выбранный режим отмечен галочкой при открытии', () => {
    render(
      <ModePickerSheet
        selected={['vulnerable_child']}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    // Галочка ✓ стоит рядом именно с уязвимым ребёнком, а не с произвольным.
    const row = screen.getByText('Уязвимый Ребёнок').closest('[role="button"]');
    expect(row?.textContent).toContain('✓');
  });

  it('«Готово» сразу показывает число уже выбранных режимов', () => {
    render(
      <ModePickerSheet
        selected={['vulnerable_child', 'demanding_critic']}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Готово (2)')).toBeTruthy();
  });

  it('без выбранных режимов «Готово» без числа', () => {
    render(
      <ModePickerSheet selected={[]} onSave={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByText('Готово')).toBeTruthy();
  });
});

describe('ModePickerSheet — переключение режимов (toggle)', () => {
  it('тап по невыбранному режиму добавляет его в счётчик', () => {
    render(
      <ModePickerSheet selected={[]} onSave={() => {}} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByText('Требовательный Критик'));
    expect(screen.getByText('Готово (1)')).toBeTruthy();
  });

  it('повторный тап по уже выбранному режиму убирает его (настоящий toggle)', () => {
    render(
      <ModePickerSheet
        selected={['demanding_critic']}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Готово (1)')).toBeTruthy();
    fireEvent.click(screen.getByText('Требовательный Критик'));
    expect(screen.getByText('Готово')).toBeTruthy();
    expect(screen.queryByText(/Готово \(/)).toBeNull();
  });
});

describe('ModePickerSheet — автосохранение (баг PR #237)', () => {
  it('тап вызывает onSave с реально накопленным списком после дебаунса', () => {
    const onSave = vi.fn();
    render(
      <ModePickerSheet
        selected={['demanding_critic']}
        onSave={onSave}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    expect(onSave).not.toHaveBeenCalled();
    void act(() => vi.advanceTimersByTime(600));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toEqual(
      expect.arrayContaining(['demanding_critic', 'vulnerable_child']),
    );
    expect(onSave.mock.calls[0][0]).toHaveLength(2);
  });

  it('закрытие сразу после тапа (до дебаунса) всё равно сохраняет один раз', () => {
    const onSave = vi.fn();
    const { unmount } = render(
      <ModePickerSheet selected={[]} onSave={onSave} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByText('Счастливый Ребёнок'));
    expect(onSave).not.toHaveBeenCalled();
    unmount();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(['happy_child']);
  });

  it('«Готово» закрывает и не дублирует сохранение', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const { unmount } = render(
      <ModePickerSheet selected={[]} onSave={onSave} onClose={onClose} />,
    );
    fireEvent.click(screen.getByText('Счастливый Ребёнок'));
    fireEvent.click(screen.getByText('Готово (1)'));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('без изменений — onSave не вызывается ни по таймеру, ни при размонтировании', () => {
    const onSave = vi.fn();
    const { unmount } = render(
      <ModePickerSheet selected={[]} onSave={onSave} onClose={() => {}} />,
    );
    void act(() => vi.advanceTimersByTime(600));
    unmount();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('ModePickerSheet — полный каталог доступен, не только популярные', () => {
  it('режим не из «С чего начать» тоже переключается и попадает в результат', () => {
    const onSave = vi.fn();
    render(
      <ModePickerSheet selected={[]} onSave={onSave} onClose={() => {}} />,
    );
    // "Счастливый Ребёнок" не входит в POPULAR_MODE_IDS — проверяем секцию
    // «Все режимы» тоже реально работает, не только быстрый список.
    fireEvent.click(screen.getByText('Счастливый Ребёнок'));
    void act(() => vi.advanceTimersByTime(600));
    expect(onSave).toHaveBeenCalledWith(['happy_child']);
  });
});
