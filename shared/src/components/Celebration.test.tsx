// @vitest-environment jsdom
// Празднование серии жило в двух версиях (webapp без эмодзи, мини-апп с 🏆/🔥)
// — сведено в shared, канон безэмодзийный. Тест держит ветвления: веха
// отмечается data-milestone (акцент числа), insight-блок опционален,
// share-фолбэк уходит в буфер и трекает неуспех.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Celebration } from './Celebration';

beforeEach(() => {
  // Гасим canvas-конфетти (useConfetti): jsdom отдаёт null вместо 2D-контекста,
  // и rAF-цикл анимации падал unhandled-ошибкой ПОСЛЕ завершения теста (CI).
  localStorage.setItem('reduce_motion', '1');
});

const tr = (ty: string, vy: string) => `${ty}|${vy}`;
const noop = () => {};

const base = {
  onDone: noop,
  tr,
  botShortUrl: 't.me/test_bot',
  trackEvent: vi.fn(),
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Celebration', () => {
  it('веха (7 дней) — число с data-milestone=yes, без эмодзи в разметке', () => {
    const { container } = render(<Celebration {...base} streak={7} />);
    const num = container.querySelector('[data-milestone="yes"]');
    expect(num?.textContent).toBe('7');
    expect(container.textContent).not.toMatch(/🏆|🔥/);
  });

  it('обычный день (8) — data-milestone=no', () => {
    const { container } = render(<Celebration {...base} streak={8} />);
    expect(container.querySelector('[data-milestone="no"]')?.textContent).toBe(
      '8',
    );
  });

  it('insight показывается только когда передан', () => {
    const { container, rerender } = render(
      <Celebration {...base} streak={5} insight="Сегодня питала близость" />,
    );
    expect(screen.getByText('Сегодня питала близость')).toBeTruthy();
    rerender(<Celebration {...base} streak={5} insight={null} />);
    expect(container.textContent).not.toContain('Сегодня питала близость');
  });

  it('share-фолбэк: без Web Share текст уходит в буфер, неуспех затрекан', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const trackEvent = vi.fn();
    render(<Celebration {...base} trackEvent={trackEvent} streak={5} />);
    fireEvent.click(screen.getByText('Поделиться'));
    await screen.findByText('Скопировано!');
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('t.me/test_bot'),
    );
    expect(trackEvent).toHaveBeenCalledWith('share_result', {
      kind: 'streak',
      ok: false,
    });
  });

  it('share-фолбэк: буфер тоже упал — виден отказ (был: молча проглочен)', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    render(<Celebration {...base} streak={5} />);
    fireEvent.click(screen.getByText('Поделиться'));
    await screen.findByText(
      (c) => c.includes('Не удалось скопировать') && c.includes('вручную'),
    );
    expect(screen.queryByText('Скопировано!')).toBeNull();
  });

  it('подпись «закрыть» — в обеих формах через tr()', () => {
    render(<Celebration {...base} streak={2} />);
    expect(
      screen.getByText((c) => c.includes('нажми') && c.includes('нажмите')),
    ).toBeTruthy();
  });
});
