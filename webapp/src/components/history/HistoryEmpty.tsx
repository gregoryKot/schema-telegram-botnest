import { useTr } from '../../utils/addressForm';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { glue } from '../../../../shared/src/utils/typo';
import { hueStyle } from '../../lib/tone';
import { SceneCheckIn } from '../art/LandingScenesMore';
import { Strokes } from '../art/PaperArt';
export function HistoryEmpty({ onGoToToday }: { onGoToToday?: () => void }) {
  const tr = useTr(), { hue } = ENTITY_LOOK.tracker;
  return (
    <div className="pp-paper sd-empty" style={hueStyle(hue)}>
      <div className="sd-empty-scene" aria-hidden="true"><SceneCheckIn hue={hue} days={0} /><Strokes values={[null, null, null, null, null]} even size="square" /></div>
      <p className="sd-empty-lead">{glue(tr('Заполни трекер сегодня – через 3–5 дней начнёт проявляться паттерн', 'Заполните трекер сегодня – через 3–5 дней начнёт проявляться паттерн'))}</p>
      {onGoToToday && <button onClick={onGoToToday} className="ds-btn sd-empty-cta">Заполнить сегодня</button>}
    </div>
  );
}
