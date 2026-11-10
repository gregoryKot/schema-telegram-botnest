import { useTr } from '../../utils/addressForm';
import { EntitySheet } from '../../components/paper/EntitySheet';
import type { IntroStep } from './introStep';
import { INTRO_LOOK } from './patternsHero';
import { schemaIntro, modeIntro, diaryIntro } from '../../../../shared/src/pattern/weekPatternText';
interface Props {
  step: IntroStep;
  /** Отвеченных вопросов незаконченного теста (null — не начат). */
  testProgress: number | null;
  onAction: () => void;
}

/** Вводная новичку («откуда это и зачем») с одним главным действием — тот же лист-герой, что у
 *  «Паттерна недели»: бумага и знак шага (INTRO_LOOK: схемы — глина + слои, режимы — Критик, дневник)
 *  крупно, кнопка — в листе. */
export function PatternsIntro({ step, testProgress, onAction }: Props) {
  const tr = useTr();
  const intro = step === 'schemas' ? schemaIntro(tr) : step === 'modes' ? modeIntro(tr) : null;
  const { title, sub } = intro ?? diaryIntro(tr);
  const button = step === 'schemas'
    ? (testProgress !== null ? `Продолжить тест (${testProgress} из 116) →` : 'Начать тест →')
    : step === 'modes' ? 'Начать знакомство →' : 'Открыть дневник →';
  return (
    <EntitySheet look={INTRO_LOOK[step]} label={intro ? `${intro.label} · ${intro.chip}` : 'Дневник'} title={title} sub={sub} className="cs-intro cs-hero">
      <button type="button" className="ds-btn cs-intro-btn" onClick={onAction}>{button}</button>
    </EntitySheet>
  );
}
