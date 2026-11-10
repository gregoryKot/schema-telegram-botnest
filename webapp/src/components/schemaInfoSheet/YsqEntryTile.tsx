import { useTr } from '../../utils/addressForm';
import { SceneQuizMini } from '../art/LandingScenesMore';
import { GlyphArrowRight } from '../exercises/ExGlyphs';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { ysqEntryTile, type YsqEntryState } from './ysqEntry';

// Вход в тест внутри листа справочника: белый лист на бумаге схем со сплошной тенью, слева веер
// карточек теста (SceneQuizMini — тест говорит своей сценой, Layers на листе уже у схем), справа
// стрелка. Одна плитка на все состояния (ysqEntry.ts).
export function YsqEntryTile({ state, onOpen }: { state: YsqEntryState; onOpen: () => void }) {
  const tr = useTr();
  const { label, title, sub } = ysqEntryTile(state, tr);
  return (
    <button type="button" className="ss-ysq-tile" onClick={onOpen}>
      <span className="ss-ysq-tile-art" aria-hidden="true"><SceneQuizMini hue={ENTITY_LOOK.ysq.hue} /></span>
      <span className="ss-cta-text">
        {label && <span className="ds-label ss-ysq-tile-label">{label}</span>}
        <span className="ss-cta-title">{title}</span>
        <span className="ss-ysq-tile-sub">{sub}</span>
      </span>
      <span className="ss-ysq-tile-go" aria-hidden="true"><GlyphArrowRight /></span>
    </button>
  );
}
