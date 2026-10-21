import { Skeleton } from '../Skeleton';
import type { GratitudeLoadStatus } from '../../../../shared/src/diary/useGratitudeItems';

/** Силуэт трёх строк, пока грузится сохранённый день, и ошибка с «Повторить»
 * при сбое. Инцидент 2026-10-18: в пустую форму печатать нельзя, а сохранять
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
      <div
        aria-busy="true"
        aria-label="Загружаю сегодняшние записи"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-12)',
        }}
      >
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={64} radius={16} />
        ))}
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div role="alert" className="sd-save-error">
        Не получилось загрузить записи за сегодня. Пока они не загрузились,
        сохранять нельзя: новая запись заменила бы прежние.
        <div>
          <button
            className="ds-btn ds-btn--secondary ds-btn--sm"
            onClick={onRetry}
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }
  return null;
}
