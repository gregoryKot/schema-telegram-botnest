// Шторка «Помощь рядом» экрана «Здесь и сейчас». Вынесена из HelpSection.tsx
// (правило №10 — секция в долге по размеру, вёрстке там не место).
// Текст и поведение не менялись.
import { BottomSheet } from '../../components/BottomSheet';
import { CrisisCard } from '../../components/CrisisCard';

export function CrisisSheet({ onClose }: { onClose: () => void }) {
  return (
    <BottomSheet onClose={onClose} zIndex={200}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: 'var(--text)',
            marginBottom: 4,
          }}
        >
          Помощь рядом
        </div>
        <CrisisCard />
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-sub)',
            lineHeight: 1.6,
            marginTop: 4,
          }}
        >
          Если есть угроза жизни — 112. Разговор с близким человеком тоже
          считается: иногда одно сообщение «мне плохо» — уже первый шаг.
        </div>
      </div>
    </BottomSheet>
  );
}
