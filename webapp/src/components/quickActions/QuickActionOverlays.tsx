// Оверлей выбранного быстрого действия «плюса» (дневники, разбор случая,
// дыхание/заземление/«Стоп»). Состояние хранит useOverlays (quickAction), чтобы
// «+» и ⌘K открывали одно и то же. Всё ленивое: чанки грузятся по тапу.
import { lazy, Suspense, useEffect, useState } from 'react';
import { api, reportClientError } from '../../api';
import { diaryToday } from '../../../../shared/src/diary/diaryDay';
import { CaseFlowHost } from '../caseFlow/CaseFlowHost';
import { QuickPracticeSheet } from '../practice/QuickPracticeSheet';
import type { OverlayQuickActionId } from './quickActionRouting';

const SchemaEntrySheet = lazy(() => import('../diary/SchemaEntrySheet').then((m) => ({ default: m.SchemaEntrySheet })));
const ModeEntrySheet = lazy(() => import('../diary/ModeEntrySheet').then((m) => ({ default: m.ModeEntrySheet })));
const GratitudeEntrySheet = lazy(() => import('../diary/GratitudeEntrySheet').then((m) => ({ default: m.GratitudeEntrySheet })));

interface Props {
  active: OverlayQuickActionId | null;
  onClose: () => void;
  onOpenTracker: () => void;
  onOpenSchema: React.ComponentProps<typeof CaseFlowHost>['onOpenSchema'];
}

// Число прошлых разборов нужно потоку для первой фразы; пока грузится — ничего
// не показываем, ошибка читается как «первый разбор».
function QuickCase({ onClose, onOpenTracker, onOpenSchema }: Omit<Props, 'active'>) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    api.getModeDiary()
      .then((rows) => { if (alive) setCount(rows.length); })
      .catch(() => { if (alive) setCount(0); });
    return () => { alive = false; };
  }, []);
  if (count === null) return null;
  return <CaseFlowHost start="flow" caseCount={count} onClose={onClose} onOpenTracker={onOpenTracker} onOpenSchema={onOpenSchema} />;
}

function QuickSchemaEntry({ onClose }: { onClose: () => void }) {
  const [activeSchemaIds, setIds] = useState<string[] | undefined>();
  useEffect(() => {
    let alive = true;
    api.getProfile().then((p) => { if (alive) setIds(p.ysq.activeSchemaIds); }).catch(() => reportClientError({ message: 'quick schema entry: профиль не загрузился', section: 'quickActions' }));
    return () => { alive = false; };
  }, []);
  return (
    <SchemaEntrySheet
      activeSchemaIds={activeSchemaIds}
      onClose={onClose}
      onSave={async (data) => { await api.createSchemaDiary(data); }}
    />
  );
}

export function QuickActionOverlays({ active, ...rest }: Props) {
  if (active === null) return null;
  const { onClose } = rest;
  switch (active) {
    case 'case':
      return <Suspense fallback={null}><QuickCase {...rest} /></Suspense>;
    case 'diary_schema':
      return <Suspense fallback={null}><QuickSchemaEntry onClose={onClose} /></Suspense>;
    case 'diary_mode':
      return (
        <Suspense fallback={null}>
          <ModeEntrySheet onClose={onClose} onSave={async (data) => { await api.createModeDiary(data); }} />
        </Suspense>
      );
    case 'diary_gratitude':
      return (
        <Suspense fallback={null}>
          <GratitudeEntrySheet
            onClose={onClose}
            date={diaryToday()}
            onSave={async (date, items) => { await api.createGratitudeDiary(date, items); }}
          />
        </Suspense>
      );
    case 'breathing':
    case 'grounding':
    case 'stop':
      return <QuickPracticeSheet id={active} onClose={onClose} />;
    default: {
      const _exhaustive: never = active;
      return _exhaustive;
    }
  }
}
