import { useState, type CSSProperties } from 'react';
import { useTr } from '../../utils/addressForm';
import { glue } from '../../../../shared/src/utils/typo';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { SignArt } from '../art/SignArt';
import { SsSheet, SsHead } from '../schemaSheets/SsSheet';
import { TipHead } from '../schemaSheets/TipHead';
import { buildModeCheckin, type ModeCheckinItem } from './data';
import { checkinLook, checkinTiles } from './modesLook';

// Чек-ин «Режим прямо сейчас»: выбор ощущения → режим и что помогает. Оба шага — один лист с одной записью
// истории (один хук на весь поток): системная «Назад» и Escape закрывают чек-ин, справочник под ним остаётся;
// «Назад» на результате закрывает весь чек-ин. Вид (2026-11): плитки бумаги группы со знаком (checkinLook), у плитки
// без знака (серия, checkinTiles) подпись по центру — без пустого слота сверху; подпись склеена (glue); результат —
// разворот: на ≥1024 лист-герой режима со знаком крупно слева, «Что помогает» (белый лист с Leaf) справа, а не узкая
// колонка посреди пустоты (ревью g5 r1).
export function ModeCheckinOverlay({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const [mode, setMode] = useState<ModeCheckinItem | null>(null);

  if (mode) {
    return (
      <SsSheet onBack={goBack} zIndex={400} spread hero={<SsHead look={checkinLook(mode)} eyebrow="Режим" title={mode.mode} />}>
        <div className="ds-card ss-card-stack ss-tip-card">
          <TipHead>Что помогает</TipHead>
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
        {checkinTiles(buildModeCheckin(tr)).map(({ item, hue, sign }) => (
          <button key={item.label} onClick={() => setMode(item)} className={sign ? 'pp-paper ss-checkin-btn' : 'pp-paper ss-checkin-btn ss-checkin-btn--bare'} style={{ '--h': hue } as CSSProperties}>
            {sign && <span className="ss-checkin-tile-sign" aria-hidden="true"><SignArt sign={sign} size="square" /></span>}
            <span className="ss-checkin-label">{glue(item.label)}</span>
          </button>
        ))}
      </div>
    </SsSheet>
  );
}
