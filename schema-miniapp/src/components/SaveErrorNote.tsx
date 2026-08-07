import { useTr } from '../utils/addressForm';

// Общий баннер «не удалось сохранить» для дневниковых форм со свободным
// текстом (LetterToSelf, SafePlace) — правило «одна механика — один
// компонент»: раньше каждая форма рисовала свой инлайн-див с той же
// стилистикой, теперь один переиспользуемый примитив.
export function SaveErrorNote({ ty, vy }: { ty: string; vy: string }) {
  const tr = useTr();
  return (
    <div
      style={{ fontSize: 12, color: 'rgba(255,100,100,0.8)', marginBottom: 10 }}
    >
      {tr(ty, vy)}
    </div>
  );
}
