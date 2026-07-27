import { Need } from '../../types';
import { SummaryDonut } from './SummaryDonut';
import { DayShareButton } from '../../share/DayShareButton';

// Нижняя сводка «день заполнен»: индекс дня + пончик, кнопка «Готово»,
// шэр карточки дня. Вынесено из TrackerOverlay.tsx (правило №10).
export function TrackerDoneSummary({
  avg,
  isBackfill,
  onDone,
  onClose,
  needs,
  ratings,
  date,
}: {
  avg: number;
  isBackfill: boolean;
  onDone?: () => void;
  onClose: () => void;
  needs: Need[];
  ratings: Record<string, number>;
  date?: string;
}) {
  return (
    <>
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 16,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              marginBottom: 4,
            }}
          >
            Индекс дня
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
            {avg.toFixed(1)}
            <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>/10</span>
          </div>
        </div>
        <SummaryDonut avg={avg} />
      </div>
      <button
        onClick={isBackfill ? (onDone ?? onClose) : onClose}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 16,
          border:
            '1px solid color-mix(in srgb, var(--accent-green) 25%, transparent)',
          background:
            'color-mix(in srgb, var(--accent-green) 12%, transparent)',
          color: 'var(--accent-green)',
          fontSize: 15,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Готово — сохранить всё ✓
      </button>
      <DayShareButton needs={needs} ratings={ratings} date={date} />
    </>
  );
}
