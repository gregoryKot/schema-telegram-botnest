// @vitest-environment jsdom
// Обёртка блока «Профиля»/«Паттернов»: скрытый не рисуется, место в порядке
// уходит в --blk-o, долгое нажатие (только на телефоне) — на обёртке.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { ScreenBlock } from './ScreenBlock';
import { useLongPress } from '../../../../shared/src/hooks/useLongPress';

afterEach(cleanup);

const orderedIds = ['journey', 'streak', 'heatmap'] as const;
const base = { orderedIds: [...orderedIds], isHidden: (id: string) => id === 'heatmap' };

describe('ScreenBlock', () => {
  it('скрытый блок не рисуется', () => {
    render(<ScreenBlock id="heatmap" blocks={{ ...base, hold: () => undefined }}>карта</ScreenBlock>);
    expect(screen.queryByText('карта')).toBeNull();
  });

  it('место блока — номер в порядке, начиная с 1; класс экрана сохраняется', () => {
    render(<ScreenBlock id="streak" className="cpf-blk" blocks={{ ...base, hold: () => undefined }}>серия</ScreenBlock>);
    const el = screen.getByText('серия');
    expect(el.style.getPropertyValue('--blk-o')).toBe('2');
    expect(el.className).toBe('cpf-blk');
  });

  it('на телефоне долгое нажатие вызывает действие, на десктопе (hold нет) — нет', () => {
    vi.useFakeTimers();
    const onHold = vi.fn();
    function Phone() {
      const hold = useLongPress(onHold);
      return <ScreenBlock id="journey" blocks={{ ...base, hold: () => hold }}>путь</ScreenBlock>;
    }
    render(<Phone />);
    fireEvent.pointerDown(screen.getByText('путь'), { button: 0, isPrimary: true, clientX: 1, clientY: 1 });
    act(() => { vi.advanceTimersByTime(600); });
    expect(onHold).toHaveBeenCalledTimes(1);
    cleanup();
    render(<ScreenBlock id="journey" blocks={{ ...base, hold: () => undefined }}>путь</ScreenBlock>);
    fireEvent.pointerDown(screen.getByText('путь'), { button: 0, isPrimary: true, clientX: 1, clientY: 1 });
    act(() => { vi.advanceTimersByTime(600); });
    expect(onHold).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
