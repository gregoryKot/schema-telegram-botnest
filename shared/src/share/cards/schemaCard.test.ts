// @vitest-environment jsdom
// Карточка схемы: домен/название/описание + опциональная панель убеждения.
// Той же функцией рисуется запись дневника режимов — раскладка обязана
// пережить и наличие, и отсутствие belief.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { drawSchemaCard } from './schemaCard';
import { mockCardCtx as mockCtx } from './canvas.test-helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('drawSchemaCard', () => {
  it('с убеждением (belief) — рисует панель цитаты, не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawSchemaCard(canvas, {
        domain: 'Отвержение',
        domainColor: 'var(--accent-blue)',
        name: 'Покинутость/Нестабильность',
        desc: 'Ощущение, что близкие люди ненадёжны и могут исчезнуть',
        belief: 'Меня в любой момент могут бросить',
      }),
    ).not.toThrow();
  });

  it('без убеждения — компактнее, не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const withBelief = document.createElement('canvas');
    drawSchemaCard(withBelief, {
      domain: 'Отвержение',
      domainColor: 'var(--accent-blue)',
      name: 'Покинутость',
      desc: 'Описание',
      belief: 'Цитата',
    });
    const noBelief = document.createElement('canvas');
    drawSchemaCard(noBelief, {
      domain: 'Отвержение',
      domainColor: 'var(--accent-blue)',
      name: 'Покинутость',
      desc: 'Описание',
    });
    expect(noBelief.height).toBeLessThan(withBelief.height);
  });

  it('свой footerLabel (для режимов) переопределяет подпись по умолчанию', () => {
    const ctx = mockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const canvas = document.createElement('canvas');
    drawSchemaCard(canvas, {
      domain: 'Ребёнок',
      domainColor: '#5aa8f7',
      name: 'Уязвимый ребёнок',
      desc: 'Описание режима',
      footerLabel: 'Режимы',
    });
    expect(ctx.fillText).toHaveBeenCalledWith(
      'Режимы',
      expect.any(Number),
      expect.any(Number),
    );
  });
});
