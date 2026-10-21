import { useTr } from '../utils/addressForm';

// Баннер «не удалось сохранить» — сайтовый аналог
// schema-miniapp/src/components/SaveErrorNote.tsx (вёрстка per-frontend).
// Отказ записи не должен уходить только в телеметрию: человек видит, что
// выбор остался лишь на этом устройстве.
export function SaveErrorNote({ ty, vy }: { ty: string; vy: string }) {
  const tr = useTr();
  return (
    <div className="ex2-err" role="alert">
      {tr(ty, vy)}
    </div>
  );
}
