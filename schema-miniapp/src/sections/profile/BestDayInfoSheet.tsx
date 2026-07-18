import { BottomSheet } from '../../components/BottomSheet';
import { useTr } from '../../utils/addressForm';

interface Props {
  onClose: () => void;
}

export function BestDayInfoSheet({ onClose }: Props) {
  const tr = useTr();
  return (
    <BottomSheet onClose={onClose} zIndex={300}>
      <div style={{ paddingTop: 8 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            marginBottom: 16,
          }}
        >
          Лучший день
        </div>
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
      </div>
    </BottomSheet>
  );
}
