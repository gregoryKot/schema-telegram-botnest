// Хост оверлея быстрого действия в AppShell. Кнопки «+» на сайте нет (простой клиент,
// этап 3): действие запускают палитра ⌘K (ov.runQuickAction) и start-параметры. Состояние
// оверлея — в useOverlays (ov.quickAction).
import { lazy, Suspense } from 'react';
import type { useOverlays } from '../appShell/useOverlays';

// Оверлеи открываются по действию — отдельным чанком, не в основном.
const QuickActionOverlays = lazy(() => import('./QuickActionOverlays').then((m) => ({ default: m.QuickActionOverlays })));

export function QuickActions({ ov }: { ov: ReturnType<typeof useOverlays> }) {
  return (
    <Suspense fallback={null}>
      {ov.quickAction !== null && (
        <QuickActionOverlays
          active={ov.quickAction}
          onClose={() => ov.setQuickAction(null)}
          onOpenTracker={() => ov.runQuickAction('tracker')}
          onOpenSchema={ov.openSchema}
        />
      )}
    </Suspense>
  );
}
