import { describe, expect, it } from 'vitest';
import { BUBBLE_EDGE, clampBubbleX, hudRightEdge } from './hudMath';

const W = 960;

describe('clampBubbleX — пузырь реплики целиком в кадре', () => {
  it('у левой стены сдвигается вправо, а не режется краем', () => {
    expect(clampBubbleX(10, 100, W) - 50).toBe(BUBBLE_EDGE);
  });

  it('у правой стены сдвигается влево', () => {
    expect(clampBubbleX(950, 100, W) + 50).toBe(W - BUBBLE_EDGE);
  });

  it('посередине стоит ровно над точкой', () => {
    expect(clampBubbleX(480, 100, W)).toBe(480);
  });

  it('шире кадра — прижат левым краем: начало реплики читается', () => {
    expect(clampBubbleX(480, 1000, W) - 500).toBe(BUBBLE_EDGE);
  });
});

describe('hudRightEdge — правый край HUD левее HTML-кнопки меню', () => {
  // Кнопка меню: 48 px шириной, в 16 px от правого края окна (game/index.html).
  it('кнопки нет или она скрыта — отступ margin от края кадра', () => {
    expect(hudRightEdge(undefined, { left: 0, width: 480 }, W, 18)).toBe(W - 18);
    expect(hudRightEdge({ left: 416, width: 0 }, { left: 0, width: 480 }, W, 18)).toBe(W - 18);
  });

  it('узкое окно: кнопка заходит на кадр — край на 10 левее неё, в координатах игры', () => {
    // окно 480 px, холст во всю ширину (масштаб 2): кнопка с 416 px → 832 в игре
    expect(hudRightEdge({ left: 416, width: 48 }, { left: 0, width: 480 }, W, 18)).toBe(822);
    // окно 1000 px, холст 960 px с полями по 20 px: кнопка с 936 px → 916 в игре
    expect(hudRightEdge({ left: 936, width: 48 }, { left: 20, width: 960 }, W, 18)).toBe(906);
  });

  it('широкое окно: кнопка правее холста — отступ margin', () => {
    // окно 2000 px, холст 1600 px с полями по 200 px: кнопка с 1936 px — за кадром
    expect(hudRightEdge({ left: 1936, width: 48 }, { left: 200, width: 1600 }, W, 18)).toBe(W - 18);
  });
});
