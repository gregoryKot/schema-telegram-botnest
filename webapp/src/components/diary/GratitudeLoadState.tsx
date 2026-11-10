import { Skeleton } from '../Skeleton';
import { PaperAlert } from '../paper/PaperAlert';
import type { GratitudeLoadStatus } from '../../../../shared/src/diary/useGratitudeItems';

/** Силуэт тетради — три строки с номером, — пока грузится сохранённый день, и сбой строкой
 * (PaperAlert) с «Повторить». Инцидент 2026-10-18: в пустую форму печатать нельзя, а сохранять
 * пустую поверх возможной записи — значит затереть её. */
export function GratitudeLoadState({
  status,
  onRetry,
}: {
  status: GratitudeLoadStatus;
  onRetry: () => void;
}) {
  if (status === 'loading') {
    return (
      <div className="pa-field sd-grat-sheet" aria-busy="true" aria-label="Загружаю сегодняшние записи">
        {[72, 58, 64].map((w, i) => (
          <div key={i} className="sd-grat-row sd-grat-row--skel">
            <Skeleton width={30} height={24} radius={6} />
            <Skeleton width={`${w}%`} height={16} />
          </div>
        ))}
      </div>
    );
  }
  if (status === 'error') {
    return (
      <PaperAlert
        sign="pebbles"
        title="Не получилось загрузить записи за сегодня."
        text="Пока они не загрузились, сохранять нельзя: новая запись заменила бы прежние."
        onRetry={onRetry}
      />
    );
  }
  return null;
}
