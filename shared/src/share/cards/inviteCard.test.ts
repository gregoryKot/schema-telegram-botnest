// @vitest-environment jsdom
// Карточка-приглашение (b23b): в приложение — знак продукта и пять полосок цветами данных на
// персике; в пару — код билетом (без пунктирной рамки); от терапевта — Talk крупно на небе.
// Эмодзи нет ни в одном виде.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { drawInviteCard } from './inviteCard';
import { canvasWithMockCtx, printedText } from './canvas.test-helpers';
import { INK, needDataInk, paperHex } from '../cardKit';

afterEach(() => {
  vi.restoreAllMocks();
});

function fills(ctx: ReturnType<typeof canvasWithMockCtx>['ctx']) {
  const seen: string[] = [];
  ctx.fill.mockImplementation(() => {
    seen.push(String(ctx.fillStyle));
  });
  return seen;
}

describe('drawInviteCard', () => {
  it('пара: код на светлом билете, без пунктира', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    const seen = fills(ctx);
    drawInviteCard(canvas, {
      kind: 'pair',
      title: 'Приглашение в пару',
      code: 'AB12CD',
      hint: 'Ввести этот код в приложении',
    });
    expect(ctx.printed.map((p) => p.text)).toContain('AB12CD');
    expect(seen).toContain(INK.surface);
    expect(seen).toContain(paperHex(28));
    expect(ctx.setLineDash).not.toHaveBeenCalled();
  });

  it('пара: длинный код уменьшается и остаётся в билете', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    drawInviteCard(canvas, {
      kind: 'pair',
      title: 'Приглашение в пару',
      code: 'ABCDEFGHIJKLMNOP',
      hint: 'Подсказка',
    });
    const code = ctx.printed.find((p) => p.text === 'ABCDEFGHIJKLMNOP')!;
    expect(code.font).not.toContain('34px');
    expect(code.x + code.width / 2).toBeLessThanOrEqual(400 - 34);
  });

  it('в приложение: полоски цветами данных пяти потребностей', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    const seen = fills(ctx);
    drawInviteCard(canvas, {
      kind: 'app',
      title: 'Всё по схеме',
      hint: 'Трекер',
    });
    for (const id of ['attachment', 'autonomy', 'expression', 'play', 'limits'])
      expect(seen).toContain(needDataInk(id));
    expect(seen).toContain(paperHex(45));
  });

  it('от терапевта: лист неба, текста-эмодзи нет', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    const seen = fills(ctx);
    drawInviteCard(canvas, {
      kind: 'therapist',
      title: 'Приглашение от терапевта',
      hint: 'Ссылка или код из сообщения',
    });
    expect(seen).toContain(paperHex(240));
    expect(printedText(ctx)).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(ctx.ellipse).toHaveBeenCalled(); // облачка Talk
  });
});
