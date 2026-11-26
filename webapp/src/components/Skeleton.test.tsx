// @vitest-environment jsdom
// Skeleton (webapp) — примитив скелетона загрузки (правило CLAUDE.md
// «скелетоны по форме контента, не спиннеры»).
// Раньше .skel-плашка красилась фиксированным rgba(255,255,255,.07) — в
// светлой теме почти сливалась с почти-белым --bg (тот же артефакт, что
// нашёлся в удалённом мини-аппе — скрин владельца 2026-08-23). Теперь цвет — на
// rgba(var(--fg-rgb),…), проверяем здесь только, что примитив не красит
// плашку инлайн-градиентом мимо общего класса .skel.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Skeleton, SkeletonCard, SkeletonLines, SkeletonList, ScreenSkeleton } from './Skeleton';

afterEach(cleanup);

describe('Skeleton — примитив', () => {
  it('цвет — из общего класса .skel, не из инлайн-градиента', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('skel');
    expect(el.style.background).toBe('');
  });

  it('height/radius применяются инлайн', () => {
    const { container } = render(<Skeleton height={200} radius={12} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.height).toBe('200px');
    expect(el.style.borderRadius).toBe('12px');
  });

  it('className добавляется к .skel, а не заменяет его: форма из CSS, цвет и шиммер — общие', () => {
    const { container } = render(<Skeleton className="ac-skel-cover" height="auto" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toBe('skel ac-skel-cover');
    expect(el.style.height).toBe('auto');
  });
});

describe('SkeletonLines — строки текста', () => {
  it('по плашке на строку: ширины по порядку, высота кегля у каждой', () => {
    const { container } = render(<SkeletonLines widths={['90%', 120]} height={18} />);
    const bars = Array.from(container.querySelectorAll<HTMLElement>('.skel'));
    expect(bars.map((b) => [b.style.width, b.style.height])).toEqual([['90%', '18px'], ['120px', '18px']]);
  });
});

describe('Skeleton — композиты', () => {
  it('SkeletonList рендерит ровно rows плашек одной высоты', () => {
    const { container } = render(<SkeletonList rows={5} height={52} />);
    expect(container.firstElementChild?.children.length).toBe(5);
  });

  it('SkeletonList по умолчанию — 4 строки', () => {
    const { container } = render(<SkeletonList />);
    expect(container.firstElementChild?.children.length).toBe(4);
  });

  it('SkeletonCard принимает height и рендерится с рамкой на токене --line', () => {
    const { container } = render(<SkeletonCard height={96} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.height).toBe('96px');
    expect(el.style.border).toContain('var(--line)');
  });

  it('ScreenSkeleton рендерится без падения', () => {
    const { container } = render(<ScreenSkeleton />);
    expect(container.firstElementChild).toBeTruthy();
  });
});
