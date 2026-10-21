import { lazy, Suspense } from 'react';
import type { SiteScreenBlocks } from './useScreenBlocks';

// Лист открывается по тапу — отдельным чанком, основной бандл не раздувается.
const ScreenCustomizeSheet = lazy(() => import('./ScreenCustomizeSheet').then(m => ({ default: m.ScreenCustomizeSheet })));

/** Лист «Настроить экран» для «Профиля» и «Паттернов»: монтируется, пока sheet открыт. */
export function ScreenCustomizeHost({ blocks }: { blocks: SiteScreenBlocks }) {
  if (blocks.sheet === null) return null;
  return (
    <Suspense fallback={null}>
      <ScreenCustomizeSheet blocks={blocks} />
    </Suspense>
  );
}
