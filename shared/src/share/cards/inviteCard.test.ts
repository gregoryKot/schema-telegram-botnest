// @vitest-environment jsdom
// Карточка-приглашение: раскладка с кодом (плашка с пунктиром) и без кода
// (эмодзи-медальон при одном эмодзи, ряд плиток при нескольких — правило
// «одна механика — один компонент» отражено внутри drawInviteEmojis).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { drawInviteCard } from './inviteCard';

function mockCtx() {
  return {
    scale: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    roundRect: vi.fn(),
    arc: vi.fn(),
    clip: vi.fn(),
    setTransform: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn((s: string) => ({ width: s.length * 7 })),
    fillStyle: '',
    strokeStyle: '',
    font: '',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'left' as CanvasTextAlign,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('drawInviteCard', () => {
  it('с кодом — рисует плашку с пунктирной рамкой, не падает', () => {
    const ctx = mockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const canvas = document.createElement('canvas');
    expect(() =>
      drawInviteCard(canvas, {
        title: 'Приглашение в пару',
        code: 'AB12CD',
        hint: 'Введите код в приложении партнёра',
      }),
    ).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalledWith(
      'AB12CD',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('без кода, одно эмодзи — медальон, не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawInviteCard(canvas, {
        title: 'Приглашение от терапевта',
        emojis: ['🤝'],
        hint: 'Перейдите по ссылке рядом с картинкой',
      }),
    ).not.toThrow();
  });

  it('без кода, несколько эмодзи — ряд плиток, не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawInviteCard(canvas, {
        title: 'Приглашение',
        emojis: ['🤝', '🧭', '⚖️', '🎉', '🛡️'],
        hint: 'Пять потребностей говорят сами за себя',
      }),
    ).not.toThrow();
  });

  it('ни кода, ни emojis — фолбэк на единственное эмодзи по умолчанию', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawInviteCard(canvas, { title: 'Приглашение', hint: 'Подсказка' }),
    ).not.toThrow();
  });
});
