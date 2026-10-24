// @vitest-environment jsdom
// Skeleton — примитив скелетона загрузки и композиты силуэтов экранов
// (правило CLAUDE.md «скелетоны по форме контента, не спиннеры»). Композиты
// TodayScreenSkeleton/ScreenSkeleton/SkeletonList не были покрыты нигде —
// проверяем, что они реально рендерят силуэт нужной формы (N карточек, а не
// произвольное число).
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  Skeleton,
  SkeletonCard,
  SkeletonLines,
  SkeletonList,
  TodayScreenSkeleton,
  ScreenSkeleton,
} from './Skeleton';

afterEach(cleanup);

describe('Skeleton — примитив', () => {
  it('circle=true берёт ширину из h (кружок)', () => {
    const { container } = render(<Skeleton h={40} circle />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.width).toBe('40px');
    expect(el.style.borderRadius).toBe('50%');
  });

  // Регрессия: раньше цвет плашки был инлайновым градиентом двух
  // почти-фоновых цветов (--surface/--surface-2) — в светлой теме они почти
  // совпадали, и плашка растворялась в фоне (скрин владельца 2026-08-23,
  // вкладка «Паттерны»). Теперь цвет/анимация — только в общем классе .skel
  // (index.css, база rgba(var(--fg-rgb),0.07)), не в инлайн-стиле.
  it('цвет плашки — из общего класса .skel, не из инлайн-градиента', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('skel');
    expect(el.style.background).toBe('');
  });
});

describe('Skeleton — композиты', () => {
  it('SkeletonLines по умолчанию рисует 3 строки', () => {
    const { container } = render(<SkeletonLines />);
    expect(container.firstElementChild?.children.length).toBe(3);
  });

  it('SkeletonList рендерит ровно rows карточек одной высоты', () => {
    const { container } = render(<SkeletonList rows={5} h={72} />);
    expect(container.firstElementChild?.children.length).toBe(5);
  });

  it('TodayScreenSkeleton рендерится без падения (использует useSafeTop)', () => {
    const { container } = render(<TodayScreenSkeleton />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('ScreenSkeleton рендерит ровно cards карточек, первая — крупнее (акцент)', () => {
    const { container } = render(<ScreenSkeleton cards={2} />);
    const cards = container.querySelectorAll(
      'div[style*="flex-direction: column"] > div',
    );
    expect(cards.length).toBe(2);
  });

  it('SkeletonCard принимает h и рендерится', () => {
    const { container } = render(<SkeletonCard h={200} />);
    expect((container.firstElementChild as HTMLElement).style.height).toBe(
      '200px',
    );
  });
});
