// @vitest-environment jsdom
// Карточка достижения (b23b): лист оттенка значка и его знак крупно по центру (achievementCardLook,
// тот же значок, что в профиле); без медальона, градиента и галочки-глифа.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { achievementArtSize, drawAchievementCard } from './achievementCard';
import { canvasWithMockCtx, printedText } from './canvas.test-helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('drawAchievementCard', () => {
  it('знак значка по id, название и описание; без галочки и градиента', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    drawAchievementCard(canvas, {
      id: 'first_day',
      title: 'Первый шаг',
      desc: 'Первая запись в дневнике',
    });
    expect(printedText(ctx)).toContain('Первый шаг');
    expect(printedText(ctx)).not.toContain('✓');
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
    expect(ctx.ellipse).toHaveBeenCalled(); // камешки Pebbles
  });

  it('незнакомое достижение — без знака и ниже', () => {
    const known = canvasWithMockCtx();
    drawAchievementCard(known.canvas, {
      id: 'streak_7',
      title: 'Т',
      desc: 'К',
    });
    const unknown = canvasWithMockCtx();
    drawAchievementCard(unknown.canvas, { title: 'Т', desc: 'К' });
    expect(unknown.canvas.height).toBeLessThan(known.canvas.height);
  });

  it('длинное описание (до 3 строк) увеличивает высоту', () => {
    const short = canvasWithMockCtx();
    drawAchievementCard(short.canvas, {
      id: 'growth',
      title: 'Т',
      desc: 'Коротко',
    });
    const long = canvasWithMockCtx();
    drawAchievementCard(long.canvas, {
      id: 'growth',
      title: 'Т',
      desc: 'Очень длинное описание достижения, которое переносится через несколько строк подряд и должно быть аккуратно обрезано без исключений',
    });
    expect(long.canvas.height).toBeGreaterThan(short.canvas.height);
  });
});

describe('achievementArtSize', () => {
  it('знак вписан в квадрат: высокий (Strokes) не выше квадрата, низкий — ниже', () => {
    const tall = achievementArtSize('strokes');
    const flat = achievementArtSize('pebbles');
    expect(tall.h).toBeLessThanOrEqual(150);
    expect(flat.h).toBeLessThan(tall.h);
    expect(achievementArtSize(null)).toEqual({ w: 0, h: 0 });
  });
});
