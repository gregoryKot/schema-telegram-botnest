import { DAY_INDEX_DEFINITION } from '../../../shared/src/onboarding/onboardingExplainers';
import { ExScreen } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { glue } from '../../../shared/src/utils/typo';
import '../styles/sheet-tracker.css';
const PARAGRAPHS = [
  DAY_INDEX_DEFINITION,
  'Индекс не ставит цели: нет задачи достичь 10 или не опускаться ниже 7.',
  'Потребности не работают как светофор. Они меняются – в зависимости от того, что происходит, кто рядом, насколько получилось выспаться.',
  'День на 5–6, прожитый осознанно, ценнее дня на 9, прожитого на автопилоте. Дневник нужен не чтобы улучшить показатели – а чтобы лучше видеть себя.',
  'Паттерн начинает читаться через 3–5 дней. Чем регулярнее – тем точнее картина.',
];
// Шапка — лист трекера (ExScreen look), пункты — список с номером Literata, без карточек (b07).
export function IndexInfoSheet({ onClose }: { onClose: () => void }) {
  const goBack = useHistorySheet(onClose);
  return (
    <ExScreen
      onBack={goBack} backLabel="Назад"
      look="tracker"
      eyebrow="Трекер"
      title={<>Об индексе <span>дня</span></>}
      lede="Что означают цифры и как ими пользоваться."
    >
      <ol className="tk2-info">
        {PARAGRAPHS.map((p, i) => (
          <li key={i} className="tk2-info-li">
            <span className="tk2-info-n" aria-hidden="true">{i + 1}</span>
            <p className="tk2-para">{glue(p)}</p>
          </li>
        ))}
      </ol>
    </ExScreen>
  );
}
