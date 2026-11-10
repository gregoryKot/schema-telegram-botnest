import { useState, type CSSProperties } from 'react';
import { useTr } from '../../utils/addressForm';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { SignArt } from '../art/SignArt';
import { SsSheet, SsHead } from '../schemaSheets/SsSheet';
import { buildModeCheckin, type ModeCheckinItem } from './data';
import { checkinLook } from './modesLook';

// Чек-ин «Режим прямо сейчас»: выбор ощущения → режим и что помогает. Оба шага —
// один лист с одной записью истории (один хук на весь поток): системная «Назад»
// и Escape закрывают чек-ин, справочник схем под ним остаётся. «Назад» на
// экране результата закрывает весь чек-ин, а не возвращает к выбору. Вид (2026-11): плитки бумаги группы
// со знаком (checkinLook), результат — лист-герой режима, «Что помогает» — белый лист с Leaf.
export function ModeCheckinOverlay({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const [mode, setMode] = useState<ModeCheckinItem | null>(null);

  if (mode) {
    return (
      <SsSheet onBack={goBack} zIndex={400} narrow>
        <SsHead look={checkinLook(mode)} eyebrow="Режим" title={mode.mode} />
        <div className="ds-card ss-card-stack ss-tip-card">
          <div className="ss-tip-head"><span className="pp-row-art" aria-hidden="true"><SignArt sign="leaf" size="row" /></span><div className="ds-eyebrow">Что помогает</div></div>
          <p className="ss-body ss-body--lead">{mode.tip}</p>
        </div>
        <div className="ss-foot"><button onClick={goBack} className="ds-btn">Понятно</button></div>
      </SsSheet>
    );
  }
  return (
    <SsSheet onBack={goBack} zIndex={400}>
      <SsHead look="modes" compact
        eyebrow="Режим прямо сейчас"
        title={<>{tr('Как ты', 'Как вы')}<br /><i>сейчас?</i></>}
        lede={tr('Выбери самое близкое ощущение', 'Выберите самое близкое ощущение')}
      />
      <div className="ss-checkin-grid">
        {buildModeCheckin(tr).map((item) => {
          const look = checkinLook(item);
          return (
            <button key={item.label} onClick={() => setMode(item)} className="pp-paper ss-checkin-btn" style={{ '--h': look.hue } as CSSProperties}>
              <span className="ss-checkin-tile-sign" aria-hidden="true"><SignArt sign={look.sign} size="square" /></span>
              {item.label}
            </button>
          );
        })}
      </div>
    </SsSheet>
  );
}
