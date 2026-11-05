import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { useAutosavedSelection } from '../../../shared/src/hooks/useAutosavedSelection';
import { DOMAIN_HUE, hueStyle } from '../lib/tone';
import { SsSheet, SsHead } from './schemaSheets/SsSheet';
import { PickRow } from './schemaSheets/PickRow';

interface Props {
  selected: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}

export function SchemaPickerSheet({ selected, onSave, onClose }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const { ids, toggle } = useAutosavedSelection(selected, onSave);

  return (
    <SsSheet onBack={goBack}>
      <SsHead
        eyebrow="Схемы"
        title="Мои схемы"
        lede={tr('Выбери схемы, которые тебе близки. Можно без теста – если ты уже знаешь свои. Выбор сохраняется сразу.', 'Выберите схемы, которые вам близки. Можно без теста – если вы уже знаете свои. Выбор сохраняется сразу.')}
      />
      {SCHEMA_DOMAINS.map(domain => (
        <div key={domain.id} className="ss-pick-group" style={hueStyle(DOMAIN_HUE[domain.id])}>
          <div className="ss-pick-eyebrow tone-ink">
            <span className="ds-dot tone-fill" />
            {domain.domain}
          </div>
          {domain.schemas.map(s => (
            <PickRow
              key={s.id}
              name={s.name}
              desc={s.desc}
              hue={DOMAIN_HUE[domain.id]}
              active={ids.includes(s.id)}
              onToggle={() => toggle(s.id)}
            />
          ))}
        </div>
      ))}
      <div className="ss-foot">
        <button className="ds-btn" onClick={goBack}>Готово</button>
      </div>
    </SsSheet>
  );
}
