import { pressable } from '../../utils/a11y';

interface Letter {
  id: string | number;
  date: string;
  text: string;
}

// Список прошлых писем — вынесен из LetterToSelf.tsx (правило №10: файл на
// потолке храповика), единственный потребитель.
export function PastLetters({
  letters,
  onView,
}: {
  letters: Letter[];
  onView: (l: Letter) => void;
}) {
  if (letters.length === 0) return null;
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          marginBottom: 10,
        }}
      >
        Прошлые письма
      </div>
      {letters.slice(0, 5).map((l) => (
        <div
          key={l.id}
          {...pressable(() => onView(l))}
          style={{
            padding: '11px 14px',
            background: 'rgba(var(--fg-rgb),0.03)',
            border: '1px solid rgba(var(--fg-rgb),0.06)',
            borderRadius: 12,
            marginBottom: 7,
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              marginBottom: 4,
            }}
          >
            {l.date}
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-sub)',
              lineHeight: 1.4,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {l.text}
          </div>
        </div>
      ))}
    </div>
  );
}
