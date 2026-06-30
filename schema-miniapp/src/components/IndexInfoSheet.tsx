import { BottomSheet } from './BottomSheet';
import { SectionLabel } from './SectionLabel';

const PARAGRAPHS = [
  'Индекс — это не цель. Нет задачи достичь 10 или не опускаться ниже 7.',
  'Потребности не работают как светофор. Они меняются — в зависимости от того, что происходит, с кем ты, насколько выспался.',
  'День на 5–6, прожитый осознанно, ценнее дня на 9, прожитого на автопилоте. Дневник нужен не чтобы улучшить показатели — а чтобы лучше видеть себя.',
  'Паттерн начинает читаться через 3–5 дней. Чем регулярнее — тем точнее картина.',
];

export function IndexInfoSheet({ onClose }: { onClose: () => void }) {
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 8 }}>
        <SectionLabel purple mb={16}>Об индексе дня</SectionLabel>
        {PARAGRAPHS.map((p, i) => (
          <p key={i} style={{ fontSize: 15, color: 'rgba(var(--fg-rgb),0.8)', lineHeight: 1.7, marginBottom: 14 }}>
            {p}
          </p>
        ))}
      </div>
    </BottomSheet>
  );
}
