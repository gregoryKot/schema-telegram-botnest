import type { CSSProperties } from 'react';
import type { IntroSheetQuestion } from './IntroSheetFlashcard';

// Итог сохранения карточки схемы/режима. Раньше «Сохранить карточку» меняла
// подпись кнопки на 1.8 секунды и всё — пользователь читал это как «ничего не
// произошло». Теперь после сохранения виден результат и сказано, где карточка
// лежит (как в дневнике: экран «Запись сохранена» с кнопкой «Готово»).
// Тексты безличные — форма обращения не нужна (правило ты/вы в CLAUDE.md).
interface Props<T extends Record<string, string>> {
  questions: IntroSheetQuestion<T>[];
  data: T;
  accentColor: string;
  /** Где искать карточку потом — честная подсказка от конкретного шита. */
  savedHint: string;
  onEdit: () => void;
  onClose: () => void;
}

const BUTTON: CSSProperties = {
  width: '100%',
  padding: '13px 0',
  borderRadius: 14,
  border: 'none',
  fontFamily: 'inherit',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};

export function IntroSheetDone<T extends Record<string, string>>({
  questions,
  data,
  accentColor,
  savedHint,
  onEdit,
  onClose,
}: Props<T>) {
  const filled = questions.filter((q) => data[q.key]?.trim());

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 46, marginBottom: 8 }}>🌿</div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 6,
          }}
        >
          Карточка сохранена
        </div>
        <div
          style={{ fontSize: 13.5, color: 'var(--text-sub)', lineHeight: 1.6 }}
        >
          {savedHint}
        </div>
      </div>

      {filled.map((q) => (
        <div key={String(q.key)} style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: accentColor,
              marginBottom: 4,
            }}
          >
            {q.label}
          </div>
          <div
            style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.55 }}
          >
            {data[q.key]}
          </div>
        </div>
      ))}

      <button
        onClick={onClose}
        style={{ ...BUTTON, marginTop: 8, background: accentColor, color: '#fff' }}
      >
        Готово
      </button>
      <button
        onClick={onEdit}
        style={{
          ...BUTTON,
          marginTop: 8,
          marginBottom: 16,
          background: 'rgba(var(--fg-rgb),0.08)',
          color: 'var(--text)',
        }}
      >
        Дополнить карточку
      </button>
    </div>
  );
}
