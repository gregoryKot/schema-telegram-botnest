import { ExScreen, GlyphArrowRight } from '../ExScreen';
import { useTr } from '../../../utils/addressForm';
import { exerciseCard } from '../../../../../shared/src/exercises/exerciseCatalog';
import '../../../styles/sheet-childhood.css';

/**
 * Вступление перед первым прохождением: откуда упражнение и зачем оно
 * (правило «откуда и зачем» до первого действия), главное действие одно.
 */
export function ChildhoodIntro({
  title,
  onBack,
  onStart,
}: {
  title: React.ReactNode;
  onBack: () => void;
  onStart: () => void;
}) {
  const tr = useTr();
  return (
    <ExScreen
      onBack={onBack}
      eyebrow={exerciseCard('wheel').eyebrow}
      title={title}
      lede="Те же пять потребностей – но про детство."
    >
      <div className="ds-card chw-intro">
        <p className="chw-intro-body">
          В схема-терапии считается, что схемы формируются, когда базовые потребности{' '}
          <b>систематически не удовлетворялись в детстве</b>. Это упражнение поможет увидеть,
          какие области могут быть особенно чувствительными – и почему дневник сегодня
          показывает то, что показывает.
        </p>
      </div>
      <div className="ds-card chw-intro">
        <p className="chw-intro-small">
          Это не диагностика – оценки приблизительны и субъективны. Результаты{' '}
          {tr('для твоего понимания', 'для вашего понимания')}, не для выводов.
        </p>
      </div>
      <div className="ex2-foot">
        <button type="button" className="ds-btn ds-btn--secondary" onClick={onBack}>
          Пропустить
        </button>
        <span className="ex2-spacer" />
        <button type="button" className="ds-btn" onClick={onStart}>
          Оценить детство – {exerciseCard('wheel').time} <GlyphArrowRight />
        </button>
      </div>
    </ExScreen>
  );
}
