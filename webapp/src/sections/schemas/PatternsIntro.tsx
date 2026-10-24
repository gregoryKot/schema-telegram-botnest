import { useTr } from '../../utils/addressForm';
import type { IntroStep } from './introStep';
import { schemaIntro, modeIntro, diaryIntro } from '../../../../shared/src/pattern/weekPatternText';

interface Props {
  step: IntroStep;
  /** Отвеченных вопросов незаконченного теста (null — не начат). */
  testProgress: number | null;
  onAction: () => void;
}

/** Вводная новичку («откуда это и зачем») с одним главным действием. */
export function PatternsIntro({ step, testProgress, onAction }: Props) {
  const tr = useTr();
  const intro = step === 'schemas' ? schemaIntro(tr) : step === 'modes' ? modeIntro(tr) : null;
  const diary = diaryIntro(tr);
  const title = intro?.title ?? diary.title;
  const sub = intro?.sub ?? diary.sub;
  const button = step === 'schemas'
    ? (testProgress !== null ? `Продолжить тест (${testProgress} из 116) →` : 'Начать тест →')
    : step === 'modes' ? 'Начать знакомство →' : 'Открыть дневник →';
  return (
    <div className="ds-card ds-card--ink cs-intro">
      <div>
        <div className="ds-label cs-test-label">{intro ? `${intro.label} · ${intro.chip}` : 'Дневник'}</div>
        <h3 className="cs-intro-title">{title}</h3>
        <p className="cs-intro-text">{sub}</p>
      </div>
      <button className="ds-btn cs-test-btn" onClick={onAction}>{button}</button>
    </div>
  );
}
