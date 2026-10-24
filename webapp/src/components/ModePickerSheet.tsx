import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { MODE_GROUPS, ALL_MODES } from '../schemaTherapyData';
import {
  MODE_DESC,
  POPULAR_MODE_IDS,
} from '../../../shared/src/mode/modePickerDesc';
import { useAutosavedSelection } from '../../../shared/src/hooks/useAutosavedSelection';
import { MODE_GROUP_HUE, hueStyle } from '../lib/tone';
import { SsSheet } from './schemaSheets/SsSheet';
import { PickRow } from './schemaSheets/PickRow';

// Выбиралка режимов — вынесена из SchemasSection.tsx (правило №10, потолок
// файла). Кнопка «Готово» только закрывает (автосохранение —
// useAutosavedSelection, жалоба пользователя, закрытый PR #237).
export function ModePickerSheet({
  selected,
  onSave,
  onClose,
}: {
  selected: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const { ids, toggle } = useAutosavedSelection(selected, onSave);

  return (
    <SsSheet
      onBack={goBack}
      barRight={
        <button onClick={goBack} className="ds-btn ds-btn--sm">
          Готово{ids.length > 0 ? ` · ${ids.length}` : ''}
        </button>
      }
    >
      <div className="ss-head">
        <h1 className="ss-title">Мои режимы</h1>
        <p className="ss-lede">
          {tr('Выбери режимы которые ты замечаешь у себя. Выбор сохраняется сразу.', 'Выберите режимы которые вы замечаете у себя. Выбор сохраняется сразу.')}
        </p>
      </div>

      <div className="ss-pick-group">
        <div className="ds-eyebrow">С чего начать</div>
        {POPULAR_MODE_IDS.map(id => {
          const mode = ALL_MODES.find(m => m.id === id);
          if (!mode) return null;
          return (
            <PickRow
              key={id}
              name={mode.name}
              desc={MODE_DESC[id]}
              hue={MODE_GROUP_HUE[mode.groupId]}
              active={ids.includes(id)}
              onToggle={() => toggle(id)}
            />
          );
        })}
      </div>

      <div className="ds-eyebrow">Все режимы</div>

      {MODE_GROUPS.map(group => (
        <div key={group.id} className="ss-pick-group" style={hueStyle(MODE_GROUP_HUE[group.id])}>
          <div className="ss-pick-eyebrow tone-ink">
            <span className="ds-dot tone-fill" />
            {group.group}
          </div>
          {group.items.filter(m => !POPULAR_MODE_IDS.includes(m.id)).map(m => (
            <PickRow
              key={m.id}
              name={m.name}
              desc={MODE_DESC[m.id]}
              hue={MODE_GROUP_HUE[group.id]}
              active={ids.includes(m.id)}
              onToggle={() => toggle(m.id)}
            />
          ))}
        </div>
      ))}
    </SsSheet>
  );
}
