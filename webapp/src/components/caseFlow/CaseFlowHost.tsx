// Поток «Что это было» вместе с картой себя (flow ⇄ map) — один хост на два
// входа сайта: карточка на /today (CaseEntryBlock) и быстрое действие «+» /
// ⌘K (quickActions). Раньше связку «поток → карта → снова поток» держал
// CaseEntryBlock, и второй вход получил бы копию (правило «одна механика —
// один компонент»). Ленивые чанки: экраны открываются по тапу, а не при
// каждом заходе на раздел.
import { lazy, Suspense, useState } from 'react';
import { api } from '../../api';

const CaseFlowScreen = lazy(() => import('./CaseFlowScreen').then((m) => ({ default: m.CaseFlowScreen })));
const SelfMapOverlay = lazy(() => import('../selfMap/SelfMapOverlay').then((m) => ({ default: m.SelfMapOverlay })));

export type CaseFlowStart = 'flow' | 'map';

interface Props {
  start: CaseFlowStart;
  caseCount: number;
  onClose: () => void;
  onOpenTracker: () => void;
  onOpenSchema: (opts?: { startTest?: boolean; tab?: 'needs' | 'schemas' | 'modes'; highlight?: string }) => void;
}

export function CaseFlowHost({ start, caseCount, onClose, onOpenTracker, onOpenSchema }: Props) {
  const [view, setView] = useState<CaseFlowStart>(start);
  return (
    <Suspense fallback={null}>
      {view === 'flow' ? (
        <CaseFlowScreen
          caseCount={caseCount}
          onSave={async (data) => { await api.createModeDiary(data); }}
          onSaveCard={async (body) => { await api.saveModeNote(body); }}
          onSteadyDay={onOpenTracker}
          onOpenMap={() => setView('map')}
          onClose={onClose}
          onDoubt={() => {}}
        />
      ) : (
        <SelfMapOverlay
          onClose={onClose}
          onStartCase={() => setView('flow')}
          onOpenTracker={onOpenTracker}
          onOpenSchema={onOpenSchema}
        />
      )}
    </Suspense>
  );
}
