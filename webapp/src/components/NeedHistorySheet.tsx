import { useState, type CSSProperties } from 'react';
import { useTr } from '../utils/addressForm';
import { hitboxStyle } from '../utils/hitbox';
import type { Need, DayHistory } from '../types';
import { useNeedData } from '../needData';
import { ExScreen } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { NeedAdviceModal } from './NeedAdviceModal';
import { NeedDynamics } from './NeedDynamics';
import { SignArt } from './art/SignArt';
import { NEED_HUE, hueStyle } from '../lib/tone';
import { needDataStyle } from './needDataColor';
import { needLook } from '../../../shared/src/theme/entityLook';
import type { NeedId } from '../../../shared/src/needs/types';
import '../styles/sheet-tracker.css';

interface Props {
  need: Need;
  value: number;
  history: DayHistory[];
  childhoodValue?: number;
  onClose: () => void;
}

// Лист «Динамика потребности» (редизайн 2026-11, APP_2026-11.md, b07): шапка — тот же лист
// потребности, что у вопроса трекера (её бумага и знак; на компьютере — колонкой разворота слева),
// сразу под ним главное — направление за неделю, спарклайн во всю колонку и сравнение с детством
// (NeedDynamics), ниже совет на бумаге потребности со знаком и теги. График — в широкой колонке,
// а не под листом слева: в 440px неделя сжималась в пилу, а правая колонка оставалась пустой.
export function NeedHistorySheet({ need, value, history, childhoodValue, onClose }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const NEED_DATA = useNeedData();
  // Случайная доля для выбора совета — фиксируется один раз при монтировании.
  // Хук объявляется ДО раннего `return null` ниже (react-hooks/rules-of-hooks);
  // индекс выводится из неё уже после гварда, по актуальному пулу.
  const [tipRand] = useState(() => Math.random());
  const data = NEED_DATA[need.id];
  if (!data) return null;
  const id = need.id as NeedId;
  const tone = { ...hueStyle(NEED_HUE[id]), ...needDataStyle(id) } as CSSProperties;

  const tipKey = value <= 3 ? 'low' : value <= 6 ? 'medium' : 'high';
  const tipPool = data.tips[tipKey];
  const tip = tipPool[Math.floor(tipRand * tipPool.length)];
  const help = hitboxStyle(20, 20, 44);

  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад"
      look={needLook(id)}
      spread
      eyebrow={need.chartLabel}
      title={<>Динамика <span>потребности</span></>}
      lede={data.explanation}
    >
      <div className="tk2-sheet" style={tone}>
        <NeedDynamics needId={need.id} history={history} childhoodValue={childhoodValue} />
        <div className="pp-paper tk2-tip-card">
          <div className="tk2-tip-head">
            <span className="ds-label">{tr('Попробуй сегодня', 'Попробуйте сегодня')}</span>
            <button
              onClick={() => setShowDisclaimer(true)}
              aria-label="Пояснение"
              className="tk2-help"
              style={help.outer}
            >
              <span className="tk2-help-in" style={help.inner}>?</span>
            </button>
          </div>
          <p className="tk2-tip-text">{tip}</p>
          <span className="tk2-tip-sign"><SignArt sign={needLook(id).sign} size="square" /></span>
        </div>

        {data.tags.length > 0 && (
          <div className="tk2-tags">
            {data.tags.map(tag => (
              <span key={tag} className="ds-chip tk2-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {showDisclaimer && <NeedAdviceModal needId={need.id} onClose={() => setShowDisclaimer(false)} />}
    </ExScreen>
  );
}
