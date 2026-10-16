import { useTr } from '../../utils/addressForm';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { SsSheet, SsHead } from '../schemaSheets/SsSheet';
import { buildModeCheckin, type ModeCheckinItem } from './data';

// Чек-ин «режим прямо сейчас»: выбор ощущения → результат с подсказкой.
// Вынесено из ModesTab.tsx (правило №10).
export function ModeCheckin({ mode, onPick, onBack, onDone }: {
  mode: ModeCheckinItem | null;
  onPick: (item: ModeCheckinItem) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const tr = useTr();
  if (mode) {
    return (
      <SsSheet onBack={onDone} zIndex={400} narrow>
        <div className="ss-center">
          <IdentityDot color={mode.color} size={40} />
          <SsHead center eyebrow="Режим" title={mode.mode} />
        </div>
        <div className="ds-card ss-card-stack">
          <div className="ds-eyebrow">Что помогает</div>
          <p className="ss-body">{mode.tip}</p>
        </div>
        <div className="ss-foot">
          <button onClick={onDone} className="ds-btn">Понятно</button>
        </div>
      </SsSheet>
    );
  }
  return (
    <SsSheet onBack={onBack} zIndex={400}>
      <SsHead
        eyebrow="Режим прямо сейчас"
        title={<>{tr('Как ты', 'Как вы')}<br /><i>сейчас?</i></>}
        lede={tr('Выбери самое близкое ощущение', 'Выберите самое близкое ощущение')}
      />
      <div className="ss-checkin-grid">
        {buildModeCheckin(tr).map((item) => (
          <button key={item.label} onClick={() => onPick(item)} className="ds-card ds-card--hover ss-checkin-btn">
            <IdentityDot color={item.color} size={22} />
            {item.label}
          </button>
        ))}
      </div>
    </SsSheet>
  );
}
