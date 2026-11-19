// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { glue } from '../../../../shared/src/utils/typo';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { NeedExplainer } from './NeedExplainer';
import { resetExampleRotation } from '../../../../shared/src/needs/exampleRotation';
import { LOW_PHONE_MEDIA } from '../useLowPhone';
import type { NeedExtra } from '../../../../shared/src/needs/types';

const pool = ['Кто-то обнял', 'Был разговор, где услышали', 'Третий пример', 'Четвёртый пример', 'Пятый пример', 'Шестой пример'];
const data = { name: 'Привязанность', desc: 'Рядом есть надёжные люди.', examples: pool } as unknown as NeedExtra;
const shown = (c: HTMLElement) => [...c.querySelectorAll('li')].map((li) => li.textContent);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(resetExampleRotation);

describe('NeedExplainer', () => {
  it('описание потребности всегда на экране, примеров ровно два — из пула', () => {
    const { container } = render(<NeedExplainer data={data} />);
    expect(screen.getByText('Рядом есть надёжные люди.')).toBeTruthy();
    const items = shown(container);
    expect(items).toHaveLength(2);
    const glued = pool.map((p) => glue(p));
    for (const it of items) expect(glued).toContain(it);
  });

  it('при каждом открытии вопроса примеры другие, а перерисовка их не меняет', () => {
    const first = render(<NeedExplainer data={data} />);
    const a = shown(first.container);
    first.rerender(<NeedExplainer data={{ ...data }} />);
    expect(shown(first.container)).toEqual(a);
    first.unmount();
    for (let i = 0; i < 10; i++) {
      const next = render(<NeedExplainer data={data} />);
      const b = shown(next.container);
      expect(b.filter((x) => a.includes(x))).toEqual([]);
      a.splice(0, a.length, ...b);
      next.unmount();
    }
  });

  // QA мобильной версии 2026-11, З5: раскрытые сразу примеры на 390×664 и 360×640
  // сталкивали все пять ответов за край экрана — даже у новичка они свёрнуты.
  it('примеры свёрнуты в «Например» и раскрываются по тапу', () => {
    const { container } = render(<NeedExplainer data={data} />);
    const details = container.querySelector('details');
    expect(details?.open).toBe(false);
    fireEvent.click(screen.getByText('Например'));
    expect(details?.open).toBe(true);
  });

  // Низкий телефон (360×640, 390×664): описание уходит под тап вместе с примерами — иначе пятый ответ под сгибом.
  it('на низком телефоне описание — внутри «Что это и примеры», а без примеров остаётся на листе', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === LOW_PHONE_MEDIA }));
    const { container, unmount } = render(<NeedExplainer data={data} />);
    const details = container.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(details.contains(screen.getByText('Рядом есть надёжные люди.'))).toBe(true);
    expect(container.querySelectorAll('.tq-desc')).toHaveLength(1);
    expect(shown(container)).toHaveLength(2);
    fireEvent.click(screen.getByText('Что это и примеры'));
    expect(details.open).toBe(true);
    unmount();
    const bare = render(<NeedExplainer data={{ ...data, examples: [] }} />);
    expect(bare.container.querySelector('details')).toBeNull();
    expect(screen.getByText('Рядом есть надёжные люди.')).toBeTruthy();
  });

  it('без контента ничего не рисует', () => {
    const { container } = render(<NeedExplainer data={undefined} />);
    expect(container.innerHTML).toBe('');
  });
});
