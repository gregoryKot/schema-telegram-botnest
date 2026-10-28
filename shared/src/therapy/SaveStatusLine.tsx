// Строка статуса сохранения — одна на оба фронтенда (правило «одна механика —
// один компонент», issue #879 шаг A). Раньше каждый экран писал свою: вкладка
// концептуализации сайта гасила «✓ сохранено» через 2 с, холст карты режимов
// молчал об ошибке, мини-апп прятал дату в текст кнопки. Здесь статус не гаснет
// («✓ Сохранено в 14:07» висит, пока не начнётся новая правка), а ошибка —
// видимая, с кнопкой «Повторить». Тексты нейтральные: без обращения, без рода.
// Цвета — токены, общие для webapp и мини-аппа (`--accent-red`, `--text-faint`;
// `--err` есть только на сайте, поэтому его здесь нет).
import type { CSSProperties } from 'react';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface Props {
  status: SaveStatus;
  /** Момент последнего успешного сохранения; показывается как «в ЧЧ:ММ» (локальное время). */
  savedAt?: Date | string | null;
  onRetry?: () => void;
  className?: string;
  align?: 'left' | 'right';
}

/** «ЧЧ:ММ» в зоне читателя — момент времени показывается моментом (правило №25). */
export function formatSavedAt(savedAt?: Date | string | null): string | null {
  if (!savedAt) return null;
  const d = savedAt instanceof Date ? savedAt : new Date(savedAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/**
 * «в 14:07» сегодня, «21 окт., 14:07» в другой день: мини-апп открывает лист с
 * `updatedAt` недельной давности, и одно время читалось бы как «сегодня».
 */
export function savedAtLabel(
  savedAt?: Date | string | null,
  now: Date = new Date(),
): string | null {
  const time = formatSavedAt(savedAt);
  if (!time || !savedAt) return null;
  const d = savedAt instanceof Date ? savedAt : new Date(savedAt);
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `в ${time}`;
  const day = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return `${day}, ${time}`;
}

/** Текст строки по статусу. Чистая функция — её и проверяет тест. */
export function saveStatusText(
  status: SaveStatus,
  savedAt?: Date | string | null,
  now?: Date,
): string {
  switch (status) {
    case 'pending':
      return 'Изменения ещё не сохранены';
    case 'saving':
      return 'Сохраняю…';
    case 'error':
      return 'Не сохранилось';
    case 'saved': {
      const at = savedAtLabel(savedAt, now);
      return at ? `✓ Сохранено ${at}` : '✓ Сохранено';
    }
    case 'idle': {
      // Пустой span (не null): вёрстка не прыгает, когда статус появится.
      const at = savedAtLabel(savedAt, now);
      return at ? `✓ Сохранено ${at}` : '';
    }
  }
}

// Кнопка «Повторить» визуально — строка текста, но тап-цель ≥44 по высоте:
// отрицательные вертикальные поля компенсируют рост, как в hitboxStyle
// (shared/src/utils/hitbox.ts), ширина — по тексту.
const retryStyle: CSSProperties = {
  minHeight: 44,
  margin: '-12px 0',
  padding: '0 8px',
  border: 'none',
  background: 'transparent',
  color: 'var(--accent-red)',
  font: 'inherit',
  fontWeight: 600,
  textDecoration: 'underline',
  cursor: 'pointer',
};

export function SaveStatusLine({
  status,
  savedAt,
  onRetry,
  className,
  align = 'left',
}: Props) {
  const isError = status === 'error';
  return (
    <span
      className={className}
      // role="alert" сам по себе assertive — aria-live рядом с ним противоречил бы;
      // вежливое объявление нужно только для status.
      {...(isError
        ? { role: 'alert' }
        : { role: 'status', 'aria-live': 'polite' })}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        gap: 4,
        minHeight: 20,
        fontSize: 12,
        lineHeight: 1.4,
        color: isError ? 'var(--accent-red)' : 'var(--text-faint)',
      }}
    >
      <span>{saveStatusText(status, savedAt)}</span>
      {isError && onRetry && (
        <button type="button" onClick={onRetry} style={retryStyle}>
          Повторить
        </button>
      )}
    </span>
  );
}
