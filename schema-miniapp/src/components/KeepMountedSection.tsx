import { useRef, type ReactNode } from 'react';

// Однажды открытая вкладка остаётся смонтированной и прячется display:none —
// возврат к ней это переключение видимости (~1 кадр), а не перемонтирование.
//
// Родилось из замера 2026-08-24 (CPU 6x, профиль телефона): каждый тап по
// вкладке размонтировал старую секцию и строил новую с нуля — ~100мс мёртвого
// времени + мигание скелетоном + повторный тяжёлый коммит, на каждом
// переключении, даже «тёплом» (жалоба владельца «стало хуже»: скелетон-кадр
// из #422 моргал при каждом тапе). Скелетон остаётся только там, где ему
// место — при ПЕРВОМ открытии вкладки (LazySections.useFirstPaintDone теперь
// срабатывает один раз за сессию: маунт один).
//
// Цена: эффекты скрытой вкладки продолжают жить (refreshKey-рефетчи проходят
// фоном — данные свежи к возврату), а ленивые по вьюпорту куски (HeatmapCard
// через IntersectionObserver) в display:none не грузятся — и не должны.
export function KeepMountedSection({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const wasActive = useRef(false);
  if (active) wasActive.current = true;
  if (!wasActive.current) return null;
  return (
    <div style={active ? undefined : { display: 'none' }} hidden={!active}>
      {children}
    </div>
  );
}
