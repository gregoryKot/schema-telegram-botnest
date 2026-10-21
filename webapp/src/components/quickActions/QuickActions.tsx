// Точка подключения быстрых действий в AppShell: кнопка «+» (мобильная
// вёрстка), её лист и оверлей выбранного действия. Состояние оверлея — в
// useOverlays (ov.quickAction), палитра ⌘K открывает то же через
// ov.runQuickAction.
import { lazy, Suspense, useState } from 'react';
import type { useOverlays } from '../appShell/useOverlays';
import { PlusButton } from './PlusButton';

// Лист и оверлеи открываются по тапу — отдельными чанками, не в основном.
const PlusMenuSheet = lazy(() => import('./PlusMenuSheet').then((m) => ({ default: m.PlusMenuSheet })));
const QuickActionOverlays = lazy(() => import('./QuickActionOverlays').then((m) => ({ default: m.QuickActionOverlays })));

export function QuickActions({ ov, showButton }: { ov: ReturnType<typeof useOverlays>; showButton: boolean }) {
  const [menu, setMenu] = useState(false);
  return (
    <>
      {showButton && <PlusButton onOpen={() => setMenu(true)} />}
      <Suspense fallback={null}>
        {menu && <PlusMenuSheet onAction={ov.runQuickAction} onClose={() => setMenu(false)} />}
        {ov.quickAction !== null && (
          <QuickActionOverlays
            active={ov.quickAction}
            onClose={() => ov.setQuickAction(null)}
            onOpenTracker={() => ov.runQuickAction('tracker')}
            onOpenSchema={ov.openSchema}
          />
        )}
      </Suspense>
    </>
  );
}
