import { useTr } from '../../utils/addressForm';
import type { EntityId } from '../../../../shared/src/theme/entityLook';
import { EntitySheet } from '../../components/paper/EntitySheet';
import type { IntroStep } from './introStep';
import { schemaIntro, modeIntro, diaryIntro } from '../../../../shared/src/pattern/weekPatternText';
interface Props {
  step: IntroStep;
  /** Отвеченных вопросов незаконченного теста (null — не начат). */
  testProgress: number | null;
  onAction: () => void;
}

/** Вид вводной — сущность шага из ENTITY_LOOK: схемы (глина + слои), режимы (небо + круги), дневник. */
const LOOK: Record<IntroStep, EntityId> = { schemas: 'schemas', modes: 'modes', diary: 'diary' };

/** Вводная новичку («откуда это и зачем») с одним главным действием — тот же лист-герой, что у
 *  «Паттерна недели»: бумага сущности шага и её знак крупно, кнопка — в листе. */
export function PatternsIntro({ step, testProgress, onAction }: Props) {
  const tr = useTr();
  const intro = step === 'schemas' ? schemaIntro(tr) : step === 'modes' ? modeIntro(tr) : null;
  const { title, sub } = intro ?? diaryIntro(tr);
  const button = step === 'schemas'
    ? (testProgress !== null ? `Продолжить тест (${testProgress} из 116) →` : 'Начать тест →')
    : step === 'modes' ? 'Начать знакомство →' : 'Открыть дневник →';
  return (
    <EntitySheet look={LOOK[step]} label={intro ? `${intro.label} · ${intro.chip}` : 'Дневник'} title={title} sub={sub} className="cs-intro">
      <button type="button" className="ds-btn cs-intro-btn" onClick={onAction}>{button}</button>
    </EntitySheet>
  );
}
