// Тихие кнопки плашки «Обычно в методе»: «В план» в строке подписи рубрики и
// «Дать заданием» у пункта. Листы и сиды плана собирает сайт (useConceptGuide).
import type { CSSProperties } from 'react';
import type { BetweenSessionsItem } from '../../schemaTherapy/guide';
import { PLAN_RUBRIC_LABEL } from '../plan/planItem';
import type { ConceptGuideActions, GuideFrom } from './conceptGuide';
import { labelStyle, wordBtn } from './graphStyles';
import { rowBtn } from './guideHintStyles';

const quietBtn: CSSProperties = {
  ...rowBtn,
  flexShrink: 0,
  color: 'var(--text-sub)',
  fontSize: 12,
};
// Зона 44 при строке подписи в одну строку: поля wordBtn вычитают прирост из потока.
const planBtn: CSSProperties = { ...quietBtn, margin: wordBtn.margin };

/** Подпись рубрики; справа «В план», когда сайт дал колбэк. */
export function HintRubricHead({
  rubric,
  onPlan,
}: {
  rubric: 'session' | 'between';
  onPlan?: () => void;
}) {
  const label = PLAN_RUBRIC_LABEL[rubric];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-8)',
      }}
    >
      <span style={labelStyle}>{label}</span>
      {onPlan && (
        <button
          type="button"
          style={planBtn}
          aria-label={`В план: ${label}`}
          onClick={onPlan}
        >
          В план
        </button>
      )}
    </div>
  );
}

/** «Дать заданием» справа от пункта «Между сессиями». */
export function HintAssignButton({
  item,
  from,
  assign,
}: {
  item: BetweenSessionsItem;
  from: GuideFrom;
  assign: NonNullable<ConceptGuideActions['onAssign']>;
}) {
  return (
    <button
      type="button"
      style={quietBtn}
      aria-label={`Дать заданием: ${item.title}`}
      onClick={() => assign(item, from)}
    >
      Дать заданием
    </button>
  );
}
