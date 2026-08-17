import { BottomSheet } from '../BottomSheet';
import { TherapyNote } from '../TherapyNote';
import { SheetIconHeader } from '../SheetIconHeader';
import { useTr } from '../../utils/addressForm';

interface SafePlaceData {
  text: string;
  savedAt: string;
}

interface Props {
  saved: SafePlaceData;
  justSaved: boolean;
  onClose: () => void;
  onEdit: () => void;
}

// Экран просмотра уже сохранённого безопасного места — вынесен из
// SafePlace.tsx (правило №10: файл на потолке храповика), единственный
// потребитель. Показывается только после подтверждённого сохранения на
// сервере (см. handleSave в SafePlace.tsx).
export function SafePlaceSavedView({
  saved,
  justSaved,
  onClose,
  onEdit,
}: Props) {
  const tr = useTr();
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <SheetIconHeader
          title="Моё безопасное место"
          subtitle={tr('Прочти — и почувствуй', 'Прочтите — и почувствуйте')}
        />

        <div
          style={{
            background:
              'color-mix(in srgb, var(--accent-green) 6%, transparent)',
            border:
              '1px solid color-mix(in srgb, var(--accent-green) 12%, transparent)',
            borderRadius: 16,
            padding: '16px',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 15,
              color: 'rgba(var(--fg-rgb),0.85)',
              lineHeight: 1.75,
              whiteSpace: 'pre-wrap',
            }}
          >
            {saved.text}
          </div>
        </div>

        <div
          style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          {justSaved ? '✓ Сохранено' : `Обновлено ${saved.savedAt}`}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button
            onClick={onEdit}
            style={{
              flex: 1,
              padding: '13px 0',
              borderRadius: 14,
              border: '1px solid rgba(var(--fg-rgb),0.1)',
              background: 'transparent',
              color: 'var(--text-sub)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Изменить
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '13px 0',
              borderRadius: 14,
              border: 'none',
              background:
                'color-mix(in srgb, var(--accent-green) 15%, transparent)',
              color: 'var(--accent-green)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Готово
          </button>
        </div>

        <TherapyNote compact />
      </div>
    </BottomSheet>
  );
}
