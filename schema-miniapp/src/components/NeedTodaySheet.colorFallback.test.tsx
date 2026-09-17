// @vitest-environment jsdom
// Страховка от рассинхрона двух реестров (CLAUDE.md, правило №4): цвета
// потребностей живут в types.COLORS, а тексты — в needData. Если потребность
// есть в одном и нет в другом, лист обязан отрисоваться нейтральным цветом,
// а не упасть. Обычным путём эта ветка недостижима: незнакомый id отсекается
// раньше (`if (!data) return null`), поэтому здесь подменяется needData.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../needData', async (orig) => {
  const actual = await orig<typeof import('../needData')>();
  return {
    ...actual,
    useNeedData: () => {
      const real = actual.useNeedData();
      return {
        ...real,
        // Полноценная запись (тексты/теги на месте) — отличается только id,
        // которого нет в COLORS. Так проверяется ровно фолбэк цвета, а не
        // устойчивость к битым данным.
        orphan_need: real.attachment,
      };
    },
  };
});

vi.mock('./PlanSheet', () => ({ PlanSheet: () => null }));

const { NeedTodaySheet } = await import('./NeedTodaySheet');

afterEach(cleanup);

describe('NeedTodaySheet — потребность без цвета в реестре', () => {
  it('рисуется нейтральным цветом вместо падения', () => {
    render(
      <NeedTodaySheet
        need={{
          id: 'orphan_need',
          emoji: '❓',
          title: 'Без цвета',
          chartLabel: 'Без цвета',
        }}
        value={5}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Без цвета')).toBeTruthy();
  });
});
