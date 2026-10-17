import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { SsSheet, SsHead } from '../schemaSheets/SsSheet';
import { buildModeCheckin, type ModeCheckinItem } from './data';

// Чек-ин «Режим прямо сейчас»: выбор ощущения → режим и что помогает. Оба шага —
// один лист с одной записью истории (один хук на весь поток): системная «Назад»
// и Escape закрывают чек-ин, справочник схем под ним остаётся. «Назад» на
// экране результата закрывает весь чек-ин, а не возвращает к выбору — как и было.
export function ModeCheckinOverlay({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const [mode, setMode] = useState<ModeCheckinItem | null>(null);

  if (mode) {
    return (
      <SsSheet onBack={goBack} zIndex={400} narrow>
        <div className="ss-center">
          <IdentityDot color={mode.color} size={40} />
          <SsHead center eyebrow="Режим" title={mode.mode} />
        </div>
        <div className="ds-card ss-card-stack">
          <div className="ds-eyebrow">Что помогает</div>
          <p className="ss-body">{mode.tip}</p>
        </div>
        <div className="ss-foot">
          <button onClick={goBack} className="ds-btn">Понятно</button>
        </div>
      </SsSheet>
    );
  }
  return (
    <SsSheet onBack={goBack} zIndex={400}>
      <SsHead
        eyebrow="Режим прямо сейчас"
        title={<>{tr('Как ты', 'Как вы')}<br /><i>сейчас?</i></>}
        lede={tr('Выбери самое близкое ощущение', 'Выберите самое близкое ощущение')}
      />
      <div className="ss-checkin-grid">
        {buildModeCheckin(tr).map((item) => (
          <button key={item.label} onClick={() => setMode(item)} className="ds-card ds-card--hover ss-checkin-btn">
            <IdentityDot color={item.color} size={22} />
            {item.label}
          </button>
        ))}
      </div>
    </SsSheet>
  );
}
