import { lazy, Suspense } from 'react';
import { api } from '../../api';
import { diaryToday } from '../../../../shared/src/diary/diaryDay';

const SchemaEntrySheet = lazy(() => import('../../components/diary/SchemaEntrySheet').then(m => ({ default: m.SchemaEntrySheet })));
const ModeEntrySheet = lazy(() => import('../../components/diary/ModeEntrySheet').then(m => ({ default: m.ModeEntrySheet })));
const GratitudeEntrySheet = lazy(() => import('../../components/diary/GratitudeEntrySheet').then(m => ({ default: m.GratitudeEntrySheet })));

interface Props {
  kind: 'schema' | 'mode' | 'gratitude';
  activeSchemaIds?: string[];
  /** Уже записанные сегодня пункты благодарности */
  gratitudeToday?: string[];
  onClose: () => void;
  onSaved: () => void;
}

// Запись выбранной практики прямо с «Сегодня»: те же листы и те же вызовы API,
// что в разделе «Дневник» (DiarySection) — без перехода туда и обратно.
export function FocusEntrySheet({ kind, activeSchemaIds, gratitudeToday, onClose, onSaved }: Props) {
  const done = () => { onSaved(); onClose(); };
  return (
    <div className="u-sheet">
      <Suspense fallback={null}>
        {kind === 'schema' && (
          <SchemaEntrySheet activeSchemaIds={activeSchemaIds} onClose={onClose}
            onSave={async data => { await api.createSchemaDiary(data); done(); }} />
        )}
        {kind === 'mode' && (
          <ModeEntrySheet onClose={onClose}
            onSave={async data => { await api.createModeDiary(data); done(); }} />
        )}
        {kind === 'gratitude' && (
          <GratitudeEntrySheet onClose={onClose} date={diaryToday()} existingItems={gratitudeToday}
            onSave={async (date, items) => { await api.createGratitudeDiary(date, items); done(); }} />
        )}
      </Suspense>
    </div>
  );
}
