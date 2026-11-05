import { useTr } from '../../utils/addressForm';
import { Layers, Pebbles } from '../../components/art/PaperArt';
import { Cluster } from '../../components/art/PaperArtSigns';
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
  const { title, sub } = intro ?? diaryIntro(tr);
  const button = step === 'schemas'
    ? (testProgress !== null ? `Продолжить тест (${testProgress} из 116) →` : 'Начать тест →')
    : step === 'modes' ? 'Начать знакомство →' : 'Открыть дневник →';
  return (
    <div className="pp-block cs-intro">
      <div className="pp-hero"><div className="pp-hero-body">
          <div className="ds-label">{intro ? `${intro.label} · ${intro.chip}` : 'Дневник'}</div>
          <h3 className="pp-hero-title">{title}</h3>
          <p className="pp-hero-text">{sub}</p>
        </div>{step === 'schemas' ? <Layers size="hero" /> : step === 'modes' ? <Cluster size="hero" /> : <Pebbles size="hero" />}
      </div>
      <button className="ds-btn cs-test-btn" onClick={onAction}>{button}</button>
    </div>
  );
}
