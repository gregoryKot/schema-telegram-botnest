import { DAY_INDEX_DEFINITION } from '../../../shared/src/onboarding/onboardingExplainers';
import { ExScreen } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import '../styles/sheet-tracker.css';
const PARAGRAPHS = [
  DAY_INDEX_DEFINITION,
  'Индекс не ставит цели: нет задачи достичь 10 или не опускаться ниже 7.',
  'Потребности не работают как светофор. Они меняются – в зависимости от того, что происходит, кто рядом, насколько получилось выспаться.',
  'День на 5–6, прожитый осознанно, ценнее дня на 9, прожитого на автопилоте. Дневник нужен не чтобы улучшить показатели – а чтобы лучше видеть себя.',
  'Паттерн начинает читаться через 3–5 дней. Чем регулярнее – тем точнее картина.',
];

export function IndexInfoSheet({ onClose }: { onClose: () => void }) {
  const goBack = useHistorySheet(onClose);
  return (
    <ExScreen
      onBack={goBack} backLabel="Назад"
      eyebrow="Трекер" eyebrowColor="var(--accent)"
      title={<>Об индексе<br /><span className="it">дня</span></>}
      lede="Что означают цифры и как ими пользоваться."
    >
      {PARAGRAPHS.map((p, i) => (
        <div key={i} className="ds-card ds-card--row tk2-info">
          <span className="ds-num tk2-info-n">{i + 1}.</span>
          <p className="tk2-para">{p}</p>
        </div>
      ))}
    </ExScreen>
  );
}
