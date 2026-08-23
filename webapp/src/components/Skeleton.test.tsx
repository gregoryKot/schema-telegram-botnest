// @vitest-environment jsdom
// Skeleton (webapp) — примитив скелетона загрузки, аналог
// schema-miniapp/src/components/Skeleton.tsx (правило CLAUDE.md
// «скелетоны по форме контента, не спиннеры», парные файлы — правило №3).
// Раньше .skel-плашка красилась фиксированным rgba(255,255,255,.07) — в
// светлой теме почти сливалась с почти-белым --bg (тот же артефакт, что
// нашёлся в schema-miniapp — скрин владельца 2026-08-23). Теперь цвет — на
// rgba(var(--fg-rgb),…), проверяем здесь только, что примитив не красит
// плашку инлайн-градиентом мимо общего класса .skel.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Skeleton, SkeletonCard, SkeletonList, ScreenSkeleton } from './Skeleton';

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
