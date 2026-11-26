// @vitest-environment jsdom
// Верхняя панель результатов теста схем: раскрытие объяснения трекает
// ysq_help_open ровно на первом открытии (правило №8), кнопка «Поделиться»
// зовёт onShare. Объяснение содержит обе формы обращения через tr().
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { YsqResultTopBar } from './YsqResultTopBar';

const tr = (ty: string, vy: string) => `${ty}|${vy}`;

afterEach(() => {
  cleanup();
});

describe('YsqResultTopBar', () => {
  it('изначально объяснение свёрнуто, onHelpOpen не звался', () => {
    const onHelpOpen = vi.fn();
    render(
      <YsqResultTopBar tr={tr} onShare={vi.fn()} onHelpOpen={onHelpOpen} />,
    );
    expect(screen.queryByText('Что это такое')).toBeNull();
    expect(onHelpOpen).not.toHaveBeenCalled();
  });

  it('первое раскрытие трекает onHelpOpen, повторные — нет', () => {
    const onHelpOpen = vi.fn();
    render(
      <YsqResultTopBar tr={tr} onShare={vi.fn()} onHelpOpen={onHelpOpen} />,
    );
    const toggle = screen.getByText(/Как понимать/);
    fireEvent.click(toggle);
    expect(onHelpOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Что это такое')).toBeTruthy();

    fireEvent.click(toggle); // закрыть
    fireEvent.click(toggle); // открыть снова
    expect(onHelpOpen).toHaveBeenCalledTimes(2);
  });

  it('объяснение содержит обе формы обращения (ты/вы) через tr()', () => {
    render(<YsqResultTopBar tr={tr} onShare={vi.fn()} onHelpOpen={vi.fn()} />);
    fireEvent.click(screen.getByText(/Как понимать/));
    expect(
      screen.getByText((c) => c.includes('про тебя|про вас')),
    ).toBeTruthy();
  });

  it('кнопка «Поделиться» зовёт onShare', () => {
    const onShare = vi.fn();
    render(<YsqResultTopBar tr={tr} onShare={onShare} onHelpOpen={vi.fn()} />);
    fireEvent.click(screen.getByText(/Поделиться/));
    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
