// Ленивая обёртка кабинета терапевта (React.lazy + Suspense). Дерево
// TherapistClientSheet — ~300 КБ исходника (список клиентов, карточка
// клиента, заметки, концепт-карта, YSQ-история) и нужно ТОЛЬКО пользователю
// с ролью THERAPIST — подавляющее большинство пользователей мини-аппа его
// никогда не откроет, а до правки оно всё равно ехало в стартовый чанк
// (замер 2026-08-22: 1,26 МБ, 2,3 c до первого рендера на 3G).
import { lazy, Suspense } from 'react';
import type { ComponentProps } from 'react';
import type { TherapistClientSheet as TherapistClientSheetT } from './TherapistClientSheet';
import { ScreenSkeleton } from './Skeleton';

const RealTherapistClientSheet = lazy(() =>
  import('./TherapistClientSheet').then((m) => ({
    default: m.TherapistClientSheet,
  })),
);

export function LazyTherapistClientSheet(
  props: ComponentProps<typeof TherapistClientSheetT>,
) {
  return (
    <Suspense fallback={<ScreenSkeleton cards={3} />}>
      <RealTherapistClientSheet {...props} />
    </Suspense>
  );
}
