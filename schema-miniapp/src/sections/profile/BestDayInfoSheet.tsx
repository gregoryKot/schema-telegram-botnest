import { InfoSheetShell } from '../../components/InfoSheetShell';
import { useTr } from '../../utils/addressForm';

interface BestDayInfoSheetProps {
  onClose: () => void;
}

export function BestDayInfoSheet({ onClose }: BestDayInfoSheetProps) {
  const tr = useTr();
  return (
    <InfoSheetShell title="Лучший день" onClose={onClose}>
      <p
        style={{
          fontSize: 15,
          color: 'rgba(var(--fg-rgb),0.8)',
          lineHeight: 1.7,
          marginBottom: 14,
        }}
      >
        {tr(
          'День недели, в который твои оценки в среднем выше всего.',
          'День недели, в который ваши оценки в среднем выше всего.',
        )}
      </p>
      <p
        style={{
          fontSize: 15,
          color: 'rgba(var(--fg-rgb),0.8)',
          lineHeight: 1.7,
        }}
      >
        Становится точнее с каждой неделей.
      </p>
    </InfoSheetShell>
  );
}
