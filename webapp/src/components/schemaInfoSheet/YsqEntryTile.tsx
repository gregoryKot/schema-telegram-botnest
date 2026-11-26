import { useTr } from '../../utils/addressForm';
import { SceneQuizMini } from '../art/LandingScenesMore';
import { GlyphArrowRight } from '../exercises/ExGlyphs';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { ysqEntryTile, type YsqEntryState } from './ysqEntry';
import { glue } from '../../../../shared/src/utils/typo';

// Вход в тест внутри листа справочника: белый лист на бумаге схем со сплошной тенью, слева веер
// карточек теста (SceneQuizMini — единственная картинка героя: своего знака у листа справочника нет,
// ревью g5 r2), справа стрелка. Одна плитка на все состояния (ysqEntry.ts).
export function YsqEntryTile({ state, onOpen }: { state: YsqEntryState; onOpen: () => void }) {
  const tr = useTr();
  const { label, title, sub } = ysqEntryTile(state, tr);
  return (
    <button type="button" className="ss-ysq-tile" onClick={onOpen}>
      <span className="ss-ysq-tile-art" aria-hidden="true"><SceneQuizMini hue={ENTITY_LOOK.ysq.hue} /></span>
      <span className="ss-cta-text">
        {label && <span className="ds-label ss-ysq-tile-label">{label}</span>}
        <span className="ss-cta-title">{glue(title)}</span>
        <span className="ss-ysq-tile-sub">{glue(sub)}</span>
      </span>
      <span className="ss-ysq-tile-go" aria-hidden="true"><GlyphArrowRight /></span>
    </button>
  );
}
