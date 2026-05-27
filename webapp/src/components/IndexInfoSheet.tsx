import { ExScreen } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';

const PARAGRAPHS = [
  'Индекс — это не цель. Нет задачи достичь 10 или не опускаться ниже 7.',
  'Потребности не работают как светофор. Они меняются — в зависимости от того, что происходит, с кем ты, насколько выспался.',
  'День на 5–6, прожитый осознанно, ценнее дня на 9, прожитого на автопилоте. Дневник нужен не чтобы улучшить показатели — а чтобы лучше видеть себя.',
  'Паттерн начинает читаться через 3–5 дней. Чем регулярнее — тем точнее картина.',
];

export function IndexInfoSheet({ onClose }: { onClose: () => void }) {
  const goBack = useHistorySheet(onClose);
  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад"
      eyebrow="Трекер"
      eyebrowColor="var(--accent)"
      title={<>Об индексе<br /><span className="it">дня</span></>}
      lede="Что означают цифры и как ими пользоваться."
    >
      {PARAGRAPHS.map((p, i) => (
        <div key={i} className="prompt">
          <div className="prompt-num">{i + 1}.</div>
          <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.75, margin: 0 }}>{p}</p>
        </div>
      ))}
    </ExScreen>
  );
}
