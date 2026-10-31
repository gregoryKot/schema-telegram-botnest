import { useRef, useState } from 'react';
import { api } from '../../api';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { todayStr } from '../../utils/format';
import { SchemaEntrySheet } from './SchemaEntrySheet';
import { ModeEntrySheet } from './ModeEntrySheet';
import { GratitudeEntrySheet } from './GratitudeEntrySheet';
import { ModeSelectScreen } from './ModeSelectScreen';
import { QuickWriteStep } from './quickEntry/QuickWriteStep';
import { QuickSchemaStep } from './quickEntry/QuickSchemaStep';
import { QuickDone } from './quickEntry/QuickDone';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { useQuickEntry } from './quickEntry/useQuickEntry';
import { useActiveSchemaIds } from './quickEntry/useActiveSchemaIds';
import type { QuickTag } from './quickEntry/quickEntryModel';
import '../../styles/sheet-tracker.css';
import '../../styles/tracker-question.css';
import '../../styles/quick-entry.css';

interface Props {
  onClose: () => void;
  /** Запись сохранена (любым путём): главная перечитывает ленту дня. */
  onSaved?: () => void;
}

// «Дневник одной страницей» (простой клиент, этап 3, docs/design/CLIENT_SIMPLE_2026-10.md):
// одно поле «Что на уме?» и необязательный тег. Мысль и благодарность сохраняются сразу,
// схема и режим просят выбрать паттерн вторым экраном. «Заполнить подробно» открывает
// прежний мастер выбранного тега с этим текстом — три мастера живы, но не на пути новичка.
export function QuickEntrySheet({ onClose, onSaved }: Props) {
  const goBack = useHistorySheet(onClose);
  const q = useQuickEntry(onSaved);
  // Правило №7: карточка не пропадает, пока текст не сохранён; на «Записано» поле уже пустое — берём q.crisis.
  const crisis = detectCrisisAny(q.text);
  const [wizard, setWizard] = useState<QuickTag | null>(null);
  const wizardSaved = useRef(false);
  const activeSchemaIds = useActiveSchemaIds(q.stage === 'schema' || wizard === 'schema' || wizard === 'thought');

  const closeWizard = () => {
    const saved = wizardSaved.current;
    wizardSaved.current = false;
    setWizard(null);
    if (saved) q.finish(q.tag, true);
  };
  const onWizardSaved = () => { wizardSaved.current = true; };

  if (wizard === 'schema' || wizard === 'thought') return (
    <SchemaEntrySheet
      activeSchemaIds={activeSchemaIds}
      initialTrigger={q.text}
      onClose={closeWizard}
      onSave={async (data) => { await api.createSchemaDiary(data); onWizardSaved(); }}
    />
  );
  if (wizard === 'mode') return (
    <ModeEntrySheet
      initialSituation={q.text}
      onClose={closeWizard}
      onSave={async (data) => { await api.createModeDiary(data); onWizardSaved(); }}
    />
  );
  if (wizard === 'gratitude') return (
    <GratitudeEntrySheet
      date={todayStr()}
      initialItem={q.text}
      onClose={closeWizard}
      onSave={async (date, items) => { await api.createGratitudeDiary(date, items); onWizardSaved(); }}
    />
  );
  if (q.stage === 'mode') {
    return <ModeSelectScreen modeId="" crisis={crisis} onPick={q.saveMode} onBack={() => q.setStage('write')} />;
  }

  return (
    <div className="tk2-overlay qe-sheet" role="dialog" aria-modal="true" aria-label="Дневник">
      {q.stage === 'write' && (
        <QuickWriteStep
          text={q.text}
          tag={q.tag}
          saving={q.saving}
          error={q.error}
          onText={q.setText}
          onTag={(t) => { q.setTag(t); q.setError(null); }}
          onSubmit={q.submit}
          onDetailed={() => setWizard(q.tag)}
          onClose={goBack}
        />
      )}
      {q.stage === 'schema' && (
        <QuickSchemaStep
          activeSchemaIds={activeSchemaIds}
          saving={q.saving}
          crisis={crisis}
          onBack={() => q.setStage('write')}
          onSave={q.saveSchema}
        />
      )}
      {q.stage === 'done' && <QuickDone crisis={q.crisis} onHome={goBack} onAgain={q.restart} />}
    </div>
  );
}
