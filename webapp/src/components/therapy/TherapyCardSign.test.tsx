// @vitest-environment jsdom
// Знак карточки моста: спокойная — Talk; по сигналу — знак того, что заметили; полоски — только из данных сигнала.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Strokes } from '../art/PaperArt';
import { SignArt } from '../art/SignArt';
import { TherapyCardSign } from './TherapyCardSign';

afterEach(cleanup);
const html = (ui: ReactElement) => { const h = render(ui).container.innerHTML; cleanup(); return h; };

describe('TherapyCardSign', () => {
  it('без сигнала — знак разговора', () => {
    expect(html(<TherapyCardSign />)).toBe(html(<SignArt sign="talk" size="row" />));
  });

  it('низкий индекс — три полоски одного тона по индексам дней сигнала, от раннего к свежему', () => {
    const { container } = render(<TherapyCardSign signal={{ trigger: 'low_index', eyebrow: 'x', days: [2, 3.4, 4] }} />);
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('pp-art--row');
    const rects = [...container.querySelectorAll('rect[data-value]')];
    expect(rects.map((r) => r.getAttribute('data-value'))).toEqual(['2', '3.4', '4']);
    // Дни, а не потребности: один тон; выше индекс — выше полоска, низ на общей линии.
    expect(new Set(rects.map((r) => r.getAttribute('fill'))).size).toBe(1);
    const h = rects.map((r) => Number(r.getAttribute('height')));
    expect(h[0]).toBeLessThan(h[1]);
    expect(h[1]).toBeLessThan(h[2]);
    expect(new Set(rects.map((r) => Number(r.getAttribute('y')) + Number(r.getAttribute('height')))).size).toBe(1);
  });

  it('низкий индекс без значений — обезличенные полоски, не выдуманные оценки', () => {
    const got = html(<TherapyCardSign signal={{ trigger: 'low_index', eyebrow: 'x' }} />);
    expect(got).toBe(html(<Strokes size="row" />));
    expect(got).not.toContain('data-value');
  });

  it.each([['repeat_mode', 'cluster'], ['crisis', 'heart']] as const)('%s — знак %s', (trigger, sign) => {
    expect(html(<TherapyCardSign signal={{ trigger, eyebrow: 'x' }} />)).toBe(html(<SignArt sign={sign} size="row" />));
  });
});
