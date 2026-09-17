// Скелетоны карточек вкладки «Я» — форма повторяет силуэт будущей карточки
// (правило CLAUDE.md «скелетоны по форме контента», а не серые
// прямоугольники). Часть прогрессивного рендера ProfileSection.tsx (замер
// 2026-08-22): каждая карточка ждёт только свои данные, а этот файл — то,
// что видно, пока они летят. Общий примитив — components/Skeleton.tsx,
// новый шиммер здесь не пишем (правило «одна механика — один компонент»).
import type { ReactNode } from 'react';
import { Skeleton, SkeletonLines } from '../../components/Skeleton';
import { STREAK_HEAD_GAP, STREAK_BAR_GAP } from './StreakCard';

function CardShell({
  children,
  pad = '16px 16px 18px',
  testId,
}: {
  children: ReactNode;
  pad?: string;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="card"
      style={{ borderRadius: 'var(--r-20)', padding: pad }}
    >
      {children}
    </div>
  );
}

/** «Мой портрет»: заголовок + пять полосок-доменов. */
export function PortraitCardSkeleton() {
  return (
    <CardShell testId="portrait-skeleton">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <Skeleton w={90} h={10} radius={4} />
        <Skeleton w={60} h={10} radius={4} />
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-10)',
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-10)',
            }}
          >
            <Skeleton w={110} h={10} radius={4} />
            <Skeleton w="100%" h={8} radius={4} />
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/** «Тёплые слова»: заголовок + три строки цитаты. */
export function WarmWordsCardSkeleton() {
  return (
    <CardShell testId="warm-words-skeleton">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <Skeleton w={140} h={10} radius={4} />
        <Skeleton w={50} h={10} radius={4} />
      </div>
      <SkeletonLines widths={['95%', '80%', '55%']} />
    </CardShell>
  );
}

/** «Серия дней»: крупное число + строка недельных отметок. */
export function StreakCardSkeleton() {
  return (
    <CardShell pad="20px 20px 18px" testId="streak-skeleton">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 'var(--space-10)',
          marginBottom: STREAK_HEAD_GAP,
        }}
      >
        <Skeleton w={64} h={48} radius={10} />
        <Skeleton w={80} h={12} radius={6} />
      </div>
      <div style={{ display: 'flex', gap: STREAK_BAR_GAP }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} w="100%" h={5} radius={3} />
        ))}
      </div>
    </CardShell>
  );
}

/** «Достижения»: заголовок + ряд карточек-значков. */
export function AchievementsCardSkeleton() {
  return (
    <CardShell pad="16px 0 16px 16px" testId="achievements-skeleton">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 14,
          paddingRight: 16,
        }}
      >
        <Skeleton w={100} h={10} radius={4} />
        <Skeleton w={40} h={10} radius={4} />
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-8)', paddingRight: 16 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} w={96} h={48} radius={14} />
        ))}
      </div>
    </CardShell>
  );
}

/** «Паттерны»: заголовок + несколько полосок-потребностей. */
export function InsightsCardSkeleton() {
  return (
    <CardShell testId="insights-skeleton">
      <Skeleton w={80} h={10} radius={4} style={{ marginBottom: 14 }} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-12)',
        }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Skeleton w="60%" h={10} radius={4} style={{ marginBottom: 6 }} />
            <Skeleton w="100%" h={6} radius={4} />
          </div>
        ))}
      </div>
    </CardShell>
  );
}
