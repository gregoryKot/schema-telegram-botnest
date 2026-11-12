import { ExScreen, GlyphArrowRight } from '../ExScreen';
import { TherapyCaution } from '../../therapy/TherapyCaution';
import { useTr } from '../../../utils/addressForm';
import { SceneChildhood } from '../../art/LandingScenes';
import { exerciseCard } from '../../../../../shared/src/exercises/exerciseCatalog';
import '../../../styles/sheet-childhood.css';

/**
 * Вступление перед первым прохождением: откуда упражнение и зачем (правило «откуда и зачем» до первого
 * действия), главное действие одно. Герой — лист персика со сценой лендинга (одной полоски не хватило),
 * объяснение — текстом на странице, «Пропустить» — тихой ссылкой, «самопомощь» — наклейкой под кнопкой.
 */
export function ChildhoodIntro({ title, onBack, onStart }: { title: React.ReactNode; onBack: () => void; onStart: () => void }) {
  const tr = useTr();
  const card = exerciseCard('wheel');
  return (
    <ExScreen
      onBack={onBack} spread look="childhood_wheel" heroArt={<span className="chw-scene chw-scene--hero"><SceneChildhood /></span>}
      eyebrow={card.eyebrow} title={title} lede="Те же пять потребностей – но про детство."
    >
      <p className="chw-intro-body">
        В схема-терапии считается, что схемы формируются, когда базовые потребности{' '}
        <b>систематически не удовлетворялись в детстве</b>. Это упражнение поможет увидеть,
        какие области могут быть особенно чувствительными – и почему дневник сегодня
        показывает то, что показывает.
      </p>
      <p className="chw-intro-small">
        Это не диагностика – оценки приблизительны и субъективны. Результаты{' '}
        {tr('для твоего понимания', 'для вашего понимания')}, не для выводов.
      </p>
      <div className="chw-actions">
        <button type="button" className="ds-btn ds-btn--lg" onClick={onStart}>
          Оценить детство – {card.time} <GlyphArrowRight />
        </button>
        <button type="button" className="ds-link pa-quiet" onClick={onBack}>Пропустить</button>
      </div>
      <TherapyCaution place="test_start" compact />
    </ExScreen>
  );
}
